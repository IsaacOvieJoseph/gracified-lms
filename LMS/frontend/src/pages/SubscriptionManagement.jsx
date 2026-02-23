import React, { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { useNavigate, useLocation } from 'react-router-dom';
import api from '../utils/api'; // Use our configured API instance
import { useAuth } from '../context/AuthContext';
import { formatAmount } from '../utils/currency';
import { LogOut } from 'lucide-react';

const SubscriptionManagement = () => {
  const [plans, setPlans] = useState([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [showPricingModal, setShowPricingModal] = useState(false);
  const [defaultPricingType, setDefaultPricingType] = useState('monthly');
  const [updatingProfile, setUpdatingProfile] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout, refreshUser } = useAuth();

  const userEmail = location.state?.email || user?.email;

  useEffect(() => {
    const fetchPlans = async () => {
      try {
        const response = await api.get('/subscription-plans');
        setPlans(response.data.plans);
      } catch (err) {
        setError(err.response?.data?.message || 'Failed to fetch subscription plans');
      } finally {
        setInitialLoading(false);
      }
    };

    fetchPlans();
    // Listen for school selection changes
    const handler = () => fetchPlans();
    window.addEventListener('schoolSelectionChanged', handler);
    return () => window.removeEventListener('schoolSelectionChanged', handler);
  }, []);

  const handleSelectPlan = (plan) => {
    setSelectedPlan(plan);
    // In a real application, this would lead to a payment flow
    // For now, we'll simulate subscription update
  };

  const loadPaystackScript = () => {
    return new Promise((resolve, reject) => {
      if (window.PaystackPop) return resolve();
      const script = document.createElement('script');
      script.src = 'https://js.paystack.co/v1/inline.js';
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('Failed to load Paystack script'));
      document.body.appendChild(script);
    });
  };

  const handleSubscribe = async () => {
    if (!selectedPlan) {
      setError('Please select a plan.');
      return;
    }

    if (!userEmail) {
      setError('User email not found. Please log in again.');
      logout(); // Log out if user email is missing for safety
      navigate('/login');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      await loadPaystackScript();

      // Use the 'Payment API' for free plans (Trial / 0-price PAYG)
      if (selectedPlan.price === 0) {
        await api.post('/payments/free-subscription', {
          planId: selectedPlan._id
        });

        toast.success(`Successfully subscribed to ${selectedPlan.name}!`);
        await refreshUser();
        setSubmitting(false);
        if (selectedPlan.planType === 'pay_as_you_go') {
          setShowPricingModal(true);
        } else {
          navigate('/dashboard');
        }
      } else {
        // For paid plans (monthly, yearly), integrate with Paystack
        const usePaystack = !!import.meta.env.VITE_PAYSTACK_PUBLIC_KEY || false;
        if (usePaystack) {
          const resp = await api.post('/payments/paystack/initiate', {
            amount: selectedPlan.price,
            planId: selectedPlan._id,
            type: 'subscription'
          });

          if (resp.data && resp.data.reference) {
            const pubKey = import.meta.env.VITE_PAYSTACK_PUBLIC_KEY;
            const payAmount = (import.meta.env.VITE_PAYSTACK_CURRENCY || 'NGN').toLowerCase() === 'ngn' ? Math.round(selectedPlan.price * 100) : Math.round(selectedPlan.price * 100);

            try {
              function handleCallback(response) {
                // call async verify but keep this function synchronous for Paystack
                (async () => {
                  try {
                    await api.get(`/payments/paystack/verify?reference=${encodeURIComponent(response.reference)}`);
                    toast.success(`Successfully subscribed to ${selectedPlan.name}!`);
                    await refreshUser();
                    if (selectedPlan.planType === 'pay_as_you_go') {
                      setShowPricingModal(true);
                    } else {
                      navigate('/dashboard');
                    }
                  } catch (err) {
                    console.error('Subscription verification error:', err);
                    setError(err.response?.data?.message || 'Verification failed');
                  } finally {
                    setSubmitting(false);
                  }
                })();
              }

              function handleOnClose() {
                setSubmitting(false);
                toast.error('Payment window closed');
              }

              if (typeof handleCallback !== 'function') throw new Error('Invalid callback');

              const handler = window.PaystackPop.setup({
                key: pubKey,
                email: userEmail,
                amount: payAmount,
                ref: resp.data.reference,
                onClose: handleOnClose,
                callback: handleCallback
              });

              if (handler && typeof handler.openIframe === 'function') {
                handler.openIframe();
              } else if (handler && typeof handler.open === 'function') {
                handler.open();
              } else {
                throw new Error('Paystack handler not available');
              }
              // Wait for user interaction or callback
              return;
            } catch (setupErr) {
              console.error('Paystack setup error:', setupErr);
              throw new Error(`Failed to launch Paystack payment window: ${setupErr.message}`);
            }
          }
        }

        // Fallback or if Paystack not configured
        toast.error('Payment configuration missing or failed to initialize');
        setSubmitting(false);
      }
    } catch (err) {
      console.error('Subscription process error:', err);
      setError(err.response?.data?.message || err.message || 'Subscription failed');
      setSubmitting(false);
    }
  };

  const handleSavePricingPreference = async () => {
    setUpdatingProfile(true);
    try {
      await api.put('/auth/profile', { defaultPricingType });
      toast.success('Your class fee preference has been saved.');
      navigate('/dashboard');
    } catch (err) {
      toast.error('Failed to save preference, taking you to dashboard.');
      navigate('/dashboard');
    } finally {
      setUpdatingProfile(false);
      setShowPricingModal(false);
    }
  };

  const handleSkipTrial = () => {
    // For now, if user skips trial, they can't access dashboard
    // This will redirect them to login with a message, or simply keep them here
    logout(); // Log out and force them to choose a plan next time
    navigate('/login', { state: { message: 'Please choose a subscription plan to access the platform.' } });
  };

  if (initialLoading) {
    return <div className="min-h-screen flex items-center justify-center">Loading plans...</div>;
  }

  if (error && !plans.length) {
    return <div className="min-h-screen flex items-center justify-center text-red-500">Error: {error}</div>;
  }

  // Check if the current user is a School Admin or Personal Teacher
  const isEligibleRole = user && (user.role === 'school_admin' || user.role === 'personal_teacher');

  if (!isEligibleRole) {
    return <div className="min-h-screen flex items-center justify-center text-red-500">Access Denied: Only School Admins and Personal Teachers require subscriptions.</div>;
  }

  return (
    <div className="min-h-screen bg-slate-50/50 py-12 px-4 sm:px-6 lg:px-8 flex items-center justify-center">
      <div className="max-w-7xl w-full mx-auto bg-white p-6 sm:p-12 rounded-[2.5rem] shadow-2xl relative border border-slate-100/50 animate-slide-up">
        {/* Decorative elements */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl -mr-32 -mt-32 pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-indigo-500/5 rounded-full blur-3xl -ml-32 -mb-32 pointer-events-none" />

        <div className="absolute top-8 right-8 z-10">
          <button
            onClick={() => { logout(); navigate('/login'); }}
            className="flex items-center space-x-2 px-5 py-2.5 bg-red-50 text-red-600 font-bold rounded-xl hover:bg-red-100 transition-all active:scale-95 group shadow-sm"
            title="Logout"
          >
            <LogOut className="w-5 h-5 group-hover:rotate-12 transition-transform" />
            <span className="hidden sm:inline">Sign Out</span>
          </button>
        </div>

        <div className="text-center mb-16 relative z-10">
          <h2 className="text-4xl sm:text-5xl font-black text-slate-900 mb-4 tracking-tight">Choose Your Plan</h2>
          <p className="text-slate-500 font-medium text-lg max-w-2xl mx-auto leading-relaxed">
            Select the perfect subscription to power your educational institution. Scale as you grow.
          </p>
        </div>

        {user?.trialEndDate && user.subscriptionStatus === 'trial' && new Date(user.trialEndDate) > Date.now() &&
          !['student', 'teacher'].includes(user.role) && (
            <div className="max-w-xl mx-auto mb-10 p-4 bg-indigo-50/50 border border-indigo-100 rounded-2xl flex items-center gap-4 animate-bounce">
              <div className="w-12 h-12 bg-white rounded-xl shadow-sm flex items-center justify-center text-primary">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              </div>
              <p className="text-indigo-900 font-bold text-sm">
                Your free trial ends on <span className="underline decoration-indigo-300 decoration-2">{new Date(user.trialEndDate).toLocaleDateString()}</span>. Enjoy the full experience!
              </p>
            </div>
          )}

        {user?.trialEndDate && user.subscriptionStatus === 'trial' && new Date(user.trialEndDate) <= Date.now() &&
          !['student', 'teacher'].includes(user.role) && (
            <div className="max-w-xl mx-auto mb-10 p-4 bg-red-50 border border-red-100 rounded-2xl flex items-center gap-4 animate-pulse">
              <div className="w-12 h-12 bg-white rounded-xl shadow-sm flex items-center justify-center text-red-500">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
              </div>
              <p className="text-red-900 font-black text-sm uppercase tracking-tight">
                Your free trial has expired! Select a plan to regain full access.
              </p>
            </div>
          )}

        {error && (
          <div className="max-w-md mx-auto mb-8 p-4 bg-red-50 text-red-600 rounded-xl border border-red-100 text-center font-bold text-sm">
            {error}
          </div>
        )}

        <div className="flex flex-wrap justify-center gap-8 mb-12">
          {plans.map((plan) => (
            <div
              key={plan._id}
              className={`w-full max-w-sm flex flex-col p-8 rounded-[2rem] cursor-pointer transition-all duration-300 relative group overflow-hidden ${selectedPlan?._id === plan._id
                ? 'bg-slate-900 text-white shadow-2xl scale-[1.02] ring-4 ring-primary/20'
                : 'bg-white text-slate-900 border-2 border-slate-100 hover:border-slate-200 hover:shadow-xl hover:-translate-y-1'
                }`}
              onClick={() => handleSelectPlan(plan)}
            >
              {selectedPlan?._id === plan._id && (
                <div className="absolute top-4 right-4 bg-primary text-white p-1 rounded-full animate-in zoom-in duration-300">
                  <CheckCircle className="w-6 h-6" />
                </div>
              )}

              <h3 className={`text-2xl font-black mb-2 ${selectedPlan?._id === plan._id ? 'text-white' : 'text-slate-900'}`}>{plan.name}</h3>
              <p className={`text-sm mb-6 font-medium ${selectedPlan?._id === plan._id ? 'text-slate-400' : 'text-slate-500'}`}>{plan.description}</p>

              <div className="mb-8 p-6 bg-slate-50/10 rounded-2xl border border-white/5 backdrop-blur-sm">
                {plan.price > 0 ? (
                  <div className="flex items-baseline gap-1">
                    <span className="text-4xl font-black">{formatAmount(plan.price)}</span>
                    <span className="text-sm font-bold opacity-60">/{plan.planType === 'monthly' ? 'mo' : 'yr'}</span>
                  </div>
                ) : (
                  <div className="text-3xl font-black text-primary">
                    {plan.planType === 'trial' ? 'FREE TRIAL' : 'REV SHARE'}
                  </div>
                )}
                {plan.planType === 'pay_as_you_go' && (
                  <p className="text-xs font-black uppercase tracking-widest mt-2 opacity-60 text-primary">{plan.revenueSharePercentage}% Service Fee</p>
                )}
              </div>

              <ul className="space-y-4 text-left flex-1 mb-10">
                {plan.features.map((feature, idx) => (
                  <li key={idx} className="flex items-start gap-3">
                    <div className={`mt-0.5 p-0.5 rounded-full ${selectedPlan?._id === plan._id ? 'bg-indigo-500/20 text-indigo-400' : 'bg-emerald-50 text-emerald-500'}`}>
                      <CheckCircle className="w-4 h-4" />
                    </div>
                    <span className={`text-sm font-bold ${selectedPlan?._id === plan._id ? 'text-slate-300' : 'text-slate-600'}`}>{feature}</span>
                  </li>
                ))}
              </ul>

              <div className={`mt-auto p-1 rounded-2xl transition-all ${selectedPlan?._id === plan._id ? 'bg-white/10' : 'bg-slate-50'}`}>
                <div className={`py-4 rounded-xl font-black text-xs uppercase tracking-[0.2em] transition-all ${selectedPlan?._id === plan._id
                  ? 'bg-indigo-600 text-white'
                  : 'text-slate-400 group-hover:text-slate-600'
                  }`}>
                  {selectedPlan?._id === plan._id ? 'Plan Selected' : 'Choose Plan'}
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="max-w-2xl mx-auto space-y-6">
          <button
            onClick={handleSubscribe}
            disabled={submitting || !selectedPlan}
            className="w-full py-5 bg-primary text-white font-black text-xl rounded-2xl hover:bg-primary/90 transition-all disabled:opacity-50 shadow-2xl shadow-primary/30 active:scale-[0.98] flex items-center justify-center gap-3"
          >
            {submitting ? (
              <>
                <div className="w-6 h-6 border-4 border-white/20 border-t-white rounded-full animate-spin" />
                <span>Processing Payment...</span>
              </>
            ) : (
              <>
                <span>Complete Subscription</span>
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
              </>
            )}
          </button>

          {user?.subscriptionStatus === 'trial' && new Date(user.trialEndDate) > Date.now() && (
            <p className="text-center">
              <button
                onClick={handleSkipTrial}
                className="text-slate-400 hover:text-slate-900 font-bold text-sm tracking-wide transition-colors uppercase"
                disabled={submitting}
              >
                Maybe Later • Continue Trial
              </button>
            </p>
          )}
        </div>
      </div>

      {showPricingModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-[2rem] shadow-2xl max-w-md w-full p-8 animate-slide-up">
            <h3 className="text-2xl font-bold text-slate-900 mb-2">Class Fee Preference</h3>
            <p className="text-slate-500 mb-8 leading-relaxed">
              As a Pay-As-You-Go user, select your default billing model. You can customize this for specific classes later.
            </p>

            <div className="grid grid-cols-1 gap-3 mb-8">
              {[
                { id: 'monthly', label: 'Monthly' },
                { id: 'weekly', label: 'Weekly' },
                { id: 'per_lecture', label: 'Per Lecture' },
                { id: 'per_topic', label: 'Per Topic' },
                { id: 'free', label: 'Free' }
              ].map((option) => (
                <label
                  key={option.id}
                  className={`flex items-center p-4 rounded-2xl cursor-pointer transition-all border-2 ${defaultPricingType === option.id ? 'border-primary bg-primary/5' : 'border-slate-50 hover:border-slate-100 hover:bg-slate-50'}`}
                >
                  <input
                    type="radio"
                    name="pricingType"
                    value={option.id}
                    checked={defaultPricingType === option.id}
                    onChange={(e) => setDefaultPricingType(e.target.value)}
                    className="w-4 h-4 text-primary focus:ring-primary border-slate-300"
                  />
                  <span className={`ml-3 font-bold ${defaultPricingType === option.id ? 'text-primary' : 'text-slate-600'}`}>{option.label}</span>
                </label>
              ))}
            </div>

            <button
              onClick={handleSavePricingPreference}
              disabled={updatingProfile}
              className="btn-premium w-full flex items-center justify-center py-4"
            >
              {updatingProfile ? <Loader2 className="w-6 h-6 animate-spin" /> : 'Confirm Preference'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default SubscriptionManagement;
