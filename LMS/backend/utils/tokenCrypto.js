// ─── Authenticated encryption for user-supplied provider secrets ──────────────
// Per-user AI connections store API keys and OAuth refresh tokens. Storing them
// in plaintext means a database read (a leaked backup, an over-broad admin
// query, a stray debug log of a Mongoose document) hands over paid API access
// for every connected user. So secrets are sealed with AES-256-GCM.
//
// Two properties matter beyond "it's encrypted":
//
// 1. *Authenticated.* GCM's tag means tampering is detected, not silently
//    decrypted into garbage that then gets sent to a provider.
//
// 2. *Bound to a context.* Every ciphertext carries the context string as GCM
//    additional-authenticated-data. A ciphertext sealed for
//    "openrouter:apiKey:<userA>" will not decrypt under
//    "openrouter:apiKey:<userB>". Without this, anyone who can write to the
//    collection could copy user A's stored key into user B's row and have the
//    server happily decrypt and use it against user B's account — a stored-key
//    laundering primitive that encryption alone does not prevent.

const crypto = require('crypto');

const VERSION = 'v1';
const ALGO = 'aes-256-gcm';
const IV_BYTES = 12; // 96-bit nonce, the size GCM is specified for
const TAG_BYTES = 16;
const KEY_BYTES = 32;

// Used only when no dedicated key is configured. Fixed on purpose: the salt has
// to be stable or previously written secrets become unreadable. Its job is only
// to stop a low-entropy passphrase from being attacked directly.
const FALLBACK_SALT = 'gracy:ai-secret-encryption:v1';

let cachedKey = null;

const deriveFallbackKey = () => {
    const source = process.env.JWT_SECRET;
    if (!source) {
        throw new Error(
            'No encryption key available. Set AI_SECRET_ENCRYPTION_KEY to a 32-byte base64 value, or set JWT_SECRET to derive one from.'
        );
    }
    return crypto.scryptSync(source, FALLBACK_SALT, KEY_BYTES);
};

const getMasterKey = () => {
    if (cachedKey) return cachedKey;

    const configured = process.env.AI_SECRET_ENCRYPTION_KEY;
    if (configured) {
        let key;
        if (/^[0-9a-f]{64}$/i.test(configured)) {
            key = Buffer.from(configured, 'hex');
        } else {
            key = Buffer.from(configured, 'base64');
        }
        if (key.length !== KEY_BYTES) {
            throw new Error(
                `AI_SECRET_ENCRYPTION_KEY must decode to exactly ${KEY_BYTES} bytes (got ${key.length}).`
            );
        }
        cachedKey = key;
        return cachedKey;
    }

    cachedKey = deriveFallbackKey();
    return cachedKey;
};

/** Test hook — forces the next call to re-read the environment. */
const resetKeyCache = () => {
    cachedKey = null;
};

/** Print this once to generate a key; the value goes in backend/.env. */
const generateMasterKey = () => crypto.randomBytes(KEY_BYTES).toString('base64');

const b64url = {
    encode: (buf) => Buffer.from(buf).toString('base64url'),
    decode: (str) => Buffer.from(String(str), 'base64url'),
};

/**
 * Seal a secret. `context` must uniquely identify what this secret IS, e.g.
 * `openrouter:apiKey:${userId}`. Omit it only for values you never need to
 * authenticate with later.
 */
const encryptSecret = (plaintext, context = '') => {
    if (typeof plaintext !== 'string' || plaintext.length === 0) {
        throw new Error('encryptSecret requires a non-empty string');
    }
    const iv = crypto.randomBytes(IV_BYTES);
    const cipher = crypto.createCipheriv(ALGO, getMasterKey(), iv);
    if (context) cipher.setAAD(Buffer.from(context, 'utf8'));
    const ciphertext = Buffer.concat([
        cipher.update(plaintext, 'utf8'),
        cipher.final(),
    ]);
    const tag = cipher.getAuthTag();
    return [
        VERSION,
        b64url.encode(iv),
        b64url.encode(tag),
        b64url.encode(ciphertext),
    ].join('.');
};

/**
 * Open a sealed secret. Throws if the blob was tampered with, was sealed under a
 * different context, or was sealed with a different key.
 */
const decryptSecret = (blob, context = '') => {
    if (typeof blob !== 'string' || !blob) {
        throw new Error('decryptSecret requires a sealed string');
    }
    const parts = blob.split('.');
    if (parts.length !== 4 || parts[0] !== VERSION) {
        throw new Error('Unrecognised secret format');
    }
    const iv = b64url.decode(parts[1]);
    const tag = b64url.decode(parts[2]);
    const ciphertext = b64url.decode(parts[3]);
    if (iv.length !== IV_BYTES || tag.length !== TAG_BYTES) {
        throw new Error('Corrupt secret');
    }

    const decipher = crypto.createDecipheriv(ALGO, getMasterKey(), iv);
    if (context) decipher.setAAD(Buffer.from(context, 'utf8'));
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
};

/**
 * Decrypt without throwing. A secret that fails to open is unusable — it may
 * have been sealed under an old key — and callers should treat it as absent
 * rather than crashing a request.
 */
const tryDecryptSecret = (blob, context = '') => {
    if (!blob) return null;
    try {
        return decryptSecret(blob, context);
    } catch (_) {
        return null;
    }
};

/**
 * A secret safe to show in logs and UI: last four characters only. Enough for a
 * user to recognise which key they connected, useless to anyone who reads it.
 */
const maskSecret = (secret) => {
    if (typeof secret !== 'string' || secret.length < 8) return '••••';
    return `${'•'.repeat(Math.max(4, secret.length - 4))}${secret.slice(-4)}`;
};

module.exports = {
    encryptSecret,
    decryptSecret,
    tryDecryptSecret,
    maskSecret,
    generateMasterKey,
    resetKeyCache,
};
