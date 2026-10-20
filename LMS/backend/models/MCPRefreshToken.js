const mongoose = require('mongoose');

// ─── MCP refresh tokens ───────────────────────────────────────────────────────
// Stored as opaque random strings, hashed at rest, with rotation and family
// reuse detection.
//
// The family mechanism is the important part. Each refresh issues a new token in
// the same `family` and marks the old one rotated. If a token that was already
// rotated is presented again, that means either the legitimate client replayed
// it or someone stole a copy — we cannot tell which. The safe response is to
// assume compromise and revoke the entire family, forcing a fresh sign-in.
// Continuing to honour a replayed token would silently keep a stolen session
// alive while the real user believes they are safe.

const MCPRefreshTokenSchema = new mongoose.Schema({
    tokenHash: {
        type: String,
        required: true,
        unique: true,
        index: true,
    },
    family: {
        type: String,
        required: true,
        index: true,
    },
    clientId: { type: String, required: true, index: true },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    scope: { type: String, required: true },
    resource: { type: String, required: true },

    rotatedAt: { type: Date, default: null },
    // Why the family was killed, for the audit trail.
    revokedAt: { type: Date, default: null },
    revokedReason: { type: String, default: null },

    expiresAt: { type: Date, required: true },
}, { timestamps: true });

MCPRefreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('MCPRefreshToken', MCPRefreshTokenSchema);
