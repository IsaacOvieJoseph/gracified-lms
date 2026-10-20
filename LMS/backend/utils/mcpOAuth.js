// ─── MCP OAuth 2.1 primitives ─────────────────────────────────────────────────
// Shared by the authorization server (routes/mcpOAuth.js) and the resource
// server (middleware/mcpAuth.js).
//
// Three properties are load-bearing and easy to get wrong:
//
// 1. *PKCE is mandatory, S256 only.* `plain` exists in the spec and is not safe
//    against an attacker who can observe the authorization request, so it is
//    rejected outright rather than supported for compatibility.
//
// 2. *Tokens are audience-bound.* Access tokens carry `aud` = this server's
//    canonical resource URI and are verified against it. Without that check a
//    token minted here would be replayable at any other resource server the
//    user authorised, and conversely a stolen token from elsewhere would be
//    accepted here.
//
// 3. *Granted scope == consented scope.* The token endpoint never grants the
//    scope string the client asked for; it grants what was shown on the consent
//    screen. Otherwise a client could request narrow scopes, get consent, then
//    exchange for a broader grant.

const crypto = require('crypto');
const jwt = require('jsonwebtoken');

const ACCESS_TOKEN_TTL_SECONDS = 60 * 60; // 1 hour
const REFRESH_TOKEN_TTL_SECONDS = 30 * 24 * 60 * 60; // 30 days
const AUTH_CODE_TTL_MS = 10 * 60 * 1000;
const CONSENT_INTENT_TTL_SECONDS = 10 * 60;

// Scope vocabulary. Kept coarse and few: every scope here is a meaningful
// capability grant shown to the user verbatim on the consent screen.
const SCOPES = {
    READ: 'mcp:read',
    DRAFT: 'mcp:draft',
    WRITE: 'mcp:write',
};

const ALL_SCOPES = Object.values(SCOPES);

const SCOPE_DESCRIPTIONS = {
    [SCOPES.READ]: 'Read your classes, topics, assignments and progress.',
    [SCOPES.DRAFT]: 'Draft study material and teaching content using AI.',
    [SCOPES.WRITE]: 'Create and update content in your classes.',
};

const DEFAULT_SCOPES = [SCOPES.READ, SCOPES.DRAFT];

const b64url = (buf) => Buffer.from(buf).toString('base64url');

const sha256 = (value) => crypto.createHash('sha256').update(value).digest('base64url');
const sha256Hex = (value) => crypto.createHash('sha256').update(value).digest('hex');

const getJwtSecret = () => {
    const secret = process.env.JWT_SECRET;
    if (!secret) throw new Error('JWT_SECRET is not configured');
    return secret;
};

/**
 * Canonical identifier for this MCP server, used as the `aud` of access tokens
 * and as the RFC 8707 `resource` parameter. Must be an absolute URL that the
 * authorization server advertises as its resource, and clients must request it.
 */
const resourceUri = () => {
    if (process.env.MCP_RESOURCE_URL) return process.env.MCP_RESOURCE_URL;
    const base =
        process.env.PUBLIC_BASE_URL ||
        process.env.BASE_URL ||
        'http://localhost:5000';
    return `${String(base).replace(/\/+$/, '')}/mcp`;
};

const issuerUri = () => {
    const base =
        process.env.PUBLIC_BASE_URL ||
        process.env.BASE_URL ||
        'http://localhost:5000';
    return `${String(base).replace(/\/+$/, '')}/api/mcp/oauth`;
};

// ─── PKCE ────────────────────────────────────────────────────────────────────

const createPkcePair = () => {
    const verifier = b64url(crypto.randomBytes(48)); // 43-128 chars per RFC 7636
    return { verifier, challenge: sha256(verifier), method: 'S256' };
};

/**
 * Verify a PKCE challenge. Uses a timing-safe compare so a mismatching
 * challenge cannot be recovered by measuring response times.
 */
const verifyPkce = ({ challenge, method, verifier }) => {
    if (method !== 'S256') {
        return { ok: false, error: 'invalid_request', detail: 'code_challenge_method must be S256' };
    }
    if (typeof verifier !== 'string' || verifier.length < 43 || verifier.length > 128) {
        return { ok: false, error: 'invalid_grant', detail: 'code_verifier is malformed' };
    }
    const expected = sha256(verifier);
    const a = Buffer.from(expected);
    const b = Buffer.from(String(challenge || ''));
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
        return { ok: false, error: 'invalid_grant', detail: 'PKCE verification failed' };
    }
    return { ok: true };
};

// ─── Scopes ──────────────────────────────────────────────────────────────────

/**
 * Reduce a requested scope string to what this client is actually allowed, and
 * reject unknown scopes rather than ignoring them: silently dropping a scope the
 * client asked for would hide a misconfigured or overreaching client.
 */
const negotiateScopes = (requested, allowed) => {
    const asked = String(requested || '')
        .split(/[\s+]+/)
        .map((s) => s.trim())
        .filter(Boolean);

    const unknown = asked.filter((s) => !ALL_SCOPES.includes(s));
    if (unknown.length) {
        return {
            ok: false,
            error: 'invalid_scope',
            detail: `Unsupported scope(s): ${unknown.join(', ')}`,
        };
    }

    const ceiling = allowed && allowed.length ? allowed : DEFAULT_SCOPES;
    const granted = asked.filter((s) => ceiling.includes(s));

    if (!granted.length) {
        return {
            ok: false,
            error: 'invalid_scope',
            detail: 'None of the requested scopes are permitted for this client',
        };
    }
    return { ok: true, scopes: granted };
};

/** Scopes implied by holding a higher one, so a client granted `write` can also read. */
const effectiveScopes = (granted) => {
    const set = new Set(granted);
    if (set.has(SCOPES.WRITE)) set.add(SCOPES.DRAFT);
    if (set.has(SCOPES.DRAFT) || set.has(SCOPES.WRITE)) set.add(SCOPES.READ);
    return [...set];
};

const hasScope = (granted, required) => effectiveScopes(granted).includes(required);

// ─── Access tokens ───────────────────────────────────────────────────────────

const mintAccessToken = ({ userId, clientId, scope, resource, family }) => {
    const aud = resource || resourceUri();
    return jwt.sign(
        {
            sub: String(userId),
            client_id: clientId,
            scope,
            aud,
            // Distinguishes an MCP token from a normal app session token, so a
            // stolen app JWT cannot be replayed at /mcp.
            typ: 'mcp_access',
            // Names the grant this token belongs to. Checking this against
            // MCPAccessGrant is what makes revocation take effect immediately
            // rather than when the token happens to expire.
            ...(family ? { sid: family } : {}),
        },
        getJwtSecret(),
        {
            algorithm: 'HS256',
            issuer: issuerUri(),
            expiresIn: ACCESS_TOKEN_TTL_SECONDS,
            jwtid: crypto.randomUUID(),
        }
    );
};

/**
 * Verify an access token for this resource server.
 *
 * Rejects when: the signature is bad, it is expired, it is not an MCP token,
 * or its audience does not name this server. The audience check is what stops a
 * token issued for a different resource being replayed here.
 */
const verifyAccessToken = (token) => {
    let claims;
    try {
        claims = jwt.verify(token, getJwtSecret(), {
            algorithms: ['HS256'], // pinned: never honour "alg": "none"
            issuer: issuerUri(),
        });
    } catch (err) {
        return { ok: false, code: 'invalid_token', detail: err.message };
    }

    if (claims.typ !== 'mcp_access') {
        return { ok: false, code: 'invalid_token', detail: 'Not an MCP access token' };
    }

    const expected = resourceUri();
    const audiences = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
    if (!audiences.includes(expected)) {
        return { ok: false, code: 'invalid_token', detail: 'Token audience does not match this server' };
    }

    return {
        ok: true,
        claims: {
            userId: claims.sub,
            clientId: claims.client_id,
            scopes: String(claims.scope || '').split(/\s+/).filter(Boolean),
            resource: expected,
            family: claims.sid || null,
        },
    };
};

// ─── Opaque secrets ──────────────────────────────────────────────────────────

const createAuthorizationCode = () => b64url(crypto.randomBytes(32));
const createRefreshToken = () => b64url(crypto.randomBytes(48));
const newFamily = () => crypto.randomUUID();

const hashOpaque = (value) => sha256Hex(String(value));

/** Constant-time compare for client secrets (both are high-entropy). */
const safeEqual = (a, b) => {
    const bufA = Buffer.from(String(a || ''));
    const bufB = Buffer.from(String(b || ''));
    if (bufA.length !== bufB.length || bufA.length === 0) return false;
    return crypto.timingSafeEqual(bufA, bufB);
};

// ─── Consent intents ─────────────────────────────────────────────────────────
// A browser redirect to /authorize cannot carry an Authorization header, so the
// signed-in frontend mints a short-lived intent first and passes it in the URL.
// The intent is what lets the consent page know *which* user is signing in
// without trusting a user id supplied in the query string.

const mintConsentIntent = ({ userId, clientId, maxScopes }) =>
    jwt.sign(
        { sub: String(userId), client_id: clientId, scopes: maxScopes, typ: 'mcp_consent_intent' },
        getJwtSecret(),
        { algorithm: 'HS256', expiresIn: CONSENT_INTENT_TTL_SECONDS, jwtid: crypto.randomUUID() }
    );

const verifyConsentIntent = (token) => {
    try {
        const claims = jwt.verify(token, getJwtSecret(), {
            algorithms: ['HS256'],
        });
        if (claims.typ !== 'mcp_consent_intent') return null;
        return { userId: claims.sub, clientId: claims.client_id, scopes: claims.scopes || [] };
    } catch (_) {
        return null;
    }
};

module.exports = {
    SCOPES,
    ALL_SCOPES,
    SCOPE_DESCRIPTIONS,
    DEFAULT_SCOPES,
    ACCESS_TOKEN_TTL_SECONDS,
    REFRESH_TOKEN_TTL_SECONDS,
    AUTH_CODE_TTL_MS,
    CONSENT_INTENT_TTL_SECONDS,
    resourceUri,
    issuerUri,
    createPkcePair,
    verifyPkce,
    negotiateScopes,
    effectiveScopes,
    hasScope,
    mintAccessToken,
    verifyAccessToken,
    mintConsentIntent,
    verifyConsentIntent,
    createAuthorizationCode,
    createRefreshToken,
    newFamily,
    hashOpaque,
    safeEqual,
    sha256,
    b64url,
};
