import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, Link, useLocation } from 'react-router-dom';
import { GraduationCap, School, User } from 'lucide-react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import ThemeToggle from './components/ThemeToggle';
import ErrorBoundary from './components/ErrorBoundary';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Classrooms from './pages/Classrooms';
import ClassroomDetail from './pages/ClassroomDetail';
import Whiteboard from './components/Whiteboard';
import SchoolDetails from './pages/SchoolDetail';
import Assignments from './pages/Assignments';
import Payments from './pages/Payments';
import PaystackCallback from './pages/PaystackCallback';
import Users from './pages/Users';
import SchoolsPage from './pages/Schools';
import RegisterStudent from './pages/RegisterStudent';
import RegisterSchoolAdmin from './pages/RegisterSchoolAdmin';
import RegisterPersonalTeacher from './pages/RegisterPersonalTeacher';
import VerifyEmail from './pages/VerifyEmail';
import SubscriptionManagement from './pages/SubscriptionManagement'; // Import new SubscriptionManagement component
import Disbursements from './pages/Disbursements'; // Import new Disbursements component
import PlatformSettings from './pages/PlatformSettings';
import Feedbacks from './pages/Feedbacks';
import ForgotPassword from './pages/ForgotPassword';
import SetPassword from './pages/SetPassword';
import Reports from './pages/Reports';
import Exams from './pages/Exams';
import ExamCreator from './pages/ExamCreator';
import ExamCenter from './pages/ExamCenter';
import ExamSubmissions from './pages/ExamSubmissions';
import ExamSubmissionDetail from './pages/ExamSubmissionDetail';
import Profile from './pages/Profile';
import Landing from './pages/Landing';
import QnACenter from './pages/QnACenter';
import QnAPresentation from './pages/QnAPresentation';
import TopicManagement from './pages/TopicManagement';
import PublicClassroom from './pages/PublicClassroom';
import PublicSchool from './pages/PublicSchool';
import AdminSubscriptionPlans from './pages/AdminSubscriptionPlans'; // Import new AdminSubscriptionPlans component
import { Toaster } from 'react-hot-toast';


const PrivateRoute = ({ children }) => {
  const { user, loading, platformSettings } = useAuth();

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-4">
        <div className="w-12 h-12 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
        <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground opacity-50">Loading...</p>
      </div>
    </div>;
  }

  if (!user) {
    return <Navigate to="/login" />;
  }

  // If user is logged in but not verified, redirect to verify email page (except for root_admin)
  if (!user.isVerified && user.role !== 'root_admin') {
    // Pass the user's email to the verify-email page for convenience
    return <Navigate to="/verify-email" state={{ email: user.email }} />;
  }

  const isCheckingEnabled = platformSettings ? platformSettings.subscriptionCheckingEnabled : true;

  // If user is School Admin or Personal Teacher and trial is expired, redirect to subscription management
  if (isCheckingEnabled && (user.role === 'school_admin' || user.role === 'personal_teacher') && user.trialExpired) {
    return <Navigate to="/subscription-management" state={{ email: user.email }} />;
  }

  return children;
};

const RegisterChoice = () => {
  const { user } = useAuth();
  const location = useLocation();
  
  const getRedirectPath = () => {
    const params = new URLSearchParams(location.search);
    return params.get('redirect') || '/dashboard';
  };

  if (user) return <Navigate to={getRedirectPath()} replace />;

  const search = location.search;

  return (
    <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-4 transition-colors duration-300">
      {/* Ambient blobs */}
      <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-primary/5 rounded-full blur-[150px] pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-[400px] h-[400px] bg-blue-400/5 rounded-full blur-[120px] pointer-events-none" />

      {/* Theme toggle */}
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>

      <div className="w-full max-w-lg bg-card border border-border backdrop-blur-sm rounded-2xl shadow-2xl p-8 relative z-10">
        <div className="text-center mb-10">
          <h2 className="text-3xl font-extrabold text-foreground mb-2">Join Our Platform</h2>
          <p className="text-muted-foreground">Choose your role to get started</p>
        </div>

        <div className="space-y-4">
          <Link to={`/register/student${search}`} className="group relative flex items-center justify-between p-4 border-2 border-transparent bg-indigo-500/10 rounded-xl hover:bg-background hover:border-indigo-500 hover:shadow-lg transition-all duration-300">
            <div className="flex items-center space-x-4">
              <div className="bg-indigo-500/20 p-3 rounded-lg group-hover:bg-indigo-600 transition-colors duration-300">
                <GraduationCap className="w-6 h-6 text-indigo-500 group-hover:text-white transition-colors duration-300" />
              </div>
              <div>
                <h3 className="font-bold text-foreground">Student</h3>
                <p className="text-sm text-muted-foreground">Access courses and assignments</p>
              </div>
            </div>
            <div className="text-indigo-500 opacity-0 group-hover:opacity-100 transform translate-x-[-10px] group-hover:translate-x-0 transition-all duration-300">→</div>
          </Link>

          <Link to={`/register/school-admin${search}`} className="group relative flex items-center justify-between p-4 border-2 border-transparent bg-emerald-500/10 rounded-xl hover:bg-background hover:border-emerald-500 hover:shadow-lg transition-all duration-300">
            <div className="flex items-center space-x-4">
              <div className="bg-emerald-500/20 p-3 rounded-lg group-hover:bg-emerald-600 transition-colors duration-300">
                <School className="w-6 h-6 text-emerald-500 group-hover:text-white transition-colors duration-300" />
              </div>
              <div>
                <h3 className="font-bold text-foreground">School Admin</h3>
                <p className="text-sm text-muted-foreground">Manage school and classes</p>
              </div>
            </div>
            <div className="text-emerald-500 opacity-0 group-hover:opacity-100 transform translate-x-[-10px] group-hover:translate-x-0 transition-all duration-300">→</div>
          </Link>

          <Link to={`/register/personal-teacher${search}`} className="group relative flex items-center justify-between p-4 border-2 border-transparent bg-violet-500/10 rounded-xl hover:bg-background hover:border-violet-500 hover:shadow-lg transition-all duration-300">
            <div className="flex items-center space-x-4">
              <div className="bg-violet-500/20 p-3 rounded-lg group-hover:bg-violet-600 transition-colors duration-300">
                <User className="w-6 h-6 text-violet-500 group-hover:text-white transition-colors duration-300" />
              </div>
              <div>
                <h3 className="font-bold text-foreground">Personal Teacher</h3>
                <p className="text-sm text-muted-foreground">Create independent courses</p>
              </div>
            </div>
            <div className="text-violet-500 opacity-0 group-hover:opacity-100 transform translate-x-[-10px] group-hover:translate-x-0 transition-all duration-300">→</div>
          </Link>
        </div>

        <div className="mt-8 text-center pt-6 border-t border-border">
          <p className="text-muted-foreground">
            Already have an account?{' '}
            <Link to={`/login${location.search}`} className="font-bold text-primary hover:text-primary/80 transition-colors">
              Sign In
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

const AppRoutes = () => {
  const { user } = useAuth();
  const location = useLocation();

  // Helper to determine where to redirect after login/signup
  const getRedirectPath = () => {
    const params = new URLSearchParams(location.search);
    return params.get('redirect') || '/dashboard';
  };

  return (
    <Routes>
      <Route path="/login" element={!user ? <Login /> : <Navigate to={getRedirectPath()} replace />} />
      <Route path="/register" element={<RegisterChoice />} />
      <Route path="/c/:shortCode" element={<PublicClassroom />} />
      <Route path="/s/:identifier" element={<PublicSchool />} />
      <Route path="/register/student" element={<RegisterStudent />} />
      <Route path="/register/school-admin" element={<RegisterSchoolAdmin />} />
      <Route path="/register/personal-teacher" element={<RegisterPersonalTeacher />} />
      <Route path="/verify-email" element={<VerifyEmail />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/subscription-management" element={<SubscriptionManagement />} /> {/* New subscription management route */}

      <Route
        path="/dashboard"
        element={
          <PrivateRoute>
            <Dashboard />
          </PrivateRoute>
        }
      />


      <Route
        path="/schools"
        element={
          <PrivateRoute>
            <SchoolsPage />
          </PrivateRoute>
        }
      />


      <Route
        path="/schools/:id"
        element={
          <PrivateRoute>
            <SchoolDetails />
          </PrivateRoute>
        }
      />



      <Route
        path="/classrooms"
        element={
          <PrivateRoute>
            <Classrooms />
          </PrivateRoute>
        }
      />
      <Route
        path="/classrooms/:id"
        element={
          <PrivateRoute>
            <ClassroomDetail />
          </PrivateRoute>
        }
      />
      <Route
        path="/classrooms/:classId/whiteboard"
        element={
          <PrivateRoute>
            <Whiteboard />
          </PrivateRoute>
        }
      />
      <Route
        path="/assignments"
        element={
          <PrivateRoute>
            <Assignments />
          </PrivateRoute>
        }
      />
      <Route
        path="/payments"
        element={
          <PrivateRoute>
            <Payments />
          </PrivateRoute>
        }
      />
      <Route
        path="/payments/verify"
        element={
          <PrivateRoute>
            <PaystackCallback />
          </PrivateRoute>
        }
      />
      <Route
        path="/users"
        element={
          <PrivateRoute>
            <Users />
          </PrivateRoute>
        }
      />
      <Route
        path="/disbursements"
        element={
          <PrivateRoute>
            <Disbursements />
          </PrivateRoute>
        }
      />
      <Route
        path="/platform-settings"
        element={
          <PrivateRoute>
            <PlatformSettings />
          </PrivateRoute>
        }
      />
      <Route
        path="/subscription-plans-admin"
        element={
          <PrivateRoute>
            <AdminSubscriptionPlans />
          </PrivateRoute>
        }
      />
      <Route
        path="/feedbacks"
        element={
          <PrivateRoute>
            <Feedbacks />
          </PrivateRoute>
        }
      />
      <Route
        path="/profile"
        element={
          <PrivateRoute>
            <Profile />
          </PrivateRoute>
        }
      />
      <Route
        path="/reports"
        element={
          <PrivateRoute>
            <Reports />
          </PrivateRoute>
        }
      />
      <Route
        path="/exams"
        element={
          <PrivateRoute>
            <Exams />
          </PrivateRoute>
        }
      />
      <Route
        path="/exams/create"
        element={
          <PrivateRoute>
            <ExamCreator />
          </PrivateRoute>
        }
      />
      <Route
        path="/exams/edit/:id"
        element={
          <PrivateRoute>
            <ExamCreator />
          </PrivateRoute>
        }
      />
      <Route
        path="/exams/:id/submissions"
        element={
          <PrivateRoute>
            <ExamSubmissions />
          </PrivateRoute>
        }
      />
      <Route
        path="/exams/submissions/detail/:id"
        element={
          <PrivateRoute>
            <ExamSubmissionDetail />
          </PrivateRoute>
        }
      />
      <Route path="/exam-center/:token" element={<ExamCenter />} />
      <Route path="/qna/:token" element={<QnACenter />} />
      <Route path="/qna/:token/present" element={<PrivateRoute><QnAPresentation /></PrivateRoute>} />
      <Route path="/set-password" element={<SetPassword />} />
      <Route path="/" element={user ? <Navigate to="/dashboard" /> : <Landing />} />
      <Route
        path="/classrooms/:id/manage-topics"
        element={
          <PrivateRoute>
            <TopicManagement />
          </PrivateRoute>
        }
      />
    </Routes>
  );
};

function App() {


  return (
    <ErrorBoundary>
      <ThemeProvider>
        <AuthProvider>
          <Router>
            <AppRoutes />
          </Router>
        </AuthProvider>
        <Toaster position="top-right" reverseOrder={false} />
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;

