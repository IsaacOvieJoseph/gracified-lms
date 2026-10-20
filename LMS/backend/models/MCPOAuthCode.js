const mongoose = require('mongoose');

// ─── MCP authorization codes ──────────────────────────────────────────────────
// Single-use, short-lived (10 minutes) codes exchanged for tokens. The PKCE
// verifier is kept here rather than being expected back from the client, because
// it must be compared server-side at exchange time.

const MCPOAuthCodeSchema = new mongoose.Schema({
    codeHash: {
        // Only the hash is stored: a dump of this collection must not yield
        // usable authorization codes.
        type: String,
        required: true,
        unique: true,
        index: true,
    },
    clientId: { type: String, required: true, index: true },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    redirectUri: { type: String, required: true },
    scope: { type: String, required: true },
    codeChallenge: { type: String, required: true },
    codeChallengeMethod: { type: String, required: true },

    // Exact scope set that was displayed on the consent screen. The token
    // endpoint grants this, never the raw `scope` the client sent, so consent
    // cannot be widened after the fact.
    consentedScopes: { type: [String], default: [] },

    resource: { type: String, required: true },
    expiresAt: { type: Date, required: true },
}, { timestamps: true });

MCPOAuthCodeSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('MCPOAuthCode', MCPOAuthCodeSchema);
