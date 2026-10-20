const mongoose = require('mongoose');

// ─── Registered MCP clients ───────────────────────────────────────────────────
// An MCP client is a third-party application (Claude, ChatGPT, Gemini, or a
// user's own integration) that connects to this server as an OAuth client.
//
// Client identity is either pre-registered here, or supplied as a Client ID
// Metadata Document (RFC 7591 style) referenced by an https URL, or registered
// dynamically. See routes/mcpOAuth.js for how the three are validated — that
// validation is where the security of the whole flow lives, not here.

const MCPClientSchema = new mongoose.Schema({
    clientId: {
        type: String,
        required: true,
        unique: true,
        index: true
    },

    // How this client proved who it is.
    registrationType: {
        type: String,
        enum: ['pre_registered', 'cimd', 'dcr'],
        default: 'pre_registered',
    },

    // Pre-registered clients authenticate with this secret. CIMD and DCR
    // clients are public and authenticate with PKCE alone, which is why this is
    // null for them rather than an empty string.
    clientSecretHash: { type: String, default: null },

    clientName: { type: String, required: true },
    clientUri: { type: String, default: null },
    logoUri: { type: String, default: null },

    redirectUris: { type: [String], default: [] },

    // Ceiling on what this client may ever be granted, intersected with the
    // scopes requested at authorization time. A client cannot widen its own
    // permissions by asking for more.
    allowedScopes: { type: [String], default: [] },

    // Set when a user or admin revokes the client entirely.
    revokedAt: { type: Date, default: null },
    revokedReason: { type: String, default: null },

    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null,
    },
}, { timestamps: true });

MCPClientSchema.methods.isActive = function isActive() {
    return !this.revokedAt;
};

module.exports = mongoose.model('MCPClient', MCPClientSchema);
