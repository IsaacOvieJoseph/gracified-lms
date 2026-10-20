// ─── MCP client identification ────────────────────────────────────────────────
// Resolves the `client_id` presented at /authorize into a trusted client
// descriptor. Three identity modes are supported, in descending order of trust:
//
//  1. Pre-registered  — a row in the MCPClient collection, provisioned by the
//     deployment. Highest trust: the redirect URIs and scope ceiling were chosen
//     by us, not by whoever registered.
//  2. CIMD            — the client_id is an https URL serving a Client ID
//     Metadata Document. We fetch it (SSRF-guarded) and validate it.
//  3. DCR             — registered on the fly via RFC 7591. Off by default,
//     because open registration lets anyone mint a client that then shows up on
//     a user's consent screen wearing a convincing name.
//
// The validation below is the trust boundary. Redirect URI matching in
// particular must be exact: a prefix or substring match lets an attacker
// register `https://evil.com/?x=https://claude.ai/callback` or
// `https://claude.ai.evil.com/cb` and receive someone else's authorization code.

const MCPClient = require('../models/MCPClient');
const { safeFetchJson } = require('./safeFetch');

// Custom schemes are how native/desktop MCP clients receive the redirect
// (e.g. `gracy://oauth/callback`, or the single-slash `com.example.app:/cb`
// form from RFC 8252). The shape alone is not enough to accept one, because
// "scheme://" also describes http:// and ftp:// — so known network and scripting
// schemes are excluded by name before the custom-scheme rule is applied.
const CUSTOM_SCHEME_RE = /^[a-z][a-z0-9+.-]{1,31}:(\/+\/?)?[^\s]*$/i;
const HTTPS_RE = /^https:\/\//i;

const BLOCKED_SCHEMES = new Set([
    'http', 'https', 'ftp', 'ftps', 'ws', 'wss',
    'javascript', 'data', 'file', 'blob', 'about',
    'mailto', 'tel', 'vbscript', 'view-source', 'jar',
]);

const isLoopback = (url) => {
    try {
        const { hostname, protocol } = new URL(url);
        return protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]', '::1'].includes(hostname);
    } catch (_) {
        return false;
    }
};

/**
 * A redirect URI is acceptable only if it is well-formed and either HTTPS, a
 * loopback address (OAuth native-app best practice), or a custom scheme.
 * Plain http to a non-loopback host is rejected because it exposes the
 * authorization code to the network.
 */
const isValidRedirectUri = (uri) => {
    if (typeof uri !== 'string' || uri.length === 0 || uri.length > 512) return false;
    if (uri.includes('*')) return false; // no wildcards, ever
    if (HTTPS_RE.test(uri)) return true;
    if (isLoopback(uri)) return true;

    const scheme = (uri.match(/^([a-z][a-z0-9+.-]*):/i) || [])[1];
    if (!scheme) return false;
    if (BLOCKED_SCHEMES.has(scheme.toLowerCase())) return false;

    return CUSTOM_SCHEME_RE.test(uri);
};

/**
 * Exact match against the registered set. This is intentionally not
 * `startsWith`: see the module header.
 */
const redirectUriAllowed = (candidate, registered) =>
    Array.isArray(registered) && registered.includes(candidate);

/** Validate a redirect_uri array from a CIMD document or DCR request. */
const sanitiseRedirectUris = (uris) => {
    if (!Array.isArray(uris)) return [];
    return uris.filter(isValidRedirectUri).slice(0, 10);
};

// ─── Client ID Metadata Document (CIMD) ──────────────────────────────────────

// A fetched CIMD is cached briefly so a consent flow does not re-fetch on every
// redirect, while still picking up a client renaming itself within a few minutes.
const CIMD_CACHE_TTL_MS = 5 * 60 * 1000;
const cimdCache = new Map();

/**
 * Validate a Client ID Metadata Document and return a client descriptor.
 * Throws with a `.oauthError` on anything unusable.
 */
const validateCIMD = (clientId, doc) => {
    const fail = (detail) => {
        const err = new Error(detail);
        err.oauthError = 'invalid_client_metadata';
        throw err;
    };

    if (!doc || typeof doc !== 'object' || Array.isArray(doc)) {
        fail('Client metadata document must be a JSON object');
    }

    // The document must describe the client that was actually fetched. Without
    // this, any hosted page could serve metadata claiming to be a different,
    // already-trusted client.
    if (doc.client_id && doc.client_id !== clientId) {
        fail('client_id in the metadata document does not match the requested client_id');
    }

    const redirectUris = sanitiseRedirectUris(doc.redirect_uris);
    if (!redirectUris.length) {
        fail('Client metadata document must contain at least one valid https redirect_uri');
    }

    const clientName = typeof doc.client_name === 'string' ? doc.client_name.trim() : '';
    if (!clientName || clientName.length > 120) {
        fail('Client metadata document must contain a client_name of 1-120 characters');
    }

    // Shown to the user on the consent screen, so it is sanitised for rendering.
    const clientUri = HTTPS_RE.test(doc.client_uri || '') ? doc.client_uri : null;
    const logoUri = HTTPS_RE.test(doc.logo_uri || '') ? doc.logo_uri : null;

    return {
        clientId,
        clientName,
        clientUri,
        logoUri,
        redirectUris,
        // CIMD clients are public and rely on PKCE; no secret is involved.
        registrationType: 'cimd',
        clientSecretHash: null,
    };
};

const fetchCIMD = async (clientId) => {
    const cached = cimdCache.get(clientId);
    if (cached && cached.expires > Date.now()) return cached.client;

    let doc;
    try {
        // safeFetch refuses redirects, non-public addresses and oversized bodies,
        // so a hostile client_id cannot use this to probe the internal network.
        doc = await safeFetchJson(clientId, {
            headers: { Accept: 'application/json' },
            timeoutMs: 5000,
            maxBytes: 128 * 1024,
        });
    } catch (err) {
        const error = new Error(`Could not load client metadata from ${clientId}`);
        error.oauthError = 'invalid_client';
        throw error;
    }

    const client = validateCIMD(clientId, doc);
    cimdCache.set(clientId, { client, expires: Date.now() + CIMD_CACHE_TTL_MS });
    return client;
};

// ─── Resolution ──────────────────────────────────────────────────────────────

/**
 * Resolve a client_id to a trusted descriptor, or throw with `.oauthError`.
 * @param {string} clientId
 */
const resolveClient = async (clientId) => {
    if (typeof clientId !== 'string' || !clientId || clientId.length > 2048) {
        const err = new Error('client_id is missing or malformed');
        err.oauthError = 'invalid_client';
        throw err;
    }

    // Pre-registered clients win over CIMD, so a deployment can override what a
    // client_id URL claims to be.
    const registered = await MCPClient.findOne({ clientId }).lean();
    if (registered) {
        if (registered.revokedAt) {
            const err = new Error('This application\'s access has been revoked');
            err.oauthError = 'unauthorized_client';
            throw err;
        }
        return {
            clientId: registered.clientId,
            clientName: registered.clientName,
            clientUri: registered.clientUri,
            logoUri: registered.logoUri,
            redirectUris: registered.redirectUris || [],
            allowedScopes: registered.allowedScopes || [],
            registrationType: registered.registrationType,
            clientSecretHash: registered.clientSecretHash,
        };
    }

    // CIMD: any https URL is a candidate document.
    if (HTTPS_RE.test(clientId)) {
        const client = await fetchCIMD(clientId);
        return { ...client, allowedScopes: client.allowedScopes || [] };
    }

    const err = new Error('Unknown client_id');
    err.oauthError = 'invalid_client';
    throw err;
};

// ─── Dynamic Client Registration ─────────────────────────────────────────────

const dcrEnabled = () => process.env.MCP_ALLOW_DYNAMIC_REGISTRATION === 'true';

/**
 * RFC 7591 registration. Disabled unless explicitly enabled, because open
 * registration means any website can obtain a client and then appear on a user's
 * consent screen under any name it likes. Even when enabled, the resulting
 * client is capped at read-only scopes; write stays with pre-registered clients
 * unless an operator opts in explicitly.
 */
const registerClient = async (body) => {
    if (!dcrEnabled()) {
        const err = new Error('Dynamic client registration is not enabled on this server');
        err.oauthError = 'access_denied';
        throw err;
    }

    const redirectUris = sanitiseRedirectUris(body?.redirect_uris);
    if (!redirectUris.length) {
        const err = new Error('At least one valid https redirect_uri is required');
        err.oauthError = 'invalid_redirect_uri';
        throw err;
    }

    const clientName = String(body?.client_name || '').trim();
    if (!clientName || clientName.length > 120) {
        const err = new Error('client_name is required (1-120 characters)');
        err.oauthError = 'invalid_client_metadata';
        throw err;
    }

    const allowWrite = process.env.MCP_ALLOW_DCR_WRITE === 'true';
    const allowedScopes = allowWrite
        ? ['mcp:read', 'mcp:draft', 'mcp:write']
        : ['mcp:read', 'mcp:draft'];

    const crypto = require('crypto');
    const clientId = `gracy-dcr-${crypto.randomUUID()}`;

    const created = await MCPClient.create({
        clientId,
        registrationType: 'dcr',
        clientName,
        clientUri: HTTPS_RE.test(body?.client_uri || '') ? body.client_uri : null,
        logoUri: HTTPS_RE.test(body?.logo_uri || '') ? body.logo_uri : null,
        redirectUris,
        allowedScopes,
        // Public client: no secret. DCR clients must use PKCE.
        clientSecretHash: null,
    });

    return {
        client_id: created.clientId,
        client_id_issued_at: Math.floor(Date.now() / 1000),
        client_name: created.clientName,
        redirect_uris: created.redirectUris,
        grant_types: ['authorization_code', 'refresh_token'],
        response_types: ['code'],
        token_endpoint_auth_method: 'none',
        scope: allowedScopes.join(' '),
    };
};

module.exports = {
    resolveClient,
    registerClient,
    dcrEnabled,
    validateCIMD,
    isValidRedirectUri,
    redirectUriAllowed,
    sanitiseRedirectUris,
    isLoopback,
};
