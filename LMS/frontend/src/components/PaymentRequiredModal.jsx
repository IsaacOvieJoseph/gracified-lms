import React, { useState } from 'react';
import { X, Lock, CreditCard, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-hot-toast';

const PaymentRequiredModal = ({ show, onClose, topic, classroomId, onSuccess }) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [isPaying, setIsPaying] = useState(false);

  if (!show || !topic) return null;

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

  const handlePay = async () => {
    setIsPaying(true);
    try {
      const amount = topic.price;
      // 1. Initialize
      const resp = await api.post('/payments/paystack/initiate', {
        amount,
        classroomId,
        topicId: topic._id,
        type: 'topic_access'
      });

      if (resp.data.reference) {
        // 2. Open Modal
        await loadPaystackScript();

        const pubKey = import.meta.env.VITE_PAYSTACK_PUBLIC_KEY;
        const payAmount = (import.meta.env.VITE_PAYSTACK_CURRENCY || 'NGN').toLowerCase() === 'ngn' ? Math.round(amount * 100) : Math.round(amount * 100);

        if (!user || !user.email) {
          throw new Error('User email not available. Please log in before paying.');
        }

        const handleCallback = (response) => {
          (async () => {
            try {
              await api.get(`/payments/paystack/verify?reference=${encodeURIComponent(response.reference)}`);
              toast.success('Payment successful! Access granted.');
              if (onSuccess) onSuccess();
              onClose();
            } catch (err) {
              toast.error('Payment verification failed.');
            } finally {
              setIsPaying(false);
            }
          })();
        };

        const handler = window.PaystackPop.setup({
          key: pubKey,
          email: user.email,
          amount: payAmount,
          ref: resp.data.reference,
          callback: handleCallback,
          onClose: () => setIsPaying(false)
        });

        if (handler && typeof handler.openIframe === 'function') {
          handler.openIframe();
        } else if (handler && typeof handler.open === 'function') {
          handler.open();
        } else {
          throw new Error('Could not open Paystack payment window.');
        }
      }
    } catch (err) {
      console.error('Payment failed', err);
      const errMsg = err.response?.data?.message || err.message || 'Could not start payment';
      toast.error(errMsg);
      setIsPaying(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
      <div className="bg-white rounded-[2.5rem] shadow-2xl max-w-md w-full overflow-hidden animate-slide-up border border-slate-100/50">
        {/* Header */}
        <div className="bg-slate-900 px-10 py-8 flex justify-between items-center relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary/0 via-primary to-primary/0" />
          <h3 className="text-2xl font-black text-white flex items-center gap-4 relative z-10">
            <div className="w-10 h-10 bg-primary/20 rounded-xl flex items-center justify-center">
              <Lock className="w-5 h-5 text-primary" />
            </div>
            Premium Unlock
          </h3>
          <button
            onClick={onClose}
            className="w-10 h-10 flex items-center justify-center rounded-xl bg-white/5 text-white/40 hover:bg-white/10 hover:text-white transition-all active:scale-95 relative z-10"
            disabled={isPaying}
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-10 text-center">
          <div className="relative inline-block mb-8">
            <div className="w-24 h-24 bg-primary/5 rounded-[2.5rem] flex items-center justify-center mx-auto relative z-10 shadow-inner">
              <Lock className="w-12 h-12 text-primary drop-shadow-[0_0_15px_rgba(var(--primary-rgb),0.3)]" />
            </div>
            <div className="absolute -inset-4 bg-primary/10 rounded-full blur-3xl opacity-30 animate-pulse" />
          </div>

          <h4 className="text-3xl font-black text-slate-900 mb-4 tracking-tight">Access Restricted</h4>
          <p className="text-slate-500 font-medium mb-10 leading-relaxed max-w-sm mx-auto">
            The topic <span className="text-primary font-black italic">"{topic.name}"</span> requires a one-time activation. Unlock interactive lessons and assignments.
          </p>

          <div className="bg-slate-50/50 rounded-[2.5rem] p-8 mb-10 border-2 border-slate-50 shadow-inner group transition-all hover:bg-white hover:border-primary/20">
            <div className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mb-3">Activation Fee</div>
            <div className="text-5xl font-black text-slate-900 group-hover:text-primary transition-colors flex items-center justify-center gap-1">
              <span className="text-2xl mt-1">₦</span>
              {topic.price?.toLocaleString()}
            </div>
          </div>

          <div className="flex gap-4">
            <button
              onClick={onClose}
              disabled={isPaying}
              className="flex-1 px-4 py-5 rounded-2xl border-2 border-slate-50 font-black text-slate-400 hover:bg-slate-50 hover:text-slate-600 hover:border-slate-100 transition-all uppercase tracking-widest text-[10px] disabled:opacity-50"
            >
              Later
            </button>
            <button
              onClick={handlePay}
              disabled={isPaying}
              className="flex-[2] btn-premium px-4 py-5 rounded-2xl shadow-2xl shadow-primary/30 flex items-center justify-center gap-3 group"
            >
              {isPaying ? (
                <Loader2 className="w-6 h-6 animate-spin" />
              ) : (
                <>
                  <CreditCard className="w-6 h-6 group-hover:rotate-12 transition-transform" />
                  <span className="text-lg font-bold">Unlock Access</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PaymentRequiredModal;
