import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import api from '../utils/api';

function useQuery() {
  return new URLSearchParams(useLocation().search);
}

export default function PaystackCallback() {
  const query = useQuery();
  const navigate = useNavigate();
  const reference = query.get('reference') || query.get('ref') || query.get('trxref');
  const [status, setStatus] = useState('verifying');
  const [message, setMessage] = useState('Verifying payment...');

  useEffect(() => {
    if (!reference) {
      setStatus('error');
      setMessage('No reference found in URL.');
      return;
    }

    const verify = async () => {
      try {
        const res = await api.get(`/payments/paystack/verify?reference=${encodeURIComponent(reference)}`);
        if (res && res.data) {
          setStatus('success');
          setMessage(res.data.message || 'Payment verified.');
          // optionally redirect after short delay
          const classroomId = query.get('classroomId');
          setTimeout(() => {
            if (classroomId) navigate(`/classrooms/${classroomId}`);
            else navigate('/payments');
          }, 2500);
        } else {
          setStatus('error');
          setMessage('Unexpected verify response');
        }
      } catch (err) {
        console.error('Verify error', err);
        setStatus('error');
        const errMsg = err?.response?.data?.message || err.message || 'Verification failed';
        setMessage(errMsg);
      }
    };

    verify();
  }, [reference, navigate]);

  return (
    <div className="p-6 max-w-xl mx-auto">
      {status === 'verifying' && (
        <div>
          <h2 className="text-xl font-semibold">Verifying payment</h2>
          <p className="mt-2 text-sm text-gray-600">Please wait while we confirm your payment.</p>
        </div>
      )}

      {status === 'success' && (
        <div>
          <h2 className="text-xl font-semibold text-green-600">Payment verified</h2>
          <p className="mt-2 text-sm text-gray-600">{message}</p>
        </div>
      )}

      {status === 'error' && (
        <div>
          <h2 className="text-xl font-semibold text-red-600">Payment verification failed</h2>
          <p className="mt-2 text-sm text-gray-600">{message}</p>
          <div className="mt-4">
            <button className="btn" onClick={() => navigate('/payments')}>Back to payments</button>
          </div>
        </div>
      )}
    </div>
  );
}
