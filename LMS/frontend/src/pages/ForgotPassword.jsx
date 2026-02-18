import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Lock, Mail, Key, Eye, EyeOff } from 'lucide-react';
import api from '../utils/api';
import { validateEmail, validatePassword, passwordRequirements } from '../utils/validation';
import OTPInput from '../components/OTPInput';

const ForgotPassword = () => {
  const [step, setStep] = useState(1); // 1: Email, 2: OTP, 3: New Password
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const navigate = useNavigate();

  // Step 1: Request OTP
  const handleRequestOTP = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');
    setLoading(true);

    if (!validateEmail(email)) {
      setError('Please enter a valid email address.');
      setLoading(false);
      return;
    }

    try {
      const response = await api.post('/auth/forgot-password', { email }, { skipLoader: true });
      setMessage(response.data.message);
      setStep(2); // Move to OTP step
      // Store email in sessionStorage for persistence
      sessionStorage.setItem('resetPasswordEmail', email);
    } catch (err) {
      console.error('Forgot password error:', err);
      setError(err.response?.data?.message || 'Failed to send reset OTP. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Step 2: Verify OTP
  const handleVerifyOTP = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');
    setLoading(true);

    const emailToUse = email || sessionStorage.getItem('resetPasswordEmail');

    try {
      const response = await api.post('/auth/verify-reset-otp', { email: emailToUse, otp }, { skipLoader: true });
      setMessage(response.data.message);
      setStep(3); // Move to password reset step
    } catch (err) {
      console.error('Verify OTP error:', err);
      setError(err.response?.data?.message || 'Invalid OTP. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Step 3: Reset Password
  const handleResetPassword = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');
    setLoading(true);

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      setLoading(false);
      return;
    }

    if (!validatePassword(newPassword)) {
      setError(passwordRequirements);
      setLoading(false);
      return;
    }

    const emailToUse = email || sessionStorage.getItem('resetPasswordEmail');

    try {
      const response = await api.post('/auth/reset-password', {
        email: emailToUse,
        otp,
        newPassword
      }, { skipLoader: true });
      setMessage(response.data.message);

      // Clear session storage
      sessionStorage.removeItem('resetPasswordEmail');

      // Redirect to login after 2 seconds
      setTimeout(() => {
        navigate('/login');
      }, 2000);
    } catch (err) {
      console.error('Reset password error:', err);
      setError(err.response?.data?.message || 'Failed to reset password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Get email from sessionStorage if available
  React.useEffect(() => {
    const savedEmail = sessionStorage.getItem('resetPasswordEmail');
    if (savedEmail && step > 1) {
      setEmail(savedEmail);
    }
  }, [step]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-slate-50 to-blue-50 flex items-center justify-center p-4 md:p-6 font-inter relative overflow-hidden">
      {/* Ambient background shapes */}
      <div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-primary/5 rounded-full blur-[150px] pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-blue-400/5 rounded-full blur-[120px] pointer-events-none" />

      <div className="w-full max-w-md relative z-10 animate-slide-up">
        <div className="card-premium p-8 md:p-10 bg-white/95 backdrop-blur-xl">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="inline-flex p-3 rounded-2xl bg-primary/10 mb-4">
              <Lock className="w-8 h-8 text-primary" />
            </div>
            <h1 className="font-outfit text-3xl font-bold text-slate-900 mb-2">Reset Password</h1>
            <p className="text-slate-500">
              {step === 1 && 'Enter your email to receive a reset code'}
              {step === 2 && 'Enter the OTP sent to your email'}
              {step === 3 && 'Create your new password'}
            </p>
          </div>

          {/* Step 1: Email Input */}
          {step === 1 && (
            <form onSubmit={handleRequestOTP} className="space-y-4">
              <div className="space-y-1.5">
                <label className="block text-sm font-semibold text-slate-600 ml-1">Email Address</label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400 group-focus-within:text-primary transition-colors">
                    <Mail className="w-5 h-5" />
                  </div>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-11 py-2.5 bg-slate-50/50 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 transition-all focus:bg-white focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                    placeholder="name@example.com"
                    required
                  />
                </div>
              </div>
              {error && (
                <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700 font-medium">
                  {error}
                </div>
              )}
              {message && (
                <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-sm text-emerald-700 font-medium">
                  {message}
                </div>
              )}
              <button
                type="submit"
                disabled={loading}
                className="w-full btn-premium mt-6 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {loading ? 'Sending...' : 'Send Reset Code'}
              </button>
            </form>
          )}

        {/* Step 2: OTP Verification */}
        {step === 2 && (
          <form onSubmit={handleVerifyOTP} className="space-y-4">
            <div className="space-y-1.5">
              <label className="block text-sm font-semibold text-slate-600 ml-1">Enter OTP</label>
              <div className="flex justify-center mb-4">
                <OTPInput
                  length={6}
                  value={otp}
                  onChange={setOtp}
                />
              </div>
              <p className="text-xs text-slate-400 text-center ml-1">OTP sent to {email || sessionStorage.getItem('resetPasswordEmail')}</p>
            </div>
            {error && (
              <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700 font-medium">
                {error}
              </div>
            )}
            {message && (
              <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-sm text-emerald-700 font-medium">
                {message}
              </div>
            )}
            <button
              type="submit"
              disabled={loading}
              className="w-full btn-premium mt-6 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading ? 'Verifying...' : 'Verify OTP'}
            </button>
            <div className="flex justify-between items-center mt-4 pt-2 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="text-primary hover:text-primary/80 text-xs font-semibold transition-colors"
              >
                Change Email
              </button>
              <button
                type="button"
                onClick={async () => {
                  setError('');
                  setMessage('');
                  setLoading(true);
                  const emailToUse = email || sessionStorage.getItem('resetPasswordEmail');
                  try {
                    const response = await api.post('/auth/resend-reset-otp', { email: emailToUse }, { skipLoader: true });
                    setMessage(response.data.message);
                  } catch (err) {
                    setError(err.response?.data?.message || 'Failed to resend OTP');
                  } finally {
                    setLoading(false);
                  }
                }}
                disabled={loading}
                className="text-primary hover:text-primary/80 text-xs font-semibold disabled:opacity-50 transition-colors"
              >
                Resend OTP
              </button>
            </div>
          </form>
        )}

        {/* Step 3: New Password */}
        {step === 3 && (
          <form onSubmit={handleResetPassword} className="space-y-4">
            <div className="space-y-1.5">
              <label className="block text-sm font-semibold text-slate-600 ml-1">New Password</label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400 group-focus-within:text-primary transition-colors">
                  <Lock className="w-5 h-5" />
                </div>
                <input
                  type={showNewPassword ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full pl-11 py-2.5 bg-slate-50/50 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 transition-all focus:bg-white focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none pr-10"
                  placeholder="Enter new password"
                  required
                  minLength="6"
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 pr-4 flex items-center text-slate-400 hover:text-slate-600 transition-colors"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                >
                  {showNewPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="block text-sm font-semibold text-slate-600 ml-1">Confirm Password</label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400 group-focus-within:text-primary transition-colors">
                  <Lock className="w-5 h-5" />
                </div>
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full pl-11 py-2.5 bg-slate-50/50 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 transition-all focus:bg-white focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none pr-10"
                  placeholder="Confirm new password"
                  required
                  minLength="6"
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 pr-4 flex items-center text-slate-400 hover:text-slate-600 transition-colors"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                >
                  {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>
            {error && (
              <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700 font-medium">
                {error}
              </div>
            )}
            {message && (
              <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-sm text-emerald-700 font-medium">
                {message}
              </div>
            )}
            <button
              type="submit"
              disabled={loading}
              className="w-full btn-premium mt-6 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading ? 'Resetting...' : 'Reset Password'}
            </button>
            {message && (
              <p className="text-xs text-slate-500 text-center animate-pulse">
                Redirecting to login page...
              </p>
            )}
          </form>
        )}

        {/* Footer */}
        <div className="mt-8 pt-6 border-t border-slate-200">
          <p className="text-center text-slate-500 text-sm">
            <Link to="/login" className="font-semibold text-primary hover:text-primary/80 transition-colors inline-flex items-center gap-1">
              ← Back to Login
            </Link>
          </p>
        </div>
        </div>
      </div>
    </div>
  );
};

export default ForgotPassword;
