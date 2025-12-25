import React, { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Book } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();
  useEffect(() => {
    // Listen for school selection changes
    const handler = () => {/* reload any school-dependent data here if needed */};
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
    <div className="min-h-screen bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-2xl p-8 w-full max-w-md">
        <div className="text-center mb-8">
          <Book className="w-16 h-16 mx-auto text-blue-600 mb-4" />
          <h1 className="text-3xl font-bold text-gray-800">LMS Platform</h1>
          <p className="text-gray-600 mt-2">Learning Management System - Please log in</p> {/* Minor text change */}
        </div>
        
        <form className="space-y-4"> {/* Removed onSubmit from form */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="your@email.com"
              required
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="••••••••"
              required
            />
          </div>
          
          {error && <p className="text-red-500 text-sm">{error}</p>}
          
          <button
            type="button"
            onClick={() => { handleTestClick(); handleSubmit(); }} // Call both functions
            disabled={loading}
            className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 transition disabled:opacity-50"
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>
        
        <p className="mt-4 text-center text-gray-600">
          <Link to="/forgot-password" className="text-blue-600 hover:underline block mb-2">
            Forgot Password?
          </Link>
          Don't have an account? <Link to="/register" className="text-blue-600 hover:underline">Sign Up</Link>
        </p>
      </div>
    </div>
  );
};

export default Login;

