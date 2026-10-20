const test = require('node:test');
const assert = require('node:assert');

const {
    validateCIMD,
    isValidRedirectUri,
    redirectUriAllowed,
    sanitiseRedirectUris,
    isLoopback,
} = require('../utils/mcpClients');

// ─── Redirect URI validation ─────────────────────────────────────────────────

test('redirect URI matching is exact, not prefix or substring', () => {
    // Each of these is a way an attacker tries to have someone else's
    // authorization code delivered to them.
    const registered = ['https://claude.ai/oauth/callback'];
    const attacks = [
        'https://claude.ai.evil.com/oauth/callback',
        'https://evil.com/?next=https://claude.ai/oauth/callback',
        'https://evil.com/https://claude.ai/oauth/callback',
        'https://claude.ai/oauth/callback/../../evil',
        'https://claude.ai/oauth/callback?x=1',
        'HTTPS://CLAUDE.AI/oauth/callback', // case differs: compare as exact strings
        'http://claude.ai/oauth/callback',
    ];
    for (const uri of attacks) {
        assert.strictEqual(
            redirectUriAllowed(uri, registered),
            false,
            `must not accept ${uri}`
        );
    }
    assert.strictEqual(redirectUriAllowed('https://claude.ai/oauth/callback', registered), true);
    assert.strictEqual(redirectUriAllowed('https://claude.ai/oauth/callback', []), false);
    assert.strictEqual(redirectUriAllowed('https://claude.ai/oauth/callback', undefined), false);
});

test('redirect URIs must be https, loopback, or a custom scheme', () => {
    assert.strictEqual(isValidRedirectUri('https://app.example.com/cb'), true);
    assert.strictEqual(isValidRedirectUri('http://localhost:3000/cb'), true);
    assert.strictEqual(isValidRedirectUri('http://127.0.0.1:8080/cb'), true);
    assert.strictEqual(isValidRedirectUri('gracy://oauth/callback'), true);
    assert.strictEqual(isValidRedirectUri('myapp://cb'), true);

    // Plain http to a remote host would expose the code in transit.
    assert.strictEqual(isValidRedirectUri('http://app.example.com/cb'), false);
    assert.strictEqual(isValidRedirectUri('ftp://example.com/cb'), false);
    assert.strictEqual(isValidRedirectUri('javascript:alert(1)'), false);
    assert.strictEqual(isValidRedirectUri('data:text/html,x'), false);
    assert.strictEqual(isValidRedirectUri(''), false);
    assert.strictEqual(isValidRedirectUri(null), false);
    assert.strictEqual(isValidRedirectUri(undefined), false);
});

test('wildcards are never permitted in a redirect URI', () => {
    assert.strictEqual(isValidRedirectUri('https://*.example.com/cb'), false);
    assert.strictEqual(isValidRedirectUri('https://example.com/*'), false);
});

test('over-long redirect URIs are rejected', () => {
    assert.strictEqual(isValidRedirectUri(`https://example.com/${'a'.repeat(600)}`), false);
});

test('sanitiseRedirectUris filters invalid entries and caps the count', () => {
    const out = sanitiseRedirectUris([
        'https://good.example/cb',
        'http://evil.example/cb',
        'javascript:alert(1)',
        'gracy://cb',
    ]);
    assert.deepStrictEqual(out, ['https://good.example/cb', 'gracy://cb']);
    assert.strictEqual(sanitiseRedirectUris(undefined).length, 0);
    assert.strictEqual(sanitiseRedirectUris('https://x/cb').length, 0);

    const many = Array.from({ length: 50 }, (_, i) => `https://e${i}.example/cb`);
    assert.ok(sanitiseRedirectUris(many).length <= 10);
});

// ─── CIMD validation ─────────────────────────────────────────────────────────

test('CIMD must be served as a JSON object with a name and a valid redirect', () => {
    const clientId = 'https://app.example.com/mcp.json';
    const client = validateCIMD(clientId, {
        client_name: 'Example Client',
        redirect_uris: ['https://app.example.com/cb'],
    });
    assert.strictEqual(client.clientName, 'Example Client');
    assert.deepStrictEqual(client.redirectUris, ['https://app.example.com/cb']);
    assert.strictEqual(client.registrationType, 'cimd');

    for (const bad of [null, [], 'string', 42]) {
        assert.throws(() => validateCIMD(clientId, bad), /JSON object/);
    }
});

test('CIMD with no usable redirect_uri is rejected', () => {
    assert.throws(
        () => validateCIMD('https://a.example/m.json', {
            client_name: 'A',
            redirect_uris: ['http://insecure.example/cb'],
        }),
        /at least one valid https redirect_uri/
    );
    assert.throws(
        () => validateCIMD('https://a.example/m.json', { client_name: 'A' }),
        /at least one valid redirect_uri|redirect_uri/
    );
});

test('CIMD without a client_name is rejected', () => {
    // Without a name there is nothing truthful to show the user on the consent
    // screen, which is the whole basis of the consent decision.
    for (const name of ['', '   ', undefined, null, 42, 'x'.repeat(200)]) {
        assert.throws(
            () => validateCIMD('https://a.example/m.json', {
                client_name: name,
                redirect_uris: ['https://a.example/cb'],
            }),
            /client_name/,
            `expected name ${JSON.stringify(name)} rejected`
        );
    }
});

test('CIMD cannot impersonate a different client_id', () => {
    // Without this check any hosted page could serve metadata claiming to be an
    // already-trusted client.
    assert.throws(
        () => validateCIMD('https://mine.example/m.json', {
            client_id: 'https://trusted.example/m.json',
            client_name: 'Trusted',
            redirect_uris: ['https://mine.example/cb'],
        }),
        /does not match the requested client_id/
    );
});

test('CIMD logo and client URIs must be https', () => {
    const client = validateCIMD('https://a.example/m.json', {
        client_name: 'A',
        redirect_uris: ['https://a.example/cb'],
        client_uri: 'javascript:alert(1)',
        logo_uri: 'http://insecure.example/logo.png',
    });
    assert.strictEqual(client.clientUri, null);
    assert.strictEqual(client.logoUri, null);
});

test('isLoopback only accepts local http', () => {
    assert.strictEqual(isLoopback('http://localhost:3000/cb'), true);
    assert.strictEqual(isLoopback('http://127.0.0.1/cb'), true);
    assert.strictEqual(isLoopback('https://localhost/cb'), false);
    assert.strictEqual(isLoopback('http://localhost.evil.com/cb'), false);
    assert.strictEqual(isLoopback('nonsense'), false);
});
