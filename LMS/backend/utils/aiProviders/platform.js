// ─── Platform provider (server-funded fallback) ───────────────────────────────
// These run on the deployment's own keys. They are used when a user has not
// connected their own provider, so the product still works out of the box.
//
// Important: reaching a platform provider is never a way around an admin
// switch. Callers must have already run assertAIAccess(), which denies the
// request outright when AI is disabled at any level.

const { safeFetch } = require('../safeFetch');

const GROQ_MODEL = () => process.env.GROQ_MODEL || 'openai/gpt-oss-20b';
const GEMINI_MODEL = () => process.env.GEMINI_MODEL || 'gemini-2.0-flash';

const SYSTEM_PROMPT =
    'You are an expert educator and curriculum designer. Always respond with valid JSON only — no markdown, no extra text.';

const stripFences = (text) => text.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();

/**
 * Build the upstream error, including the provider's own message when present.
 * "Gemini error 403" alone hides the actual cause (disabled API, bad key,
 * missing scope) and made a missing credential header hard to spot.
 */
const upstreamError = (label, res) => {
    let detail = '';
    try {
        const parsed = JSON.parse(res.body);
        detail = parsed?.error?.message || parsed?.error?.status || '';
    } catch (_) {
        // Non-JSON body (gateway HTML, empty) — fall back to the bare status.
    }
    const suffix = detail ? `: ${String(detail).slice(0, 300)}` : '';
    return new Error(`${label} error ${res.status}${suffix}`);
};

const GROQ_ENDPOINT = 'https://api.groq.com/openai/v1/chat/completions';

const buildGroqRequest = ({ prompt, systemPrompt, apiKey }) => ({
    url: GROQ_ENDPOINT,
    options: {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
            model: GROQ_MODEL(),
            messages: [
                { role: 'system', content: systemPrompt || SYSTEM_PROMPT },
                { role: 'user', content: prompt },
            ],
            temperature: 0.7,
            // Groq is OpenAI-compatible: the output cap is `max_tokens`.
            // `maxOutputTokens` is Gemini's spelling and makes Groq reject the
            // entire request with 400 "property 'maxOutputTokens' is unsupported".
            max_tokens: 4096,
        }),
        timeoutMs: 60000,
    },
});

const completeGroq = async ({ prompt, systemPrompt }) => {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey || apiKey === 'your_groq_api_key_here') {
        throw new Error(
            'No AI provider is available. Connect your own provider in your profile, or ask an administrator to configure one.'
        );
    }

    const { url, options } = buildGroqRequest({ prompt, systemPrompt, apiKey });
    const res = await safeFetch(url, options);

    if (res.status < 200 || res.status >= 300) {
        throw upstreamError('Groq', res);
    }
    const text = res.body ? JSON.parse(res.body)?.choices?.[0]?.message?.content || '' : '';
    if (!text) throw new Error('Groq returned no content');
    return text;
};

const buildGeminiRequest = ({ prompt, systemPrompt, apiKey }) => ({
    url: `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL()}:generateContent`,
    options: {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            // The key must actually be sent. It goes in a header rather than a
            // `?key=` query parameter so it never lands in logs or proxy traces.
            'x-goog-api-key': apiKey,
        },
        body: JSON.stringify({
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            systemInstruction: systemPrompt ? { parts: [{ text: systemPrompt }] } : undefined,
            generationConfig: { temperature: 0.7, maxOutputTokens: 4096 },
        }),
        timeoutMs: 60000,
    },
});

const completeGemini = async ({ prompt, systemPrompt }) => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey === 'your_gemini_api_key_here') {
        throw new Error(
            'No AI provider is available. Connect your own provider in your profile, or ask an administrator to configure one.'
        );
    }

    const { url, options } = buildGeminiRequest({ prompt, systemPrompt, apiKey });
    const res = await safeFetch(url, options);

    if (res.status < 200 || res.status >= 300) {
        throw upstreamError('Gemini', res);
    }
    const data = JSON.parse(res.body);
    const parts = data?.candidates?.[0]?.content?.parts;
    const text = Array.isArray(parts) ? parts.map((p) => p?.text || '').join('') : '';
    if (!text) throw new Error('Gemini returned no content');
    return stripFences(text);
};

/**
 * @param {'groq'|'gemini'} provider deployment-wide active provider
 */
const complete = ({ provider, prompt, systemPrompt }) =>
    provider === 'gemini' ? completeGemini({ prompt, systemPrompt }) : completeGroq({ prompt, systemPrompt });

module.exports = {
    complete,
    SYSTEM_PROMPT,
    stripFences,
    providerLabel: (p) => (p === 'gemini' ? 'Google Gemini' : 'Groq'),
    buildGeminiRequest,
    buildGroqRequest,
    upstreamError,
};
