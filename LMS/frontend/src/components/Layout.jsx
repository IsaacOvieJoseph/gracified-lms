import React, { useEffect, useState, useRef } from 'react'; // Added useRef
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Book, LogOut, Users, DollarSign, FileText, LayoutDashboard, Landmark, Bell } from 'lucide-react'; // Added Bell icon
import { useAuth } from '../context/AuthContext';
import api from '../utils/api'; // Ensure api is imported
import SubscriptionBlockBanner from './SubscriptionBlockBanner';
import SchoolSwitcher from './SchoolSwitcher';

const Layout = ({ children }) => {
  const { user, logout, refreshUser } = useAuth();
  // School switcher state for school admins
  const [selectedSchools, setSelectedSchools] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('selectedSchools')) || [];
    } catch {
      return [];
    }
  });
  const location = useLocation();
  const navigate = useNavigate();
    // Real-time: Refresh user subscription status on every route change
    useEffect(() => {
      if (user && refreshUser) {
        refreshUser();
      }
      // eslint-disable-next-line
    }, [location.pathname]);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showNotifications, setShowNotifications] = useState(false);
  const notificationsRef = useRef(null); // Ref for closing dropdown on outside click

  useEffect(() => {
    if (user) {
      fetchNotifications();
    }
    const interval = setInterval(() => {
      if (user) {
        fetchNotifications();
      }
    }, 30000); // Fetch notifications every 30 seconds

    return () => clearInterval(interval);
  }, [user]);

  // Close notifications dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (notificationsRef.current && !notificationsRef.current.contains(event.target)) {
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
      fetchNotifications();
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await api.put('/notifications/inapp/mark-all-read');
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
    ...(user?.role === 'student' ? [{ path: '/payments', icon: DollarSign, label: 'Payments' }] : []),
    ...(user?.role === 'student' ? [{ path: '/assignments', icon: FileText, label: 'Assignments' }] : []),
    ...(['root_admin', 'school_admin', 'teacher', 'personal_teacher'].includes(user?.role) ? [{ path: '/users', icon: Users, label: 'Users' }] : []),
    ...(['root_admin', 'school_admin'].includes(user?.role) ? [{ path: '/schools', icon: Landmark, label: 'Schools' }] : []),
  ];

  // Block all activity except dashboard if subscription is expired or never active
  // Allow if user is on a valid free trial (trial not expired and never used before)
  const isDashboard = location.pathname === '/dashboard';
  let shouldBlock = false;
  if (user) {
    // Block if subscription is not active and not on a valid trial
    const isTrial = user.subscriptionStatus === 'trial';
    const trialValid = isTrial && user.trialEndDate && new Date(user.trialEndDate) > new Date() && !user.trialExpired;
    shouldBlock = user.subscriptionStatus !== 'active' && !trialValid;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {shouldBlock && !isDashboard && (
        <SubscriptionBlockBanner onViewPlans={() => navigate('/subscription-management')} />
      )}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Book className="w-8 h-8 text-blue-600" />
            <div>
              <h1 className="text-xl font-bold text-gray-800">LMS Platform</h1>
              <p className="text-xs text-gray-500">
                {user?.role?.replace('_', ' ').toUpperCase()}
              </p>
            </div>
          </div>
          
          <div className="flex items-center space-x-4">
            {/* School Switcher for school admins */}
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
                  <div className="absolute right-0 mt-2 w-80 bg-white border border-gray-200 rounded-lg shadow-lg z-50">
                    <div className="p-4 border-b border-gray-200 flex justify-between items-center">
                      <h4 className="font-semibold text-gray-800">Notifications</h4>
                      {unreadCount > 0 && (
                        <button
                          onClick={handleMarkAllAsRead}
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
                                onClick={() => handleMarkAsRead(notification._id)}
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
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-8">
        <nav className="flex space-x-2 mb-6 bg-white p-2 rounded-lg shadow-sm">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition ${
                  isActive(item.path)
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
};

export default Layout;

