const mongoose = require('mongoose');

// ─── Per-user AI provider connection ──────────────────────────────────────────
// One document per user, holding the credentials for the model provider that
// user chose to connect to their own account. Requests are then billed to the
// user rather than the platform, and an admin can never see or spend a user's
// key (secrets are sealed — see utils/tokenCrypto).
//
// Deliberately a separate collection rather than a subdocument on User: it keeps
// encrypted secret material out of the user documents that get read constantly
// by ordinary requests, and lets a connection be revoked or expired without
// touching the account record.

const AIModelConnectionSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        unique: true,
        index: true
    },

    provider: {
        type: String,
        enum: ['gemini', 'openrouter'],
        required: true
    },

    // Only 'connected' connections may be used to serve a request. 'pending'
    // exists so an OAuth flow that has not been completed yet cannot be spent.
    status: {
        type: String,
        enum: ['pending', 'connected', 'error'],
        default: 'pending'
    },

    // Sealed with AES-256-GCM, bound by AAD to `<provider>:<field>:<userId>` so a
    // ciphertext cannot be moved between users or fields. Never selected by
    // default in queries, never logged, never returned by the API.
    apiKeyEncrypted: { type: String, default: null },
    accessTokenEncrypted: { type: String, default: null },
    refreshTokenEncrypted: { type: String, default: null },

    // OAuth (Gemini). Plain expiry metadata is not sensitive and lets us refresh
    // proactively instead of failing mid-request.
    scope: { type: String, default: null },
    tokenExpiresAt: { type: Date, default: null },

    // Optional per-user model override, validated against the provider's
    // allowlist at connect time.
    model: { type: String, default: null },

    lastUsedAt: { type: Date, default: null },
    lastError: { type: String, default: null },

    connectedAt: { type: Date, default: null },
}, { timestamps: true });

module.exports = mongoose.model('AIModelConnection', AIModelConnectionSchema);
