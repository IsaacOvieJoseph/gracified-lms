import React, { useEffect, useState } from 'react';
import { Eye, EyeOff, Lock, Mail, ArrowRight, Loader2 } from 'lucide-react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import logo from '../assets/logo.jpg';
import { validateEmail } from '../utils/validation';
import ThemeToggle from '../components/ThemeToggle';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

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
        const params = new URLSearchParams(location.search);
        const redirectTo = params.get('redirect') || '/dashboard';
        navigate(redirectTo);
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
    <div className="h-screen bg-background text-foreground flex font-inter relative overflow-hidden transition-colors duration-300">
      {/* Ambient Background */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/5 rounded-full blur-[120px]" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-400/5 rounded-full blur-[120px]" />

      {/* Left Decoration - Desktop Only */}
      <div className="hidden lg:flex flex-1 items-center justify-center p-12 bg-card border-r border-border relative z-10">
        <div className="max-w-md text-center">
          <img src={logo} alt="Gracified" className="w-24 h-24 mx-auto rounded-3xl shadow-xl mb-8" />
          <h2 className="text-4xl font-extrabold text-foreground mb-4 tracking-tight">
            Elevate Your <span className="text-primary italic">Learning Experience</span>
          </h2>
          <p className="text-muted-foreground text-lg leading-relaxed">
            The most intuitive management system for modern educational environments.
          </p>
          <div className="mt-12 grid grid-cols-2 gap-4">
            <div className="p-4 rounded-2xl bg-muted border border-border">
              <div className="text-2xl font-bold text-foreground">10k+</div>
              <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Students</div>
            </div>
            <div className="p-4 rounded-2xl bg-muted border border-border">
              <div className="text-2xl font-bold text-foreground">99.9%</div>
              <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Uptime</div>
            </div>
          </div>
          <br /><br /><br />
          <p className="mt-8 text-center text-muted-foreground/60 text-xs font-medium">
            &copy; {new Date().getFullYear()} Gracified LMS. All rights reserved.
          </p>
        </div>
      </div>

      {/* Right Form */}
      <div className="flex-1 flex items-center justify-center p-6 lg:p-12 relative z-10">
        <div className="w-full max-w-lg animate-slide-up">
          {/* Mobile logo + theme toggle row */}
          <div className="lg:hidden text-center mb-8 relative">
            <div className="absolute top-0 right-0">
              <ThemeToggle />
            </div>
            <img src={logo} alt="Gracified" className="w-16 h-16 mx-auto rounded-2xl shadow-lg mb-4" />
            <h1 className="text-2xl font-bold text-foreground">Gracified LMS</h1>
          </div>

          <div className="card-premium p-10 md:p-14 bg-card max-h-[calc(100vh-4rem)] overflow-y-auto shadow-2xl relative">
            {/* Desktop theme toggle */}
            <div className="hidden lg:flex absolute top-6 right-6">
              <ThemeToggle />
            </div>

            <div className="mb-10 text-center lg:text-left">
              <h1 className="text-3xl font-extrabold text-foreground mb-3 tracking-tight">Welcome back</h1>
              <p className="text-muted-foreground text-base">Enter your credentials to access your account</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-7">
              <div className="space-y-1.5">
                <label className="block text-sm font-semibold text-foreground/80 mb-1.5 ml-1">Email Address</label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-muted-foreground group-focus-within:text-primary transition-colors">
                    <Mail className="w-5 h-5" />
                  </div>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-11 bg-muted/50 dark:bg-muted border-border focus:bg-background dark:focus:bg-background/50"
                    placeholder="name@example.com"
                    required
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="block text-sm font-semibold text-foreground/80 mb-1.5 ml-1">Password</label>
                  <Link to="/forgot-password" title="Recover password" className="text-xs font-bold text-primary hover:underline">
                    Forgot Password?
                  </Link>
                </div>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-muted-foreground group-focus-within:text-primary transition-colors">
                    <Lock className="w-5 h-5" />
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-11 bg-muted/50 dark:bg-muted border-border focus:bg-background dark:focus:bg-background/50"
                    placeholder="••••••••"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-4 flex items-center text-muted-foreground hover:text-foreground focus:outline-none transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              {error && (
                <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-500 dark:text-red-400 text-xs font-medium">
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

            <div className="mt-12 pt-8 border-t border-border text-center text-sm text-muted-foreground">
              Don't have an account?{' '}
              <Link
                to={`/register?${new URLSearchParams(location.search).toString()}`}
                className="font-bold text-primary hover:underline"
              >
                Create account
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
