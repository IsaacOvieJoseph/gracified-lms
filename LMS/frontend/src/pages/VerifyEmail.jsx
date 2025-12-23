import React, { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import api from '../utils/api'; // Use our configured API instance
import { useAuth } from '../context/AuthContext';

const VerifyEmail = () => {
  const [otp, setOtp] = useState('');
  const [error, setError] = useState(null);
  const [message, setMessage] = useState(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { login, setAuthData } = useAuth();

  const email = location.state?.email;

  if (!email) {
    navigate('/login'); // Redirect to login if no email is found in state
    return null;
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setLoading(true);

    try {
      const response = await api.post('/auth/verify-otp', { email, otp });
      console.log('VerifyEmail: API Response on OTP verification:', response.data);
      // Debug: Log all relevant response fields
      console.log('VerifyEmail: token:', response.data.token);
      console.log('VerifyEmail: user:', response.data.user);
      console.log('VerifyEmail: user.isVerified:', response.data.user?.isVerified);
      console.log('VerifyEmail: message:', response.data.message);
      if (response.data.token && response.data.user) {
        console.log('VerifyEmail: Logging in and navigating to dashboard (token and user present)');
        setAuthData(response.data.token, response.data.user, response.data.trialExpired);
        setMessage(response.data.message || 'Email verified successfully!');
        navigate('/dashboard');
      } else if (response.data.user && response.data.user.isVerified) {
        console.log('VerifyEmail: Logging in and navigating to dashboard (user already verified)');
        setAuthData(response.data.token, response.data.user, response.data.trialExpired);
        setMessage('Email already verified. Logging you in...');
        navigate('/dashboard');
      } else {
        console.log('VerifyEmail: OTP verification failed or incomplete data.');
        setError(response.data.message || 'OTP verification failed: Incomplete data from server.');
      }
    } catch (err) {
      console.error('VerifyEmail: OTP verification error caught:', err.response?.data?.message || err.message, 'Full error object:', err);
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
      const response = await api.post('/auth/resend-otp', { email });
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
      <div className="w-full max-w-md p-8 space-y-6 bg-white rounded-lg shadow-md">
        <h2 className="text-2xl font-bold text-center text-gray-900">Verify Your Email</h2>
        <p className="text-center text-gray-600">An OTP has been sent to <strong>{email}</strong>. Please enter it below to verify your email address.</p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="otp" className="block text-sm font-medium text-gray-700">OTP</label>
            <input
              type="text"
              id="otp"
              name="otp"
              value={otp}
              onChange={(e) => setOtp(e.target.value)}
              required
              maxLength="6"
              className="w-full px-3 py-2 mt-1 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 text-center text-lg"
            />
          </div>
          {error && <p className="text-red-500 text-sm">{error}</p>}
          {message && <p className="text-green-500 text-sm">{message}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full px-4 py-2 text-white bg-indigo-600 rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
          >
            {loading ? 'Verifying...' : 'Verify Email'}
          </button>
        </form>
        <p className="text-sm text-center text-gray-600">
          Didn't receive the OTP? <button onClick={handleResendOtp} disabled={loading} className="font-medium text-indigo-600 hover:text-indigo-500 disabled:opacity-50">Resend OTP</button>
        </p>
        <p className="text-sm text-center text-gray-600">
          <Link to="/login" className="font-medium text-indigo-600 hover:text-indigo-500">Back to Login</Link>
        </p>
      </div>
    </div>
  );
};

export default VerifyEmail;
