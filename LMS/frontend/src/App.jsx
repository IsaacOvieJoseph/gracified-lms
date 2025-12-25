import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, Link } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import ErrorBoundary from './components/ErrorBoundary';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Classrooms from './pages/Classrooms';
import ClassroomDetail from './pages/ClassroomDetail';
import SchoolDetails from './pages/SchoolDetail';
import Assignments from './pages/Assignments';
import Payments from './pages/Payments';
import Users from './pages/Users';
import SchoolsPage from './pages/Schools';
import RegisterStudent from './pages/RegisterStudent';
import RegisterSchoolAdmin from './pages/RegisterSchoolAdmin';
import RegisterPersonalTeacher from './pages/RegisterPersonalTeacher';
import VerifyEmail from './pages/VerifyEmail';
import SubscriptionManagement from './pages/SubscriptionManagement'; // Import new SubscriptionManagement component
import ForgotPassword from './pages/ForgotPassword';

const PrivateRoute = ({ children }) => {
  const { user, loading } = useAuth();
  
  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }
  
  if (!user) {
    return <Navigate to="/login" />;
  }

  // If user is logged in but not verified, redirect to verify email page
  if (!user.isVerified) {
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
    <div className="flex justify-center items-center min-h-screen bg-gray-100">
      <div className="w-full max-w-md p-8 space-y-6 bg-white rounded-lg shadow-md">
        <h2 className="text-2xl font-bold text-center text-gray-900">Choose Your Role to Register</h2>
        <div className="space-y-4">
          <Link to="/register/student" className="block w-full px-4 py-2 text-white bg-indigo-600 rounded-md text-center hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500">
            Register as Student
          </Link>
          <Link to="/register/school-admin" className="block w-full px-4 py-2 text-white bg-green-600 rounded-md text-center hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500">
            Register as School Admin
          </Link>
          <Link to="/register/personal-teacher" className="block w-full px-4 py-2 text-white bg-purple-600 rounded-md text-center hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500">
            Register as Personal Teacher
          </Link>
        </div>
        <p className="text-sm text-center text-gray-600">
          Already have an account? <Link to="/login" className="font-medium text-indigo-600 hover:text-indigo-500">Login</Link>
        </p>
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
        path="/users"
        element={
          <PrivateRoute>
            <Users />
          </PrivateRoute>
        }
      />
      <Route path="/" element={<Navigate to="/dashboard" />} />
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
    </ErrorBoundary>
  );
}

export default App;

