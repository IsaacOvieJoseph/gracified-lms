import React, { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { useNavigate, useLocation } from 'react-router-dom';
import api from '../utils/api'; // Use our configured API instance
import { useAuth } from '../context/AuthContext';
import { formatAmount } from '../utils/currency';

const SubscriptionManagement = () => {
  const [plans, setPlans] = useState([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [selectedPlan, setSelectedPlan] = useState(null);
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

      // For trial/pay-as-you-go, no immediate payment, just update user subscription
      if (selectedPlan.planType === 'trial' || selectedPlan.planType === 'pay_as_you_go') {
        await api.post('/user-subscriptions', {
          userId: user._id,
          planId: selectedPlan._id,
          status: selectedPlan.planType === 'trial' ? 'trial' : 'pay_as_you_go',
          startDate: new Date(),
        });

        toast.success(`Successfully subscribed to ${selectedPlan.name}!`);
        await refreshUser();
        setSubmitting(false);
        navigate('/dashboard');
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
                    navigate('/dashboard');
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
    <div className="min-h-screen bg-gray-100 flex flex-col items-center justify-center p-4">
      <div className="bg-white p-8 rounded-lg shadow-md w-full max-w-2xl">
        <h2 className="text-3xl font-bold text-center text-gray-900 mb-6">Choose Your Subscription Plan</h2>

        {user?.trialEndDate && user.subscriptionStatus === 'trial' && new Date(user.trialEndDate) > Date.now() &&
          !['student', 'teacher'].includes(user.role) && (
            <p className="text-center text-sm text-gray-600 mb-4">
              Your free trial ends on {new Date(user.trialEndDate).toLocaleDateString()}. Please select a plan before it expires.
            </p>
          )}

        {user?.trialEndDate && user.subscriptionStatus === 'trial' && new Date(user.trialEndDate) <= Date.now() &&
          !['student', 'teacher'].includes(user.role) && (
            <p className="text-center text-red-500 text-lg font-semibold mb-4">
              Your free trial has expired! Please choose a plan to continue.
            </p>
          )}

        {error && <p className="text-red-500 text-center mb-4">{error}</p>}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {plans.map((plan) => (
            <div
              key={plan._id}
              className={`p-6 border rounded-lg shadow-sm text-center cursor-pointer transition-all ${selectedPlan?._id === plan._id ? 'border-indigo-600 ring-2 ring-indigo-500' : 'border-gray-200 hover:shadow-md'}`}
              onClick={() => handleSelectPlan(plan)}
            >
              <h3 className="text-xl font-bold text-gray-800 mb-2">{plan.name}</h3>
              <p className="text-gray-600 text-sm mb-4">{plan.description}</p>
              {plan.price > 0 ? (
                <p className="text-2xl font-bold text-indigo-600">{formatAmount(plan.price)}{plan.planType === 'monthly' ? '/month' : plan.planType === 'yearly' ? '/year' : ''}</p>
              ) : (
                <p className="text-2xl font-bold text-indigo-600">{plan.planType === 'trial' ? 'FREE' : 'Revenue Share'}</p>
              )}
              {plan.planType === 'pay_as_you_go' && (
                <p className="text-sm text-gray-500">{plan.revenueSharePercentage}% revenue share</p>
              )}
              <ul className="text-gray-700 text-left mt-4 space-y-1">
                {plan.features.map((feature, idx) => (
                  <li key={idx} className="flex items-center"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-check-circle text-green-500 mr-2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><path d="m9 11 3 3L22 4" /></svg>{feature}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <button
          onClick={handleSubscribe}
          disabled={submitting || !selectedPlan}
          className="w-full px-6 py-3 bg-indigo-600 text-white font-semibold rounded-md hover:bg-indigo-700 transition disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
        >
          {submitting ? 'Processing...' : `Subscribe to ${selectedPlan ? selectedPlan.name : 'Plan'}`}
        </button>

        {user?.subscriptionStatus === 'trial' && new Date(user.trialEndDate) > Date.now() && (
          <p className="text-center mt-4">
            <button onClick={handleSkipTrial} className="text-gray-600 hover:underline disabled:opacity-50" disabled={submitting}>Skip for now (Trial Active)</button>
          </p>
        )}

      </div>
    </div>
  );
};

export default SubscriptionManagement;
