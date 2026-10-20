import React, { useCallback, useEffect, useState } from 'react';
import api from '../../utils/api';
import { toast } from 'react-hot-toast';
import {
    Bot, Loader2, ShieldCheck, Unplug, ExternalLink, Info,
} from 'lucide-react';

const SCOPE_LABELS = {
    'mcp:read': 'Read your data',
    'mcp:draft': 'Generate drafts',
    'mcp:write': 'Make changes',
};

/**
 * Lists the AI assistants connected to this account and lets the user revoke
 * them.
 *
 * A connection is a standing grant, so it needs a visible off switch in the same
 * place as everything else the user controls. Revoking here ends the grant
 * immediately — the server kills the live access tokens too, so a disconnected
 * assistant stops working straight away rather than when its token happens to
 * expire.
 */
const MCPConnectionsSection = () => {
    const [connections, setConnections] = useState([]);
    const [loading, setLoading] = useState(true);
    const [busyClient, setBusyClient] = useState(null);

    const load = useCallback(async () => {
        try {
            const res = await api.get('/mcp/oauth/connections', { skipLoader: true });
            setConnections(res.data.connections || []);
        } catch {
            // The endpoint is authenticated and rate limited like everything else;
            // failing to load should not take the profile page down with it.
            setConnections([]);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { load(); }, [load]);

    const disconnect = async (clientId, name) => {
        try {
            setBusyClient(clientId);
            await api.post('/mcp/oauth/connections/revoke', { clientId });
            toast.success(`${name} disconnected`);
            await load();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Could not disconnect that application');
        } finally {
            setBusyClient(null);
        }
    };

    return (
        <div className="space-y-6 border-t border-border pt-8">
            <div className="flex items-center gap-2 opacity-40">
                <Bot className="w-4 h-4 text-muted-foreground" />
                <h2 className="text-xs font-semibold text-muted-foreground tracking-[0.2em]">
                    Connected Assistants
                </h2>
            </div>

            {loading ? (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Loading connected applications…
                </div>
            ) : connections.length === 0 ? (
                <div className="flex items-start gap-3 p-5 bg-muted/40 border border-border rounded-xl">
                    <Info className="w-4 h-4 mt-0.5 shrink-0 text-muted-foreground/60" />
                    <p className="text-xs text-muted-foreground leading-relaxed">
                        No assistants are connected. If you add one from inside Claude, ChatGPT or
                        Gemini, it will ask your permission first and appear here afterwards.
                    </p>
                </div>
            ) : (
                <div className="space-y-3">
                    {connections.map((c) => (
                        <div
                            key={c.clientId}
                            className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 bg-muted/40 border border-border rounded-xl"
                        >
                            <div className="min-w-0">
                                <h3 className="text-sm font-semibold text-foreground tracking-wide flex items-center gap-2">
                                    <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0" />
                                    <span className="truncate">{c.clientName}</span>
                                </h3>
                                {c.clientUri && (
                                    <a
                                        href={c.clientUri}
                                        target="_blank"
                                        rel="noopener noreferrer nofollow"
                                        className="inline-flex items-center gap-1 mt-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors break-all"
                                    >
                                        {c.clientUri}
                                        <ExternalLink className="w-3 h-3 shrink-0" />
                                    </a>
                                )}
                                <div className="flex flex-wrap gap-1.5 mt-2">
                                    {(c.scope || []).map((s) => (
                                        <span
                                            key={s}
                                            className="px-2 py-0.5 rounded-full border border-border text-[10px] font-medium text-muted-foreground"
                                        >
                                            {SCOPE_LABELS[s] || s}
                                        </span>
                                    ))}
                                </div>
                            </div>

                            <button
                                type="button"
                                onClick={() => disconnect(c.clientId, c.clientName)}
                                disabled={busyClient === c.clientId}
                                className="shrink-0 inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg border border-border text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors disabled:opacity-50 self-start"
                            >
                                {busyClient === c.clientId ? (
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                    <Unplug className="w-3.5 h-3.5" />
                                )}
                                Disconnect
                            </button>
                        </div>
                    ))}
                </div>
            )}

            <p className="text-[11px] text-muted-foreground/70 leading-relaxed">
                Disconnecting takes effect immediately. Any change an assistant had already
                approved stays applied.
            </p>
        </div>
    );
};

export default MCPConnectionsSection;
