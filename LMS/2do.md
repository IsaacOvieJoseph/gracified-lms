Todo
[✓] Phase 1: SSRF guard, token crypto, gate generate-* routes, close unauthenticated /ai/provider, rate limit AI
[✓] Phase 2: Per-user provider — model, registry (gemini OAuth + openrouter key), aiConnections routes, callAI resolution, admin-toggle precedence
[•] Phase 2b: Profile.jsx UI for connect/manage/disconnect
[ ] Phase 3: MCP core — models (MCPClient, MCPAuditLog, MCPOAuthCode), OAuth 2.1 AS (PRM, AS metadata, authorize, token, revoke, CIMD/DCR), Streamable HTTP transport
[ ] Phase 4: Role-partitioned read tools + audit logging
[ ] Phase 5: Draft tools wired to per-user provider resolution
[ ] Phase 6: Write tools with elicitation two-phase confirm gate
[ ] Phase 7: Tests — audience rejection, cross-user denial, toggle immediacy, confirm-token single-use