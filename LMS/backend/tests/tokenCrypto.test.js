const test = require('node:test');
const assert = require('node:assert');

process.env.AI_SECRET_ENCRYPTION_KEY = require('node:crypto')
    .randomBytes(32)
    .toString('base64');

const {
    encryptSecret,
    decryptSecret,
    tryDecryptSecret,
    maskSecret,
    resetKeyCache,
} = require('../utils/tokenCrypto');

const CTX_A = 'openrouter:apiKey:userA';
const CTX_B = 'openrouter:apiKey:userB';

test('round-trips a secret', () => {
    const secret = 'sk-or-v1-0123456789abcdef0123456789abcdef';
    const sealed = encryptSecret(secret, CTX_A);
    assert.notStrictEqual(sealed, secret, 'must not be stored in plaintext');
    assert.ok(!sealed.includes(secret));
    assert.strictEqual(decryptSecret(sealed, CTX_A), secret);
});

test('produces a distinct ciphertext per call (random IV)', () => {
    const a = encryptSecret('same-value', CTX_A);
    const b = encryptSecret('same-value', CTX_A);
    assert.notStrictEqual(a, b, 'identical IVs would leak equality');
});

test('refuses to decrypt under a different context', () => {
    // This is the property that stops user A's stored key being copied into
    // user B's row and decrypted with user B's context.
    const sealed = encryptSecret('user-a-private-key', CTX_A);
    assert.throws(() => decryptSecret(sealed, CTX_B), /unable to authenticate|Unsupported state/i);
});

test('detects tampering with ciphertext, IV, and tag', () => {
    const sealed = encryptSecret('secret-value', CTX_A);
    const [version, iv, tag, ct] = sealed.split('.');

    const flip = (str, index) => {
        const bytes = Buffer.from(str, 'base64url');
        bytes[index] ^= 0x01;
        return `${version}.${iv}.${tag}.${bytes.toString('base64url')}`;
    };
    assert.throws(() => decryptSecret(flip(ct, 0), CTX_A));
    assert.throws(() => decryptSecret(flip(iv, 0), CTX_A));
    assert.throws(() => decryptSecret(flip(tag, 0), CTX_A));
});

test('rejects malformed and empty input rather than returning junk', () => {
    assert.throws(() => decryptSecret(''), /sealed string/);
    assert.throws(() => decryptSecret('not-sealed'), /Unrecognised secret format/);
    assert.throws(() => decryptSecret('v2.a.b.c'), /Unrecognised secret format/);
    assert.throws(() => encryptSecret('', CTX_A), /non-empty string/);
    assert.strictEqual(tryDecryptSecret(null), null);
    assert.strictEqual(tryDecryptSecret('garbage'), null);
});

test('tryDecryptSecret swallows a context mismatch instead of throwing', () => {
    const sealed = encryptSecret('secret', CTX_A);
    assert.strictEqual(tryDecryptSecret(sealed, CTX_B), null);
    assert.strictEqual(tryDecryptSecret(sealed, CTX_A), 'secret');
});

test('maskSecret never reveals more than the last four characters', () => {
    const masked = maskSecret('sk-or-v1-abcdefghijklmnop');
    assert.ok(!masked.includes('abcdefghij'));
    assert.ok(masked.endsWith('mnop'));
    assert.strictEqual(maskSecret('short'), '••••');
});

test('a different master key cannot open the ciphertext', () => {
    const sealed = encryptSecret('secret', CTX_A);
    resetKeyCache();
    const original = process.env.AI_SECRET_ENCRYPTION_KEY;
    process.env.AI_SECRET_ENCRYPTION_KEY = require('node:crypto').randomBytes(32).toString('base64');
    try {
        assert.throws(() => decryptSecret(sealed, CTX_A));
    } finally {
        process.env.AI_SECRET_ENCRYPTION_KEY = original;
        resetKeyCache();
    }
});
