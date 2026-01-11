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
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center p-4 z-[60]">
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full overflow-hidden animate-fade-in-up">
        {/* Header */}
        <div className="bg-gradient-to-r from-gray-800 to-gray-900 px-6 py-4 flex justify-between items-center">
          <h3 className="text-xl font-bold text-white flex items-center gap-2">
            <Lock className="w-5 h-5 text-yellow-500" />
            Access Restricted
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition"
            disabled={isPaying}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 text-center">
          <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Lock className="w-8 h-8 text-yellow-600" />
          </div>

          <h4 className="text-xl font-bold text-gray-800 mb-2">Payment Required</h4>
          <p className="text-gray-600 mb-6">
            The topic <span className="font-semibold text-indigo-600">"{topic.name}"</span> requires payment to access its contents, including assignments, lectures, and the whiteboard.
          </p>

          <div className="bg-gray-50 rounded-lg p-4 mb-6 border border-gray-200">
            <div className="text-sm text-gray-500 mb-1">Access Fee</div>
            <div className="text-3xl font-bold text-green-600">₦{topic.price?.toLocaleString()}</div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={onClose}
              disabled={isPaying}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition font-medium disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handlePay}
              disabled={isPaying}
              className="flex-1 px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg hover:from-indigo-700 hover:to-purple-700 transition font-medium flex items-center justify-center gap-2 shadow-lg disabled:opacity-50"
            >
              {isPaying ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <CreditCard className="w-4 h-4" />
                  Pay Now
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
