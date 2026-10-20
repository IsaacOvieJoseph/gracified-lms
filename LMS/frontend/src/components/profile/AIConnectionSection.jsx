import React, { useCallback, useEffect, useState } from 'react';
import api from '../../utils/api';
import { toast } from 'react-hot-toast';
import {
    Sparkles, Loader2, CheckCircle2, AlertTriangle, Eye, EyeOff,
    Plug, Unplug, ExternalLink,
} from 'lucide-react';

/**
 * Lets a user connect their own model provider so AI requests are billed to
 * them instead of the deployment.
 *
 * Two things this component deliberately does not do:
 *  - It never displays a stored secret. The server only ever returns a masked
 *    hint (last four characters), so there is nothing here to leak into a
 *    screenshot or a shoulder-surfer.
 *  - It does not render at all unless a root admin has granted "own AI models"
 *    access for the user's school / personal tutor account. The flag comes from
 *    the server (`ownModelsAllowed`) and the write endpoints enforce it too, so
 *    hiding the UI is a convenience, not the security boundary.
 */
const AIConnectionSection = () => {
    const [connection, setConnection] = useState(null);
    const [providers, setProviders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState(false);
    const [aiDisabled, setAiDisabled] = useState(false);
    const [ownModelsAllowed, setOwnModelsAllowed] = useState(false);
    const [apiKey, setApiKey] = useState('');
    const [showKey, setShowKey] = useState(false);

    const load = useCallback(async () => {
        try {
            const res = await api.get('/ai-connections', { skipLoader: true });
            setConnection(res.data);
            // Root admin grants BYO ("own AI model") access per school / tutor.
            // Until that is granted the whole block stays hidden.
            setOwnModelsAllowed(res.data?.ownModelsAllowed === true);
            setAiDisabled(false);
        } catch (err) {
            if (err.response?.status === 403) setAiDisabled(true);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { load(); }, [load]);

    useEffect(() => {
        if (aiDisabled || !ownModelsAllowed) return;
        api.get('/ai-connections/providers', { skipLoader: true })
            .then((res) => setProviders(res.data.providers || []))
            .catch(() => setProviders([]));
    }, [aiDisabled, ownModelsAllowed]);

    // Finish a Google redirect. Google sends the user back to this page with
    // ?code&state; exchange it server-side, then scrub the URL so a refresh does
    // not replay a single-use code.
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const code = params.get('code');
        const state = params.get('state');
        if (!code || !state) return;

        (async () => {
            try {
                setBusy(true);
                await api.post('/ai-connections/gemini/callback', {
                    code,
                    state,
                    redirectUri: `${window.location.origin}/profile`,
                });
                toast.success('Google account connected');
                await load();
            } catch (err) {
                toast.error(err.response?.data?.message || 'Could not finish connecting Google');
            } finally {
                setBusy(false);
                window.history.replaceState({}, '', window.location.pathname);
            }
        })();
    }, [load]);

    const connectKey = async () => {
        const key = apiKey.trim();
        if (!key) return;
        try {
            setBusy(true);
            const res = await api.post('/ai-connections/api-key', { apiKey: key });
            setApiKey('');
            toast.success(res.data?.label ? `Connected ${res.data.label}` : 'Provider connected');
            await load();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Could not connect that provider');
        } finally {
            setBusy(false);
        }
    };

    const connectGoogle = async () => {
        try {
            setBusy(true);
            const res = await api.post('/ai-connections/gemini/start', {
                redirectUri: `${window.location.origin}/profile`,
            });
            window.location.assign(res.data.authorizationUrl);
        } catch (err) {
            setBusy(false);
            toast.error(err.response?.data?.message || 'Could not start Google sign-in');
        }
    };

    const disconnect = async () => {
        try {
            setBusy(true);
            await api.delete('/ai-connections');
            toast.success('Provider disconnected and credentials deleted');
            await load();
        } catch (err) {
            toast.error('Could not disconnect');
        } finally {
            setBusy(false);
        }
    };

    const openrouter = providers.find((p) => p.auth === 'api_key');
    const gemini = providers.find((p) => p.auth === 'oauth');

    // The entire block stays hidden until a root admin activates "own AI
    // models" access for this school / personal tutor. We also render nothing
    // while loading so the section never flashes before we know the answer.
    if (loading || !ownModelsAllowed) return null;

    return (
        <div className="space-y-6 border-t border-border pt-8">
            <div className="flex items-center gap-2 opacity-40">
                <Sparkles className="w-4 h-4 text-muted-foreground" />
                <h2 className="text-xs font-semibold text-muted-foreground tracking-[0.2em]">
                    Your AI Provider
                </h2>
            </div>

            {aiDisabled ? (
                <div className="flex items-start gap-3 p-5 bg-muted/40 border border-border rounded-xl">
                    <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0 text-muted-foreground" />
                    <p className="text-xs text-muted-foreground leading-relaxed">
                        AI features are currently disabled for your account by your academy
                        administrator. Contact them to switch them back on.
                    </p>
                </div>
            ) : (
                <>
                    {/* Current state */}
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-5 bg-muted/40 border border-border rounded-xl gap-4">
                        <div className="min-w-0">
                            <h3 className="text-sm font-semibold text-foreground tracking-wide flex items-center gap-2">
                                {loading ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                ) : connection?.connected ? (
                                    <>
                                        <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                                        Connected to{' '}
                                        {connection.provider === 'openrouter' ? 'OpenRouter' : 'Google Gemini'}
                                        {connection.hint ? ` (${connection.hint})` : ''}
                                    </>
                                ) : (
                                    <>
                                        <Plug className="w-4 h-4 text-muted-foreground" />
                                        Using the academy's shared provider
                                    </>
                                )}
                            </h3>
                            <p className="text-xs text-muted-foreground font-medium mt-1">
                                {connection?.connected
                                    ? 'AI requests are billed to your own account and never to the academy.'
                                    : 'Connect your own provider to keep your usage separate from the academy’s shared quota.'}
                            </p>
                            {connection?.status === 'error' && connection.lastError && (
                                <p className="text-xs text-red-500 font-medium mt-2 flex items-start gap-1.5">
                                    <AlertTriangle className="w-3.5 h-3.5 mt-px shrink-0" />
                                    {connection.lastError}
                                </p>
                            )}
                        </div>

                        {connection?.connected && (
                            <button
                                type="button"
                                onClick={disconnect}
                                disabled={busy}
                                className="shrink-0 inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg border border-border text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors disabled:opacity-50"
                            >
                                {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Unplug className="w-3.5 h-3.5" />}
                                Disconnect
                            </button>
                        )}
                    </div>

                    {/* Connect options */}
                    {!connection?.connected && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {gemini && (
                                <div className="p-5 border border-border rounded-xl space-y-3">
                                    <h4 className="text-sm font-semibold text-foreground">Connect Google Gemini</h4>
                                    <p className="text-xs text-muted-foreground leading-relaxed">
                                        {gemini.instructions}
                                    </p>
                                    <button
                                        type="button"
                                        onClick={connectGoogle}
                                        disabled={busy}
                                        className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg bg-primary text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-50"
                                    >
                                        {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ExternalLink className="w-3.5 h-3.5" />}
                                        Sign in with Google
                                    </button>
                                </div>
                            )}

                            {openrouter && (
                                <div className="p-5 border border-border rounded-xl space-y-3">
                                    <h4 className="text-sm font-semibold text-foreground">Connect OpenRouter</h4>
                                    <p className="text-xs text-muted-foreground leading-relaxed">
                                        {openrouter.instructions}
                                    </p>
                                    <div className="relative">
                                        <input
                                            type={showKey ? 'text' : 'password'}
                                            value={apiKey}
                                            onChange={(e) => setApiKey(e.target.value)}
                                            placeholder="sk-or-v1-..."
                                            autoComplete="off"
                                            spellCheck={false}
                                            className="w-full bg-background border border-border rounded-lg px-3 py-2 pr-10 text-xs text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/50"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowKey(!showKey)}
                                            className="absolute inset-y-0 right-0 pr-3 flex items-center text-muted-foreground/30 hover:text-primary transition-colors"
                                            aria-label={showKey ? 'Hide key' : 'Show key'}
                                        >
                                            {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                        </button>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={connectKey}
                                        disabled={busy || !apiKey.trim()}
                                        className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg bg-primary text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-50"
                                    >
                                        {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plug className="w-3.5 h-3.5" />}
                                        Connect
                                    </button>
                                </div>
                            )}
                        </div>
                    )}

                    <p className="text-[11px] text-muted-foreground/70 leading-relaxed">
                        Your key is encrypted before it is stored and can never be read back.
                        Disconnecting deletes it permanently.
                    </p>
                </>
            )}
        </div>
    );
};

export default AIConnectionSection;
