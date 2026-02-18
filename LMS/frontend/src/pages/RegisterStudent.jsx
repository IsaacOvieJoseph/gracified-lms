import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff } from 'lucide-react';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { validateEmail, validatePassword, passwordRequirements } from '../utils/validation';
import logo from '../assets/logo.jpg';

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
    <div className="h-screen bg-[#F8FAFC] flex font-inter relative overflow-hidden">
      {/* Abstract Background Shapes */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/5 rounded-full blur-[120px]" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-400/5 rounded-full blur-[120px]" />

      {/* Left Decoration - Visible on Desktop */}
      <div className="hidden lg:flex flex-1 items-center justify-center p-12 bg-white border-r border-slate-100 relative z-10">
        <div className="max-w-md text-center">
          <img src={logo} alt="Gracified" className="w-24 h-24 mx-auto rounded-3xl shadow-xl mb-8" />
          <h2 className="text-4xl font-extrabold text-slate-900 mb-4 tracking-tight">
            Elevate Your <span className="text-primary italic">Learning Experience</span>
          </h2>
          <p className="text-slate-500 text-lg leading-relaxed">
            The most intuitive management system for modern educational environments.
          </p>
          <div className="mt-12 grid grid-cols-2 gap-4">
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100">
              <div className="text-2xl font-bold text-slate-900">10k+</div>
              <div className="text-xs font-bold uppercase tracking-wider text-slate-400">Students</div>
            </div>
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100">
              <div className="text-2xl font-bold text-slate-900">99.9%</div>
              <div className="text-xs font-bold uppercase tracking-wider text-slate-400">Uptime</div>
            </div>
          </div>

          <br></br>
          <br></br>
          <br></br>
          <p className="mt-8 text-center text-slate-400 text-xs font-medium">
            &copy; {new Date().getFullYear()} Gracified LMS. All rights reserved.
          </p>

        </div>
      </div>

      {/* Right Form */}
      <div className="flex-1 flex justify-center p-6 pt-10 pb-10 relative z-10">
        <div className="w-full max-w-md animate-slide-up">
          <div className="lg:hidden text-center mb-8">
            <img src={logo} alt="Gracified" className="w-16 h-16 mx-auto rounded-2xl shadow-lg mb-4" />
            <h1 className="text-2xl font-bold text-slate-900">Gracified LMS</h1>
          </div>

          <div className="card-premium p-8 md:p-10 bg-white/95 backdrop-blur-xl max-h-[calc(100vh-4rem)] overflow-y-auto">
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
                    placeholder="••••••••"
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
                    placeholder="••••••••"
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
    </div>
  );
};

export default RegisterStudent;
