// ─── Tool result formatting ───────────────────────────────────────────────────
// Turns whatever a tool handler returned into MCP `content` blocks. Split out of
// the transport so it can be tested without standing up a server, and so the
// text-vs-resource decision has one home.

const { isResourceResult } = require('../mcp/tools/registry');

/**
 * Most tools return data and it becomes a single text block.
 *
 * A tool that produced a real file returns a tagged resource result instead, and
 * that becomes a text block plus an embedded resource — which is how a generated
 * .pptx reaches the user as something they can open, rather than a base64 wall of
 * text in the transcript. The file travels base64-encoded inline because the
 * server keeps no copy: the deck is rebuilt per request and the client only ever
 * holds what it was just sent.
 *
 * Error results are never given the resource treatment. A handler that throws is
 * reporting a failure, and pairing a failure with a file would be misleading.
 */
const toolContent = (payload, isError = false) => {
    if (!isError && isResourceResult(payload)) {
        const { uri, mimeType, blob } = payload.resource;
        return {
            content: [
                { type: 'text', text: payload.text || 'A file was generated.' },
                { type: 'resource', resource: { uri, mimeType, blob } },
            ],
            isError: false,
        };
    }

    // A resource result can still reach here with isError set, if a caller wraps a
    // handler's return value rather than letting it throw. Stringifying it wholesale
    // would inline the entire base64 file into an error message, so the file is
    // dropped and only the summary survives.
    const text =
        typeof payload === 'string'
            ? payload
            : isResourceResult(payload)
              ? payload.text || 'A file was generated.'
              : JSON.stringify(payload, null, 2);

    return { content: [{ type: 'text', text }], isError };
};

module.exports = { toolContent };
