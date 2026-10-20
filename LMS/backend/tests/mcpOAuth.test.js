const test = require('node:test');
const assert = require('node:assert');

process.env.JWT_SECRET = 'test-secret-for-mcp-oauth-tests-only';
process.env.PUBLIC_BASE_URL = 'https://lms.example.com';
process.env.AI_SECRET_ENCRYPTION_KEY = require('node:crypto').randomBytes(32).toString('base64');

const {
    SCOPES,
    createPkcePair,
    verifyPkce,
    negotiateScopes,
    effectiveScopes,
    hasScope,
    mintAccessToken,
    verifyAccessToken,
    mintConsentIntent,
    verifyConsentIntent,
    hashOpaque,
    safeEqual,
    resourceUri,
} = require('../utils/mcpOAuth');

// ─── PKCE ────────────────────────────────────────────────────────────────────

test('PKCE round-trips with S256', () => {
    const { verifier, challenge, method } = createPkcePair();
    assert.strictEqual(verifyPkce({ challenge, method, verifier }).ok, true);
});

test('PKCE rejects the wrong verifier', () => {
    const { verifier, challenge, method } = createPkcePair();
    const other = createPkcePair();
    const result = verifyPkce({ challenge, method, verifier: other.verifier });
    assert.strictEqual(result.ok, false);
    assert.strictEqual(result.error, 'invalid_grant');
});

test('PKCE refuses the plain method outright', () => {
    // "plain" offers no protection against an attacker who can see the
    // authorization request, so supporting it is a downgrade, not a feature.
    const { verifier } = createPkcePair();
    const result = verifyPkce({ challenge: verifier, method: 'plain', verifier });
    assert.strictEqual(result.ok, false);
    assert.match(result.detail, /S256/);
});

test('PKCE rejects malformed verifiers', () => {
    for (const v of ['', 'short', 'x'.repeat(200), undefined, null]) {
        assert.strictEqual(verifyPkce({ challenge: 'x', method: 'S256', verifier: v }).ok, false, `expected ${v} rejected`);
    }
});

// ─── Scopes ──────────────────────────────────────────────────────────────────

test('scope negotiation caps grants at the client ceiling', () => {
    const result = negotiateScopes(
        `${SCOPES.READ} ${SCOPES.DRAFT} ${SCOPES.WRITE}`,
        [SCOPES.READ, SCOPES.DRAFT]
    );
    assert.strictEqual(result.ok, true);
    assert.deepStrictEqual(result.scopes, [SCOPES.READ, SCOPES.DRAFT]);
    assert.ok(!result.scopes.includes(SCOPES.WRITE), 'must not grant write when not allowed');
});

test('scope negotiation rejects unknown scopes instead of ignoring them', () => {
    const result = negotiateScopes(`${SCOPES.READ} mcp:admin`, ALL_SCOPE_LIST());
    assert.strictEqual(result.ok, false);
    assert.strictEqual(result.error, 'invalid_scope');
    assert.match(result.detail, /mcp:admin/);
});

function ALL_SCOPE_LIST() {
    return [SCOPES.READ, SCOPES.DRAFT, SCOPES.WRITE];
}

test('scope negotiation rejects an entirely disallowed request', () => {
    const result = negotiateScopes(SCOPES.WRITE, [SCOPES.READ]);
    assert.strictEqual(result.ok, false);
    assert.strictEqual(result.error, 'invalid_scope');
});

test('higher scopes imply lower ones', () => {
    assert.ok(hasScope([SCOPES.WRITE], SCOPES.READ));
    assert.ok(hasScope([SCOPES.WRITE], SCOPES.DRAFT));
    assert.ok(hasScope([SCOPES.DRAFT], SCOPES.READ));
    assert.ok(!hasScope([SCOPES.READ], SCOPES.WRITE));
    assert.ok(!hasScope([SCOPES.READ], SCOPES.DRAFT));
    assert.deepStrictEqual(effectiveScopes([SCOPES.WRITE]).sort(), [SCOPES.DRAFT, SCOPES.READ, SCOPES.WRITE].sort());
});

// ─── Access tokens and audience binding ──────────────────────────────────────

test('access token verifies for its own audience', () => {
    const token = mintAccessToken({
        userId: '507f1f77bcf86cd799439011',
        clientId: 'https://claude.ai',
        scope: `${SCOPES.READ} ${SCOPES.DRAFT}`,
    });
    const result = verifyAccessToken(token);
    assert.strictEqual(result.ok, true);
    assert.strictEqual(result.claims.userId, '507f1f77bcf86cd799439011');
    assert.strictEqual(result.claims.clientId, 'https://claude.ai');
    assert.deepStrictEqual(result.claims.scopes.sort(), [SCOPES.DRAFT, SCOPES.READ].sort());
});

test('a token minted for another resource is rejected here', () => {
    // The core audience-binding control: a token this server issued for a
    // different resource must not be accepted by this one.
    const foreign = mintAccessToken({
        userId: '507f1f77bcf86cd799439011',
        clientId: 'https://evil.example',
        scope: SCOPES.READ,
        resource: 'https://other.example.com/mcp',
    });
    const result = verifyAccessToken(foreign);
    assert.strictEqual(result.ok, false);
    assert.strictEqual(result.code, 'invalid_token');
    assert.match(result.detail, /audience/);
});

test('an ordinary app session JWT is not accepted as an MCP token', () => {
    // Stops a stolen /api/auth token from being replayed at /mcp, which has a
    // different (larger) tool surface.
    const jwt = require('jsonwebtoken');
    const appToken = jwt.sign({ id: '507f1f77bcf86cd799439011' }, process.env.JWT_SECRET, {
        expiresIn: '1h',
    });
    assert.strictEqual(verifyAccessToken(appToken).ok, false);

    // Even one that forges the right issuer still fails, on the token type: the
    // `typ` claim is what separates MCP tokens from app session tokens.
    const forger = jwt.sign(
        { id: '507f1f77bcf86cd799439011', scope: SCOPES.WRITE },
        process.env.JWT_SECRET,
        { issuer: require('../utils/mcpOAuth').issuerUri(), expiresIn: '1h' }
    );
    const result = verifyAccessToken(forger);
    assert.strictEqual(result.ok, false);
    assert.match(result.detail, /Not an MCP access token/);
});

test('tampered and unsigned tokens are rejected', () => {
    const token = mintAccessToken({ userId: 'u', clientId: 'c', scope: SCOPES.READ });
    const [h, p, s] = token.split('.');
    const forgedPayload = Buffer.from(
        JSON.stringify({ ...JSON.parse(Buffer.from(p, 'base64url')), scope: SCOPES.WRITE })
    ).toString('base64url');
    assert.strictEqual(verifyAccessToken(`${h}.${forgedPayload}.${s}`).ok, false);
    assert.strictEqual(verifyAccessToken('not.a.jwt').ok, false);
    assert.strictEqual(verifyAccessToken('').ok, false);

    // alg:none must never be honoured.
    const jwt = require('jsonwebtoken');
    const noneHeader = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
    const nonePayload = Buffer.from(
        JSON.stringify({
            sub: 'attacker', typ: 'mcp_access', aud: resourceUri(),
            scope: SCOPES.WRITE, iss: require('../utils/mcpOAuth').issuerUri(),
        })
    ).toString('base64url');
    assert.strictEqual(verifyAccessToken(`${noneHeader}.${nonePayload}.`).ok, false);
});

// ─── Consent intents ─────────────────────────────────────────────────────────

test('consent intent carries the user and is single-purpose', () => {
    const intent = mintConsentIntent({
        userId: '507f1f77bcf86cd799439011',
        clientId: 'https://claude.ai',
        maxScopes: [SCOPES.READ],
    });
    const parsed = verifyConsentIntent(intent);
    assert.strictEqual(parsed.userId, '507f1f77bcf86cd799439011');
    assert.strictEqual(parsed.clientId, 'https://claude.ai');
    assert.deepStrictEqual(parsed.scopes, [SCOPES.READ]);
});

test('a tampered consent intent is rejected', () => {
    const intent = mintConsentIntent({ userId: 'u1', clientId: 'c', maxScopes: [] });
    const [h, p, s] = intent.split('.');
    const swapped = Buffer.from(
        JSON.stringify({ ...JSON.parse(Buffer.from(p, 'base64url')), sub: 'someone-else' })
    ).toString('base64url');
    assert.strictEqual(verifyConsentIntent(`${h}.${swapped}.${s}`), null);
    assert.strictEqual(verifyConsentIntent('garbage'), null);
    assert.strictEqual(verifyConsentIntent(''), null);
});

// ─── Misc primitives ─────────────────────────────────────────────────────────

test('opaque secrets hash deterministically and compare safely', () => {
    assert.strictEqual(hashOpaque('abc'), hashOpaque('abc'));
    assert.notStrictEqual(hashOpaque('abc'), hashOpaque('abd'));
    assert.strictEqual(safeEqual('s3cret', 's3cret'), true);
    assert.strictEqual(safeEqual('s3cret', 's3crey'), false);
    assert.strictEqual(safeEqual('short', 'much-longer'), false);
    assert.strictEqual(safeEqual('', ''), false);
    assert.strictEqual(safeEqual(undefined, 'x'), false);
});

test('resource URI is absolute and derived from the public base URL', () => {
    assert.strictEqual(resourceUri(), 'https://lms.example.com/mcp');
});
