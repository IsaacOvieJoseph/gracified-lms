// ─── OpenRouter adapter ───────────────────────────────────────────────────────
// Users connect an OpenRouter API key to spend their own credits. The endpoint
// below is a constant and must never be built from request input — the model id
// is the only caller-influenced value, so it is format-checked before it reaches
// a URL or a header.

const { safeFetch } = require('../safeFetch');

const ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions';
const DEFAULT_MODEL = 'google/gemini-2.0-flash-001';

// Model ids appear in a JSON body, not a URL, but they are still constrained:
// OpenRouter ids are vendor/model, optionally with a provider suffix after a
// colon. Anything else is a mistake or an injection attempt.
const MODEL_RE = /^[a-z0-9][a-z0-9._-]*\/[a-z0-9][a-z0-9._-]*(:[a-z0-9._-]+)?$/i;

const isValidModel = (model) =>
    typeof model === 'string' && model.length > 0 && model.length <= 128 && MODEL_RE.test(model);

const normaliseModel = (model) => (isValidModel(model) ? model : DEFAULT_MODEL);

const extractText = (data) => {
    const content = data?.choices?.[0]?.message?.content;
    if (typeof content === 'string') return content;
    // Some models return a content-parts array instead of a plain string.
    if (Array.isArray(content)) {
        return content.map((part) => (typeof part === 'string' ? part : part?.text || '')).join('');
    }
    return '';
};

/**
 * @param {object} args
 * @param {string} args.apiKey  decrypted user key
 * @param {string} args.prompt
 * @param {string} [args.model]
 * @param {string} [args.systemPrompt]
 * @param {string} [args.appUrl]  used only for OpenRouter's optional attribution headers
 */
const complete = async ({ apiKey, prompt, model, systemPrompt, appUrl }) => {
    if (!apiKey) throw new Error('OpenRouter API key is not connected');

    const res = await safeFetch(ENDPOINT, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
            ...(appUrl ? { 'HTTP-Referer': appUrl } : {}),
            'X-Title': 'Gracy',
        },
        body: JSON.stringify({
            model: normaliseModel(model),
            messages: [
                ...(systemPrompt ? [{ role: 'system', content: systemPrompt }] : []),
                { role: 'user', content: prompt },
            ],
            temperature: 0.7,
        }),
        timeoutMs: 60000,
        maxBytes: 4 * 1024 * 1024,
    });

    if (res.status === 401 || res.status === 403) {
        const err = new Error('OpenRouter rejected the connected API key. Reconnect it in your profile.');
        err.code = 'PROVIDER_AUTH_FAILED';
        err.disconnect = true;
        throw err;
    }
    if (res.status === 429) {
        const err = new Error('OpenRouter rate limit or credit limit reached.');
        err.code = 'PROVIDER_RATE_LIMITED';
        throw err;
    }
    if (res.redirected) {
        throw new Error('OpenRouter returned an unexpected redirect');
    }
    if (res.status < 200 || res.status >= 300) {
        throw new Error(`OpenRouter error ${res.status}`);
    }

    let data;
    try {
        data = JSON.parse(res.body);
    } catch (_) {
        throw new Error('OpenRouter returned an unreadable response');
    }

    const text = extractText(data);
    if (!text) throw new Error('OpenRouter returned no content');
    return text;
};

module.exports = {
    id: 'gemini-openrouter',
    provider: 'openrouter',
    auth: 'api_key',
    label: 'OpenRouter',
    defaultModel: DEFAULT_MODEL,
    isValidModel,
    normaliseModel,
    complete,
};
