// ─── Provider resolution ──────────────────────────────────────────────────────
// Decides which model provider serves a given request. The rule the product
// promises: a user's own connection is used when they have one, and the
// platform's provider otherwise — so nobody pays for AI they did not agree to.
//
// What this module deliberately does NOT do is decide whether AI is allowed at
// all. That is assertAIAccess()'s job, and callers must have run it first.
// Keeping the two apart is what stops "use my own key" from becoming a bypass
// for an administrator's kill switch: a disabled account is refused before
// provider resolution is ever reached, whether or not it has a working key.

const AIModelConnection = require('../../models/AIModelConnection');
const Settings = require('../../models/Settings');
const { resolveOwnAIModelsAccess } = require('../aiAccess');
const { encryptSecret, decryptSecret, tryDecryptSecret } = require('../tokenCrypto');

const openrouter = require('./openrouter');
const gemini = require('./geminiOAuth');
const platform = require('./platform');

const PROVIDERS = {
    openrouter,
    gemini,
};

const providerMeta = () => ({
    openrouter: {
        id: 'openrouter',
        label: openrouter.label,
        auth: 'api_key',
        defaultModel: openrouter.defaultModel,
        instructions:
            'Create an API key at openrouter.ai/keys and paste it here. Requests are billed to your own OpenRouter account.',
    },
    gemini: {
        id: 'gemini',
        label: gemini.label,
        auth: 'oauth',
        defaultModel: gemini.defaultModel,
        instructions: 'Sign in with Google to connect your own Gemini account.',
    },
});

/** AAD context — must match exactly at seal and open time. */
const secretContext = (provider, field, userId) => `${provider}:${field}:${userId}`;

const seal = (provider, field, userId, value) =>
    value ? encryptSecret(value, secretContext(provider, field, userId)) : null;

const open = (provider, field, userId, blob) =>
    tryDecryptSecret(blob, secretContext(provider, field, userId));

const listProviders = () => Object.values(providerMeta());

/**
 * Build the completion function for a user, decrypting their credentials on
 * demand. Returns null when there is no usable connection, so the caller can
 * fall back to the platform provider.
 *
 * @returns {Promise<null | {provider: string, label: string, source: 'user', model: string, complete: Function}>}
 */
const resolveUserProvider = async (user) => {
    // A root admin can revoke BYO access per school / tutor. When revoked, the
    // stored connection must stop serving requests, so fall back to the
    // platform provider instead of silently continuing to spend the user's own
    // credentials. The connection row is left intact so re-granting is instant.
    if (!(await resolveOwnAIModelsAccess(user))) return null;

    const conn = await AIModelConnection.findOne({ userId: user._id }).lean();
    if (!conn || conn.status !== 'connected') return null;

    const adapter = PROVIDERS[conn.provider];
    if (!adapter) return null;

    try {
        if (conn.provider === 'openrouter') {
            const apiKey = open('openrouter', 'apiKey', String(user._id), conn.apiKeyEncrypted);
            if (!apiKey) {
                await markBroken(user._id, 'Stored key could not be decrypted; please reconnect.');
                return null;
            }
            return {
                provider: 'openrouter',
                label: openrouter.label,
                source: 'user',
                model: adapter.normaliseModel(conn.model),
                complete: (prompt, opts = {}) =>
                    adapter.complete({ apiKey, prompt, model: conn.model, ...opts }),
            };
        }

        if (conn.provider === 'gemini') {
            let accessToken = open('gemini', 'accessToken', String(user._id), conn.accessTokenEncrypted);
            const refreshToken = open('gemini', 'refreshToken', String(user._id), conn.refreshTokenEncrypted);

            if (gemini.needsRefresh(conn.tokenExpiresAt)) {
                if (!refreshToken) {
                    await markBroken(user._id, 'Google connection expired; please reconnect.');
                    return null;
                }
                const refreshed = await gemini.refreshAccessToken({ refreshToken });
                accessToken = refreshed.accessToken;
                await AIModelConnection.updateOne(
                    { userId: user._id },
                    {
                        $set: {
                            accessTokenEncrypted: seal('gemini', 'accessToken', String(user._id), refreshed.accessToken),
                            tokenExpiresAt: refreshed.expiresAt,
                            status: 'connected',
                            lastError: null,
                        },
                    }
                );
            }
            if (!accessToken) return null;

            return {
                provider: 'gemini',
                label: gemini.label,
                source: 'user',
                model: adapter.normaliseModel(conn.model),
                complete: (prompt, opts = {}) =>
                    adapter.complete({ accessToken, prompt, model: conn.model, ...opts }),
            };
        }
    } catch (err) {
        // If the provider cannot be reached, fall back to the platform provider
        // rather than failing the request — but record why, so the user sees a
        // reconnect prompt in their profile instead of silent retries.
        await markBroken(user._id, err.message);
        return null;
    }

    return null;
};

/**
 * Flag a connection as unusable and record why it failed.
 *
 * The sealed credentials are deliberately left in place. A provider outage or a
 * dropped connection should not force the user through a full OAuth dance to get
 * back what they already authorised, and 'error' already prevents the connection
 * from being used until they reconnect. The reconnect flow overwrites the
 * secrets anyway.
 */
const markBroken = async (userId, message) => {
    try {
        await AIModelConnection.updateOne(
            { userId },
            { $set: { status: 'error', lastError: String(message).slice(0, 300) } }
        );
    } catch (_) {
        // Never let bookkeeping failure mask the original error.
    }
};

/** Drop the platform provider for a user when their own key reports failure. */
const markUsed = async (userId) => {
    try {
        await AIModelConnection.updateOne({ userId }, { $set: { lastUsedAt: new Date() } });
    } catch (_) {
        // Non-critical.
    }
};

/**
 * Resolve the provider for a request: the user's own connection if they have
 * one, otherwise the deployment's active provider.
 *
 * @returns {Promise<{source: 'user'|'platform', provider: string, label: string,
 *                    complete: (prompt: string, opts?: object) => Promise<string>}>}
 */
const resolveProvider = async (user) => {
    const own = await resolveUserProvider(user);
    if (own) {
        const userId = user._id;
        return {
            ...own,
            complete: async (prompt, opts = {}) => {
                try {
                    const text = await own.complete(prompt, opts);
                    markUsed(userId);
                    return text;
                } catch (err) {
                    if (err.disconnect) await markBroken(userId, err.message);
                    throw err;
                }
            },
        };
    }

    const settings = await Settings.findOne().lean();
    const provider = settings?.activeAIProvider || 'groq';
    return {
        source: 'platform',
        provider,
        label: platform.providerLabel(provider),
        complete: (prompt, opts = {}) => platform.complete({ provider, prompt, ...opts }),
    };
};

module.exports = {
    resolveProvider,
    resolveUserProvider,
    listProviders,
    providerMeta,
    seal,
    open,
    secretContext,
    markBroken,
    PROVIDERS,
};
