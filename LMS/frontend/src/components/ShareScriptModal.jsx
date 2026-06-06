import React, { useState, useEffect } from 'react';
import api from '../utils/api';
import { X, Copy, Check, Save, Settings, Clock, Shield, AlertCircle, RefreshCw } from 'lucide-react';
import { toast } from 'react-hot-toast';

const ShareScriptModal = ({ show, onClose, parentId, parentType, submissionId, studentId }) => {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [copied, setCopied] = useState(false);
    
    // Config state
    const [config, setConfig] = useState({
        isShareable: false,
        defaultAccessType: 'view',
        otpLifespanMinutes: 30,
        accessDurationMinutes: 60,
        assignedMarkerId: null
    });

    // Share link state
    const [shareUrl, setShareUrl] = useState('');
    const [shareToken, setShareToken] = useState('');

    useEffect(() => {
        if (show && parentId) {
            fetchShareConfigAndLink();
        }
    }, [show, parentId, submissionId, studentId]);

    const fetchShareConfigAndLink = async () => {
        setLoading(true);
        try {
            // 1. Fetch share config
            const configRes = await api.get(`/scripts/${parentType}/${parentId}/share-config`);
            setConfig(configRes.data);

            // 2. If shareable, generate or retrieve the link
            if (configRes.data.isShareable) {
                await generateShareLink(configRes.data.isShareable);
            } else {
                setShareUrl('');
                setShareToken('');
            }
        } catch (error) {
            console.error('Error fetching share config:', error);
            toast.error('Failed to load sharing configuration');
        } finally {
            setLoading(false);
        }
    };

    const generateShareLink = async (isShareableActive) => {
        if (!isShareableActive) return;
        try {
            let res;
            if (parentType === 'exam') {
                res = await api.post(`/scripts/exam-submission/${submissionId}/generate-link`);
            } else {
                res = await api.post(`/scripts/assignment-submission/${parentId}/${studentId}/generate-link`);
            }
            setShareUrl(res.data.shareUrl);
            setShareToken(res.data.shareToken);
        } catch (error) {
            console.error('Error generating share link:', error);
            toast.error(error.response?.data?.message || 'Failed to generate share link');
        }
    };

    const handleToggleShareable = async () => {
        const nextState = !config.isShareable;
        setSaving(true);
        try {
            const res = await api.put(`/scripts/${parentType}/${parentId}/share-config`, {
                isShareable: nextState
            });
            setConfig(res.data);
            if (nextState) {
                await generateShareLink(true);
                toast.success('Sharing enabled');
            } else {
                setShareUrl('');
                setShareToken('');
                toast.success('Sharing disabled');
            }
        } catch (error) {
            toast.error('Failed to update sharing settings');
        } finally {
            setSaving(false);
        }
    };

    const handleSaveSettings = async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
            const res = await api.put(`/scripts/${parentType}/${parentId}/share-config`, {
                defaultAccessType: config.defaultAccessType,
                otpLifespanMinutes: Number(config.otpLifespanMinutes),
                accessDurationMinutes: Number(config.accessDurationMinutes)
            });
            setConfig(res.data);
            toast.success('Sharing settings saved successfully!');
            // Re-generate link to sync defaultAccessType if needed
            if (config.isShareable) {
                await generateShareLink(true);
            }
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to save settings');
        } finally {
            setSaving(false);
        }
    };

    const copyToClipboard = () => {
        if (!shareUrl) return;
        navigator.clipboard.writeText(shareUrl);
        setCopied(true);
        toast.success('Share link copied to clipboard!');
        setTimeout(() => setCopied(false), 2000);
    };

    if (!show) return null;

    return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-[2rem] shadow-2xl max-w-md w-full p-8 relative animate-slide-up overflow-hidden text-slate-800 dark:text-slate-200">
                <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-primary/0 via-primary to-primary/0 opacity-20" />
                
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-xl font-black tracking-tight flex items-center gap-2">
                        <Settings className="w-5 h-5 text-primary" />
                        <span>Script Sharing</span>
                    </h3>
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition text-slate-400">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {loading ? (
                    <div className="flex flex-col items-center justify-center py-12 gap-3">
                        <RefreshCw className="w-10 h-10 text-primary animate-spin" />
                        <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Fetching share configuration...</p>
                    </div>
                ) : (
                    <div className="space-y-6">
                        {/* Enable/Disable Toggle */}
                        <div className="bg-slate-50 dark:bg-slate-950 p-4 rounded-2xl border border-slate-100 dark:border-slate-800/50 flex items-center justify-between">
                            <div>
                                <span className="text-xs font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">Public Access Portal</span>
                                <h4 className="text-sm font-bold text-foreground mt-0.5">Enable Sharing</h4>
                            </div>
                            <button
                                onClick={handleToggleShareable}
                                disabled={saving}
                                className={`w-12 h-6 rounded-full transition-colors relative ${config.isShareable ? 'bg-primary' : 'bg-slate-300 dark:bg-slate-700'}`}
                            >
                                <div className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${config.isShareable ? 'translate-x-6' : ''}`} />
                            </button>
                        </div>

                        {config.isShareable ? (
                            <>
                                {/* Shareable Link Display */}
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 ml-1">Share Link</label>
                                    <div className="flex gap-2">
                                        <input
                                            type="text"
                                            readOnly
                                            value={shareUrl || 'Generating secure link...'}
                                            className="flex-1 text-xs select-all bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 font-mono"
                                        />
                                        <button
                                            onClick={copyToClipboard}
                                            disabled={!shareUrl}
                                            className="p-2.5 bg-primary text-white rounded-xl hover:bg-primary/90 transition shadow-sm"
                                            title="Copy Link"
                                        >
                                            {copied ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
                                        </button>
                                    </div>
                                    <p className="text-[10px] text-muted-foreground leading-relaxed ml-1 flex items-start gap-1.5 mt-1">
                                        <AlertCircle className="w-3.5 h-3.5 text-primary flex-shrink-0 mt-0.5" />
                                        <span>Anyone with this link can request access. An OTP will be emailed to your authorized school/exam owner.</span>
                                    </p>
                                </div>

                                {/* Configure settings form */}
                                <form onSubmit={handleSaveSettings} className="space-y-4 border-t border-slate-100 dark:border-slate-800/50 pt-4">
                                    <div>
                                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-1.5 ml-1">Access Mode Granted</label>
                                        <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 dark:bg-slate-950 border dark:border-slate-800 rounded-xl">
                                            <button
                                                type="button"
                                                onClick={() => setConfig({ ...config, defaultAccessType: 'view' })}
                                                className={`py-2 rounded-lg font-bold text-xs transition-all ${config.defaultAccessType === 'view' ? 'bg-white dark:bg-slate-800 text-primary shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'}`}
                                            >
                                                Read Only (View)
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setConfig({ ...config, defaultAccessType: 'grade' })}
                                                className={`py-2 rounded-lg font-bold text-xs transition-all ${config.defaultAccessType === 'grade' ? 'bg-white dark:bg-slate-800 text-primary shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'}`}
                                            >
                                                Evaluate (Grade)
                                            </button>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-1.5 ml-1 flex items-center gap-1">
                                                <Shield className="w-3.5 h-3.5" />
                                                <span>OTP Lifespan</span>
                                            </label>
                                            <div className="relative">
                                                <input
                                                    type="number"
                                                    value={config.otpLifespanMinutes}
                                                    onChange={(e) => setConfig({ ...config, otpLifespanMinutes: Math.max(5, Number(e.target.value)) })}
                                                    className="w-full pr-12 text-xs font-bold"
                                                    min="5"
                                                    max="1440"
                                                    required
                                                />
                                                <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-[9px] font-bold text-muted-foreground">MINS</span>
                                            </div>
                                        </div>

                                        <div>
                                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-1.5 ml-1 flex items-center gap-1">
                                                <Clock className="w-3.5 h-3.5" />
                                                <span>Session Length</span>
                                            </label>
                                            <div className="relative">
                                                <input
                                                    type="number"
                                                    value={config.accessDurationMinutes}
                                                    onChange={(e) => setConfig({ ...config, accessDurationMinutes: Math.max(5, Number(e.target.value)) })}
                                                    className="w-full pr-12 text-xs font-bold"
                                                    min="5"
                                                    max="2880"
                                                    required
                                                />
                                                <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-[9px] font-bold text-muted-foreground">MINS</span>
                                            </div>
                                        </div>
                                    </div>

                                    <button
                                        type="submit"
                                        disabled={saving}
                                        className="w-full btn-premium py-3 mt-2 font-bold text-xs"
                                    >
                                        <Save className="w-4 h-4" />
                                        <span>{saving ? 'Saving...' : 'Save Configuration'}</span>
                                    </button>
                                </form>
                            </>
                        ) : (
                            <div className="text-center py-6 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl">
                                <AlertCircle className="w-8 h-8 text-slate-300 dark:text-slate-700 mx-auto mb-2" />
                                <p className="text-xs text-muted-foreground font-medium px-4">
                                    Script sharing is currently disabled. Toggle the switch above to enable sharing and generate a secure link.
                                </p>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default ShareScriptModal;
