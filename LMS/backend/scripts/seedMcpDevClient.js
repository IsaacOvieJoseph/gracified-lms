// ─── Register a development MCP client ───────────────────────────────────────
// The MCP server has no client yet, so even a fully deployed instance cannot be
// exercised: OAuth authorizes *a client*, and without a pre-registered one every
// token request fails before it reaches the user. This script creates exactly one
// confidential client for local development.
//
// It stores only the SHA-256 of the secret, matching how the token endpoint
// compares presented secrets (constant-time compare of the hash). The plaintext
// is printed to stdout once so it can be pasted into an MCP client configuration
// (Claude Code: `claude mcp add ... --env` / `desktop`, Cursor, etc.).
//
// Config via env, all optional:
//   MCP_DEV_CLIENT_ID       default "gracy-dev-assistant"
//   MCP_DEV_CLIENT_NAME     default "Gracy Development Assistant"
//   MCP_DEV_CLIENT_SECRET   default: generated and printed
//   MCP_DEV_REDIRECT_URIS   comma-separated. Important: the authorize endpoint
//                           rejects any redirect not listed here.
//   MCP_DEV_CLIENT_URI      link to the app, optional
//
// Safe to run multiple times: it upserts on clientId, so the second run with the
// same client id simply refreshes the record instead of stacking duplicates.
//
//   node scripts/seedMcpDevClient.js

require('dotenv').config();
const crypto = require('crypto');
const mongoose = require('mongoose');
const MCPClient = require('../models/MCPClient');
const { hashOpaque, ALL_SCOPES } = require('../utils/mcpOAuth');

const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/lms';

const clientId = process.env.MCP_DEV_CLIENT_ID || 'gracy-dev-assistant';
const clientName = process.env.MCP_DEV_CLIENT_NAME || 'Gracy Development Assistant';
const clientSecret = process.env.MCP_DEV_CLIENT_SECRET || crypto.randomBytes(24).toString('base64url');
const clientUri = process.env.MCP_DEV_CLIENT_URI || null;
const redirectUris = process.env.MCP_DEV_REDIRECT_URIS
    ? process.env.MCP_DEV_REDIRECT_URIS.split(',').map((s) => s.trim()).filter(Boolean)
    : ['http://127.0.0.1:8085/callback'];

const run = async () => {
    await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 10000 });
    console.log(`connected: ${mongoUri}`);

    const result = await MCPClient.updateOne(
        { clientId },
        {
            $set: {
                registrationType: 'pre_registered',
                clientName,
                clientUri: clientUri || undefined,
                redirectUris,
                allowedScopes: ALL_SCOPES,
                clientSecretHash: hashOpaque(clientSecret),
                revokedAt: null,
                revokedReason: null,
            },
            $unset: { createdBy: 1 },
        },
        { upsert: true }
    );

    const doc = await MCPClient.findOne({ clientId }).lean();
    console.log(result.upsertedCount ? 'created' : 'updated', clientId);
    console.log('registered client:', JSON.stringify({
        clientId: doc.clientId,
        clientName: doc.clientName,
        redirectUris: doc.redirectUris,
        allowedScopes: doc.allowedScopes,
        registrationType: doc.registrationType,
    }, null, 2));
    console.log('');
    console.log('  CLIENT_ID =', clientId);
    console.log('  CLIENT_SECRET =', clientSecret);
    console.log('');
    console.log('Paste those into your MCP client. Add the Dev OAuth URL from the environment you deploy under.');
};

run()
    .then(() => mongoose.disconnect())
    .then(() => process.exit(0))
    .catch((err) => {
        console.error('seed failed:', err.message);
        mongoose.disconnect().finally(() => process.exit(1));
    });