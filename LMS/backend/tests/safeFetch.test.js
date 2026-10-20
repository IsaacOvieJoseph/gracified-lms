const test = require('node:test');
const assert = require('node:assert');

const { isBlockedAddress, assertSafeUrl } = require('../utils/safeFetch');

// Every address here is one an SSRF payload would reach for. If any of them
// becomes reachable, safeFetch is decorative.
const MUST_BLOCK = [
    // loopback
    '127.0.0.1', '127.1.2.3', '127.255.255.254',
    // RFC1918
    '10.0.0.5', '10.255.255.255', '172.16.0.1', '172.31.255.255', '192.168.1.1',
    // link-local + cloud metadata
    '169.254.169.254', '169.254.0.1',
    // CGNAT
    '100.64.0.1',
    // reserved / broadcast / multicast
    '0.0.0.0', '255.255.255.255', '224.0.0.1', '240.0.0.1',
    // protocol assignments + documentation ranges
    '192.0.0.1', '192.0.2.5', '198.18.0.1', '198.51.100.7', '203.0.113.9',
    // IPv6 loopback / unspecified / link-local / unique-local / multicast
    '::1', '::', 'fe80::1', 'fc00::1', 'fd12:3456:789a::1', 'ff02::1',
    // IPv4-embedded forms must be unwrapped and re-checked
    '::ffff:127.0.0.1', '::ffff:169.254.169.254', '::ffff:10.0.0.1',
    '::ffff:192.168.0.1', '64:ff9b::7f00:1',
    // discard + documentation
    '100::1', '2001:db8::1',
    // fc00::/7 spans fc00..fdff, so the top of that range is blocked too
    'fcff::1', 'fdff:ffff::1', 'fd12:3456:789a::1',
];

// Addresses that must stay usable, including the boundaries immediately
// outside each blocked range — off-by-one errors here silently re-open SSRF.
const MUST_ALLOW = [
    '8.8.8.8', '1.1.1.1', '142.250.185.78', '172.15.0.1', '172.32.0.1',
    '11.0.0.1', '9.255.255.255', '100.63.255.255', '100.128.0.1',
    '126.255.255.255', '128.0.0.1', '192.0.1.1', '198.20.0.1', '203.0.112.1',
    '169.253.169.253', '169.255.0.1', '223.255.255.255',
    '2606:4700:4700::1111', '2a00:1450:4001:81b::200e',
    // first byte differs from fc/fd but second byte 0xff would collide with a
    // low-bit-only comparison
    'fbff::1', 'fbff:ffff::1',
    // just outside fe80::/10 (link-local ends at febf)
    'fe00::1', 'fec0::1',
    '::ffff:8.8.8.8', '::ffff:1.1.1.1',
];

test('blocks every non-public IPv4 range', () => {
    for (const ip of MUST_BLOCK.filter((a) => /^\d/.test(a))) {
        assert.strictEqual(isBlockedAddress(ip), true, `expected ${ip} to be blocked`);
    }
});

test('blocks every non-public IPv6 range, unwrapping IPv4-embedded forms', () => {
    for (const ip of MUST_BLOCK.filter((a) => !/^\d/.test(a))) {
        assert.strictEqual(isBlockedAddress(ip), true, `expected ${ip} to be blocked`);
    }
});

test('allows public addresses and range boundaries', () => {
    for (const ip of MUST_ALLOW) {
        assert.strictEqual(isBlockedAddress(ip), false, `expected ${ip} to be allowed`);
    }
});

test('blocks metadata hostnames regardless of resolution', () => {
    assert.strictEqual(isBlockedAddress('169.254.169.254'), true);
    assert.strictEqual(isBlockedAddress('metadata.google.internal'), true);
    assert.strictEqual(isBlockedAddress('metadata.goog'), true);
});

test('handles dns.lookup record objects ({ address, family })', () => {
    // dns.promises.lookup(..., { all: true }) returns objects, and safeFetch
    // passes them straight in. Regression for "address.toLowerCase is not a
    // function", which crashed every real outbound call.
    assert.strictEqual(isBlockedAddress({ address: '127.0.0.1', family: 4 }), true);
    assert.strictEqual(isBlockedAddress({ address: '169.254.169.254', family: 4 }), true);
    assert.strictEqual(isBlockedAddress({ address: '10.0.0.1', family: 4 }), true);
    assert.strictEqual(isBlockedAddress({ address: '::1', family: 6 }), true);
    assert.strictEqual(isBlockedAddress({ address: 'fc00::1', family: 6 }), true);

    assert.strictEqual(isBlockedAddress({ address: '8.8.8.8', family: 4 }), false);
    assert.strictEqual(isBlockedAddress({ address: '2606:4700:4700::1111', family: 6 }), false);
    assert.strictEqual(isBlockedAddress({ address: '::ffff:127.0.0.1', family: 6 }), true);
});

test('rejects a record object missing the address field', () => {
    assert.strictEqual(isBlockedAddress({ family: 4 }), true);
});

test('rejects non-https, credentialed, and localhost URLs before any socket', () => {
    assert.throws(() => assertSafeUrl('http://example.com'), /Only https/);
    assert.throws(() => assertSafeUrl('https://user:pass@example.com'), /embedded credentials/);
    assert.throws(() => assertSafeUrl('https://localhost/x'), /Blocked host/);
    assert.throws(() => assertSafeUrl('https://sub.localhost/x'), /Blocked host/);
    assert.throws(() => assertSafeUrl('not-a-url'), /Malformed URL/);
    assert.doesNotThrow(() => assertSafeUrl('https://generativelanguage.googleapis.com/v1/models'));
});