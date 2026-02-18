import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff } from 'lucide-react';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { validateEmail, validatePassword, passwordRequirements } from '../utils/validation';

const RegisterStudent = () => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    schoolId: '',
  });
  const [error, setError] = useState(null);
  const [message, setMessage] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const navigate = useNavigate();
  const { login } = useAuth();
  const [schools, setSchools] = useState([]);

  useEffect(() => {
    const fetchSchools = async () => {
      try {
        const response = await api.get('/schools/public');
        setSchools(response.data.schools);
      } catch (error) {
        console.error('Error fetching schools:', error);
      }
    };
    fetchSchools();
  }, []);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
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

    try {
      const response = await api.post('/auth/register', { ...formData, role: 'student' }, { skipLoader: true });
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
            <h1 className="font-outfit text-3xl font-bold text-slate-900 mb-2">Join as Student</h1>
            <p className="text-slate-500">Create your learning account</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Name */}
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
                placeholder="you@example.com"
                required
                className="w-full px-4 py-2.5 bg-slate-50/50 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 transition-all focus:bg-white focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
              />
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <label htmlFor="password" className="block text-sm font-semibold text-slate-600 ml-1">Password</label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400 group-focus-within:text-primary transition-colors" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  id="password"
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  placeholder="Create a strong password"
                  required
                  className="w-full pl-4 pr-12 py-2.5 bg-slate-50/50 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 transition-all focus:bg-white focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 pr-4 flex items-center text-slate-400 hover:text-slate-600 transition-colors"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Confirm Password */}
            <div className="space-y-1.5">
              <label htmlFor="confirmPassword" className="block text-sm font-semibold text-slate-600 ml-1">Confirm Password</label>
              <div className="relative group">
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  id="confirmPassword"
                  name="confirmPassword"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  placeholder="Confirm your password"
                  required
                  className="w-full pl-4 pr-12 py-2.5 bg-slate-50/50 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 transition-all focus:bg-white focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 pr-4 flex items-center text-slate-400 hover:text-slate-600 transition-colors"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                >
                  {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* School Selection */}
            <div className="space-y-1.5">
              <label htmlFor="schoolId" className="block text-sm font-semibold text-slate-600 ml-1">School / Tutorial Center</label>
              <select
                id="schoolId"
                name="schoolId"
                value={formData.schoolId}
                onChange={handleChange}
                className="w-full px-4 py-2.5 bg-slate-50/50 border border-slate-200 rounded-xl text-slate-900 transition-all focus:bg-white focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none appearance-none"
              >
                <option value="">Select a school (Optional)</option>
                <option value="none">None</option>
                {schools.map(school => (
                  <option key={school._id} value={school._id}>{school.name}</option>
                ))}
              </select>
              <p className="text-xs text-slate-400 ml-1 mt-1">Select "None" if you don't belong to any specific school.</p>
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
              disabled={loading}
              className="w-full btn-premium mt-6 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading ? 'Creating account...' : 'Create Account'}
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

          {/* Sign Up Options */}
          <div className="mt-6 pt-6 border-t border-slate-200">
            <p className="text-xs text-slate-500 text-center mb-4">Other account types</p>
            <div className="grid grid-cols-2 gap-3">
              <Link
                to="/register/school-admin"
                className="btn-secondary text-sm py-2 justify-center"
              >
                School Admin
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

export default RegisterStudent;
