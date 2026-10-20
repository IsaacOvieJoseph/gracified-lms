const express = require('express');
const crypto = require('crypto');

const { auth } = require('../middleware/auth');
const AIModelConnection = require('../models/AIModelConnection');
const AIOAuthState = require('../models/AIOAuthState');
const Settings = require('../models/Settings');
const { maskSecret } = require('../utils/tokenCrypto');
const {
    listProviders,
    seal,
    open,
} = require('../utils/aiProviders');
const gemini = require('../utils/aiProviders/geminiOAuth');
const { safeFetch } = require('../utils/safeFetch');
const { resolveAIAccess, resolveOwnAIModelsAccess } = require('../utils/aiAccess');

const router = express.Router();

const STATE_TTL_MS = 10 * 60 * 1000; // 10 minutes is ample for a consent screen

// OpenRouter keys are prefixed; anything else is a paste error. Validating the
// shape catches typos before they become a confusing provider failure, without
// spending the user's credits on a test completion.
const OPENROUTER_KEY_RE = /^sk-or-v1-[A-Za-z0-9_-]{16,}$/;

const b64url = (buf) => Buffer.from(buf).toString('base64url');

const publicView = (conn, platformProvider) => {
    if (!conn) {
        return {
            connected: false,
            platformProvider,
            provider: null,
        };
    }
    return {
        connected: conn.status === 'connected',
        status: conn.status,
        provider: conn.provider,
        model: conn.model || null,
        lastUsedAt: conn.lastUsedAt || null,
        connectedAt: conn.connectedAt || null,
        // Safe to show: reveals nothing beyond the last four characters.
        hint: conn.provider === 'openrouter'
            ? maskSecret(open('openrouter', 'apiKey', String(conn.userId), conn.apiKeyEncrypted) || '')
            : null,
        lastError: conn.status === 'error' ? conn.lastError : null,
    };
};

// ─── GET /api/ai-connections ──────────────────────────────────────────────────
/**
 * @swagger
 * /api/ai-connections:
 *   get:
 *     summary: Get the signed-in user's own AI provider connection
 *     tags: [AI Connections]
 *     security:
 *       - bearerAuth: []
 */
router.get('/', auth, async (req, res) => {
    try {
        const [conn, settings, ownModelsAllowed] = await Promise.all([
            AIModelConnection.findOne({ userId: req.user._id }).lean(),
            Settings.findOne().lean(),
            resolveOwnAIModelsAccess(req.user),
        ]);
        res.json({
            ...publicView(conn, settings?.activeAIProvider || 'groq'),
            // Front-end uses this to decide whether the "Connect your own
            // provider" (BYO Gemini / OpenRouter / MCP) block is shown at all.
            ownModelsAllowed,
        });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// ─── GET /api/ai-connections/providers ────────────────────────────────────────
/**
 * @swagger
 * /api/ai-connections/providers:
 *   get:
 *     summary: List the model providers a user can connect
 *     tags: [AI Connections]
 *     security:
 *       - bearerAuth: []
 */
router.get('/providers', auth, async (req, res) => {
    try {
        // Deny the connect UI entirely when the admin has not granted BYO
        // provider access, so a user is not invited to authorise a provider the
        // server will then refuse to use.
        const ownAllowed = await resolveOwnAIModelsAccess(req.user);
        if (!ownAllowed) {
            return res.status(403).json({
                message: 'Connecting your own AI provider is not enabled for your account.',
                code: 'OWN_AI_MODELS_DISABLED',
            });
        }
        // Deny the connect UI entirely when AI is switched off, so a user is not
        // invited to authorise a provider the server will then refuse to use.
        const access = await resolveAIAccess(req.user);
        if (!access.enabled) {
            return res.status(403).json({
                message: 'AI features are disabled for your account.',
                code: 'AI_DISABLED',
            });
        }
        res.json({ providers: listProviders(), aiEnabled: access.enabled });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// ─── POST /api/ai-connections/api-key ─────────────────────────────────────────
/**
 * @swagger
 * /api/ai-connections/api-key:
 *   post:
 *     summary: Connect an OpenRouter API key
 *     tags: [AI Connections]
 *     security:
 *       - bearerAuth: []
 */
router.post('/api-key', auth, async (req, res) => {
    try {
        if (!(await resolveOwnAIModelsAccess(req.user))) {
            return res.status(403).json({ message: 'Connecting your own AI provider is not enabled for your account.', code: 'OWN_AI_MODELS_DISABLED' });
        }
        const access = await resolveAIAccess(req.user);
        if (!access.enabled) {
            return res.status(403).json({ message: 'AI features are disabled for your account.', code: 'AI_DISABLED' });
        }

        const apiKey = String(req.body?.apiKey || '').trim();
        if (!apiKey) return res.status(400).json({ message: 'apiKey is required' });
        if (!OPENROUTER_KEY_RE.test(apiKey)) {
            return res.status(400).json({ message: 'That does not look like an OpenRouter key. Keys start with "sk-or-v1-".' });
        }

        // Confirm the key works before storing it, so the user is not told they
        // are connected and then silently failed over on their next generation.
        // This endpoint reports key metadata and does not consume credits.
        let verifiedLabel = null;
        try {
            const check = await safeFetch('https://openrouter.ai/api/v1/key', {
                headers: { Authorization: `Bearer ${apiKey}` },
                timeoutMs: 10000,
            });
            if (check.status === 401 || check.status === 403) {
                return res.status(400).json({ message: 'OpenRouter rejected that key.' });
            }
            if (check.status >= 200 && check.status < 300) {
                const data = JSON.parse(check.body);
                verifiedLabel = data?.data?.label || null;
            }
        } catch (_) {
            // Network trouble is not proof of a bad key. Store it anyway and let
            // the first real call report a genuine failure.
        }

        const userId = String(req.user._id);
        await AIModelConnection.findOneAndUpdate(
            { userId: req.user._id },
            {
                $set: {
                    provider: 'openrouter',
                    status: 'connected',
                    apiKeyEncrypted: seal('openrouter', 'apiKey', userId, apiKey),
                    // Clear the other provider's secrets so switching connections
                    // never leaves an unused credential behind.
                    accessTokenEncrypted: null,
                    refreshTokenEncrypted: null,
                    scope: null,
                    tokenExpiresAt: null,
                    model: req.body?.model || null,
                    lastError: null,
                    connectedAt: new Date(),
                },
            },
            { upsert: true, new: true }
        ).lean();

        res.json({ connected: true, provider: 'openrouter', label: verifiedLabel });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// ─── POST /api/ai-connections/gemini/start ────────────────────────────────────
/**
 * @swagger
 * /api/ai-connections/gemini/start:
 *   post:
 *     summary: Begin Gemini OAuth and return the consent URL
 *     tags: [AI Connections]
 *     security:
 *       - bearerAuth: []
 */
router.post('/gemini/start', auth, async (req, res) => {
    try {
        if (!(await resolveOwnAIModelsAccess(req.user))) {
            return res.status(403).json({ message: 'Connecting your own AI provider is not enabled for your account.', code: 'OWN_AI_MODELS_DISABLED' });
        }
        const access = await resolveAIAccess(req.user);
        if (!access.enabled) {
            return res.status(403).json({ message: 'AI features are disabled for your account.', code: 'AI_DISABLED' });
        }
        if (!process.env.GEMINI_OAUTH_CLIENT_ID) {
            return res.status(503).json({ message: 'Google sign-in is not available on this deployment yet.' });
        }

        const redirectUri = String(req.body?.redirectUri || '');
        if (!/^https?:\/\//i.test(redirectUri)) {
            return res.status(400).json({ message: 'A valid redirectUri is required' });
        }

        const state = b64url(crypto.randomBytes(32));
        const codeVerifier = b64url(crypto.randomBytes(48));
        const codeChallenge = b64url(
            crypto.createHash('sha256').update(codeVerifier).digest()
        );

        await AIOAuthState.create({
            state,
            userId: req.user._id,
            provider: 'gemini',
            codeVerifier,
            redirectUri,
            expiresAt: new Date(Date.now() + STATE_TTL_MS),
        });

        const params = new URLSearchParams({
            client_id: process.env.GEMINI_OAUTH_CLIENT_ID,
            redirect_uri: redirectUri,
            response_type: 'code',
            scope: gemini.scope,
            code_challenge: codeChallenge,
            code_challenge_method: 'S256',
            state,
            access_type: 'offline', // required to receive a refresh token
            prompt: 'consent',
        });

        res.json({
            authorizationUrl: `${gemini.authorizeUrl}?${params.toString()}`,
            state,
            // The verifier stays on the server; only the client-side round trip
            // needs to carry `state` back.
            redirectUri,
        });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// ─── POST /api/ai-connections/gemini/callback ─────────────────────────────────
/**
 * @swagger
 * /api/ai-connections/gemini/callback:
 *   post:
 *     summary: Complete Gemini OAuth by exchanging the code for tokens
 *     tags: [AI Connections]
 *     security:
 *       - bearerAuth: []
 */
router.post('/gemini/callback', auth, async (req, res) => {
    try {
        if (!(await resolveOwnAIModelsAccess(req.user))) {
            return res.status(403).json({ message: 'Connecting your own AI provider is not enabled for your account.', code: 'OWN_AI_MODELS_DISABLED' });
        }
        const { code, state } = req.body || {};
        if (!code || !state) {
            return res.status(400).json({ message: 'code and state are required' });
        }

        // `state` is single-use and bound to this user. A mismatch means the
        // callback does not belong to the session that started it, so reject
        // rather than complete someone else's flow.
        const pending = await AIOAuthState.findOneAndDelete({
            state: String(state),
            userId: req.user._id,
        }).lean();
        if (!pending) {
            return res.status(400).json({ message: 'This sign-in link has expired or was already used. Please try again.' });
        }
        if (new Date(pending.expiresAt).getTime() < Date.now()) {
            return res.status(400).json({ message: 'This sign-in link has expired. Please try again.' });
        }

        const tokens = await gemini.exchangeCode({
            code: String(code),
            redirectUri: pending.redirectUri,
            codeVerifier: pending.codeVerifier,
        });

        const userId = String(req.user._id);
        await AIModelConnection.findOneAndUpdate(
            { userId: req.user._id },
            {
                $set: {
                    provider: 'gemini',
                    status: 'connected',
                    accessTokenEncrypted: seal('gemini', 'accessToken', userId, tokens.accessToken),
                    refreshTokenEncrypted: tokens.refreshToken
                        ? seal('gemini', 'refreshToken', userId, tokens.refreshToken)
                        : null,
                    scope: tokens.scope,
                    tokenExpiresAt: tokens.expiresAt,
                    apiKeyEncrypted: null,
                    model: req.body?.model || null,
                    lastError: null,
                    connectedAt: new Date(),
                },
            },
            { upsert: true, new: true }
        ).lean();

        res.json({ connected: true, provider: 'gemini' });
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

// ─── DELETE /api/ai-connections ───────────────────────────────────────────────
/**
 * @swagger
 * /api/ai-connections:
 *   delete:
 *     summary: Disconnect and forget the user's AI provider credentials
 *     tags: [AI Connections]
 *     security:
 *       - bearerAuth: []
 */
router.delete('/', auth, async (req, res) => {
    try {
        // Delete rather than blank the fields: there is no reason to retain a
        // credential the user has explicitly asked us to forget.
        await AIModelConnection.deleteOne({ userId: req.user._id });
        await AIOAuthState.deleteMany({ userId: req.user._id });
        res.json({ connected: false });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

module.exports = router;
