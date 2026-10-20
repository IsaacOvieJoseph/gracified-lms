const express = require('express');

const { mcpAuth } = require('../middleware/mcpAuth');
const User = require('../models/User');
const MCPAuditLog = require('../models/MCPAuditLog');
const { visibleTools, resolveTool } = require('../mcp/tools/registry');
const { issueConfirmation, consumeConfirmation, splitConfirmation } = require('../utils/mcpConfirm');
const { assertAIAccess } = require('../utils/aiAccess');

// Registering tools is a side effect of importing them.
require('../mcp/tools/read');
require('../mcp/tools/draft');
require('../mcp/tools/files');
require('../mcp/tools/write');

const router = express.Router();

const PROTOCOL_VERSION = '2025-11-25';
const SUPPORTED_VERSIONS = ['2026-07-28', '2025-11-25', '2025-06-18'];
const SERVER_INFO = { name: 'gracy-lms', version: '1.0.0' };

// JSON-RPC error codes. Using the spec's reserved range where one exists, so
// clients can distinguish protocol faults from tool faults.
const RPC = {
    PARSE_ERROR: -32700,
    INVALID_REQUEST: -32600,
    METHOD_NOT_FOUND: -32601,
    INVALID_PARAMS: -32602,
    INTERNAL_ERROR: -32603,
    // Tool-level outcome reported inside a successful result, not as a JSON-RPC
    // error, so the model can read the explanation and react.
    REQUEST_FAILED: -32000,
};

const rpcError = (id, code, message, data) => ({
    jsonrpc: '2.0',
    id: id ?? null,
    error: { code, message, ...(data ? { data } : {}) },
});

const rpcResult = (id, result) => ({ jsonrpc: '2.0', id: id ?? null, result });

// Formatting a tool's return value into MCP content blocks lives in one place,
// shared with the tests, since the text-vs-embedded-resource decision is what turns
// a generated deck into a downloadable file rather than unreadable output.
const { toolContent } = require('../utils/mcpContent');

const audit = (entry) =>
    MCPAuditLog.create(entry).catch((err) =>
        // Auditing must never turn a working tool call into an error, but a
        // silent failure would hide a real problem, so surface it in the logs.
        console.error('[mcp] audit log write failed:', err.message)
    );

// ─── initialize ──────────────────────────────────────────────────────────────

const handleInitialize = (id, params) => {
    const requested = params?.protocolVersion;
    // Echo the client's version when we speak it, otherwise offer our newest
    // and let it decide whether to continue.
    const negotiated = SUPPORTED_VERSIONS.includes(requested)
        ? requested
        : PROTOCOL_VERSION;

    return rpcResult(id, {
        protocolVersion: negotiated,
        capabilities: {
            // We surface tools only. Advertising resources or prompts we do not
            // implement would make clients wait on features that never arrive.
            tools: { listChanged: false },
            logging: {},
        },
        serverInfo: SERVER_INFO,
        instructions:
            'Gracy is a school management platform. Reading tools return only the connected user\'s own data. ' +
            'Every change must be confirmed by the user before it is applied: call a write tool without a ' +
            'confirmationId first, show the user the returned preview, and call it again with the ' +
            'confirmationId only once they approve.',
    });
};

// ─── tools/call ──────────────────────────────────────────────────────────────

const handleToolsCall = async (req, id, params) => {
    const { user, clientId, scopes, role } = req.mcp;

    const name = params?.name;
    if (typeof name !== 'string' || !name) {
        return rpcError(id, RPC.INVALID_PARAMS, 'tools/call requires a tool name');
    }

    // Arguments are model-generated, so treat them as untrusted input regardless
    // of the shape the schema suggests. The confirmation id is transport
    // bookkeeping, not part of the change, so it is lifted out here before
    // anything hashes them: left in place it would make phase 2 fingerprint
    // differently from phase 1 and the approval could never be consumed — the
    // write would fail permanently rather than merely awkwardly. Both spellings
    // are accepted because the response returns `confirmationId` while earlier
    // callers used `confirmId`.
    const { confirmId, args } = splitConfirmation(params, params?.arguments);

    const resolved = resolveTool({ name, scopes, role });
    if (resolved.error) {
        // A hidden tool should be indistinguishable from a nonexistent one, but
        // the transport still needs to say something actionable.
        return rpcError(id, RPC.METHOD_NOT_FOUND, resolved.message, { code: resolved.error });
    }
    const { tool } = resolved;

    const startedAt = Date.now();
    const baseAudit = {
        userId: user._id,
        schoolId: user.schoolId?.[0] || null,
        clientId,
        tool: name,
        effect: tool.effect,
        arguments: args,
    };

    // Writes: two-phase confirmation before any handler runs.
    let confirmationId = null;
    if (tool.requiresConfirmation) {
        if (!confirmId) {
            // Phase 1: ask the tool what it *would* do. `preview` only describes
            // the change; it must not mutate.
            const preview = await tool.handler({ user, args, role, scope: 'preview' });

            const issued = await issueConfirmation({
                userId: user._id,
                clientId,
                toolName: name,
                args,
                preview: typeof preview === 'string' ? preview : JSON.stringify(preview),
            });

            await audit({
                ...baseAudit,
                succeeded: true,
                confirmationId: issued.confirmationId,
                confirmedByUser: false,
                durationMs: Date.now() - startedAt,
            });

            // Ask the client to put this in front of the human.
            return {
                ...rpcResult(id, {
                    ...toolContent(
                        {
                            status: 'awaiting_confirmation',
                            confirmationId: issued.confirmationId,
                            expiresInSeconds: issued.expiresInSeconds,
                            message:
                                'This change has NOT been applied. Show these details to the user and ask them to approve. ' +
                                'If they approve, call this tool again — the confirmationId goes as a top-level field next ' +
                                'to arguments (or inside arguments if that is easier), under either the name confirmationId or confirmId.',
                            proposedChange: preview,
                        },
                        false
                    ),
                    // MCP elicitation: the client is expected to prompt the user
                    // and only re-issue the call on approval.
                    elicitation: {
                        action: 'accept',
                        requestedSchema: {
                            type: 'object',
                            properties: {
                                approved: { type: 'boolean', title: 'Apply this change?' },
                            },
                            required: ['approved'],
                        },
                        message: `Apply this change via ${name}?`,
                    },
                }),
            };
        }

        const consumed = await consumeConfirmation({
            confirmationId: String(confirmId),
            userId: user._id,
            clientId,
            toolName: name,
            args,
        });
        if (!consumed.ok) {
            await audit({
                ...baseAudit,
                succeeded: false,
                errorCode: consumed.error,
                confirmationId: String(confirmId),
                durationMs: Date.now() - startedAt,
            });
            return rpcResult(id, toolContent({ error: consumed.message }, true));
        }
        confirmationId = String(confirmId);
    }

    try {
        // Whether this user may use AI at all was already decided in mcpAuth,
        // once per request, so it does not need repeating here.
        const result = await tool.handler({ user, args, role, scope: 'execute' });

        // Meter the generation, but only after it succeeded. Charging up front
        // would penalise a failed draft, and a quota error raised at this point
        // would misreport work the user has already been billed for and already
        // received — so it is recorded and not thrown.
        if (tool.effect === 'draft') {
            await assertAIAccess(user, { consume: true }).catch((err) => {
                console.error('[mcp] could not record AI usage:', err.message);
            });
        }

        await audit({
            ...baseAudit,
            succeeded: true,
            confirmationId,
            confirmedByUser: confirmationId ? true : null,
            durationMs: Date.now() - startedAt,
        });

        return rpcResult(id, toolContent(result, false));
    } catch (err) {
        await audit({
            ...baseAudit,
            succeeded: false,
            errorCode: err.code || 'TOOL_ERROR',
            confirmationId,
            durationMs: Date.now() - startedAt,
        });

        // Tool failures are reported as results with isError, so the model can
        // explain the problem and try something else. Only protocol faults use
        // JSON-RPC errors.
        const status = err.status === 403 || err.status === 429 ? err.status : undefined;
        return rpcResult(id, toolContent({ error: err.message, code: err.code || 'TOOL_ERROR', status }, true));
    }
};

// ─── Dispatch ────────────────────────────────────────────────────────────────

const handleRpc = async (req, message) => {
    const { id, method, params } = message;

    // Notifications have no id and expect no response.
    const isNotification = id === undefined || id === null;
    if (isNotification && typeof method === 'string' && method.startsWith('notifications/')) {
        return null;
    }

    switch (method) {
        case 'initialize':
            return handleInitialize(id, params);
        case 'ping':
            return rpcResult(id, {});
        case 'tools/list':
            return rpcResult(id, { tools: visibleTools({ scopes: req.mcp.scopes, role: req.mcp.role }) });
        case 'tools/call':
            return handleToolsCall(req, id, params);
        case 'completion/complete':
        case 'resources/list':
        case 'prompts/list':
            // Declined rather than answered with empty lists so a client can tell
            // "not supported" from "you have nothing".
            return rpcError(id, RPC.METHOD_NOT_FOUND, `${method} is not supported by this server`);
        default:
            return rpcError(id, RPC.METHOD_NOT_FOUND, `Unknown method: ${method}`);
    }
};

router.post('/', mcpAuth, async (req, res) => {
    // Streamable HTTP: accept a single request or a batch, reply with a single
    // response or a batch. Batching is capped so one request cannot pin the
    // event loop with thousands of tool calls.
    const MAX_BATCH = 20;
    const payload = req.body;

    res.set('MCP-Protocol-Version', req.headers['mcp-protocol-version'] || PROTOCOL_VERSION);

    if (Array.isArray(payload)) {
        if (payload.length === 0) {
            return res.status(400).json(rpcError(null, RPC.INVALID_REQUEST, 'Batch must not be empty'));
        }
        if (payload.length > MAX_BATCH) {
            return res.status(400).json(
                rpcError(null, RPC.INVALID_REQUEST, `Batch exceeds the ${MAX_BATCH} message limit`)
            );
        }
        const responses = [];
        for (const message of payload) {
            const response = await handleRpc(req, message);
            if (response) responses.push(response);
        }
        // A batch of pure notifications gets an empty body, not an empty array.
        return responses.length ? res.json(responses) : res.status(202).end();
    }

    if (!payload || typeof payload !== 'object' || payload.jsonrpc !== '2.0') {
        return res.status(400).json(rpcError(null, RPC.INVALID_REQUEST, 'Expected a JSON-RPC 2.0 request'));
    }
    if (typeof payload.method !== 'string') {
        return res.status(400).json(rpcError(payload.id, RPC.INVALID_REQUEST, 'method must be a string'));
    }

    const response = await handleRpc(req, payload);
    if (!response) return res.status(202).end();
    return res.json(response);
});

/** GET is for the server-initiated stream; we only send responses. */
router.get('/', mcpAuth, (req, res) => {
    res.set('Allow', 'POST');
    res.status(405).json(rpcError(null, RPC.INVALID_REQUEST, 'Use POST for MCP messages'));
});

router.delete('/', mcpAuth, (req, res) => {
    // Stateless per-request transport: there is no session to terminate, so
    // terminating is a successful no-op rather than an error.
    res.status(204).end();
});

module.exports = router;
