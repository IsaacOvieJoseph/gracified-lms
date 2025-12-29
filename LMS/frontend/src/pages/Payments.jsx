import React, { useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import { useSearchParams } from 'react-router-dom';
import { DollarSign, CheckCircle, XCircle, Clock } from 'lucide-react';
import Layout from '../components/Layout';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { formatAmount } from '../utils/currency';

const Payments = () => {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const classroomId = searchParams.get('classroomId');
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showPaymentModal, setShowPaymentModal] = useState(!!classroomId);
  const [classroomForPayment, setClassroomForPayment] = useState(null);
  const [isPaying, setIsPaying] = useState(false);
  const [payError, setPayError] = useState(null);

  useEffect(() => {
    fetchPayments();
    if (classroomId) {
      fetchClassroomForPayment();
    }
    // Listen for school selection changes
    const handler = () => fetchPayments();
    window.addEventListener('schoolSelectionChanged', handler);
    return () => window.removeEventListener('schoolSelectionChanged', handler);
  }, [classroomId]);

  const fetchPayments = async () => {
    try {
      const response = await api.get('/payments/history');
      setPayments(response.data.payments);
    } catch (error) {
      console.error('Error fetching payments:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchClassroomForPayment = async () => {
    try {
      const response = await api.get(`/classrooms/${classroomId}`);
      setClassroomForPayment(response.data.classroom || null);
      // show modal if classroom exists
      if (response.data.classroom) setShowPaymentModal(true);
    } catch (error) {
      console.error('Error fetching classroom:', error);
    }
  };

  const handlePayment = async (classroomId, amount) => {
    setPayError(null);
    setIsPaying(true);
    try {
      const usePaystack = !!import.meta.env.VITE_PAYSTACK_PUBLIC_KEY || false;
      if (usePaystack) {
        // Request server to initialize Paystack transaction
        const returnUrl = `${window.location.origin}/payments?classroomId=${classroomId}`;
        const resp = await api.post('/payments/paystack/initiate', { amount, classroomId, type: 'class_enrollment', returnUrl });
        if (resp.data && resp.data.reference) {
          // load Paystack inline script then open inline
          await loadPaystackScript();
          const pubKey = import.meta.env.VITE_PAYSTACK_PUBLIC_KEY;
          const payAmount = (import.meta.env.VITE_PAYSTACK_CURRENCY || 'NGN').toLowerCase() === 'ngn' ? Math.round(amount * 100) : Math.round(amount * 100);
          try {
            // ensure callback is a plain function (Paystack expects a function reference)
            function handleCallback(response) {
              // call async verify but keep this function synchronous for Paystack
              (async () => {
                try {
                  await api.get(`/payments/paystack/verify?reference=${encodeURIComponent(response.reference)}`);
                  toast.success('Payment successful! You are now enrolled.');
                  setShowPaymentModal(false);
                  fetchPayments();
                  window.location.href = `/classrooms/${classroomId}`;
                } catch (err) {
                  setPayError(err.response?.data?.message || err.message || 'Verification failed');
                } finally {
                  setIsPaying(false);
                }
              })();
            }

            function handleOnClose() {
              setIsPaying(false);
              setPayError('Payment window closed');
            }

            if (typeof handleCallback !== 'function') throw new Error('Invalid callback');

            if (!user || !user.email) {
              throw new Error('User email not available. Please log in before paying.');
            }

            const handler = window.PaystackPop.setup({
              key: pubKey,
              email: user.email,
              amount: payAmount,
              ref: resp.data.reference,
              onClose: handleOnClose,
              callback: handleCallback
            });

            if (handler && typeof handler.openIframe === 'function') {
              handler.openIframe();
            } else if (handler && typeof handler.open === 'function') {
              // older/newer API variation
              handler.open();
            } else {
              throw new Error('Paystack handler not available');
            }
          } catch (setupErr) {
            console.error('Paystack setup error', setupErr);
            setPayError(setupErr.message || 'Failed to launch Paystack payment window');
            setIsPaying(false);
          }
          return;
        }
        throw new Error('Failed to initialize Paystack payment');
      }

      // Fallback: existing Stripe flow
      const intentRes = await api.post('/payments/create-intent', {
        type: 'class_enrollment',
        classroomId,
        amount
      });
      const confirmRes = await api.post('/payments/confirm', {
        paymentIntentId: intentRes.data.paymentIntentId,
        type: 'class_enrollment',
        classroomId,
        amount
      });

      toast.success('Payment successful! You are now enrolled.');
      setShowPaymentModal(false);
      fetchPayments();
      window.location.href = `/classrooms/${classroomId}`;
    } catch (error) {
      setPayError(error.response?.data?.message || error.message || 'Payment failed');
      setIsPaying(false);
    }
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

  // After returning from Paystack, Paystack may attach `reference` in the query string.
  // If present, verify the transaction with the backend.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const reference = params.get('reference');
    const cbClassroomId = params.get('classroomId') || classroomId;
    if (reference) {
      (async () => {
        try {
          const verifyRes = await api.get(`/payments/paystack/verify?reference=${encodeURIComponent(reference)}`);
          toast.success('Payment successful! You are now enrolled.');
          // clear reference from URL
          params.delete('reference');
          window.history.replaceState({}, document.title, window.location.pathname + (params.toString() ? '?' + params.toString() : ''));
          fetchPayments();
          if (cbClassroomId) window.location.href = `/classrooms/${cbClassroomId}`;
        } catch (err) {
          toast.error(err.response?.data?.message || 'Payment verification failed');
        }
      })();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const getStatusIcon = (status) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-green-600" />;
      case 'failed':
        return <XCircle className="w-4 h-4 text-red-600" />;
      case 'pending':
        return <Clock className="w-4 h-4 text-yellow-600" />;
      default:
        return null;
    }
  };

  if (loading) {
    return <Layout><div className="text-center py-8">Loading...</div></Layout>;
  }

  return (
    <Layout>
      {/* Payment modal shown when navigating to payments?classroomId=... */}
      {showPaymentModal && classroomForPayment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white rounded-lg shadow-lg max-w-md w-full p-6 overflow-y-auto max-h-[90vh]">
            <h3 className="text-lg font-bold mb-2">Pay to Enroll</h3>
            <p className="text-sm text-gray-600 mb-4">You're about to enroll in <strong>{classroomForPayment.name}</strong>.</p>
            <div className="mb-4">
              <div className="text-sm text-gray-500">Amount</div>
              <div className="text-2xl font-semibold">{formatAmount(classroomForPayment.pricing?.amount || 0, classroomForPayment.pricing?.currency || 'NGN')}</div>
            </div>
            <div className="flex justify-end gap-3">
              <button className="px-4 py-2 border rounded" onClick={() => { setShowPaymentModal(false); setClassroomForPayment(null); window.history.replaceState({}, document.title, '/payments'); }}>Cancel</button>
              <button disabled={isPaying} className={`px-4 py-2 ${isPaying ? 'bg-gray-400' : 'bg-blue-600'} text-white rounded`} onClick={() => handlePayment(classroomForPayment._id, classroomForPayment.pricing?.amount || 0)}>
                {isPaying ? 'Processing...' : 'Pay Now'}
              </button>
            </div>
            {payError && <div className="mt-3 text-sm text-red-600">{payError}</div>}
          </div>
        </div>
      )}

      <div className="space-y-6">
        <h2 className="text-2xl font-bold text-gray-800">Payment History</h2>

        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date / Time</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Payer</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Class/Topic</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Amount</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {payments.length > 0 ? (
                payments.map((payment) => (
                  <tr key={payment._id}>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {new Date(payment.paymentDate).toLocaleString()}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {payment.userId?.name || payment.userId?.email || 'Unknown'}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {payment.type.replace('_', ' ')}
                    </td>
                    <td className="px-6 py-4 text-sm font-medium text-gray-800">
                      {payment.classroomId?.name || payment.topicId?.name || payment.planId?.name || 'N/A'}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {formatAmount(payment.amount, payment.currency || 'NGN')}
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-800">
                        {getStatusIcon(payment.status)}
                        <span className="ml-1">{payment.status}</span>
                      </span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="6" className="px-6 py-8 text-center text-gray-500">
                    No payment history yet
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </Layout>
  );
};

export default Payments;

