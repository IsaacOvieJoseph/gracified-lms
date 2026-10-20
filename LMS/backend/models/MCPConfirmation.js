const mongoose = require('mongoose');

// ─── Pending write confirmations ─────────────────────────────────────────────
// One document per "the user was asked to approve this change". Created when a
// write tool is called without a confirmation, consumed when it is called with
// one. Documents are deleted on use and expired by TTL, so a stale approval can
// never authorise a later write.
//
// `argsHash` is the important field: it pins the approval to the exact arguments
// that were shown to the user. Without it, an approval obtained for one action
// could be replayed to perform a different one.

const MCPConfirmationSchema = new mongoose.Schema({
    confirmationId: {
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
    toolName: { type: String, required: true },
    argsHash: { type: String, required: true },

    // What the user was shown, retained for the audit trail.
    preview: { type: String, default: '' },

    expiresAt: { type: Date, required: true },
}, { timestamps: true });

MCPConfirmationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('MCPConfirmation', MCPConfirmationSchema);
