const mongoose = require('mongoose');

// ─── MCP audit log ────────────────────────────────────────────────────────────
// Every tool call made through MCP is recorded here. This is the record a school
// administrator reads when a teacher asks "what did the assistant change in my
// classes", and it is the only way to investigate after a prompt-injection
// incident, because the caller's intent is not otherwise recoverable.
//
// Deliberately append-only from the application's point of view: no route
// updates or deletes these. Arguments are stored because knowing *what* was
// asked matters as much as knowing it was allowed.

const MCPAuditLogSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true,
    },
    schoolId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'School',
        default: null,
        index: true,
    },
    clientId: { type: String, required: true, index: true },

    tool: { type: String, required: true, index: true },
    // 'read' | 'draft' | 'write' | 'render' — lets an admin review changes without
    // reading every read. 'render' is a tool that produces a file for the user
    // without calling AI or persisting anything, so it must not be logged as either.
    effect: {
        type: String,
        enum: ['read', 'draft', 'write', 'render'],
        required: true,
    },

    arguments: { type: mongoose.Schema.Types.Mixed, default: {} },
    succeeded: { type: Boolean, required: true },
    errorCode: { type: String, default: null },

    // Confirmation provenance for mutations: which confirmation token authorised
    // this, and whether a human actually approved it or the client proceeded
    // without elicitation support.
    confirmationId: { type: String, default: null },
    confirmedByUser: { type: Boolean, default: null },

    durationMs: { type: Number, default: null },
}, { timestamps: true });

MCPAuditLogSchema.index({ createdAt: -1 });
MCPAuditLogSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model('MCPAuditLog', MCPAuditLogSchema);
