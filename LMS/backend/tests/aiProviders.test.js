const test = require('node:test');
const assert = require('node:assert');

const gemini = require('../utils/aiProviders/geminiOAuth');
const openrouter = require('../utils/aiProviders/openrouter');
const platform = require('../utils/aiProviders/platform');

test('gemini rejects model ids that could escape the URL path', () => {
    // These end up interpolated into ".../models/<model>:generateContent", so a
    // traversal or query separator would let a caller redirect the request.
    const hostile = [
        '../../admin',
        'gemini?key=stolen',
        'gemini#frag',
        'gemini/../other',
        'a b',
        'gemini:generateContent/../../x',
        'gemini%2f..%2f',
        '',
        'x'.repeat(200),
    ];
    for (const m of hostile) {
        assert.strictEqual(gemini.isValidModel(m), false, `expected ${JSON.stringify(m)} to be rejected`);
    }
});

test('gemini accepts ordinary model names and normalises anything else', () => {
    assert.strictEqual(gemini.isValidModel('gemini-2.0-flash'), true);
    assert.strictEqual(gemini.isValidModel('gemini-2.5-pro'), true);
    assert.strictEqual(gemini.normaliseModel('gemini-2.0-flash'), 'gemini-2.0-flash');
    assert.strictEqual(gemini.normaliseModel('../../etc'), gemini.defaultModel);
    assert.strictEqual(gemini.normaliseModel(undefined), gemini.defaultModel);
});

test('openrouter requires a vendor/model pair and rejects junk', () => {
    assert.strictEqual(openrouter.isValidModel('google/gemini-2.0-flash-001'), true);
    assert.strictEqual(
        openrouter.isValidModel('anthropic/claude-sonnet-4:free'),
        true
    );
    for (const m of ['gemini-2.0-flash', '../../x', 'a/b/c', '', 'x'.repeat(300)]) {
        assert.strictEqual(openrouter.isValidModel(m), false, `expected ${JSON.stringify(m)} to be rejected`);
    }
    assert.strictEqual(openrouter.normaliseModel('nonsense'), openrouter.defaultModel);
});

test('openrouter reads content from both string and part-array shapes', () => {
    const extract = (data) => {
        const content = data?.choices?.[0]?.message?.content;
        if (typeof content === 'string') return content;
        if (Array.isArray(content)) {
            return content.map((p) => (typeof p === 'string' ? p : p?.text || '')).join('');
        }
        return '';
    };
    assert.strictEqual(extract({ choices: [{ message: { content: 'plain' } }] }), 'plain');
    assert.strictEqual(
        extract({ choices: [{ message: { content: [{ type: 'text', text: 'a' }, { type: 'text', text: 'b' }] } }] }),
        'ab'
    );
    assert.strictEqual(extract({}), '');
});

test('platform gemini request authenticates with the API key', () => {
    // Regression: the key was checked for existence but never sent, so every
    // platform Gemini call was unauthenticated and came back 403.
    const original = process.env.GEMINI_MODEL;
    process.env.GEMINI_MODEL = 'gemini-2.0-flash';
    try {
        const { url, options } = platform.buildGeminiRequest({
            prompt: 'hi',
            systemPrompt: 'sys',
            apiKey: 'test-key-123',
        });

        assert.match(url, /generativelanguage\.googleapis\.com\/v1beta\/models\/gemini-2\.0-flash:generateContent/);
        assert.strictEqual(options.method, 'POST');
        // Must be present, and as a header so it cannot leak into a URL/log.
        assert.strictEqual(options.headers['x-goog-api-key'], 'test-key-123');
        assert.ok(!url.includes('test-key-123'), 'key must not appear in the URL');

        const body = JSON.parse(options.body);
        assert.strictEqual(body.contents[0].parts[0].text, 'hi');
        assert.strictEqual(body.systemInstruction.parts[0].text, 'sys');
    } finally {
        if (original === undefined) delete process.env.GEMINI_MODEL;
        else process.env.GEMINI_MODEL = original;
    }
});

test('platform gemini refuses to call without a key configured', async () => {
    const original = process.env.GEMINI_API_KEY;
    delete process.env.GEMINI_API_KEY;
    try {
        await assert.rejects(
            () => platform.complete({ provider: 'gemini', prompt: 'hi' }),
            /No AI provider is available/
        );
    } finally {
        if (original !== undefined) process.env.GEMINI_API_KEY = original;
    }
});

test('platform groq request uses the OpenAI max_tokens field', () => {
    // Regression: Groq rejected every call with 400 because the body carried
    // Gemini's `maxOutputTokens` instead of OpenAI's `max_tokens`.
    const { url, options } = platform.buildGroqRequest({
        prompt: 'hi',
        systemPrompt: 'sys',
        apiKey: 'groq-key',
    });

    assert.match(url, /api\.groq\.com\/openai\/v1\/chat\/completions/);
    assert.strictEqual(options.headers.Authorization, 'Bearer groq-key');

    const body = JSON.parse(options.body);
    assert.strictEqual(body.max_tokens, 4096);
    assert.ok(!('maxOutputTokens' in body), 'Gemini field must not be sent to Groq');
    assert.strictEqual(body.messages[0].content, 'sys');
    assert.strictEqual(body.messages[1].content, 'hi');
});

test('platform gemini request uses the Gemini maxOutputTokens field', () => {
    // The mirror of the Groq case: Gemini's generationConfig uses maxOutputTokens,
    // not max_tokens.
    const { options } = platform.buildGeminiRequest({ prompt: 'hi', apiKey: 'k' });
    const body = JSON.parse(options.body);
    assert.strictEqual(body.generationConfig.maxOutputTokens, 4096);
    assert.ok(!('max_tokens' in body));
});

test('upstream errors carry the provider detail when present', () => {
    const err = platform.upstreamError('Gemini', {
        status: 403,
        body: JSON.stringify({ error: { status: 'PERMISSION_DENIED', message: 'API has not been used' } }),
    });
    assert.match(err.message, /Gemini error 403/);
    assert.match(err.message, /API has not been used/);

    const bare = platform.upstreamError('Groq', { status: 500, body: 'not json' });
    assert.strictEqual(bare.message, 'Groq error 500');
});
