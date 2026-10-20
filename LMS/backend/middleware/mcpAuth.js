const User = require('../models/User');
const MCPClient = require('../models/MCPClient');
const MCPAccessGrant = require('../models/MCPAccessGrant');
const { verifyAccessToken, issuerUri, resourceUri } = require('../utils/mcpOAuth');
const { assertAIAccess } = require('../utils/aiAccess');

// ─── MCP resource-server authentication ──────────────────────────────────────
// Guards POST /mcp. This is the boundary where a third-party AI assistant stops
// being an untrusted internet client and starts being allowed to act as the
// signed-in user — so everything downstream may assume `req.mcp` describes a
// real, currently-authenticated, currently-permitted session.
//
// Note it re-reads the User on every request rather than trusting the token
// alone. An access token is valid for an hour; if an admin disables a user's AI,
// deletes the account, or changes their role in that window, the change must
// take effect immediately rather than when the token happens to expire.

const extractBearer = (req) => {
    const header = req.headers.authorization || '';
    if (!header.startsWith('Bearer ')) return null;
    const token = header.slice(7).trim();
    return token || null;
};

/**
 * Where an unauthenticated client should go to find the authorization server.
 * Derived from the resource identifier so the advertised location always
 * matches the one /authorize and /token actually live at.
 */
const metadataUrl = () => {
    const base = resourceUri().replace(/\/mcp\/?$/, '');
    return `${base}/.well-known/oauth-protected-resource/mcp`;
};

// Kept for callers that only need the issuer.
const authServer = () => issuerUri();

const mcpAuth = async (req, res, next) => {
    const token = extractBearer(req);

    // RFC 9728: an unauthenticated request to a protected resource must be told
    // where to authenticate, or the client cannot discover the flow at all.
    if (!token) {
        return res.status(401)
            .set('WWW-Authenticate', `Bearer realm="gracy-mcp", error="invalid_token", resource_metadata="${metadataUrl()}"`)
            .json({ error: 'unauthorized', error_description: 'Bearer token required' });
    }

    const verified = verifyAccessToken(token);
    if (!verified.ok) {
        return res.status(401)
            .set('WWW-Authenticate', `Bearer error="${verified.code}", error_description="${verified.detail.replace(/"/g, '')}"`)
            .json({ error: 'unauthorized', error_description: verified.detail });
    }

    try {
        const { userId, clientId, scopes, family } = verified.claims;

        // A token must name all three of user, client, and grant family. Every
        // token this server mints does; a claim missing one means the token was not
        // produced by the current code, and the checks below cannot be performed
        // without it. Asking the database for a client with an undefined id is not a
        // safe way to find "none" — a query with a dropped key can match an arbitrary
        // document instead, which would give a token somebody else's client identity.
        if (!userId || !clientId || !family) {
            return res.status(401)
                .set('WWW-Authenticate', 'Bearer error="invalid_token", error_description="Token is missing required claims"')
                .json({ error: 'unauthorized', error_description: 'Token is missing required claims' });
        }

        const user = await User.findById(userId);
        if (!user) {
            return res.status(401).json({ error: 'unauthorized', error_description: 'Account no longer exists' });
        }
        // Mirrors middleware/auth.js so a user who cannot use the app cannot use
        // an assistant through it either.
        if (!user.isVerified && user.role !== 'root_admin') {
            return res.status(403).json({ error: 'forbidden', error_description: 'Email address is not verified' });
        }

        // A revoked client must lose access immediately, without waiting for its
        // access tokens to expire. A *deleted* client has to be rejected too: the
        // lookup returns null there, and `null?.revokedAt` is undefined, so checking
        // only for revocation would silently keep a purged registration working
        // until its tokens aged out. Every access token carries the client_id it was
        // minted from, so a record that no longer exists means it was removed.
        const client = await MCPClient.findOne({ clientId }).lean();
        if (!client || client.revokedAt) {
            return res.status(401).json({ error: 'unauthorized', error_description: 'This application has been revoked' });
        }

        // Same for a grant the user disconnected or revoked. Access tokens are
        // stateless, so this database check is the only thing that makes
        // "disconnect this app" mean now rather than in up to an hour. Always
        // checked, never conditional: skipping it for a token without a family would
        // mean such a token outlives a disconnect.
        const grant = await MCPAccessGrant.findOne({ family }).lean();
        if (!grant || grant.revokedAt) {
            return res.status(401).json({ error: 'unauthorized', error_description: 'This connection has been revoked' });
        }
        // The grant and the token must still agree about who and what.
        if (String(grant.userId) !== String(userId) || grant.clientId !== clientId) {
            return res.status(401).json({ error: 'unauthorized', error_description: 'This connection has been revoked' });
        }

        // The admin AI switch governs this surface in full, not just the tools
        // that call a model. The MCP server exists to let an assistant act for
        // this user, so if their AI access has been switched off the assistant
        // gets nothing at all. Checked per request, so the change is immediate
        // rather than taking effect when the access token expires.
        //
        // Not consumed here: reads are not metered, and a draft that fails should
        // not cost the student one of their daily interactions.
        await assertAIAccess(user);

        req.mcp = {
            userId: String(userId),
            clientId,
            scopes,
            // Populated per request; downstream tools must re-check these rather
            // than assuming a token grant implies current permission.
            user,
            role: user.role,
        };
        next();
    } catch (err) {
        if (err.status === 403 || err.status === 429) {
            return res.status(err.status).json({ error: err.code || 'forbidden', error_description: err.message });
        }
        next(err);
    }
};

module.exports = { mcpAuth, extractBearer, metadataUrl, authServer };
