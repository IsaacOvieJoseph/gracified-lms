const test = require('node:test');
const assert = require('node:assert');

// The middleware is the only boundary between a third-party AI assistant and the
// user it acts for, so its failure modes get explicit coverage. No database is
// needed here: the model statics are stubbed per test and restored afterwards,
// which is enough to prove the *decisions* — exactly when a request must be let
// through and when it must be refused. What it cannot prove is that a real Mongo
// query returns what the stub returns; that is what the live boot probe and the
// deferred in-memory DB tests are for.

process.env.JWT_SECRET = 'mcp-auth-test-secret-0123456789abcdef';

const jwt = require('jsonwebtoken');
const { mcpAuth } = require('../middleware/mcpAuth');
const User = require('../models/User');
const MCPClient = require('../models/MCPClient');
const MCPAccessGrant = require('../models/MCPAccessGrant');
const Settings = require('../models/Settings');
const { mintAccessToken, issuerUri, resourceUri } = require('../utils/mcpOAuth');

const USER_ID = 'f'.repeat(24);
const CLIENT_ID = 'dev-assistant-1';
const FAMILY = 'aaaa-bbbb-cccc';

const userDoc = (overrides = {}) => ({
    _id: USER_ID,
    role: 'teacher',
    isVerified: true,
    schoolId: [],
    aiTutorAccess: 'enabled',
    ...overrides,
});

const clientDoc = (overrides = {}) => ({ clientId: CLIENT_ID, revokedAt: null, ...overrides });

const grantDoc = (overrides = {}) => ({
    family: FAMILY,
    userId: USER_ID,
    clientId: CLIENT_ID,
    revokedAt: null,
    ...overrides,
});

/** Express no-ops, collecting what the middleware did instead of a real socket. */
const freshContext = () => {
    const res = {
        statusCode: null,
        headers: {},
        set(header, value) {
            this.headers[header] = value;
            return this;
        },
        status(code) {
            this.statusCode = code;
            return this;
        },
        json(body) {
            this.body = body;
            return this;
        },
    };
    const req = { headers: {} };
    const calls = { next: 0 };
    const next = () => {
        calls.next += 1;
    };
    return { req, res, next, calls };
};

/** A fresh, correctly-shaped token for the stubs in use. */
const validToken = (overrides = {}) =>
    mintAccessToken({
        userId: USER_ID,
        clientId: CLIENT_ID,
        scope: 'mcp:read mcp:draft mcp:write',
        family: FAMILY,
        ...overrides,
    });

// The middleware calls `MCPClient.findOne({ clientId }).lean()` and
// `MCPAccessGrant.findOne({ family }).lean()` — the `.lean()` applies to the Query
// object synchronously, before it resolves. So those stubs must return a
// query-shaped `{ lean: async () => doc }` directly; an async function returning
// that shape would hand the middleware a Promise and `.lean` would not exist.
const query = (doc) => ({ lean: async () => doc });

/** Temporarily replace the model statics the middleware depends on. */
const withStubs = async (stubs, fn) => {
    const originals = new Map();
    for (const [model, method, impl] of stubs) {
        originals.set(`${model.modelName}.${method}`, model[method]);
        model[method] = impl;
    }
    try {
        return await fn();
    } finally {
        for (const [model, method] of stubs) {
            model[method] = originals.get(`${model.modelName}.${method}`);
        }
    }
};

/** Default stubs: everything present, verified, enabled, AI on. */
const defaultStubs = (overrides = {}) =>
    [
        [Settings, 'findOne', () => query(null)],
        [User, 'findById', async () => userDoc()],
        [MCPClient, 'findOne', () => query(clientDoc())],
        [MCPAccessGrant, 'findOne', () => query(grantDoc())],
    ].map(([model, method, impl]) =>
        overrides[`${model.modelName}.${method}`]
            ? [model, method, overrides[`${model.modelName}.${method}`]]
            : [model, method, impl]
    );

// ─── Happy path ──────────────────────────────────────────────────────────────

test('a valid token with client, grant, user and AI present reaches the handler', async () => {
    await withStubs(defaultStubs(), async () => {
        const ctx = freshContext();
        ctx.req.headers.authorization = `Bearer ${validToken()}`;
        await mcpAuth(ctx.req, ctx.res, ctx.next);

        assert.strictEqual(ctx.calls.next, 1, 'next() must be called');
        assert.strictEqual(ctx.res.statusCode, null);
        assert.strictEqual(ctx.req.mcp.userId, USER_ID);
        assert.strictEqual(ctx.req.mcp.clientId, CLIENT_ID);
        assert.ok(ctx.req.mcp.scopes.includes('mcp:write'));
        assert.strictEqual(ctx.req.mcp.role, 'teacher');
    });
});

test('a valid token for a student carries the student role through when student AI is enabled', async () => {
    // Students are disabled by default when no settings record exists, so this
    // test has to enable student AI explicitly — which also documents that the
    // middleware honours it.
    await withStubs(
        defaultStubs({
            'Settings.findOne': () => query({ studentAIEnabled: true, studentAIDailyLimit: 20 }),
            'User.findById': async () => userDoc({ role: 'student', aiTutorUsage: {} }),
        }),
        async () => {
            const ctx = freshContext();
            ctx.req.headers.authorization = `Bearer ${validToken()}`;
            await mcpAuth(ctx.req, ctx.res, ctx.next);
            assert.strictEqual(ctx.calls.next, 1);
            assert.strictEqual(ctx.req.mcp.role, 'student');
        }
    );
});

test('a student whose AI is not enabled anywhere is refused', async () => {
    await withStubs(
        defaultStubs({
            'Settings.findOne': () => query({ studentAIEnabled: false, studentAIDailyLimit: 20 }),
            'User.findById': async () => userDoc({ role: 'student', aiTutorUsage: {} }),
        }),
        async () => {
            const ctx = freshContext();
            ctx.req.headers.authorization = `Bearer ${validToken()}`;
            await mcpAuth(ctx.req, ctx.res, ctx.next);
            assert.strictEqual(ctx.res.statusCode, 403);
            assert.strictEqual(ctx.calls.next, 0);
        }
    );
});

// ─── Authentication failures ─────────────────────────────────────────────────

test('a request without a token is told where to authenticate', async () => {
    const ctx = freshContext();
    await mcpAuth(ctx.req, ctx.res, ctx.next);

    assert.strictEqual(ctx.res.statusCode, 401);
    assert.strictEqual(ctx.calls.next, 0);
    assert.ok(ctx.res.headers['WWW-Authenticate'].includes('invalid_token'));
    // The metadata location must actually point at the resource server.
    assert.ok(ctx.res.headers['WWW-Authenticate'].includes(resourceUri().replace(/\/mcp\/?$/, '') + '/.well-known/oauth-protected-resource/mcp'));
    assert.strictEqual(ctx.res.body.error, 'unauthorized');
});

test('a token that does not verify is refused', async () => {
    const ctx = freshContext();
    ctx.req.headers.authorization = 'Bearer not-a-real-token';
    await mcpAuth(ctx.req, ctx.res, ctx.next);
    assert.strictEqual(ctx.res.statusCode, 401);
    assert.strictEqual(ctx.calls.next, 0);
});

test('a token minted with a different secret is refused', async () => {
    const forged = jwt.sign(
        { sub: USER_ID, client_id: CLIENT_ID, scope: 'mcp:read', typ: 'mcp_access', aud: resourceUri(), sid: FAMILY },
        'wrong-secret',
        { issuer: issuerUri(), algorithm: 'HS256' }
    );
    const ctx = freshContext();
    ctx.req.headers.authorization = `Bearer ${forged}`;
    await mcpAuth(ctx.req, ctx.res, ctx.next);
    assert.strictEqual(ctx.res.statusCode, 401);
});

// ─── The regression this suite exists for: client lifecycle ─────────────────

test('a DELETED client is refused — a null lookup must not pass as "not revoked"', async () => {
    // `client?.revokedAt` on a null result is undefined, which is falsy, so the
    // original check let a purged registration keep working until its tokens
    // expired. Deletion is the strongest form of revocation; it must be refused now.
    await withStubs(defaultStubs({ 'MCPClient.findOne': () => query(null) }), async () => {
        const ctx = freshContext();
        ctx.req.headers.authorization = `Bearer ${validToken()}`;
        await mcpAuth(ctx.req, ctx.res, ctx.next);

        assert.strictEqual(ctx.res.statusCode, 401);
        assert.strictEqual(ctx.calls.next, 0);
        assert.match(ctx.res.body.error_description, /revoked/);
    });
});

test('a revoked client is refused', async () => {
    await withStubs(
        defaultStubs({ 'MCPClient.findOne': () => query(clientDoc({ revokedAt: new Date() })) }),
        async () => {
            const ctx = freshContext();
            ctx.req.headers.authorization = `Bearer ${validToken()}`;
            await mcpAuth(ctx.req, ctx.res, ctx.next);
            assert.strictEqual(ctx.res.statusCode, 401);
            assert.strictEqual(ctx.calls.next, 0);
        }
    );
});

test('a revoked grant is refused even with a valid token and client', async () => {
    await withStubs(
        defaultStubs({ 'MCPAccessGrant.findOne': () => query(grantDoc({ revokedAt: new Date() })) }),
        async () => {
            const ctx = freshContext();
            ctx.req.headers.authorization = `Bearer ${validToken()}`;
            await mcpAuth(ctx.req, ctx.res, ctx.next);
            assert.strictEqual(ctx.res.statusCode, 401);
        }
    );
});

test('a missing grant document is refused, not skipped', async () => {
    // Without a grant row there is nothing to prove the user ever approved this
    // client, so the token must not be honoured.
    await withStubs(defaultStubs({ 'MCPAccessGrant.findOne': () => query(null) }), async () => {
        const ctx = freshContext();
        ctx.req.headers.authorization = `Bearer ${validToken()}`;
        await mcpAuth(ctx.req, ctx.res, ctx.next);
        assert.strictEqual(ctx.res.statusCode, 401);
    });
});

test('a grant belonging to someone else is refused', async () => {
    // The token says user A, the grant says user B: the family has been reused or
    // tampered with, and borrowing is not a coincidence worth a second guess.
    await withStubs(
        defaultStubs({ 'MCPAccessGrant.findOne': () => query(grantDoc({ userId: 'b'.repeat(24) })) }),
        async () => {
            const ctx = freshContext();
            ctx.req.headers.authorization = `Bearer ${validToken()}`;
            await mcpAuth(ctx.req, ctx.res, ctx.next);
            assert.strictEqual(ctx.res.statusCode, 401);
        }
    );
});

// ─── User lifecycle ──────────────────────────────────────────────────────────

test('a token for a deleted user is refused', async () => {
    await withStubs(defaultStubs({ 'User.findById': async () => null }), async () => {
        const ctx = freshContext();
        ctx.req.headers.authorization = `Bearer ${validToken()}`;
        await mcpAuth(ctx.req, ctx.res, ctx.next);
        assert.strictEqual(ctx.res.statusCode, 401);
    });
});

test('an unverified user is refused (403) unless they are a root admin', async () => {
    await withStubs(
        defaultStubs({ 'User.findById': async () => userDoc({ isVerified: false }) }),
        async () => {
            const ctx = freshContext();
            ctx.req.headers.authorization = `Bearer ${validToken()}`;
            await mcpAuth(ctx.req, ctx.res, ctx.next);
            assert.strictEqual(ctx.res.statusCode, 403);
        }
    );
    // root_admin with the same token must pass, mirroring middleware/auth.js.
    await withStubs(
        defaultStubs({ 'User.findById': async () => userDoc({ isVerified: false, role: 'root_admin' }) }),
        async () => {
            const ctx = freshContext();
            ctx.req.headers.authorization = `Bearer ${validToken()}`;
            await mcpAuth(ctx.req, ctx.res, ctx.next);
            assert.strictEqual(ctx.calls.next, 1);
        }
    );
});

test('a token missing its claims is refused before any lookup runs', async () => {
    // A token without client_id/sid was not minted by this server's current code.
    // It must be rejected rather than fed into a query with an undefined key, which
    // could otherwise match an arbitrary document.
    const bare = mintAccessToken({ userId: USER_ID, clientId: undefined, family: undefined, scope: 'mcp:read' });

    await withStubs(defaultStubs(), async () => {
        const ctx = freshContext();
        ctx.req.headers.authorization = `Bearer ${bare}`;
        await mcpAuth(ctx.req, ctx.res, ctx.next);
        assert.strictEqual(ctx.res.statusCode, 401);
        assert.strictEqual(ctx.calls.next, 0);
    });
});

// ─── AI gating ───────────────────────────────────────────────────────────────

test('a user whose AI is disabled at global level is refused even with a valid token', async () => {
    await withStubs(
        defaultStubs({ 'Settings.findOne': () => query({ staffAIEnabled: false }) }),
        async () => {
            const ctx = freshContext();
            ctx.req.headers.authorization = `Bearer ${validToken()}`;
            await mcpAuth(ctx.req, ctx.res, ctx.next);
            assert.strictEqual(ctx.res.statusCode, 403);
            assert.strictEqual(ctx.calls.next, 0);
        }
    );
});