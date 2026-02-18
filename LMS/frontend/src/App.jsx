import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, Link } from 'react-router-dom';
import { GraduationCap, School, User } from 'lucide-react';
import { AuthProvider, useAuth } from './context/AuthContext';
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
import { Toaster } from 'react-hot-toast';


const PrivateRoute = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }

  if (!user) {
    return <Navigate to="/login" />;
  }

  // If user is logged in but not verified, redirect to verify email page (except for root_admin)
  if (!user.isVerified && user.role !== 'root_admin') {
    // Pass the user's email to the verify-email page for convenience
    return <Navigate to="/verify-email" state={{ email: user.email }} />;
  }

  // If user is School Admin or Personal Teacher and trial is expired, redirect to subscription management
  if ((user.role === 'school_admin' || user.role === 'personal_teacher') && user.trialExpired) {
    return <Navigate to="/subscription-management" state={{ email: user.email }} />;
  }

  return children;
};

const RegisterChoice = () => {
  const { user } = useAuth();
  if (user) return <Navigate to="/dashboard" />;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 flex items-center justify-center p-4">
      <div className="w-full max-w-lg bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl p-8 transform transition-all">
        <div className="text-center mb-10">
          <h2 className="text-3xl font-extrabold text-gray-900 mb-2">Join Our Platform</h2>
          <p className="text-gray-600">Choose your role to get started</p>
        </div>

        <div className="space-y-4">
          <Link to="/register/student" className="group relative flex items-center justify-between p-4 border-2 border-transparent bg-indigo-50 rounded-xl hover:bg-white hover:border-indigo-500 hover:shadow-lg transition-all duration-300">
            <div className="flex items-center space-x-4">
              <div className="bg-indigo-100 p-3 rounded-lg group-hover:bg-indigo-600 transition-colors duration-300">
                <GraduationCap className="w-6 h-6 text-indigo-600 group-hover:text-white transition-colors duration-300" />
              </div>
              <div>
                <h3 className="font-bold text-gray-800">Student</h3>
                <p className="text-sm text-gray-500">Access courses and assignments</p>
              </div>
            </div>
            <div className="text-indigo-600 opacity-0 group-hover:opacity-100 transform translate-x-[-10px] group-hover:translate-x-0 transition-all duration-300">→</div>
          </Link>

          <Link to="/register/school-admin" className="group relative flex items-center justify-between p-4 border-2 border-transparent bg-green-50 rounded-xl hover:bg-white hover:border-green-500 hover:shadow-lg transition-all duration-300">
            <div className="flex items-center space-x-4">
              <div className="bg-green-100 p-3 rounded-lg group-hover:bg-green-600 transition-colors duration-300">
                <School className="w-6 h-6 text-green-600 group-hover:text-white transition-colors duration-300" />
              </div>
              <div>
                <h3 className="font-bold text-gray-800">School Admin</h3>
                <p className="text-sm text-gray-500">Manage school and classes</p>
              </div>
            </div>
            <div className="text-green-600 opacity-0 group-hover:opacity-100 transform translate-x-[-10px] group-hover:translate-x-0 transition-all duration-300">→</div>
          </Link>

          <Link to="/register/personal-teacher" className="group relative flex items-center justify-between p-4 border-2 border-transparent bg-purple-50 rounded-xl hover:bg-white hover:border-purple-500 hover:shadow-lg transition-all duration-300">
            <div className="flex items-center space-x-4">
              <div className="bg-purple-100 p-3 rounded-lg group-hover:bg-purple-600 transition-colors duration-300">
                <User className="w-6 h-6 text-purple-600 group-hover:text-white transition-colors duration-300" />
              </div>
              <div>
                <h3 className="font-bold text-gray-800">Personal Teacher</h3>
                <p className="text-sm text-gray-500">Create independent courses</p>
              </div>
            </div>
            <div className="text-purple-600 opacity-0 group-hover:opacity-100 transform translate-x-[-10px] group-hover:translate-x-0 transition-all duration-300">→</div>
          </Link>
        </div>

        <div className="mt-8 text-center pt-6 border-t border-gray-100">
          <p className="text-gray-600">
            Already have an account?{' '}
            <Link to="/login" className="font-bold text-indigo-600 hover:text-indigo-500 transition-colors">
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

  return (
    <Routes>
      <Route path="/login" element={!user ? <Login /> : <Navigate to="/dashboard" />} />
      <Route path="/register" element={<RegisterChoice />} />
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
      <Route path="/set-password" element={<SetPassword />} />
      <Route path="/" element={user ? <Navigate to="/dashboard" /> : <Landing />} />
    </Routes>
  );
};

function App() {


  return (
    <ErrorBoundary>
      <AuthProvider>
        <Router>
          <AppRoutes />
        </Router>
      </AuthProvider>
      <Toaster position="top-right" reverseOrder={false} />

    </ErrorBoundary>
  );
}

export default App;

