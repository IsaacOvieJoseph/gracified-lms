import React, { createContext, useState, useEffect, useContext } from 'react';
import api, { setAuthToken } from '../utils/api';
// import { useNavigate } from 'react-router-dom'; // Remove useNavigate import

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  // const navigate = useNavigate(); // Remove useNavigate instantiation

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) setAuthToken(token); // Ensure Authorization is set before any API call.
    console.log('AuthContext useEffect: Initializing...');
    const savedUser = localStorage.getItem('user');
    console.log('AuthContext useEffect: Token being retrieved:', savedUser);
    
    if (token && savedUser) {
      console.log('AuthContext useEffect: Token and user found in localStorage. Attempting to verify token.');
      setUser(JSON.parse(savedUser)); // Set user from local storage initially
      verifyToken();
    } else {
      console.log('AuthContext useEffect: No token or user found in localStorage. Setting loading to false.');
      setLoading(false);
    }
  }, []);

  const verifyToken = async () => {
    console.log('AuthContext verifyToken: Starting token verification...');
    const existingToken = localStorage.getItem('token'); // Get existing token
        
    try {
      const response = await api.get('/auth/me');
      const { user: fetchedUser, trialExpired } = response.data; // Extract trialExpired
      console.log('AuthContext verifyToken: Token verification successful. User data:', fetchedUser, 'trialExpired:', trialExpired);
      
      // Ensure schoolId and tutorialId are stored as plain IDs
      const cleanedUser = {
        ...fetchedUser,
        schoolId: fetchedUser.schoolId?._id || fetchedUser.schoolId || null,
        tutorialId: fetchedUser.tutorialId?._id || fetchedUser.tutorialId || null,
      };

      // Use existing token (not response.data.token which doesn't exist)
      setAuthData(existingToken, cleanedUser, trialExpired);
      // No need for separate setUser/localStorage.setItem calls as setAuthData handles it
      
    } catch (error) {
      const apiErrorMsg = error.response?.data?.message;
      const apiErrorStatus = error.response?.status;
      console.warn('AuthContext verifyToken: Token verification failed:', apiErrorMsg || error.message);
      // Only clear IF this is an actual token/authentication error
      if (
        apiErrorStatus === 401 ||
        apiErrorStatus === 403 ||
        apiErrorMsg === 'No token, authorization denied' ||
        apiErrorMsg === 'Token is invalid, user not found'
      ) {
        setAuthData(null, null); // User is actually unauthenticated
      } else {
        // For other errors (e.g. server/network problems), don't log the user out, just display error and keep state
        console.error('Non-auth verifyToken error (not logging out):', error);
      }
    } finally {
      console.log('AuthContext verifyToken: Finished verification. Setting loading to false.');
      setLoading(false);
    }
  };

  const setAuthData = (token, user, trialExpired = false) => {
    // If token is null/undefined, preserve existing token from localStorage
    const tokenToUse = token || localStorage.getItem('token') || '';
    setAuthToken(tokenToUse); // Set token on api instance immediately
    // Ensure user object explicitly contains isVerified: true after OTP success
    const userWithVerifiedStatus = user ? { ...user, isVerified: user.isVerified || false } : null;
    const finalUser = userWithVerifiedStatus ? { ...userWithVerifiedStatus, trialExpired: trialExpired || false } : null;

    // Only update token if a new token was provided
    if (token) {
      localStorage.setItem('token', token);
    }
    localStorage.setItem('user', finalUser ? JSON.stringify(finalUser) : '');
    setUser(finalUser);
    console.log('AuthContext setAuthData: User data and token set.', finalUser);
  };


  const login = async (email, password) => {
    console.log('AuthContext login: Attempting to log in user:', email);
    try {
      const response = await api.post('/auth/login', { email, password });
      console.log('AuthContext login: Raw response data from /auth/login:', response.data);
      const { token, user, redirectToVerify, trialExpired } = response.data;
      console.log('AuthContext login: Extracted data - token present:', !!token, 'user present:', !!user, 'redirectToVerify:', redirectToVerify, 'trialExpired:', trialExpired);

      if (redirectToVerify) {
        console.log('AuthContext login: Redirecting to verify email.');
        return { success: false, redirectToVerify: true, email: email, message: response.data.message };
      }

      const cleanedUser = {
        ...user,
        schoolId: user.schoolId?._id || user.schoolId || null,
        tutorialId: user.tutorialId?._id || user.tutorialId || null,
      };

      setAuthData(token, cleanedUser, trialExpired);
      console.log('AuthContext login: User logged in and state updated. User:', cleanedUser);

      return { success: true, trialExpired: trialExpired || false };
    } catch (error) {
      const errorMessage = error.response?.data?.message || 'Login failed';
      const redirectToVerify = error.response?.data?.redirectToVerify || false;
      const unverifiedEmail = error.response?.data?.email || null;
      const trialExpired = error.response?.data?.trialExpired || false;
      console.error('AuthContext login: Login failed:', errorMessage, { redirectToVerify, unverifiedEmail, trialExpired });

      if (redirectToVerify && unverifiedEmail) {
        return { success: false, redirectToVerify: true, email: unverifiedEmail, message: errorMessage, trialExpired: trialExpired };
      }

      return { success: false, message: errorMessage };
    }
  };

  const logout = () => {
    console.log('AuthContext logout: Clearing user session.');
    setAuthData(null, null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, setAuthData, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};