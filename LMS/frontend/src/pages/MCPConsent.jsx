import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import api from '../utils/api';
import { toast } from 'react-hot-toast';
import {
    ShieldCheck, ShieldAlert, Loader2, Check, X, ExternalLink, Lock,
} from 'lucide-react';

/**
 * The approval screen for a third-party assistant connecting to Gracy.
 *
 * This page is the whole of the human oversight in the integration, so it is
 * deliberately plain about what is being asked for. Two states matter:
 *
 *  - The server has already validated the request and stored a pending consent
 *    (`?consent_id=`). We show the real client name and scopes from the server,
 *    never from the query string, so the page cannot be used to display a
 *    spoofed application name.
 *
 *  - No consent_id: the flow reached us without a session (the user was not
 *    signed in when the assistant opened the link). In that case this page mints
 *    a consent intent from the real app session and bounces back to /authorize
 *    with it, which is what actually identifies the user to the server.
 *
 * Nothing is written until Approve is pressed, and the response contains the
 * exact URL the server validated as this client's registered redirect — the
 * browser is sent there by the server's word, not by anything on this page.
 */

const GRANT_COPY = {
    'mcp:read': {
        title: 'Read your data',
        body: 'See the classes, topics, assignments and results that belong to your account. It cannot see anything belonging to anyone else.',
    },
    'mcp:draft': {
        title: 'Generate drafts for you',
        body: 'Create suggested lessons, quizzes, exams and answers, billed to your own AI provider if you have one.',
    },
    'mcp:write': {
        title: 'Make changes',
        body: 'Add and edit topics, assignments and exams. Every change is shown to you for approval first and is never applied without it.',
    },
};

const MCPConsent = () => {
    const [params] = useSearchParams();
    const navigate = useNavigate();

    const consentId = params.get('consent_id');
    const [request, setRequest] = useState(null);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [failure, setFailure] = useState(null);

    const load = useCallback(async () => {
        // Resume case: /authorize sent us here with the original request but no
        // consent_id because it could not identify the user. Now that the app has
        // a real session, mint a consent intent from it and send the flow back to
        // /authorize, which will then hand us a consent_id to approve.
        if (!consentId) {
            const clientId = params.get('client_id');
            if (!clientId) {
                setFailure('This link is missing its approval reference. Start again from your assistant.');
                setLoading(false);
                return;
            }
            try {
                const res = await api.post('/mcp/oauth/consent-intent', { clientId }, { skipLoader: true });
                const resume = new URLSearchParams({
                    client_id: clientId,
                    redirect_uri: params.get('redirect_uri') || '',
                    state: params.get('state') || '',
                    scope: params.get('scope') || '',
                    code_challenge: params.get('code_challenge') || '',
                    code_challenge_method: 'S256',
                    resource: params.get('resource') || '',
                    consent_intent: res.data.consentIntent,
                });
                window.location.assign(`/api/mcp/oauth/authorize?${resume.toString()}`);
            } catch (err) {
                setFailure(err.response?.data?.message || 'Could not start the connection request.');
                setLoading(false);
            }
            return;
        }

        try {
            const res = await api.get('/mcp/oauth/consent', {
                params: { consent_id: consentId },
                skipLoader: true,
            });
            setRequest(res.data);
        } catch (err) {
            setFailure(err.response?.data?.message || 'This authorisation request has expired.');
        } finally {
            setLoading(false);
        }
    }, [consentId, params]);

    useEffect(() => { load(); }, [load]);

    const decide = async (approve) => {
        try {
            setSubmitting(true);
            const res = await api.post('/mcp/oauth/consent', { consentId, approve });
            // The destination is built and validated server-side; this page never
            // constructs it, so there is nothing here to tamper with.
            window.location.assign(res.data.redirectUrl);
        } catch (err) {
            toast.error(err.response?.data?.message || 'Could not complete the request');
            setSubmitting(false);
        }
    };

    // ── Expired, unauthenticated or already-used request ──
    if (loading || failure) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center p-6">
                <div className="w-full max-w-md text-center space-y-5">
                    {loading ? (
                        <Loader2 className="w-8 h-8 mx-auto animate-spin text-muted-foreground/40" />
                    ) : (
                        <>
                            <ShieldAlert className="w-10 h-10 mx-auto text-amber-500" />
                            <p className="text-sm text-muted-foreground leading-relaxed">{failure}</p>
                            <button
                                type="button"
                                onClick={() => navigate('/profile')}
                                className="text-xs font-semibold text-primary hover:underline"
                            >
                                Back to your profile
                            </button>
                        </>
                    )}
                </div>
            </div>
        );
    }

    const scopes = request?.scopes || [];

    return (
        <div className="min-h-screen bg-background flex items-center justify-center p-6">
            <div className="w-full max-w-lg border border-border rounded-2xl bg-card p-8 space-y-7">
                <header className="space-y-3">
                    <div className="flex items-center gap-2 text-emerald-500">
                        <ShieldCheck className="w-5 h-5" />
                        <span className="text-[11px] font-semibold tracking-[0.2em] uppercase">
                            Connection request
                        </span>
                    </div>
                    <div>
                        <h1 className="text-xl font-semibold text-foreground tracking-tight">
                            Allow {request?.clientName || 'an application'} to work with your Gracy account?
                        </h1>
                        {request?.clientUri && (
                            <a
                                href={request.clientUri}
                                target="_blank"
                                rel="noopener noreferrer nofollow"
                                className="inline-flex items-center gap-1 mt-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors break-all"
                            >
                                {request.clientUri}
                                <ExternalLink className="w-3 h-3 shrink-0" />
                            </a>
                        )}
                    </div>
                </header>

                <div className="space-y-3">
                    {scopes.map(({ scope, description }) => {
                        const copy = GRANT_COPY[scope];
                        return (
                            <div key={scope} className="p-4 rounded-xl bg-muted/40 border border-border space-y-1.5">
                                <div className="flex items-center gap-2">
                                    <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                                    <h3 className="text-sm font-semibold text-foreground">
                                        {copy?.title || scope}
                                    </h3>
                                </div>
                                <p className="text-xs text-muted-foreground leading-relaxed pl-6">
                                    {copy?.body || description}
                                </p>
                            </div>
                        );
                    })}
                </div>

                <div className="flex items-start gap-3 p-4 rounded-xl border border-border bg-background/60">
                    <Lock className="w-4 h-4 mt-0.5 shrink-0 text-muted-foreground/60" />
                    <p className="text-xs text-muted-foreground leading-relaxed">
                        You are approving <span className="text-foreground font-medium">{request?.account?.email}</span>.
                        It only ever sees data belonging to this account, and every change it proposes has to be
                        approved by you individually before it happens. You can disconnect it at any time from
                        your profile.
                    </p>
                </div>

                <div className="flex flex-col sm:flex-row gap-3 pt-1">
                    <button
                        type="button"
                        onClick={() => decide(true)}
                        disabled={submitting}
                        className="flex-1 inline-flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-lg bg-primary text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-50"
                    >
                        {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                        Allow access
                    </button>
                    <button
                        type="button"
                        onClick={() => decide(false)}
                        disabled={submitting}
                        className="flex-1 inline-flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-lg border border-border text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
                    >
                        <X className="w-4 h-4" />
                        Not now
                    </button>
                </div>
            </div>
        </div>
    );
};

export default MCPConsent;
