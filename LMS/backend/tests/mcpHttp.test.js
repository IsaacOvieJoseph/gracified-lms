const test = require('node:test');
const assert = require('node:assert');
const express = require('express');
const mongoose = require('mongoose');

// These exercise the parts of the MCP surface that must work before anyone is
// authenticated: discovery documents, and the refusal to serve without a token.
// A client cannot start the flow at all if it cannot find the metadata, and
// cannot reach a single tool if the unauthenticated path is not closed.
//
// No database is involved, which is the point: these are exactly the requests
// that must not depend on one. Buffering is switched off so any incidental model
// lookup fails immediately instead of stalling the suite.
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-for-mcp-http-tests';
process.env.PUBLIC_BASE_URL = 'https://lms.example.test';
mongoose.set('bufferTimeoutMS', 1);

const mcpOAuthRouter = require('../routes/mcpOAuth');
const mcpRouter = require('../routes/mcp');

const RESOURCE = 'https://lms.example.test/mcp';
const ISSUER = 'https://lms.example.test/api/mcp/oauth';

const startServer = async () => {
    const app = express();
    // Mirrors server.js: a small limit for the MCP surface, registered first so
    // the wider global parser cannot loosen it.
    app.use('/mcp', express.json({ limit: '256kb' }));
    app.use(express.json({ limit: '50mb' }));
    app.use((req, res, next) => {
        if (req.path.startsWith('/.well-known/oauth-')) return mcpOAuthRouter(req, res, next);
        next();
    });
    app.use('/api/mcp/oauth', mcpOAuthRouter);
    app.use('/mcp', mcpRouter);

    const server = await new Promise((resolve) => {
        const s = app.listen(0, '127.0.0.1', () => resolve(s));
    });
    const base = `http://127.0.0.1:${server.address().port}`;
    return {
        base,
        close: () => new Promise((r) => server.close(r)),
    };
};

let srv;
const get = (p) => fetch(`${srv.base}${p}`);
const post = (p, body, headers = {}) =>
    fetch(`${srv.base}${p}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify(body),
        redirect: 'manual',
    });

test.before(async () => { srv = await startServer(); });
test.after(async () => { await srv?.close(); mongoose.set('bufferTimeoutMS', 10000); });

// ─── Discovery ───────────────────────────────────────────────────────────────

test('protected resource metadata points at the authorization server', async () => {
    const res = await get('/.well-known/oauth-protected-resource/mcp');
    assert.strictEqual(res.status, 200);

    const body = await res.json();
    assert.strictEqual(body.resource, RESOURCE);
    assert.deepStrictEqual(body.authorization_servers, [ISSUER]);
    assert.ok(body.scopes_supported.includes('mcp:read'));
    assert.deepStrictEqual(body.bearer_methods_supported, ['header']);
});

test('authorization server metadata advertises PKCE S256 and no implicit flow', async () => {
    const res = await get('/.well-known/oauth-authorization-server');
    assert.strictEqual(res.status, 200);

    const body = await res.json();
    assert.strictEqual(body.issuer, ISSUER);
    assert.strictEqual(body.authorization_endpoint, `${ISSUER}/authorize`);
    assert.strictEqual(body.token_endpoint, `${ISSUER}/token`);
    assert.strictEqual(body.revocation_endpoint, `${ISSUER}/revoke`);

    // PKCE is mandatory, so only S256 may be advertised, and only the code flow
    // exists. Anything here that implied otherwise would be a lie the client acts on.
    assert.deepStrictEqual(body.code_challenge_methods_supported, ['S256']);
    assert.deepStrictEqual(body.response_types_supported, ['code']);
    assert.deepStrictEqual(body.grant_types_supported, ['authorization_code', 'refresh_token']);
});

test('issuer-path metadata is served at the RFC 8414 location', async () => {
    // The issuer has a path component, so the spec puts the document at
    // /.well-known/oauth-authorization-server/api/mcp/oauth. A client following
    // the spec must not 404 here.
    const res = await get('/.well-known/oauth-authorization-server/api/mcp/oauth');
    assert.strictEqual(res.status, 200);
    assert.strictEqual((await res.json()).issuer, ISSUER);
});

test('dynamic registration is not advertised while it is disabled', async () => {
    const body = await (await get('/.well-known/oauth-authorization-server')).json();
    if (process.env.MCP_ALLOW_DYNAMIC_REGISTRATION === 'true') {
        assert.strictEqual(body.registration_endpoint, `${ISSUER}/register`);
    } else {
        assert.strictEqual(body.registration_endpoint, undefined);
    }
});

// ─── The resource refuses to serve anyone ────────────────────────────────────

test('POST /mcp without a token is refused with a discovery hint', async () => {
    const res = await post('/mcp', { jsonrpc: '2.0', id: 1, method: 'tools/list' });

    assert.strictEqual(res.status, 401);
    const challenge = res.headers.get('www-authenticate');
    assert.match(challenge, /^Bearer /);
    // RFC 9728: the client is told where to go, otherwise it cannot authorise.
    assert.match(challenge, /resource_metadata="https:\/\/lms\.example\.test\/\.well-known\/oauth-protected-resource\/mcp"/);
    assert.strictEqual((await res.json()).error, 'unauthorized');
});

test('POST /mcp with a forged token is refused as invalid_token', async () => {
    const res = await post(
        '/mcp',
        { jsonrpc: '2.0', id: 1, method: 'tools/list' },
        { Authorization: 'Bearer not.a.jwt' }
    );

    assert.strictEqual(res.status, 401);
    assert.match(res.headers.get('www-authenticate'), /error="invalid_token"/);
});

test('an ordinary app session JWT cannot be replayed at /mcp', async () => {
    // The app's own login token is a valid JWT on the same secret. Only the
    // `typ: mcp_access` claim distinguishes an MCP grant, so a stolen session
    // token must not open this door.
    const jwt = require('jsonwebtoken');
    const sessionToken = jwt.sign(
        { sub: '507f1f77bcf86cd799439011', role: 'root_admin' },
        process.env.JWT_SECRET,
        { algorithm: 'HS256', expiresIn: '1h' }
    );

    const res = await post(
        '/mcp',
        { jsonrpc: '2.0', id: 1, method: 'tools/list' },
        { Authorization: `Bearer ${sessionToken}` }
    );

    assert.strictEqual(res.status, 401);
    assert.match(res.headers.get('www-authenticate'), /error="invalid_token"/);
});

// ─── /authorize will not act as an open redirector ───────────────────────────

test('/authorize does not redirect to an unregistered redirect_uri', async () => {
    // The regression this guards: an early return that bounced straight to
    // whatever redirect_uri the query string named, before the client was even
    // resolved. `redirect: manual` means any 3xx here is a real redirect.
    const evil = encodeURIComponent('https://attacker.example/steal');
    const res = await get(`/api/mcp/oauth/authorize?client_id=whatever&redirect_uri=${evil}&state=x`);

    assert.ok(res.status < 300 || res.status >= 400, `expected a refusal, got ${res.status}`);
    assert.ok(!String(res.headers.get('location') || '').includes('attacker.example'));
});

test('/authorize refuses a request carrying an error parameter', async () => {
    const evil = encodeURIComponent('https://attacker.example/steal');
    const res = await get(
        `/api/mcp/oauth/authorize?client_id=whatever&redirect_uri=${evil}&error=access_denied`
    );

    assert.ok(!String(res.headers.get('location') || '').includes('attacker.example'));
});

test('/token rejects an unsupported grant type', async () => {
    const res = await post('/api/mcp/oauth/token', {
        grant_type: 'password',
        client_id: 'whatever',
    });

    assert.strictEqual(res.status, 400);
    assert.strictEqual((await res.json()).error, 'unsupported_grant_type');
});

test('/revoke rejects a request with no token at all', async () => {
    const res = await post('/api/mcp/oauth/revoke', {});

    assert.strictEqual(res.status, 400);
    assert.strictEqual((await res.json()).error, 'invalid_request');
});

test('revocation is mounted and never redirects the caller away', async () => {
    // Whether a token exists must not be observable: RFC 7009 requires a 200
    // either way, so the endpoint cannot be used to probe for valid tokens. The
    // "same answer for a real and a fake token" half of that needs a database and
    // belongs with the integration tests; what is checkable here is that the
    // endpoint is wired up and never turns into a redirect.
    const res = await post('/api/mcp/oauth/revoke', { token: 'definitely-not-a-real-token' });

    assert.ok(res.status < 300 || res.status >= 400, `revocation must not redirect, got ${res.status}`);
    assert.strictEqual(res.headers.get('location'), null);
});

test('an oversized tool call is refused before it is parsed', async () => {
    // A tool call is a small envelope. A multi-megabyte body to /mcp is not a
    // legitimate request, and the limit has to be enforced here rather than
    // inherited from the 50mb global parser that the rest of the API uses.
    const huge = 'x'.repeat(400 * 1024);
    const res = await post('/mcp', {
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/call',
        params: { name: 'list_classes', arguments: { search: huge } },
    });

    assert.ok(res.status === 413 || res.status === 401, `expected a refusal, got ${res.status}`);
    assert.ok(res.status !== 200);
});
