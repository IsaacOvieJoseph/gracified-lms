const mongoose = require('mongoose');

// ─── Pending provider OAuth state ─────────────────────────────────────────────
// Holds the CSRF `state` and the PKCE `code_verifier` between the moment we send
// the user to the provider and the moment they come back with a code.
//
// The verifier is kept server-side rather than in the browser: a `state` value
// that travels through the URL bar, browser history and possibly a referrer
// header should not be the only thing standing between an attacker and a forged
// callback. Documents expire quickly and are removed by MongoDB's TTL monitor.
//
// `expiresAt` exists purely to carry the TTL index; there is no application logic
// that should trust it, since a document surviving past its TTL would mean a
// clock problem, not a valid state.

const AIOAuthStateSchema = new mongoose.Schema({
    state: {
        type: String,
        required: true,
        unique: true,
        index: true
    },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    provider: {
        type: String,
        enum: ['gemini'],
        required: true
    },
    codeVerifier: { type: String, required: true },
    redirectUri: { type: String, required: true },
    expiresAt: { type: Date, required: true },
}, { timestamps: true });

AIOAuthStateSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('AIOAuthState', AIOAuthStateSchema);
