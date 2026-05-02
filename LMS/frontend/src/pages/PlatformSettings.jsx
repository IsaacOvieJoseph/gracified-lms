import React, { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import api from '../utils/api';
import { toast } from 'react-hot-toast';
import { Settings, Save, Loader2, Percent, Zap, Brain } from 'lucide-react';

const PlatformSettings = () => {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [settings, setSettings] = useState({
        taxRate: 0,
        vatRate: 0,
        serviceFeeRate: 0,
        subscriptionCheckingEnabled: true,
        activeAIProvider: 'groq'
    });

    useEffect(() => {
        fetchSettings();
    }, []);

    const fetchSettings = async () => {
        try {
            const response = await api.get('/settings');
            setSettings(response.data);
        } catch (error) {
            toast.error('Failed to load settings');
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
            await api.put('/settings', settings);
            toast.success('Settings updated successfully');
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to update settings');
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <Layout>
                <div className="flex items-center justify-center min-h-[400px]">
                    <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
                </div>
            </Layout>
        );
    }

    return (
        <Layout>
            <div className="max-w-2xl mx-auto space-y-8 py-4">
                <div className="flex items-center justify-between">
                    <h2 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
                        <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center text-primary">
                            <Settings className="w-6 h-6" />
                        </div>
                        Platform Settings
                    </h2>
                </div>

                <div className="card-premium overflow-hidden">
                    <div className="p-8 border-b border-slate-100 bg-slate-50/50">
                        <h3 className="text-xl font-bold text-slate-900 mb-1">Financial Rates (%)</h3>
                        <p className="text-sm text-slate-500 font-medium">Set the default rates for all transactions. Payouts will be calculated after deducting these percentages.</p>
                    </div>

                    <form onSubmit={handleSave} className="p-8 space-y-8">
                        {/* Subscription Checking Toggle */}
                        <div className="bg-indigo-50/50 p-6 rounded-2xl border border-indigo-100 flex items-center justify-between">
                            <div>
                                <h4 className="font-bold text-slate-900">Enable Subscription Checking</h4>
                                <p className="text-sm text-slate-500 font-medium">When disabled, all users will have full access regardless of their subscription status.</p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setSettings({ ...settings, subscriptionCheckingEnabled: !settings.subscriptionCheckingEnabled })}
                                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${settings.subscriptionCheckingEnabled ? 'bg-primary' : 'bg-slate-300'}`}
                            >
                                <span
                                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${settings.subscriptionCheckingEnabled ? 'translate-x-6' : 'translate-x-1'}`}
                                />
                            </button>
                        </div>

                        {/* AI Provider Selection */}
                        <div className="space-y-4">
                            <div>
                                <h4 className="font-bold text-slate-900 flex items-center gap-2"><Brain className="w-4 h-4 text-violet-600" /> Active AI Provider</h4>
                                <p className="text-sm text-slate-500 font-medium mt-1">Choose which AI engine powers topic, assignment, exam, and slide generation across the platform.</p>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                {/* Groq Card */}
                                <button
                                    type="button"
                                    onClick={() => setSettings({ ...settings, activeAIProvider: 'groq' })}
                                    className={`relative p-5 rounded-2xl border-2 text-left transition-all ${
                                        settings.activeAIProvider === 'groq'
                                            ? 'border-violet-500 bg-violet-50 shadow-md shadow-violet-100'
                                            : 'border-slate-200 bg-white hover:border-violet-200'
                                    }`}
                                >
                                    {settings.activeAIProvider === 'groq' && (
                                        <span className="absolute top-3 right-3 w-5 h-5 bg-violet-600 rounded-full flex items-center justify-center">
                                            <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                                        </span>
                                    )}
                                    <div className="w-10 h-10 bg-gradient-to-br from-violet-600 to-purple-700 rounded-xl flex items-center justify-center mb-3">
                                        <Zap className="w-5 h-5 text-white" />
                                    </div>
                                    <p className="font-black text-slate-900">Groq</p>
                                    <p className="text-xs text-slate-500 mt-1 font-medium">LLaMA 3.3 70B · Ultra fast · Generous free tier</p>
                                    <span className="inline-block mt-2 text-[10px] font-black uppercase tracking-wider bg-green-100 text-green-700 px-2 py-0.5 rounded-full">Recommended</span>
                                </button>

                                {/* Gemini Card */}
                                <button
                                    type="button"
                                    onClick={() => setSettings({ ...settings, activeAIProvider: 'gemini' })}
                                    className={`relative p-5 rounded-2xl border-2 text-left transition-all ${
                                        settings.activeAIProvider === 'gemini'
                                            ? 'border-blue-500 bg-blue-50 shadow-md shadow-blue-100'
                                            : 'border-slate-200 bg-white hover:border-blue-200'
                                    }`}
                                >
                                    {settings.activeAIProvider === 'gemini' && (
                                        <span className="absolute top-3 right-3 w-5 h-5 bg-blue-600 rounded-full flex items-center justify-center">
                                            <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                                        </span>
                                    )}
                                    <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-cyan-600 rounded-xl flex items-center justify-center mb-3">
                                        <Brain className="w-5 h-5 text-white" />
                                    </div>
                                    <p className="font-black text-slate-900">Gemini</p>
                                    <p className="text-xs text-slate-500 mt-1 font-medium">Google Gemini · Multimodal · Daily quota</p>
                                    <span className="inline-block mt-2 text-[10px] font-black uppercase tracking-wider bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">Google AI</span>
                                </button>
                            </div>
                            <p className="text-xs text-slate-400 font-medium italic">⚙️ Configure API keys via <code className="bg-slate-100 px-1.5 py-0.5 rounded font-mono">backend/.env</code> — GROQ_API_KEY and GEMINI_API_KEY</p>
                        </div>
                        <div className="grid grid-cols-1 gap-6">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                                    Tax Rate (%)
                                </label>
                                <div className="relative">
                                    <input
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        max="100"
                                        value={settings.taxRate}
                                        onChange={(e) => setSettings({ ...settings, taxRate: parseFloat(e.target.value) || 0 })}
                                        className="w-full pl-4 pr-10 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                        required
                                    />
                                    <Percent className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                                    VAT (%)
                                </label>
                                <div className="relative">
                                    <input
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        max="100"
                                        value={settings.vatRate}
                                        onChange={(e) => setSettings({ ...settings, vatRate: parseFloat(e.target.value) || 0 })}
                                        className="w-full pl-4 pr-10 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                        required
                                    />
                                    <Percent className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                                    Service Fee (%)
                                </label>
                                <div className="relative">
                                    <input
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        max="100"
                                        value={settings.serviceFeeRate}
                                        onChange={(e) => setSettings({ ...settings, serviceFeeRate: parseFloat(e.target.value) || 0 })}
                                        className="w-full pl-4 pr-10 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                        required
                                    />
                                    <Percent className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                </div>
                            </div>
                        </div>

                        <div className="bg-primary/5 p-6 rounded-2xl border border-primary/10">
                            <h4 className="text-sm font-bold text-primary uppercase tracking-wider mb-2">Calculation Example:</h4>
                            <div className="space-y-1 text-sm text-slate-600">
                                <p>If a user pays <span className="font-bold text-slate-900">₦10,000</span>:</p>
                                <p>- Tax ({settings.taxRate}%): <span className="text-slate-900">₦{(10000 * settings.taxRate / 100).toLocaleString()}</span></p>
                                <p>- VAT ({settings.vatRate}%): <span className="text-slate-900">₦{(10000 * settings.vatRate / 100).toLocaleString()}</span></p>
                                <p>- Service Fee ({settings.serviceFeeRate}%): <span className="text-slate-900">₦{(10000 * settings.serviceFeeRate / 100).toLocaleString()}</span></p>
                                <div className="mt-3 pt-3 border-t border-primary/10">
                                    <p className="text-primary font-bold">Payable to Subscriber: ₦{(10000 - (10000 * (settings.taxRate + settings.vatRate + settings.serviceFeeRate) / 100)).toLocaleString()}</p>
                                </div>
                            </div>
                        </div>

                        <div className="flex justify-end pt-4">
                            <button
                                type="submit"
                                disabled={saving}
                                className="btn-premium min-w-[200px]"
                            >
                                {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                                Save Settings
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </Layout>
    );
};

export default PlatformSettings;
