const mongoose = require('mongoose');

// ─── Access grants ───────────────────────────────────────────────────────────
// One document per grant (per refresh-token family). Access tokens are stateless
// JWTs and valid for an hour, so on their own they cannot be withdrawn: a user
// who disconnects an app in their profile, or revokes it via RFC 7009, would
// still find the old token working until it expired.
//
// The `sid` claim in an access token names the grant it came from. Revoking a
// grant therefore kills every access token in that family on the next request,
// while leaving other apps the user has connected untouched.
//
// Writes are upserted as the family rotates, so the document follows the grant
// rather than the individual token.

const MCPAccessGrantSchema = new mongoose.Schema({
    family: { type: String, required: true, unique: true, index: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    clientId: { type: String, required: true, index: true },
    scope: { type: String, required: true },
    resource: { type: String, required: true },
    revokedAt: { type: Date, default: null },
    revokedReason: { type: String, default: null },
}, { timestamps: true });

// Supports the "show me every app connected to my account" listing.
MCPAccessGrantSchema.index({ userId: 1, clientId: 1 });

module.exports = mongoose.model('MCPAccessGrant', MCPAccessGrantSchema);
