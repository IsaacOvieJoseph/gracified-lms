import React, { useEffect, useState, useRef } from 'react';
import { Link, useLocation, useNavigate, NavLink } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import {
  Book, LogOut, Users, User, DollarSign, FileText,
  LayoutDashboard, Landmark, Bell, Menu, X,
  MessageSquare, BarChart2, Settings, ShieldCheck,
  ChevronRight, Search, CreditCard, PieChart
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';
import SubscriptionBlockBanner from './SubscriptionBlockBanner';
import SchoolSwitcher from './SchoolSwitcher';
import FeedbackManager from './FeedbackManager';
import logo from '../assets/logo.jpg';

const Layout = ({ children }) => {
  const { user, logout, refreshUser } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfileDropdown, setShowProfileDropdown] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  const [selectedSchools, setSelectedSchools] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('selectedSchools')) || [];
    } catch {
      return [];
    }
  });

  const notificationsRef = useRef(null);
  const profileRef = useRef(null);

  const schoolLogo = user?.schoolId?.[0]?.logoUrl || user?.tutorialId?.logoUrl || user?.schoolId?.logoUrl || null;
  const displayLogo = schoolLogo || logo;

  useEffect(() => {
    if (user && refreshUser) {
      refreshUser();
    }
  }, [location.pathname]);

  useEffect(() => {
    // Listen for school selection changes from SchoolSwitcher elsewhere if needed
    const handler = () => {
      try {
        setSelectedSchools(JSON.parse(localStorage.getItem('selectedSchools')) || []);
      } catch { }
    };
    window.addEventListener('schoolSelectionChanged', handler);
    return () => window.removeEventListener('schoolSelectionChanged', handler);
  }, []);

  useEffect(() => {
    if (user) {
      fetchNotifications();
      const interval = setInterval(fetchNotifications, 60000);
      return () => clearInterval(interval);
    }
  }, [user]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (notificationsRef.current && !notificationsRef.current.contains(event.target)) {
        setShowNotifications(false);
      }
      if (profileRef.current && !profileRef.current.contains(event.target)) {
        setShowProfileDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchNotifications = async () => {
    try {
      const response = await api.get('/notifications/inapp');
      setNotifications(response.data.notifications);
      setUnreadCount(response.data.notifications.filter(n => !n.read).length);
    } catch (error) {
      console.error('Error fetching notifications:', error);
    }
  };

  const handleMarkAsRead = async (notificationId) => {
    try {
      await api.put(`/notifications/inapp/${notificationId}/read`);
      fetchNotifications();
    } catch (error) { }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const navItems = [
    { path: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { path: '/classrooms', icon: Book, label: 'Classrooms' },
    ...(['student', 'root_admin', 'school_admin', 'teacher', 'personal_teacher'].includes(user?.role) ? [{ path: '/payments', icon: CreditCard, label: 'Payments' }] : []),
    { path: '/exams', icon: PieChart, label: 'Exams' },
    ...(user?.role === 'student' ? [{ path: '/assignments', icon: FileText, label: 'Assignments' }] : []),
    ...(['root_admin', 'school_admin', 'teacher', 'personal_teacher'].includes(user?.role) ? [{ path: '/users', icon: Users, label: 'Users' }] : []),
    { path: '/reports', icon: BarChart2, label: 'Reports' },
    ...(['root_admin', 'school_admin'].includes(user?.role) ? [{ path: '/schools', icon: Landmark, label: 'Schools' }] : []),
    ...(user?.role === 'root_admin' ? [
      { path: '/disbursements', icon: Landmark, label: 'Disbursements' },
      { path: '/feedbacks', icon: MessageSquare, label: 'Feedbacks' },
      { path: '/platform-settings', icon: Settings, label: 'Platform Settings' }
    ] : []),
  ];

  const isDashboard = location.pathname === '/dashboard';
  let shouldBlock = false;
  if (user && (user.role === 'school_admin' || user.role === 'personal_teacher')) {
    if (user.subscriptionStatus !== 'pay_as_you_go') {
      const trialValid = user.subscriptionStatus === 'trial' && user.trialEndDate && new Date(user.trialEndDate) > new Date() && !user.trialExpired;
      const activeValid = user.subscriptionStatus === 'active' && !user.subscriptionExpired;
      shouldBlock = !trialValid && !activeValid;
    }
  }

  return (
    <div className="flex h-screen bg-[#F8FAFC] overflow-hidden font-inter">
      <FeedbackManager />

      {/* Sidebar - Desktop */}
      <aside className={`hidden md:flex flex-col border-r border-slate-200 bg-white transition-all duration-300 ease-in-out ${isSidebarCollapsed ? 'w-20' : 'w-64'}`}>
        <div className="p-6 flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-primary/10 text-primary">
            <img src={logo} alt="Logo" className="w-8 h-8 rounded-lg" />
          </div>
          {!isSidebarCollapsed && (
            <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-slate-900 to-slate-600">
              Gracified
            </h1>
          )}
        </div>

        <nav className="flex-1 px-3 space-y-1 overflow-y-auto">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) => `
                nav-link ${isActive ? 'active shadow-sm' : ''}
                ${isSidebarCollapsed ? 'justify-center px-0' : ''}
              `}
              title={isSidebarCollapsed ? item.label : ''}
            >
              <item.icon className={`w-5 h-5 ${isSidebarCollapsed ? 'w-6 h-6' : ''}`} />
              {!isSidebarCollapsed && <span>{item.label}</span>}
            </NavLink>
          ))}
        </nav>

        <div className="p-4 border-t border-slate-100">
          <div className={`flex items-center gap-3 ${isSidebarCollapsed ? 'justify-center' : 'p-2 rounded-xl bg-slate-50'}`}>
            <div className="w-10 h-10 rounded-xl bg-white border border-slate-200 shadow-sm flex items-center justify-center overflow-hidden shrink-0">
              {user?.profilePicture ? (
                <img src={user.profilePicture} alt="Profile" className="w-full h-full object-cover" />
              ) : (
                <span className="font-bold text-primary">{user?.name?.charAt(0)}</span>
              )}
            </div>
            {!isSidebarCollapsed && (
              <div className="min-w-0">
                <p className="text-sm font-bold text-slate-900 truncate">{user?.name}</p>
                <p className="text-[10px] uppercase tracking-wider font-bold text-slate-400">{user?.role?.replace('_', ' ')}</p>
              </div>
            )}
          </div>
          <button
            onClick={handleLogout}
            className={`mt-4 w-full flex items-center gap-3 px-4 py-2.5 text-sm font-semibold text-red-500 hover:bg-red-50 rounded-xl transition-colors ${isSidebarCollapsed ? 'justify-center px-0' : ''}`}
          >
            <LogOut className="w-5 h-5" />
            {!isSidebarCollapsed && <span>Sign Out</span>}
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        {/* Navbar */}
        <header className="h-16 border-b border-slate-200 bg-white/80 backdrop-blur-md sticky top-0 z-30 flex items-center justify-between px-6">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setIsMobileMenuOpen(true)}
              className="md:hidden p-2 rounded-lg hover:bg-slate-100 transition"
            >
              <Menu className="w-6 h-6 text-slate-600" />
            </button>
            <div className="hidden md:flex items-center gap-2 text-slate-400">
              <LandingBreadcrumbs path={location.pathname} />
            </div>
          </div>

          <div className="flex items-center gap-4">
            <SchoolSwitcher user={user} selectedSchools={selectedSchools} setSelectedSchools={setSelectedSchools} />

            <div className="relative" ref={notificationsRef}>
              <button
                onClick={() => setShowNotifications(!showNotifications)}
                className="p-2 rounded-xl border border-slate-200 hover:bg-slate-50 transition relative"
              >
                <Bell className="w-5 h-5 text-slate-600" />
                {unreadCount > 0 && (
                  <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border-2 border-white"></span>
                )}
              </button>

              {showNotifications && (
                <div className="absolute right-0 mt-3 w-80 bg-white border border-slate-200 rounded-2xl shadow-2xl z-50 overflow-hidden animate-slide-up">
                  <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                    <h4 className="font-bold text-slate-900">Activity</h4>
                    <span className="text-[10px] px-2 py-0.5 bg-primary/10 text-primary rounded-full font-bold">{unreadCount} New</span>
                  </div>
                  <div className="max-h-96 overflow-y-auto">
                    {notifications.length > 0 ? (
                      notifications.map(n => (
                        <div key={n._id} className={`p-4 border-b border-slate-50 last:border-0 hover:bg-slate-50/50 transition cursor-pointer ${!n.read ? 'bg-primary/[0.02]' : ''}`}>
                          <p className="text-sm font-medium text-slate-800">{n.message}</p>
                          <div className="flex items-center justify-between mt-2">
                            <span className="text-[10px] text-slate-400 font-medium">{new Date(n.createdAt).toLocaleDateString()}</span>
                            {!n.read && (
                              <button onClick={() => handleMarkAsRead(n._id)} className="text-[10px] font-bold text-primary hover:underline">Mark as read</button>
                            )}
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="p-8 text-center text-slate-400">
                        <Bell className="w-10 h-10 mx-auto mb-2 opacity-10" />
                        <p className="text-sm">No new activity</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="relative" ref={profileRef}>
              <button
                onClick={() => setShowProfileDropdown(!showProfileDropdown)}
                className="w-10 h-10 rounded-xl bg-slate-100 border border-slate-200 overflow-hidden shadow-sm hover:scale-105 transition"
              >
                {user?.profilePicture ? (
                  <img src={user.profilePicture} alt="Profile" className="w-full h-full object-cover" />
                ) : (
                  <span className="font-bold text-primary">{user?.name?.charAt(0)}</span>
                )}
              </button>

              {showProfileDropdown && (
                <div className="absolute right-0 mt-3 w-56 bg-white border border-slate-200 rounded-2xl shadow-2xl z-50 py-2 animate-slide-up">
                  <div className="px-4 py-3 border-b border-slate-50 mb-1">
                    <p className="text-sm font-bold text-slate-800 truncate">{user?.name}</p>
                    <p className="text-xs text-slate-400 truncate">{user?.email}</p>
                  </div>
                  <button onClick={() => { setShowProfileDropdown(false); navigate('/profile'); }} className="w-full flex items-center gap-3 px-4 py-2 hover:bg-slate-50 text-slate-600 text-sm font-medium transition-colors">
                    <User className="w-4 h-4" /> Account Settings
                  </button>
                  <button onClick={handleLogout} className="w-full flex items-center gap-3 px-4 py-2 hover:bg-red-50 text-red-500 text-sm font-bold transition-colors">
                    <LogOut className="w-4 h-4" /> Sign Out
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Dynamic Canvas Area */}
        <main className="flex-1 overflow-y-auto p-4 md:p-8 custom-scrollbar">
          {shouldBlock && !isDashboard && (
            <div className="mb-6">
              <SubscriptionBlockBanner onViewPlans={() => navigate('/subscription-management')} user={user} />
            </div>
          )}
          <div className="max-w-7xl mx-auto animate-slide-up">
            {children}
          </div>
        </main>
      </div>

      {/* Mobile Sidebar Overlay */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-[100] md:hidden">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setIsMobileMenuOpen(false)} />
          <div className="absolute left-0 top-0 bottom-0 w-72 bg-white flex flex-col p-6 animate-slide-in-right">
            <div className="flex items-center justify-between mb-8">
              <img src={logo} alt="Logo" className="w-10 h-10 rounded-xl" />
              <button onClick={() => setIsMobileMenuOpen(false)} className="p-2 -mr-2 text-slate-400">
                <X className="w-6 h-6" />
              </button>
            </div>
            <nav className="flex-1 space-y-1 overflow-y-auto">
              {navItems.map(item => (
                <NavLink key={item.path} to={item.path} onClick={() => setIsMobileMenuOpen(false)} className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
                  <item.icon className="w-5 h-5" /> {item.label}
                </NavLink>
              ))}
            </nav>
            <div className="mt-auto pt-6 border-t border-slate-100">
              <button onClick={handleLogout} className="w-full btn-danger shadow-red-200">
                <LogOut className="w-5 h-5" /> Sign Out
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const LandingBreadcrumbs = ({ path }) => {
  const parts = path.split('/').filter(Boolean);
  if (parts.length === 0) return <span className="text-primary cursor-default">Platform</span>;

  return (
    <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest overflow-hidden">
      <Link
        to="/dashboard"
        className="text-primary hover:text-primary/80 transition-colors"
      >
        LMS
      </Link>
      {parts.map((p, i) => {
        const linkPath = `/${parts.slice(0, i + 1).join('/')}`;
        const isLast = i === parts.length - 1;

        return (
          <React.Fragment key={i}>
            <ChevronRight className="w-3 h-3 text-slate-300 shrink-0" />
            {isLast ? (
              <span className="text-slate-800 truncate max-w-[150px]">
                {p.replace('-', ' ')}
              </span>
            ) : (
              <Link
                to={linkPath}
                className="text-slate-400 hover:text-primary transition-colors truncate max-w-[150px]"
              >
                {p.replace('-', ' ')}
              </Link>
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
};

export default Layout;
