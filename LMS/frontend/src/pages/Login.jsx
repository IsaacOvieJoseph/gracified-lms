import React, { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import logo from '../assets/logo.jpg';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();
  useEffect(() => {
    // Listen for school selection changes
    const handler = () => {/* reload any school-dependent data here if needed */ };
    window.addEventListener('schoolSelectionChanged', handler);
    return () => window.removeEventListener('schoolSelectionChanged', handler);
  }, []);

  const handleSubmit = async (e) => {
    // e.preventDefault(); // No longer needed as button type is 'button'
    console.log('Login.jsx: === handleSubmit initiated ==='); // More prominent log here
    setError('');
    setLoading(true);

    console.log('Login.jsx: Attempting to call AuthContext login with:', { email, password });
    try {
      const result = await login(email, password);

      if (result.success) {
        console.log('Login.jsx: Login successful, navigating to dashboard.');
        navigate('/dashboard');
      } else if (result.redirectToVerify && result.email) {
        console.log('Login.jsx: Login requires email verification, navigating to verify-email.');
        navigate('/verify-email', { state: { email: result.email } });
      } else if (result.trialExpired) {
        console.log('Login.jsx: Trial expired, navigating to subscription management.');
        navigate('/subscription-management', { state: { email: email } });
      } else {
        console.log('Login.jsx: Login failed with error:', result.message);
        setError(result.message);
      }
    } catch (err) {
      console.error('Login.jsx: Uncaught error during login process:', err);
      setError(err.message || 'An unexpected error occurred.');
    } finally {
      setLoading(false);
      console.log('Login.jsx: handleSubmit finished. Loading set to false.');
    }
  };

  const handleTestClick = () => {
    console.log('Login.jsx: Test click handler fired!');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 flex items-center justify-center p-4">
      <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl p-8 w-full max-w-md transform transition-all hover:scale-[1.01]">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-6">
            <img
              src={logo}
              alt="Gracified LMS Logo"
              className="w-24 h-24 object-contain rounded-full shadow-md transform hover:scale-105 transition-transform duration-300"
            />
          </div>
          <h1 className="text-3xl font-extrabold text-gray-900 mb-2">Gracified LMS</h1>
          <p className="text-gray-600">Empowering education with seamless management and interactive learning</p>
        </div>

        <form className="space-y-6">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2 ml-1">Email Address</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl bg-gray-50 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-200 outline-none"
              placeholder="name@example.com"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2 ml-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl bg-gray-50 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-200 outline-none"
              placeholder="••••••••"
              required
            />
          </div>

          <div className="flex items-center justify-end">
            <Link to="/forgot-password" className="text-sm font-medium text-indigo-600 hover:text-indigo-500 hover:underline">
              Forgot Password?
            </Link>
          </div>

          {error && (
            <div className="p-4 rounded-xl bg-red-50 border-l-4 border-red-500 text-red-700 text-sm">
              {error}
            </div>
          )}

          <button
            type="button"
            onClick={() => { handleTestClick(); handleSubmit(); }}
            disabled={loading}
            className="w-full py-3.5 px-4 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white text-lg font-bold rounded-xl shadow-lg hover:shadow-xl transform transition-all duration-200 active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {loading ? (
              <span className="flex items-center justify-center">
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Signing in...
              </span>
            ) : 'Sign In'}
          </button>
        </form>

        <p className="mt-8 text-center text-gray-600">
          Don't have an account?{' '}
          <Link to="/register" className="font-bold text-indigo-600 hover:text-indigo-500 transition-colors">
            Create account
          </Link>
        </p>
      </div>
    </div>
  );
};

export default Login;

