import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import api from '../utils/api'; // Use our configured API instance
import { useAuth } from '../context/AuthContext';
import OTPInput from '../components/OTPInput';

const VerifyEmail = () => {
  const [otp, setOtp] = useState('');
  const [error, setError] = useState(null);
  const [message, setMessage] = useState(null);
  const [loading, setLoading] = useState(false);
  // Removed problematic user dependency and effect, since user is not defined
  // Add effect back only if you plan to implement fetchVerificationStatus and properly access user from context.
  // useEffect(() => {
  //   // fetchVerificationStatus();
  //   // Listen for school selection changes
  //   // const handler = () => fetchVerificationStatus();
  //   // window.addEventListener('schoolSelectionChanged', handler);
  //   // return () => window.removeEventListener('schoolSelectionChanged', handler);
  // }, []);

  const navigate = useNavigate();
  const location = useLocation();
  const { login, setAuthData } = useAuth();

  const passedEmail = location.state?.email;
  const [email, setEmail] = useState(passedEmail || sessionStorage.getItem('verifyEmail'));

  useEffect(() => {
    if (passedEmail) sessionStorage.setItem('verifyEmail', passedEmail);
    if (!passedEmail && !email) {
      navigate('/login');
    }
  }, [passedEmail, email, navigate]);

  if (!email) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setLoading(true);

    try {
      const response = await api.post('/auth/verify-otp', { email, otp }, { skipLoader: true });
      if (response.data.token && response.data.user) {
        setAuthData(response.data.token, response.data.user, response.data.trialExpired);
        setMessage(response.data.message || 'Email verified successfully!');
        navigate('/dashboard');
      } else if (response.data.user && response.data.user.isVerified) {
        setAuthData(response.data.token, response.data.user, response.data.trialExpired);
        setMessage('Email already verified. Logging you in...');
        navigate('/dashboard');
      } else {
        setError(response.data.message || 'OTP verification failed: Incomplete data from server.');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'OTP verification failed');
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    setError(null);
    setMessage(null);
    setLoading(true);
    try {
      const response = await api.post('/auth/resend-otp', { email }, { skipLoader: true });
      setMessage(response.data.message);
    } catch (err) {
      console.error('Resend OTP error:', err.response?.data?.message || err.message);
      setError(err.response?.data?.message || 'Failed to resend OTP');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex justify-center items-center min-h-screen bg-gray-100">
      <div className="w-full max-w-md p-8 space-y-6 bg-white rounded-xl shadow-none">
        <h2 className="text-2xl font-semibold text-center text-gray-900">Verify Your Email</h2>
        <p className="text-center text-gray-600">An OTP has been sent to <strong>{email}</strong>. Please enter it below to verify your email address.</p>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="flex justify-center">
            <OTPInput
              length={6}
              value={otp}
              onChange={setOtp}
            />
          </div>
          {error && <p className="text-red-500 text-sm">{error}</p>}
          {message && <p className="text-green-500 text-sm">{message}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full px-4 py-2 text-white bg-primary rounded-md hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
          >
            {loading ? 'Verifying...' : 'Verify Email'}
          </button>
        </form>
        <p className="text-sm text-center text-gray-600">
          Didn't receive the OTP? <button onClick={handleResendOtp} disabled={loading} className="font-medium text-primary hover:text-primary disabled:opacity-50">Resend OTP</button>
        </p>
        <p className="text-sm text-center text-gray-600">
          <Link to="/login" className="font-medium text-primary hover:text-primary">Back to Login</Link>
        </p>
      </div>
    </div>
  );
};

export default VerifyEmail;
