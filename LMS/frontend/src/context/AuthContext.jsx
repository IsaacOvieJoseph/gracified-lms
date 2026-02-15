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
    const savedUser = localStorage.getItem('user');
    if (token) setAuthToken(token); // Ensure Authorization is set before any API call.
    if (token && savedUser) {
      setUser(JSON.parse(savedUser)); // Set user from local storage initially
      verifyToken();
    } else {
      setLoading(false);
    }
  }, []);

  const verifyToken = async () => {
    const existingToken = localStorage.getItem('token');
    try {
      const response = await api.get('/auth/me');
      const { user: fetchedUser, trialExpired, subscriptionExpired } = response.data; // Extract flags

      // Keep populated fields if they exist to access logo URLs
      const cleanedUser = {
        ...fetchedUser,
        schoolId: fetchedUser.schoolId || [],
        tutorialId: fetchedUser.tutorialId || null,
      };

      // Use existing token
      setAuthData(existingToken, cleanedUser, trialExpired, subscriptionExpired);
      // No need for separate setUser/localStorage.setItem calls as setAuthData handles it

    } catch (error) {
      const apiErrorMsg = error.response?.data?.message;
      const apiErrorStatus = error.response?.status;
    } finally {
      setLoading(false);
    }
  };

  const setAuthData = (token, user, trialExpired = false, subscriptionExpired = false) => {
    // If token is null/undefined, preserve existing token from localStorage
    const tokenToUse = token || localStorage.getItem('token') || '';
    setAuthToken(tokenToUse); // Set token on api instance immediately
    // Ensure user object explicitly contains isVerified: true after OTP success
    const userWithVerifiedStatus = user ? { ...user, isVerified: user.isVerified || false } : null;
    const finalUser = userWithVerifiedStatus ? {
      ...userWithVerifiedStatus,
      trialExpired: trialExpired || false,
      subscriptionExpired: subscriptionExpired || false
    } : null;

    // Only update token if a new token was provided
    if (token) {
      localStorage.setItem('token', token);
    }
    localStorage.setItem('user', finalUser ? JSON.stringify(finalUser) : '');
    setUser(finalUser);
  };

  const login = async (email, password) => {
    try {
      const response = await api.post('/auth/login', { email, password }, { skipLoader: true });
      const { token, user, redirectToVerify, trialExpired, subscriptionExpired } = response.data;

      if (redirectToVerify) {
        return { success: false, redirectToVerify: true, email: email, message: response.data.message };
      }

      // Keep populated fields if they exist
      const cleanedUser = {
        ...user,
        schoolId: user.schoolId || [],
        tutorialId: user.tutorialId || null,
      };

      setAuthData(token, cleanedUser, trialExpired, subscriptionExpired);

      return { success: true, trialExpired: trialExpired || false, subscriptionExpired: subscriptionExpired || false };
    } catch (error) {
      const errorMessage = error.response?.data?.message || 'Login failed';
      const redirectToVerify = error.response?.data?.redirectToVerify || false;
      const unverifiedEmail = error.response?.data?.email || null;
      const trialExpired = error.response?.data?.trialExpired || false;
      const subscriptionExpired = error.response?.data?.subscriptionExpired || false;

      if (redirectToVerify && unverifiedEmail) {
        return { success: false, redirectToVerify: true, email: unverifiedEmail, message: errorMessage, trialExpired, subscriptionExpired };
      }

      return { success: false, message: errorMessage };
    }
  };

  const logout = () => {
    setAuthData(null, null);
  };

  // Refresh user data from backend (for subscription changes, etc)
  const refreshUser = async () => {
    try {
      const response = await api.get('/auth/me');
      const { user: fetchedUser, trialExpired, subscriptionExpired } = response.data;
      const cleanedUser = {
        ...fetchedUser,
        schoolId: fetchedUser.schoolId || [],
        tutorialId: fetchedUser.tutorialId || null,
      };
      setAuthData(null, cleanedUser, trialExpired, subscriptionExpired);
      return true;
    } catch (error) {
      console.error('Failed to refresh user:', error);
      return false;
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, setAuthData, logout, refreshUser }}>
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