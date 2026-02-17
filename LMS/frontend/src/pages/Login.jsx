import React, { useEffect, useState } from 'react';
import { Eye, EyeOff, Lock, Mail, ArrowRight, Loader2 } from 'lucide-react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import logo from '../assets/logo.jpg';
import { validateEmail } from '../utils/validation';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    if (!validateEmail(email)) {
      setError('Please enter a valid email address.');
      setLoading(false);
      return;
    }

    try {
      const result = await login(email, password);
      if (result.success) {
        navigate('/dashboard');
      } else if (result.redirectToVerify && result.email) {
        navigate('/verify-email', { state: { email: result.email } });
      } else if (result.trialExpired) {
        navigate('/subscription-management', { state: { email: email } });
      } else {
        setError(result.message);
      }
    } catch (err) {
      setError(err.message || 'An unexpected error occurred.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex font-inter relative overflow-hidden">
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
        </div>
      </div>

      {/* Right Form */}
      <div className="flex-1 flex items-center justify-center p-6 relative z-10">
        <div className="w-full max-w-md animate-slide-up">
          <div className="lg:hidden text-center mb-8">
            <img src={logo} alt="Gracified" className="w-16 h-16 mx-auto rounded-2xl shadow-lg mb-4" />
            <h1 className="text-2xl font-bold text-slate-900">Gracified LMS</h1>
          </div>

          <div className="card-premium p-8 md:p-10 bg-white">
            <div className="mb-8">
              <h1 className="text-2xl font-bold text-slate-900 mb-2">Welcome back</h1>
              <p className="text-slate-500">Enter your credentials to access your account</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-1.5">
                <label>Email Address</label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400 group-focus-within:text-primary transition-colors">
                    <Mail className="w-5 h-5" />
                  </div>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-11 bg-slate-50/50 border-slate-200 focus:bg-white"
                    placeholder="name@example.com"
                    required
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="mb-0">Password</label>
                  <Link to="/forgot-password" title="Recover password" className="text-xs font-bold text-primary hover:underline">
                    Forgot Password?
                  </Link>
                </div>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400 group-focus-within:text-primary transition-colors">
                    <Lock className="w-5 h-5" />
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-11 bg-slate-50/50 border-slate-200 focus:bg-white"
                    placeholder="••••••••"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-4 flex items-center text-slate-400 hover:text-slate-600 focus:outline-none transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              {error && (
                <div className="p-3 bg-red-50 border border-red-100 rounded-xl text-red-600 text-xs font-medium animate-shake">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="btn-premium w-full mt-2"
              >
                {loading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    <span>Sign In</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>

            <div className="mt-8 pt-6 border-t border-slate-100 text-center text-sm text-slate-500">
              Don't have an account?{' '}
              <Link to="/register" className="font-bold text-primary hover:underline">
                Create account
              </Link>
            </div>
          </div>

          <p className="mt-8 text-center text-slate-400 text-xs font-medium">
            &copy; {new Date().getFullYear()} Gracified LMS. All rights reserved.
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
