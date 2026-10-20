const mongoose = require('mongoose');

// ─── Pending consent ──────────────────────────────────────────────────────────
// Between "the user was redirected here by a client" and "the user clicked
// Approve", the validated authorization request has to live somewhere.
//
// It lives here rather than in a cookie. The frontend and API are on different
// sites (vercel / render), so a cookie set by the API is not sent on the
// frontend's cross-site fetch — SameSite=Lax drops it and SameSite=None would
// require Secure and break local http development. Passing a short-lived,
// single-use id to the frontend sidesteps that entirely, and because the approve
// call still requires the user's own bearer token, the id is not a capability on
// its own: whoever holds it must also be signed in as the same user.

const MCPPendingConsentSchema = new mongoose.Schema({
    consentId: {
        type: String,
        required: true,
        unique: true,
        index: true,
    },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    clientId: { type: String, required: true },
    clientName: { type: String, required: true },
    clientUri: { type: String, default: null },

    redirectUri: { type: String, required: true },
    codeChallenge: { type: String, required: true },
    codeChallengeMethod: { type: String, required: true },
    resource: { type: String, required: true },

    // Exactly what is displayed on the consent screen. This is what gets
    // granted, never the scope the client originally asked for.
    consentedScopes: { type: [String], default: [] },

    state: { type: String, required: true },

    expiresAt: { type: Date, required: true },
}, { timestamps: true });

MCPPendingConsentSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('MCPPendingConsent', MCPPendingConsentSchema);
