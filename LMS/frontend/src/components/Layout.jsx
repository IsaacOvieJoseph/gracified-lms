import React, { useEffect, useState, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { Book, LogOut, Users, DollarSign, FileText, LayoutDashboard, Landmark, Bell, Menu, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';
import SubscriptionBlockBanner from './SubscriptionBlockBanner';
import SchoolSwitcher from './SchoolSwitcher';
import FeedbackManager from './FeedbackManager';
import logo from '../assets/logo.jpg';

const Layout = ({ children }) => {
  const { user, logout, refreshUser } = useAuth();
  const [selectedSchools, setSelectedSchools] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('selectedSchools')) || [];
    } catch {
      return [];
    }
  });
  const location = useLocation();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showNotifications, setShowNotifications] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const notificationsRef = useRef(null);
  const mobileNotificationsRef = useRef(null);

  const [isLoading, setIsLoading] = useState(false);
  const loadingCountRef = useRef(0);
  const timeoutRef = useRef(null);

  useEffect(() => {
    const startLoading = () => {
      loadingCountRef.current++;
      setIsLoading(true);
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };

    const stopLoading = () => {
      loadingCountRef.current = Math.max(0, loadingCountRef.current - 1);
      if (loadingCountRef.current === 0) {
        timeoutRef.current = setTimeout(() => {
          setIsLoading(false);
        }, 150);
      }
    };

    window.addEventListener('loading-start', startLoading);
    window.addEventListener('loading-end', stopLoading);

    return () => {
      window.removeEventListener('loading-start', startLoading);
      window.removeEventListener('loading-end', stopLoading);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  useEffect(() => {
    if (user && refreshUser) {
      refreshUser();
    }
  }, [location.pathname]);

  useEffect(() => {
    if (user) {
      fetchNotifications();
    }
    const interval = setInterval(() => {
      if (user) {
        fetchNotifications();
      }
    }, 30000);
    return () => clearInterval(interval);
  }, [user]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      const isDesktopClick = notificationsRef.current && notificationsRef.current.contains(event.target);
      const isMobileClick = mobileNotificationsRef.current && mobileNotificationsRef.current.contains(event.target);

      if (!isDesktopClick && !isMobileClick) {
        setShowNotifications(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const fetchNotifications = async () => {
    try {
      const response = await api.get('/notifications/inapp');
      setNotifications(response.data.notifications);
      setUnreadCount(response.data.notifications.filter(n => !n.read).length);
    } catch (error) {
      console.error('Error fetching in-app notifications:', error);
    }
  };

  const handleMarkAsRead = async (notificationId) => {
    try {
      await api.put(`/notifications/inapp/${notificationId}/read`);
      toast.success('Notification marked as read');
      fetchNotifications();
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await api.put('/notifications/inapp/mark-all-read');
      toast.success('All notifications marked as read');
      fetchNotifications();
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const isActive = (path) => location.pathname === path;

  const navItems = [
    { path: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { path: '/classrooms', icon: Book, label: 'Classrooms' },
    ...(['student', 'root_admin', 'school_admin', 'teacher', 'personal_teacher'].includes(user?.role) ? [{ path: '/payments', icon: DollarSign, label: 'Payments' }] : []),
    ...(user?.role === 'student' ? [{ path: '/assignments', icon: FileText, label: 'Assignments' }] : []),
    ...(['root_admin', 'school_admin', 'teacher', 'personal_teacher'].includes(user?.role) ? [{ path: '/users', icon: Users, label: 'Users' }] : []),
    ...(['root_admin', 'school_admin'].includes(user?.role) ? [{ path: '/schools', icon: Landmark, label: 'Schools' }] : []),
    ...(user?.role === 'root_admin' ? [{ path: '/disbursements', icon: Landmark, label: 'Disbursements' }] : []),
    ...(user?.role === 'root_admin' ? [{ path: '/platform-settings', icon: Landmark, label: 'Platform Settings' }] : []),
  ];

  const isDashboard = location.pathname === '/dashboard';
  let shouldBlock = false;

  if (user && (user.role === 'school_admin' || user.role === 'personal_teacher')) {
    if (user.subscriptionStatus === 'pay_as_you_go') {
      shouldBlock = false;
    } else {
      const isTrial = user.subscriptionStatus === 'trial';
      const isExpired = user.subscriptionStatus === 'expired' || user.trialExpired || user.subscriptionExpired;

      // If it's a trial, it must be within trialEndDate and not trialExpired
      const trialValid = isTrial && user.trialEndDate && new Date(user.trialEndDate) > new Date() && !user.trialExpired;

      // If it's active, it must not be subscriptionExpired
      const activeValid = user.subscriptionStatus === 'active' && !user.subscriptionExpired;

      shouldBlock = !trialValid && !activeValid;
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 overflow-x-hidden">
      <FeedbackManager />
      {shouldBlock && !isDashboard && (
        <SubscriptionBlockBanner
          onViewPlans={() => navigate('/subscription-management')}
          user={user}
        />
      )}
      <header className="bg-white shadow-sm border-b sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <img
                src={logo}
                alt="Gracified LMS"
                className={`w-10 h-10 object-contain rounded-full transition-transform ${isLoading ? 'animate-spin' : ''}`}
              />
              <div>
                <h1 className="text-xl font-bold text-gray-800">Gracified LMS</h1>
                <p className="text-xs text-gray-500">
                  {user?.role?.replace('_', ' ').toUpperCase()}
                </p>
              </div>
            </div>

            {/* Desktop Actions */}
            <div className="hidden md:flex items-center space-x-4">
              <SchoolSwitcher user={user} selectedSchools={selectedSchools} setSelectedSchools={setSelectedSchools} />
              {user && (
                <div className="relative" ref={notificationsRef}>
                  <button
                    onClick={() => setShowNotifications(!showNotifications)}
                    className="relative p-2 rounded-full bg-gray-100 text-gray-600 hover:bg-gray-200 transition"
                  >
                    <Bell className="w-5 h-5" />
                    {unreadCount > 0 && (
                      <span className="absolute top-0 right-0 inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-red-100 bg-red-600 rounded-full transform translate-x-1/2 -translate-y-1/2">
                        {unreadCount}
                      </span>
                    )}
                  </button>

                  {showNotifications && (
                    <div
                      onClick={(e) => e.stopPropagation()}
                      className="absolute right-0 mt-2 w-80 bg-white border border-gray-200 rounded-lg shadow-lg z-50"
                    >
                      <div className="p-4 border-b border-gray-200 flex justify-between items-center">
                        <h4 className="font-semibold text-gray-800">Notifications</h4>
                        {unreadCount > 0 && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleMarkAllAsRead();
                            }}
                            className="text-blue-600 hover:underline text-sm"
                          >
                            Mark all as read
                          </button>
                        )}
                      </div>
                      <div className="max-h-80 overflow-y-auto">
                        {notifications.length > 0 ? (
                          notifications.map(notification => (
                            <div
                              key={notification._id}
                              className={`p-3 border-b border-gray-100 last:border-b-0 ${notification.read ? 'bg-white' : 'bg-blue-50'}`}
                            >
                              <p className="text-sm font-medium text-gray-800">{notification.message}</p>
                              <p className="text-xs text-gray-500 mt-1">
                                {new Date(notification.createdAt).toLocaleString()}
                              </p>
                              {!notification.read && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleMarkAsRead(notification._id);
                                  }}
                                  className="mt-2 text-xs text-blue-600 hover:underline"
                                >
                                  Mark as Read
                                </button>
                              )}
                            </div>
                          ))
                        ) : (
                          <p className="p-3 text-center text-gray-500 text-sm">No new notifications.</p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
              <span className="text-sm text-gray-600">{user?.name}</span>
              <button
                onClick={handleLogout}
                className="flex items-center space-x-2 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition"
              >
                <LogOut className="w-4 h-4" />
                <span>Logout</span>
              </button>
            </div>

            {/* Mobile Actions */}
            <div className="md:hidden flex items-center space-x-4">
              {/* Notifications also visible on mobile */}
              {user && (
                <div className="relative" ref={mobileNotificationsRef}>
                  <button
                    onClick={() => setShowNotifications(!showNotifications)}
                    className="relative p-2 rounded-full bg-gray-100 text-gray-600 hover:bg-gray-200 transition"
                  >
                    <Bell className="w-5 h-5" />
                    {unreadCount > 0 && (
                      <span className="absolute top-0 right-0 inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-red-100 bg-red-600 rounded-full transform translate-x-1/2 -translate-y-1/2">
                        {unreadCount}
                      </span>
                    )}
                  </button>
                  {/* Mobile Notification Dropdown (same as desktop slightly adjusted) */}
                  {showNotifications && (
                    <div
                      onClick={(e) => e.stopPropagation()}
                      className="absolute right-0 mt-2 w-72 bg-white border border-gray-200 rounded-lg shadow-lg z-50"
                    >
                      <div className="p-4 border-b border-gray-200 flex justify-between items-center">
                        <h4 className="font-semibold text-gray-800">Notifications</h4>
                        {unreadCount > 0 && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleMarkAllAsRead();
                            }}
                            className="text-blue-600 text-xs"
                          >
                            Mark all read
                          </button>
                        )}
                      </div>
                      <div className="max-h-60 overflow-y-auto">
                        {notifications.length > 0 ? (
                          notifications.map(n => (
                            <div key={n._id} className={`p-3 border-b text-sm ${n.read ? 'bg-white' : 'bg-blue-50'}`}>
                              <p>{n.message}</p>
                              {!n.read && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleMarkAsRead(n._id);
                                  }}
                                  className="text-blue-600 text-xs mt-1"
                                >
                                  Mark Read
                                </button>
                              )}
                            </div>
                          ))
                        ) : (
                          <p className="p-2 text-center text-xs text-gray-500">No new notifications</p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              <button
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="p-2 rounded-lg hover:bg-gray-100 transition"
              >
                {isMobileMenuOpen ? <X className="w-6 h-6 text-gray-600" /> : <Menu className="w-6 h-6 text-gray-600" />}
              </button>
            </div>
          </div>

          {/* Mobile Menu Dropdown */}
          {isMobileMenuOpen && (
            <div className="md:hidden mt-4 py-4 border-t border-gray-100 space-y-4">
              {/* Mobile School Switcher */}
              <div className="px-2">
                <SchoolSwitcher user={user} selectedSchools={selectedSchools} setSelectedSchools={setSelectedSchools} />
              </div>

              {/* Mobile Navigation Links */}
              <nav className="flex flex-col space-y-2">
                {navItems.map((item) => {
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      onClick={() => setIsMobileMenuOpen(false)}
                      className={`flex items-center space-x-2 px-4 py-3 rounded-lg transition ${isActive(item.path)
                        ? 'bg-blue-600 text-white'
                        : 'text-gray-600 hover:bg-gray-100'
                        }`}
                    >
                      <Icon className="w-5 h-5" />
                      <span>{item.label}</span>
                    </Link>
                  );
                })}
              </nav>

              {/* Mobile User Info & Logout */}
              <div className="pt-4 border-t border-gray-100 px-2 flex justify-between items-center">
                <div className="text-sm font-medium text-gray-700">{user?.name}</div>
                <button
                  onClick={handleLogout}
                  className="flex items-center space-x-2 px-4 py-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 transition"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Logout</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Desktop Navigation */}
        <nav className="hidden md:flex space-x-2 mb-6 bg-white p-2 rounded-lg shadow-sm">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition ${isActive(item.path)
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-600 hover:bg-gray-100'
                  }`}
              >
                <Icon className="w-4 h-4" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {children}
      </div>
    </div>
  );
}; // End Component

export default Layout;

