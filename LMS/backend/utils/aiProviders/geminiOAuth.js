// ─── Gemini adapter (OAuth, billed to the user's own Google account) ──────────
// Users connect with Google OAuth rather than pasting a key. Access tokens are
// short-lived, so every call checks expiry and refreshes through the token
// endpoint before use.

const { safeFetch } = require('../safeFetch');

const API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';
const SCOPE = 'https://www.googleapis.com/auth/generative-language';
const DEFAULT_MODEL = 'gemini-2.0-flash';

// The model id is interpolated into a URL path, so it is restricted to a
// conservative character class. Anything containing '/', '..', '?', '#' or a
// space is rejected outright rather than escaped.
const MODEL_RE = /^[a-z0-9][a-z0-9._-]{0,63}$/i;

const isValidModel = (model) =>
    typeof model === 'string' && model.length > 0 && MODEL_RE.test(model);

const normaliseModel = (model) => (isValidModel(model) ? model : DEFAULT_MODEL);

/** Exchange an authorization code for tokens. Called once, at connect time. */
const exchangeCode = async ({ code, redirectUri, codeVerifier }) => {
    if (!process.env.GEMINI_OAUTH_CLIENT_ID || !process.env.GEMINI_OAUTH_CLIENT_SECRET) {
        throw new Error('Gemini OAuth is not configured on this server (GEMINI_OAUTH_CLIENT_ID / _SECRET).');
    }

    const body = new URLSearchParams({
        code,
        client_id: process.env.GEMINI_OAUTH_CLIENT_ID,
        client_secret: process.env.GEMINI_OAUTH_CLIENT_SECRET,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
        code_verifier: codeVerifier,
    }).toString();

    const res = await safeFetch(TOKEN_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
        timeoutMs: 15000,
    });

    if (res.status < 200 || res.status >= 300) {
        throw new Error('Google rejected the authorization code');
    }
    const data = JSON.parse(res.body);
    if (!data.access_token) throw new Error('Google did not return an access token');
    return {
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        scope: data.scope || SCOPE,
        expiresAt: data.expires_in
            ? new Date(Date.now() + Number(data.expires_in) * 1000)
            : null,
    };
};

/** Refresh an expired access token using the stored refresh token. */
const refreshAccessToken = async ({ refreshToken }) => {
    if (!refreshToken) throw new Error('No refresh token available; reconnect your Google account.');
    if (!process.env.GEMINI_OAUTH_CLIENT_ID || !process.env.GEMINI_OAUTH_CLIENT_SECRET) {
        throw new Error('Gemini OAuth is not configured on this server.');
    }

    const body = new URLSearchParams({
        refresh_token: refreshToken,
        client_id: process.env.GEMINI_OAUTH_CLIENT_ID,
        client_secret: process.env.GEMINI_OAUTH_CLIENT_SECRET,
        grant_type: 'refresh_token',
    }).toString();

    const res = await safeFetch(TOKEN_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
        timeoutMs: 15000,
    });

    if (res.status < 200 || res.status >= 300) {
        const err = new Error('Google token refresh failed; reconnect your account.');
        err.disconnect = true;
        throw err;
    }
    const data = JSON.parse(res.body);
    if (!data.access_token) throw new Error('Google did not return a refreshed token');
    return {
        accessToken: data.access_token,
        expiresAt: data.expires_in
            ? new Date(Date.now() + Number(data.expires_in) * 1000)
            : null,
    };
};

/**
 * Refresh a little early so a token does not expire between the check and the
 * API call.
 */
const needsRefresh = (expiresAt) =>
    !expiresAt || expiresAt.getTime() <= Date.now() + 60_000;

const extractText = (data) => {
    const parts = data?.candidates?.[0]?.content?.parts;
    if (!Array.isArray(parts)) return '';
    return parts.map((part) => part?.text || '').join('');
};

const complete = async ({ accessToken, prompt, model, systemPrompt }) => {
    if (!accessToken) throw new Error('Gemini is not connected for this account');

    const res = await safeFetch(`${API_BASE}/${normaliseModel(model)}:generateContent`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            // OAuth bearer, not an API key in the query string — a key in the URL
            // ends up in logs and proxy traces.
            Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            systemInstruction: systemPrompt
                ? { parts: [{ text: systemPrompt }] }
                : undefined,
            generationConfig: { temperature: 0.7, maxOutputTokens: 4096 },
        }),
        timeoutMs: 60000,
        maxBytes: 4 * 1024 * 1024,
    });

    if (res.status === 401 || res.status === 403) {
        const err = new Error('Gemini rejected the connected Google account. Reconnect it in your profile.');
        err.code = 'PROVIDER_AUTH_FAILED';
        err.disconnect = true;
        throw err;
    }
    if (res.status === 429) {
        const err = new Error('Gemini rate limit or quota reached.');
        err.code = 'PROVIDER_RATE_LIMITED';
        throw err;
    }
    if (res.redirected) {
        throw new Error('Gemini returned an unexpected redirect');
    }
    if (res.status < 200 || res.status >= 300) {
        throw new Error(`Gemini error ${res.status}`);
    }

    const text = extractText(JSON.parse(res.body));
    if (!text) throw new Error('Gemini returned no content');
    return text;
};

module.exports = {
    id: 'gemini',
    provider: 'gemini',
    auth: 'oauth',
    label: 'Google Gemini',
    scope: SCOPE,
    authorizeUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    defaultModel: DEFAULT_MODEL,
    isValidModel,
    normaliseModel,
    exchangeCode,
    refreshAccessToken,
    needsRefresh,
    complete,
};
