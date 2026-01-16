import axios from 'axios';
import { toast } from 'react-hot-toast';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';



const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000, // 30 seconds timeout
});

// Add token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  // Skip loading event for non-blocking calls if needed (e.g. notifications, auth check, whiteboard polling)
  const isBackgroundCall =
    config.skipLoader || // Allow manual opt-out
    config.url.includes('/notifications') ||
    config.url.includes('/auth/me') ||
    config.url.includes('/whiteboard');

  if (!isBackgroundCall) {
    window.dispatchEvent(new CustomEvent('loading-start'));
    // Attach flag to config so interceptor knows whether to fire loading-end
    config._showLoader = true;
  }


  return config;
});

// Handle token expiration and connection errors
api.interceptors.response.use(
  (response) => {
    if (response.config?._showLoader) {
      window.dispatchEvent(new CustomEvent('loading-end'));
    }
    return response;
  },
  (error) => {
    if (error.config?._showLoader) {
      window.dispatchEvent(new CustomEvent('loading-end'));
    }
    // Log connection errors for debugging
    if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
      toast.error('The server is taking too long to respond. Please try again.');
      console.error('Request timeout - Backend may be slow or unavailable:', error.config?.url);
      console.error('API URL being used:', API_URL);
    } else if (error.code === 'ERR_NETWORK' || error.message.includes('Network Error')) {
      toast.error('Unable to connect to the server. Please check your internet connection.');
      console.error('Network error - Cannot reach backend:', error.config?.url);
      console.error('API URL being used:', API_URL);
      console.error('Check if backend is running and CORS is configured correctly');
    }

    if (error.response?.status === 401) {
      // Only redirect if not already on login page and not during token verification
      // Let AuthContext handle the logout/redirect logic to avoid conflicts
      const isAuthMeEndpoint = error.config?.url?.includes('/auth/me');
      if (!window.location.pathname.includes('/login') && !isAuthMeEndpoint) {
        // Only clear if it's not a token verification call (AuthContext will handle that)
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export const setAuthToken = (token) => {
  if (token) {
    api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  } else {
    delete api.defaults.headers.common['Authorization'];
  }
};

export default api;

