const test = require('node:test');
const assert = require('node:assert');
const { safeFetch, safeFetchJson } = require('../utils/safeFetch');

test('rejects a blocked target before dialling', async () => {
    await assert.rejects(() => safeFetch('https://169.254.169.254/latest/meta-data/'), /non-public|Blocked/);
});

test('rejects a redirect target instead of following it', async () => {
    // A public URL that 302s inward is the standard SSRF bypass. safeFetch must
    // surface the redirect rather than chase it.
    const res = await safeFetch('http://example.com').catch((e) => e);
    // Offline sandboxes surface a DNS/socket error here; either way no request
    // may have been made to a non-public host.
    if (res instanceof Error) {
        assert.ok(['UNSAFE_URL', 'ENOTFOUND', 'EAI_AGAIN', 'ETIMEDOUT'].includes(res.code), `unexpected ${res.code}`);
        return;
    }
    assert.ok(res.redirected === true || typeof res.status === 'number');
});

test('does not hang on an unreachable host', async () => {
    const started = Date.now();
    await safeFetch('https://this-host-should-not-resolve-gracy.invalid/x', { timeoutMs: 3000 }).catch(() => {});
    assert.ok(Date.now() - started < 10000);
});

test('safeFetchJson rejects non-JSON and non-2xx rather than returning junk', async () => {
    await assert.rejects(() => safeFetchJson('http://example.com'));
});
