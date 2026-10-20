// ─── MCP tool registry ───────────────────────────────────────────────────────
// Every tool declares, up front, three things that are checked on every call:
//
//   requiredScope — the OAuth grant the connected client must hold.
//   allowedRoles — who may ever use it.
//   effect        — 'read' | 'draft' | 'write' | 'render', which drives both the
//                   audit log and the confirmation requirement.
//
// Declaring these as data rather than burying the checks inside handlers is what
// lets `tools/list` advertise only what the caller may actually use, so a
// student is never shown a "create exam" tool they would only be denied.
//
// Defence in depth: the checks here are the primary control, and each handler
// still re-verifies ownership of whatever it is about to touch. Scope answers
// "may this client do this kind of thing"; ownership answers "may this user do
// this to *this record*". A client with `mcp:write` still cannot write to
// another teacher's classroom, and only the handler knows that.

const { SCOPES, hasScope } = require('../../utils/mcpOAuth');
const { isStaff, isStudent, isAdmin } = require('../../utils/mcpRoles');

const tools = new Map();

/**
 * @param {object} spec
 * @param {string} spec.name
 * @param {string} spec.description  shown to the model; say what it is for
 * @param {string} spec.effect       'read' | 'draft' | 'write' | 'render'
 * @param {string} spec.requiredScope
 * @param {string[]|null} spec.allowedRoles  null = any authenticated role
 * @param {object} spec.inputSchema  JSON Schema
 * @param {boolean} [spec.requiresConfirmation] writes default to true
 * @param {Function} spec.handler
 */
const register = (spec) => {
    if (tools.has(spec.name)) {
        throw new Error(`Duplicate MCP tool: ${spec.name}`);
    }
    tools.set(spec.name, {
        requiresConfirmation: spec.effect === 'write',
        allowedRoles: null,
        ...spec,
    });
};

/**
 * Tools the caller may currently use. Hidden tools are not listed and cannot be
 * called, so a client cannot even attempt them.
 */
const visibleTools = ({ scopes, role }) =>
    [...tools.values()]
        .filter((t) => (t.allowedRoles ? t.allowedRoles.includes(role) : true))
        .filter((t) => hasScope(scopes, t.requiredScope))
        .map((t) => ({
            name: t.name,
            description: t.description,
            inputSchema: t.inputSchema,
        }));

/**
 * Resolve a tool for execution. Returns `{ tool }` or `{ error }` with an
 * OAuth-style code so the transport can map it to the right status.
 */
const resolveTool = ({ name, scopes, role }) => {
    const tool = tools.get(name);
    if (!tool) {
        return { error: 'unknown_tool', message: `No tool named "${name}"` };
    }
    if (tool.allowedRoles && !tool.allowedRoles.includes(role)) {
        // Deliberately the same message as an unknown tool. Distinguishing
        // "exists but not for you" from "does not exist" would let a client
        // enumerate the server's capabilities.
        return { error: 'unknown_tool', message: `No tool named "${name}"` };
    }
    if (!hasScope(scopes, tool.requiredScope)) {
        return {
            error: 'insufficient_scope',
            message: `This connection is not authorised for "${name}". Reconnect with broader access.`,
        };
    }
    return { tool };
};

const getTool = (name) => tools.get(name);

// ─── File-bearing results ────────────────────────────────────────────────────
// Almost every tool returns JSON, which the transport formats as a text block. A
// few need to hand back an actual file — a generated slide deck is the case that
// motivates this — and those have to arrive as an MCP embedded resource, because a
// .pptx inside a JSON string is something no chat client will offer to download.
//
// A handler signals this by returning `resourceResult(...)` instead of a plain
// object. It is a tagged wrapper rather than a duck-typed check on the payload
// because every field of a tool result is attacker-influenced model output: a
// handler returning a natural `resource` key must not accidentally change the
// shape of its response.
const RESOURCE_RESULT = Symbol.for('mcp.resourceResult');

/**
 * @param {string} text           short summary for the model to read alongside the file
 * @param {object} resource       { uri, mimeType, blob } — blob is base64
 */
const resourceResult = (text, resource) => ({
    [RESOURCE_RESULT]: true,
    text,
    resource,
});

const isResourceResult = (value) =>
    Boolean(value && typeof value === 'object' && value[RESOURCE_RESULT]);

module.exports = {
    register,
    visibleTools,
    resolveTool,
    getTool,
    resourceResult,
    isResourceResult,
    SCOPES,
    isStaff,
    isStudent,
    isAdmin,
};
