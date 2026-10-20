const express = require('express');
const crypto = require('crypto');

const { auth } = require('../middleware/auth');
const User = require('../models/User');
const MCPClient = require('../models/MCPClient');
const MCPOAuthCode = require('../models/MCPOAuthCode');
const MCPRefreshToken = require('../models/MCPRefreshToken');
const MCPAccessGrant = require('../models/MCPAccessGrant');
const MCPPendingConsent = require('../models/MCPPendingConsent');
const { resolveClient, registerClient, dcrEnabled, redirectUriAllowed } = require('../utils/mcpClients');
const {
    SCOPES, SCOPE_DESCRIPTIONS, ALL_SCOPES,
    resourceUri, issuerUri,
    createPkcePair, verifyPkce,
    negotiateScopes,
    mintAccessToken,
    mintConsentIntent, verifyConsentIntent,
    createAuthorizationCode, createRefreshToken, newFamily,
    hashOpaque, safeEqual,
    AUTH_CODE_TTL_MS, REFRESH_TOKEN_TTL_SECONDS,
} = require('../utils/mcpOAuth');

const router = express.Router();

const frontendBase = () =>
    String(process.env.FRONTEND_URL || 'http://localhost:3000').replace(/\/+$/, '');

const CONSENT_TTL_MS = 10 * 60 * 1000;

// ─── Metadata (RFC 9728 / RFC 8414) ──────────────────────────────────────────

/**
 * Protected Resource Metadata. MCP clients read this to discover the
 * authorization server, so it must be reachable without authentication at the
 * well-known path derived from the resource identifier.
 */
const prmHandler = (req, res) => {
    res.json({
        resource: resourceUri(),
        authorization_servers: [issuerUri()],
        scopes_supported: ALL_SCOPES,
        bearer_methods_supported: ['header'],
        resource_name: 'Gracy',
        resource_documentation: `${frontendBase()}/profile`,
    });
};

router.get('/.well-known/oauth-protected-resource/mcp', prmHandler);
router.get('/.well-known/oauth-protected-resource', prmHandler);

/**
 * Authorization Server Metadata.
 *
 * RFC 8414 §3.1: when the issuer identifier contains a path component, the
 * metadata document lives at /.well-known/oauth-authorization-server followed by
 * that path. Ours is /api/mcp/oauth, so the spec-correct location is
 * /.well-known/oauth-authorization-server/api/mcp/oauth. The bare form is also
 * served, because clients commonly try it first and a 404 there aborts the flow
 * before they fall back.
 */
const authorizationServerMetadata = (req, res) => {
    const issuer = issuerUri();
    res.json({
        issuer,
        authorization_endpoint: `${issuer}/authorize`,
        token_endpoint: `${issuer}/token`,
        revocation_endpoint: `${issuer}/revoke`,
        registration_endpoint: dcrEnabled() ? `${issuer}/register` : undefined,
        scopes_supported: ALL_SCOPES,
        response_types_supported: ['code'],
        grant_types_supported: ['authorization_code', 'refresh_token'],
        token_endpoint_auth_methods_supported: ['none', 'client_secret_basic', 'client_secret_post'],
        code_challenge_methods_supported: ['S256'],
        // PKCE is required, not merely offered. Clients that ignore this still
        // cannot proceed without it, because /authorize rejects anything else.
        require_pce: true,
        revocation_endpoint_auth_methods_supported: ['none', 'client_secret_basic', 'client_secret_post'],
    });
};

// Derived from the issuer so the two can never drift apart.
const ISSUER_PATH = (() => {
    try {
        return new URL(issuerUri()).pathname.replace(/\/+$/, '');
    } catch {
        return '';
    }
})();

if (ISSUER_PATH) {
    router.get(`/.well-known/oauth-authorization-server${ISSUER_PATH}`, authorizationServerMetadata);
}
router.get('/.well-known/oauth-authorization-server', authorizationServerMetadata);

// ─── Consent intent (authenticated bridge) ───────────────────────────────────

/**
 * A browser redirect to /authorize cannot carry an Authorization header, and the
 * app's session lives in localStorage rather than a cookie. So the signed-in
 * frontend mints a short-lived intent naming the user, and passes it in the
 * authorize URL. The user id therefore never comes from the query string.
 */
router.post('/consent-intent', auth, async (req, res) => {
    try {
        const clientId = String(req.body?.clientId || '');
        if (!clientId) return res.status(400).json({ message: 'clientId is required' });

        const client = await resolveClient(clientId);

        // Cap what the intent can ever authorise at the client's own ceiling.
        const intent = mintConsentIntent({
            userId: req.user._id,
            clientId: client.clientId,
            maxScopes: client.allowedScopes?.length ? client.allowedScopes : [SCOPES.READ, SCOPES.DRAFT],
        });

        res.json({ consentIntent: intent, clientName: client.clientName, allowedScopes: client.allowedScopes });
    } catch (err) {
        res.status(400).json({ message: err.message, code: err.oauthError });
    }
});

// ─── Authorization endpoint ──────────────────────────────────────────────────

const oauthErrorRedirect = (redirectUri, error, description, state) => {
    const url = new URL(redirectUri);
    url.searchParams.set('error', error);
    if (description) url.searchParams.set('error_description', description);
    // state is echoed on errors too, or the client cannot correlate the failure
    // with its pending request.
    if (state) url.searchParams.set('state', state);
    return url.toString();
};

router.get('/authorize', async (req, res) => {
    const q = req.query || {};
    const {
        client_id: clientId,
        redirect_uri: redirectUri,
        response_type: responseType,
        code_challenge: codeChallenge,
        code_challenge_method: codeChallengeMethod,
        state,
        scope,
        resource,
        consent_intent: consentIntent,
    } = q;

    let client;
    try {
        client = await resolveClient(String(clientId || ''));
    } catch (err) {
        // Do not redirect: an unverified redirect_uri cannot be trusted as a
        // destination for an error, and bouncing to it would make this endpoint
        // an open redirector.
        return res.status(400).send('Unknown or invalid client_id');
    }

    // Everything below is only safe to report once the redirect_uri is known to
    // be one this client registered.
    if (!redirectUriAllowed(String(redirectUri || ''), client.redirectUris)) {
        return res.status(400).send('redirect_uri is not registered for this client');
    }

    if (responseType !== 'code') {
        return res.redirect(oauthErrorRedirect(redirectUri, 'unsupported_response_type', 'Only response_type=code is supported', state));
    }
    if (!state || String(state).length > 512) {
        return res.redirect(oauthErrorRedirect(redirectUri, 'invalid_request', 'state is required', null));
    }
    // PKCE is mandatory and S256-only; validate before showing any consent UI.
    if (!codeChallenge || codeChallengeMethod !== 'S256') {
        return res.redirect(oauthErrorRedirect(redirectUri, 'invalid_request', 'PKCE with code_challenge_method=S256 is required', state));
    }
    if (String(resource || '') !== resourceUri()) {
        return res.redirect(oauthErrorRedirect(redirectUri, 'invalid_target', 'resource must match this server', state));
    }

    const negotiated = negotiateScopes(scope, client.allowedScopes);
    if (!negotiated.ok) {
        return res.redirect(oauthErrorRedirect(redirectUri, negotiated.error, negotiated.detail, state));
    }

    const intent = verifyConsentIntent(String(consentIntent || ''));
    if (!intent) {
        // No way to identify the user without a session. Send them to the app to
        // sign in, preserving everything needed to resume.
        const resume = new URL(`${frontendBase()}/mcp-consent`);
        resume.searchParams.set('client_id', clientId);
        resume.searchParams.set('redirect_uri', redirectUri);
        resume.searchParams.set('state', state);
        resume.searchParams.set('scope', String(scope || ''));
        resume.searchParams.set('code_challenge', codeChallenge);
        resume.searchParams.set('code_challenge_method', codeChallengeMethod);
        resume.searchParams.set('resource', resourceUri());
        return res.redirect(resume.toString());
    }
    if (intent.clientId !== client.clientId) {
        return res.status(400).send('Consent intent does not match this client');
    }

    // Intersect the client's ceiling with what the intent was minted for, so a
    // stale or over-scoped intent cannot widen the grant.
    const consentedScopes = negotiated.scopes.filter(
        (s) => !intent.scopes?.length || intent.scopes.includes(s)
    );
    if (!consentedScopes.length) {
        return res.redirect(oauthErrorRedirect(redirectUri, 'invalid_scope', 'No requested scope is permitted', state));
    }

    const consentId = crypto.randomBytes(24).toString('base64url');
    await MCPPendingConsent.create({
        consentId,
        userId: intent.userId,
        clientId: client.clientId,
        clientName: client.clientName,
        clientUri: client.clientUri,
        redirectUri: String(redirectUri),
        codeChallenge: String(codeChallenge),
        codeChallengeMethod: 'S256',
        resource: resourceUri(),
        consentedScopes,
        state: String(state),
        expiresAt: new Date(Date.now() + CONSENT_TTL_MS),
    });

    // Hand off to the signed-in app to render the consent screen.
    const consent = new URL(`${frontendBase()}/mcp-consent`);
    consent.searchParams.set('consent_id', consentId);
    res.redirect(consent.toString());
});

// ─── Consent decisions ───────────────────────────────────────────────────────

const loadPending = async (req, res) => {
    const consentId = String(req.body?.consentId || req.query?.consent_id || '');
    const pending = await MCPPendingConsent.findOne({ consentId }).lean();
    // The bearer token must belong to the same user the flow was started for,
    // otherwise holding a consent_id would be enough to approve someone's grant.
    if (!pending || String(pending.userId) !== String(req.user._id)) {
        res.status(404).json({ message: 'This authorisation request has expired. Please try again.' });
        return null;
    }
    if (new Date(pending.expiresAt).getTime() < Date.now()) {
        res.status(400).json({ message: 'This authorisation request has expired. Please try again.' });
        return null;
    }
    return pending;
};

router.get('/consent', auth, async (req, res) => {
    try {
        const pending = await loadPending(req, res);
        if (!pending) return;
        res.json({
            clientName: pending.clientName,
            clientUri: pending.clientUri,
            scopes: (pending.consentedScopes || []).map((s) => ({
                scope: s,
                description: SCOPE_DESCRIPTIONS[s] || s,
            })),
            account: { name: req.user.name, email: req.user.email },
        });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

router.post('/consent', auth, async (req, res) => {
    try {
        const pending = await loadPending(req, res);
        if (!pending) return;

        const approve = req.body?.approve === true;

        // Single-use either way: consume before deciding, so a double submit
        // cannot mint two codes.
        await MCPPendingConsent.deleteOne({ consentId: pending.consentId });

        if (!approve) {
            return res.json({
                redirectUrl: oauthErrorRedirect(pending.redirectUri, 'access_denied', 'The user declined the request', pending.state),
            });
        }

        // Re-check the grant is still permitted at approval time: the client's
        // scope ceiling may have been tightened while the consent screen was open.
        const client = await resolveClient(pending.clientId);
        const scopes = (pending.consentedScopes || []).filter((s) =>
            client.allowedScopes?.length ? client.allowedScopes.includes(s) : [SCOPES.READ, SCOPES.DRAFT].includes(s)
        );
        if (!scopes.length) {
            return res.json({
                redirectUrl: oauthErrorRedirect(pending.redirectUri, 'invalid_scope', 'Permissions changed before approval', pending.state),
            });
        }

        const code = createAuthorizationCode();
        await MCPOAuthCode.create({
            codeHash: hashOpaque(code),
            clientId: pending.clientId,
            userId: pending.userId,
            redirectUri: pending.redirectUri,
            scope: scopes.join(' '),
            consentedScopes: scopes,
            codeChallenge: pending.codeChallenge,
            codeChallengeMethod: 'S256',
            resource: pending.resource,
            expiresAt: new Date(Date.now() + AUTH_CODE_TTL_MS),
        });

        const url = new URL(pending.redirectUri);
        url.searchParams.set('code', code);
        url.searchParams.set('state', pending.state);
        res.json({ redirectUrl: url.toString() });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// ─── Token endpoint ──────────────────────────────────────────────────────────

/**
 * Authenticate a confidential client. Public clients (CIMD/DCR) return null and
 * rely on PKCE alone, which is the correct posture for clients that cannot keep
 * a secret.
 */
const authenticateClient = async (req) => {
    let clientId = null;
    let clientSecret = null;

    const authHeader = req.headers.authorization || '';
    if (authHeader.startsWith('Basic ')) {
        const decoded = Buffer.from(authHeader.slice(6), 'base64').toString('utf8');
        const idx = decoded.indexOf(':');
        clientId = decodeURIComponent(decoded.slice(0, idx));
        clientSecret = decodeURIComponent(decoded.slice(idx + 1));
    } else if (req.body?.client_id) {
        clientId = String(req.body.client_id);
        clientSecret = req.body.client_secret ? String(req.body.client_secret) : null;
    }

    if (!clientId) return { error: 'invalid_client', detail: 'client_id is required' };

    let client;
    try {
        client = await resolveClient(clientId);
    } catch (err) {
        return { error: err.oauthError || 'invalid_client', detail: err.message };
    }

    if (client.clientSecretHash) {
        // Confidential: require the secret. Compare in constant time.
        const presented = hashOpaque(clientSecret || '');
        if (!clientSecret || !safeEqual(presented, client.clientSecretHash)) {
            return { error: 'invalid_client', detail: 'Client authentication failed' };
        }
    }

    return { client };
};

router.post('/token', async (req, res) => {
    const body = req.body || {};
    const grantType = String(body.grant_type || '');

    // ── authorization_code ──
    if (grantType === 'authorization_code') {
        const code = String(body.code || '');
        const redirectUri = String(body.redirect_uri || '');

        const { client, error, detail } = await authenticateClient(req);
        if (error) return res.status(400).json({ error, error_description: detail });

        const record = await MCPOAuthCode.findOne({ codeHash: hashOpaque(code) });
        if (!record) {
            return res.status(400).json({ error: 'invalid_grant', error_description: 'Unknown authorization code' });
        }
        // Single-use, regardless of what else fails below.
        await MCPOAuthCode.deleteOne({ _id: record._id });

        if (new Date(record.expiresAt).getTime() < Date.now()) {
            return res.status(400).json({ error: 'invalid_grant', error_description: 'Authorization code has expired' });
        }
        if (record.clientId !== client.clientId) {
            return res.status(400).json({ error: 'invalid_grant', error_description: 'Code was issued to a different client' });
        }
        if (record.redirectUri !== redirectUri) {
            return res.status(400).json({ error: 'invalid_grant', error_description: 'redirect_uri does not match the authorization request' });
        }
        // RFC 8707: a token must never be minted for a resource the code was not
        // issued for.
        if (String(body.resource || record.resource) !== record.resource) {
            return res.status(400).json({ error: 'invalid_target', error_description: 'resource does not match the authorization request' });
        }

        const pkce = verifyPkce({
            challenge: record.codeChallenge,
            method: record.codeChallengeMethod,
            verifier: body.code_verifier,
        });
        if (!pkce.ok) {
            return res.status(400).json({ error: pkce.error, error_description: pkce.detail });
        }

        return issueTokens(res, {
            userId: record.userId,
            clientId: record.clientId,
            scope: record.consentedScopes.join(' '),
            resource: record.resource,
        });
    }

    // ── refresh_token ──
    if (grantType === 'refresh_token') {
        const presented = String(body.refresh_token || '');
        const { client, error, detail } = await authenticateClient(req);
        if (error) return res.status(400).json({ error, error_description: detail });

        const record = await MCPRefreshToken.findOne({ tokenHash: hashOpaque(presented) });
        if (!record) {
            return res.status(400).json({ error: 'invalid_grant', error_description: 'Unknown refresh token' });
        }
        if (record.clientId !== client.clientId) {
            return res.status(400).json({ error: 'invalid_grant', error_description: 'Refresh token belongs to a different client' });
        }
        if (record.revokedAt) {
            return res.status(400).json({ error: 'invalid_grant', error_description: 'Refresh token has been revoked' });
        }

        // Reuse of an already-rotated token means a copy escaped. We cannot tell
        // a replay by the legitimate client from a theft, so assume theft and
        // kill the whole family, forcing a fresh sign-in.
        if (record.rotatedAt) {
            await MCPRefreshToken.updateMany(
                { family: record.family, revokedAt: null },
                { $set: { revokedAt: new Date(), revokedReason: 'Refresh token reuse detected' } }
            );
            return res.status(400).json({
                error: 'invalid_grant',
                error_description: 'Refresh token reuse detected. All sessions for this grant were revoked; please sign in again.',
            });
        }

        if (new Date(record.expiresAt).getTime() < Date.now()) {
            return res.status(400).json({ error: 'invalid_grant', error_description: 'Refresh token has expired' });
        }
        if (String(body.resource || record.resource) !== record.resource) {
            return res.status(400).json({ error: 'invalid_target', error_description: 'resource does not match' });
        }

        // A refresh must not be able to escalate the grant. Narrowing is allowed.
        let scope = record.scope;
        if (body.scope) {
            const requested = String(body.scope).split(/\s+/).filter(Boolean);
            if (!requested.every((s) => record.scope.split(/\s+/).includes(s))) {
                return res.status(400).json({
                    error: 'invalid_scope',
                    error_description: 'A refresh cannot request scopes beyond the original grant',
                });
            }
            scope = requested.join(' ');
        }

        // Rotate: mark the old token used and mint a successor in the family.
        await MCPRefreshToken.updateOne({ _id: record._id }, { $set: { rotatedAt: new Date() } });

        return issueTokens(res, {
            userId: record.userId,
            clientId: record.clientId,
            scope,
            resource: record.resource,
            family: record.family,
        });
    }

    res.status(400).json({ error: 'unsupported_grant_type', error_description: `Unsupported grant_type: ${grantType}` });
});

/**
 * Mint an access/refresh pair. Grants exactly the consented scope.
 */
const issueTokens = async (res, { userId, clientId, scope, resource, family }) => {
    const grantFamily = family || newFamily();
    const accessToken = mintAccessToken({ userId, clientId, scope, resource, family: grantFamily });
    const refreshToken = createRefreshToken();

    await MCPRefreshToken.create({
        tokenHash: hashOpaque(refreshToken),
        family: grantFamily,
        clientId,
        userId,
        scope,
        resource,
        expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_SECONDS * 1000),
    });

    // The grant is the unit that gets revoked, and it spans every refresh in the
    // family. Upsert rather than insert so rotation updates the same row and a
    // revocation recorded earlier cannot be silently replaced by a new grant.
    await MCPAccessGrant.updateOne(
        { family: grantFamily },
        {
            $set: {
                userId,
                clientId,
                scope,
                resource,
            },
            $setOnInsert: { revokedAt: null, revokedReason: null },
        },
        { upsert: true }
    );

    res.json({
        access_token: accessToken,
        token_type: 'Bearer',
        expires_in: 60 * 60,
        refresh_token: refreshToken,
        scope,
    });
};

// ─── Revocation ──────────────────────────────────────────────────────────────

router.post('/revoke', async (req, res) => {
    try {
        const token = String(req.body?.token || '');
        if (!token) return res.status(400).json({ error: 'invalid_request' });

        const hint = String(req.body?.token_type_hint || '');

        // If the caller identifies a client, the revocation is scoped to that
        // client: one app cannot revoke another app's token. An unauthenticated
        // caller may still revoke a token it holds, which RFC 7009 allows for
        // public clients.
        let callerClientId = null;
        const authResult = await authenticateClient(req).catch(() => ({}));
        if (authResult.client) callerClientId = authResult.client.clientId;

        const record = await MCPRefreshToken.findOne({
            tokenHash: hashOpaque(token),
            ...(callerClientId ? { clientId: callerClientId } : {}),
        });

        if (record) {
            // Revoke the whole grant, not just this token. The siblings are
            // already unusable via rotation checks, but the access tokens issued
            // alongside them are still valid for up to an hour, and revoking the
            // family plus its grant record is what ends that immediately.
            await MCPRefreshToken.updateMany(
                { family: record.family, revokedAt: null },
                { $set: { revokedAt: new Date(), revokedReason: hint || 'Revoked by client or user' } }
            );
            await MCPAccessGrant.updateOne(
                { family: record.family },
                { $set: { revokedAt: new Date(), revokedReason: hint || 'Revoked by client or user' } }
            );
        }

        // Always 200. Reporting whether a token existed would let a caller probe
        // for valid tokens.
        res.status(200).json({});
    } catch (err) {
        res.status(500).json({ error: 'server_error' });
    }
});

// ─── Connected apps (Profile UI) ─────────────────────────────────────────────

/**
 * Every MCP app the signed-in user has granted access to, so the user can see
 * what is connected to their account and disconnect it. Scoped by userId, never
 * by anything supplied in the request.
 */
router.get('/connections', auth, async (req, res) => {
    try {
        const grants = await MCPAccessGrant.find({
            userId: req.user._id,
            revokedAt: null,
        })
            .sort({ updatedAt: -1 })
            .lean();

        const clientIds = [...new Set(grants.map((g) => g.clientId))];
        const clients = await MCPClient.find({ clientId: { $in: clientIds } })
            .select('clientId clientName clientUri logoUri revokedAt')
            .lean();
        const byId = new Map(clients.map((c) => [c.clientId, c]));

        res.json({
            connections: grants.map((g) => {
                const client = byId.get(g.clientId);
                return {
                    clientId: g.clientId,
                    clientName: client?.clientName || 'Unknown application',
                    clientUri: client?.clientUri || null,
                    logoUri: client?.logoUri || null,
                    // A revoked client keeps its name so the user can recognise
                    // what they just disconnected.
                    clientRevoked: Boolean(client?.revokedAt),
                    scope: g.scope.split(/\s+/).filter(Boolean),
                    connectedAt: g.updatedAt,
                    lastRefreshedAt: g.updatedAt,
                };
            }),
        });
    } catch (err) {
        res.status(500).json({ message: 'Could not load connected applications' });
    }
});

/**
 * Disconnect an app: revoke every grant this user has with this client,
 * including all live access tokens. This is the "sign out everywhere" the user
 * actually expects from a disconnect button.
 */
router.post('/connections/revoke', auth, async (req, res) => {
    try {
        const clientId = String(req.body?.clientId || '');
        if (!clientId) return res.status(400).json({ message: 'clientId is required' });

        const grants = await MCPAccessGrant.find({
            userId: req.user._id,
            clientId,
            revokedAt: null,
        })
            .select('family')
            .lean();

        if (!grants.length) {
            return res.status(404).json({ message: 'That application is not connected to your account' });
        }

        const families = grants.map((g) => g.family);
        const when = new Date();

        await MCPRefreshToken.updateMany(
            { family: { $in: families }, revokedAt: null },
            { $set: { revokedAt: when, revokedReason: 'Disconnected by user' } }
        );
        await MCPAccessGrant.updateMany(
            { family: { $in: families }, revokedAt: null },
            { $set: { revokedAt: when, revokedReason: 'Disconnected by user' } }
        );

        res.json({ revoked: true, clientId, grantsRevoked: families.length });
    } catch (err) {
        res.status(500).json({ message: 'Could not disconnect the application' });
    }
});

// ─── Dynamic Client Registration ─────────────────────────────────────────────

router.post('/register', async (req, res) => {
    try {
        const registration = await registerClient(req.body || {});
        res.status(201).json(registration);
    } catch (err) {
        res.status(err.oauthError === 'access_denied' ? 403 : 400).json({
            error: err.oauthError || 'invalid_client_metadata',
            error_description: err.message,
        });
    }
});

module.exports = router;
