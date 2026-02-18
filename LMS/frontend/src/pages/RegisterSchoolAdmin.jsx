import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { School, Eye, EyeOff } from 'lucide-react';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { validateEmail, validatePassword, passwordRequirements } from '../utils/validation';

const RegisterSchoolAdmin = () => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    schoolName: '',
    logoUrl: '',
  });
  const [logoFile, setLogoFile] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const navigate = useNavigate();
  const { login } = useAuth();
  useEffect(() => {
    // ...existing code...
    // Listen for school selection changes
    const handler = () => {/* reload any school-dependent data here if needed */ };
    window.addEventListener('schoolSelectionChanged', handler);
    return () => window.removeEventListener('schoolSelectionChanged', handler);
  }, []);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleLogoChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setLogoFile(e.target.files[0]);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setLoading(true);

    if (!validateEmail(formData.email)) {
      setError('Please enter a valid email address.');
      setLoading(false);
      return;
    }

    if (!validatePassword(formData.password)) {
      setError(passwordRequirements);
      setLoading(false);
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      setLoading(false);
      return;
    }

    let currentLogoUrl = formData.logoUrl;

    try {
      // 1. Upload logo if selected
      if (logoFile) {
        setIsUploading(true);
        const uploadData = new FormData();
        uploadData.append('logo', logoFile);
        const uploadRes = await api.post('/auth/upload-logo', uploadData, {
          headers: { 'Content-Type': 'multipart/form-data' },
          skipLoader: true
        });
        currentLogoUrl = uploadRes.data.imageUrl;
        setIsUploading(false);
      }

      // 2. Register with logoUrl
      const response = await api.post('/auth/register', {
        ...formData,
        logoUrl: currentLogoUrl,
        role: 'school_admin'
      }, { skipLoader: true });
      setMessage(response.data.message);
      if (response.data.redirectToVerify) {
        sessionStorage.setItem('verifyEmail', formData.email);
        navigate('/verify-email', { state: { email: formData.email } });
      } else if (response.data.token) {
        login(response.data.token, response.data.user);
        navigate('/dashboard');
      }
    } catch (err) {
      console.error('Registration error:', err);
      if (err.code === 'ECONNABORTED' || err.message?.includes('timeout')) {
        setError('Connection timeout. The server may be slow or unavailable. Please try again.');
      } else if (err.code === 'ERR_NETWORK' || err.message?.includes('Network Error')) {
        setError('Cannot connect to server. Please check your internet connection and ensure the backend is running.');
      } else {
        setError(err.response?.data?.message || err.message || 'Registration failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

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
              <School className="w-8 h-8 text-primary" />
            </div>
            <h1 className="font-outfit text-3xl font-bold text-slate-900 mb-2">School Admin</h1>
            <p className="text-slate-500">Register your school and start managing</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Full Name */}
            <div className="space-y-1.5">
              <label htmlFor="name" className="block text-sm font-semibold text-slate-600 ml-1">Full Name</label>
              <input
                type="text"
                id="name"
                name="name"
                value={formData.name}
                onChange={handleChange}
                placeholder="Enter your full name"
                required
                className="w-full px-4 py-2.5 bg-slate-50/50 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 transition-all focus:bg-white focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
              />
            </div>

            {/* Email */}
            <div className="space-y-1.5">
              <label htmlFor="email" className="block text-sm font-semibold text-slate-600 ml-1">Email Address</label>
              <input
                type="email"
                id="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                placeholder="admin@school.com"
                required
                className="w-full px-4 py-2.5 bg-slate-50/50 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 transition-all focus:bg-white focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
              />
            </div>

            {/* School Name */}
            <div className="space-y-1.5">
              <label htmlFor="schoolName" className="block text-sm font-semibold text-slate-600 ml-1">School Name</label>
              <input
                type="text"
                id="schoolName"
                name="schoolName"
                value={formData.schoolName}
                onChange={handleChange}
                placeholder="Excellence Academy"
                required
                className="w-full px-4 py-2.5 bg-slate-50/50 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 transition-all focus:bg-white focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
              />
            </div>

            {/* Logo Upload */}
            <div className="space-y-1.5">
              <label htmlFor="logo" className="block text-sm font-semibold text-slate-600 ml-1">School Logo (Optional)</label>
              <input
                type="file"
                id="logo"
                name="logo"
                onChange={handleLogoChange}
                accept="image/*"
                className="w-full px-4 py-2.5 bg-slate-50/50 border border-slate-200 rounded-xl text-slate-500 transition-all focus:bg-white focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-primary/10 file:text-primary file:font-semibold file:cursor-pointer"
              />
              <p className="text-xs text-slate-400 ml-1">Recommended: Square image, max 2MB</p>
            </div>

            {/* Passwords */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label htmlFor="password" className="block text-sm font-semibold text-slate-600 ml-1">Password</label>
                <div className="relative group">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    id="password"
                    name="password"
                    value={formData.password}
                    onChange={handleChange}
                    placeholder="••••••••"
                    required
                    className="w-full px-4 py-2.5 bg-slate-50/50 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 transition-all focus:bg-white focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none pr-10"
                  />
                  <button
                    type="button"
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 transition-colors"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <label htmlFor="confirmPassword" className="block text-sm font-semibold text-slate-600 ml-1">Confirm</label>
                <div className="relative group">
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    id="confirmPassword"
                    name="confirmPassword"
                    value={formData.confirmPassword}
                    onChange={handleChange}
                    placeholder="••••••••"
                    required
                    className="w-full px-4 py-2.5 bg-slate-50/50 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 transition-all focus:bg-white focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none pr-10"
                  />
                  <button
                    type="button"
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 transition-colors"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  >
                    {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </div>

            {/* Error & Message Alerts */}
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

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading || isUploading}
              className="w-full btn-premium mt-6 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isUploading ? 'Uploading logo...' : loading ? 'Creating account...' : 'Complete Registration'}
            </button>
          </form>

          {/* Footer */}
          <div className="mt-8 pt-6 border-t border-slate-200">
            <p className="text-sm text-slate-600 text-center">
              Already have an account?{' '}
              <Link to="/login" className="font-semibold text-primary hover:text-primary/80 transition-colors">
                Sign in here
              </Link>
            </p>
          </div>

          {/* Other Account Types */}
          <div className="mt-6 pt-6 border-t border-slate-200">
            <p className="text-xs text-slate-500 text-center mb-4">Other account types</p>
            <div className="grid grid-cols-2 gap-3">
              <Link
                to="/register/student"
                className="btn-secondary text-sm py-2 justify-center"
              >
                Student
              </Link>
              <Link
                to="/register/personal-teacher"
                className="btn-secondary text-sm py-2 justify-center"
              >
                Teacher
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RegisterSchoolAdmin;
