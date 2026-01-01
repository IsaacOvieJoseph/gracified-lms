import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Book, Users, DollarSign, FileText, Calendar, ChevronDown, ChevronUp, Monitor, AlertCircle } from 'lucide-react';
import Layout from '../components/Layout';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { formatAmount } from '../utils/currency';

import CreateSchoolModal from './Schools';



const Dashboard = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState({
    classrooms: 0,
    students: 0,
    payments: 0,
    assignments: 0
  });
  const [recentClassrooms, setRecentClassrooms] = useState([]);
  const [userClassrooms, setUserClassrooms] = useState([]);
  const [showWelcome, setShowWelcome] = useState(true);
  const [isRecentExpanded, setIsRecentExpanded] = useState(true);
  const [isMyClassesExpanded, setIsMyClassesExpanded] = useState(false);
  const [schoolModalOpen, setSchoolModalOpen] = useState(false);
  const [selectedSchools, setSelectedSchools] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('selectedSchools')) || [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    fetchData();
  }, [selectedSchools, user]);

  useEffect(() => {
    // Listen for school selection changes
    const handler = () => {
      const newSelectedSchools = JSON.parse(localStorage.getItem('selectedSchools') || '[]');
      setSelectedSchools(newSelectedSchools);
    };
    window.addEventListener('schoolSelectionChanged', handler);
    return () => window.removeEventListener('schoolSelectionChanged', handler);
  }, []);

  useEffect(() => {
    if (showWelcome) {
      const timer = setTimeout(() => setShowWelcome(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [showWelcome]);

  const fetchData = async () => {
    try {
      const [classroomsRes, paymentsRes, assignmentsRes, meetingsRes] = await Promise.all([
        api.get('/classrooms'),
        user?.role === 'student' ? api.get('/payments/history') : Promise.resolve({ data: { payments: [] } }),
        api.get('/assignments'),
        api.get('/classrooms/active-meetings')
      ]);

      // Filter classrooms based on role and selection
      let availableClassrooms = classroomsRes.data.classrooms;
      if (user?.role === 'student' || user?.role === 'teacher') {
        availableClassrooms = availableClassrooms.filter(c => c.published);
      }

      if (user?.role === 'school_admin' && selectedSchools.length > 0) {
        availableClassrooms = availableClassrooms.filter(c => {
          const classroomSchoolIds = Array.isArray(c.schoolId)
            ? c.schoolId.map(sid => (sid?._id || sid)?.toString())
            : [c.schoolId?._id?.toString() || c.schoolId?.toString()];

          return selectedSchools.some(selectedId => {
            const sid = (selectedId?._id || selectedId)?.toString();
            return classroomSchoolIds.includes(sid);
          });
        });
      }

      const assignments = assignmentsRes.data.assignments || [];
      const activeMeetings = meetingsRes.data.activeSessions || [];
      const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);

      // Map activities to classrooms and identify "Recent" ones
      const classroomsWithActivity = availableClassrooms.map(c => {
        const activities = [];
        const activeMeeting = activeMeetings.find(m => m.classroomId?.toString() === c._id.toString());
        if (activeMeeting) activities.push({ type: 'meeting', label: 'Active Meeting' });

        const newAssignments = assignments.filter(a =>
          a.classroomId?._id?.toString() === c._id.toString() &&
          new Date(a.createdAt) > threeDaysAgo
        );
        if (newAssignments.length > 0) activities.push({ type: 'assignment', label: `${newAssignments.length} New Assignment${newAssignments.length > 1 ? 's' : ''}` });

        if (new Date(c.updatedAt) > threeDaysAgo) {
          activities.push({ type: 'update', label: 'Recently Updated' });
        }

        return { ...c, activities };
      });

      // "Recent Classrooms" are those with any activity OR recently created
      // For now, we'll show those with activity first, then by updatedAt
      const recent = classroomsWithActivity
        .filter(c => c.activities.length > 0 || new Date(c.createdAt) > threeDaysAgo)
        .sort((a, b) => {
          if (a.activities.length !== b.activities.length) return b.activities.length - a.activities.length;
          return new Date(b.updatedAt) - new Date(a.updatedAt);
        });

      setRecentClassrooms(recent.slice(0, 10)); // Top 10 recent activities

      // Determine 'My Classrooms' (explicitly related to user)
      let relatedClassrooms = [];
      if (user?.role === 'student') {
        relatedClassrooms = availableClassrooms.filter(c =>
          c.students?.some(s => (s._id || s) === user?._id) ||
          user?.enrolledClasses?.includes(c._id)
        );
      } else if (user?.role === 'teacher' || user?.role === 'personal_teacher') {
        relatedClassrooms = availableClassrooms.filter(c =>
          (c.teacherId?._id || c.teacherId) === user?._id
        );
      } else {
        // For admins, all available classrooms are related
        relatedClassrooms = availableClassrooms;
      }
      setUserClassrooms(relatedClassrooms);

      // Stats calculation
      let studentCount = 0;
      let classroomCount = availableClassrooms.length;

      if (user?.role === 'root_admin' || user?.role === 'school_admin') {
        studentCount = availableClassrooms.reduce((acc, c) => acc + (c.students?.length || 0), 0);
      } else if (user?.role === 'teacher' || user?.role === 'personal_teacher') {
        const myClasses = availableClassrooms.filter(c => (c.teacherId?._id || c.teacherId) === user?._id);
        studentCount = myClasses.reduce((acc, c) => acc + (c.students?.length || 0), 0);
        classroomCount = myClasses.length;
      } else if (user?.role === 'student') {
        classroomCount = relatedClassrooms.length;
      }

      setStats({
        classrooms: classroomCount,
        students: studentCount,
        payments: paymentsRes.data.payments?.length || 0,
        assignments: assignments.length
      });
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    }
  };

  return (
    <Layout>
      {showWelcome && user && (
        <div style={{ background: '#e0f7fa', padding: '10px', borderRadius: '6px', marginBottom: '16px', textAlign: 'center' }}>
          Welcome, <b>{user.name}</b>!
        </div>
      )}
      <div className="space-y-6">
        <h2 className="text-2xl font-bold text-gray-800">Dashboard</h2>

        <div className={`grid grid-cols-1 md:grid-cols-2 ${user?.role === 'student' ? 'lg:grid-cols-3' : 'lg:grid-cols-4'} gap-6`}>
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm">Classrooms</p>
                <p className="text-3xl font-bold text-gray-800">{stats.classrooms}</p>
              </div>
              <Book className="w-12 h-12 text-blue-500" />
            </div>
          </div>

          {user?.role !== 'student' && (
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-600 text-sm">Students</p>
                  <p className="text-3xl font-bold text-gray-800">{stats.students}</p>
                </div>
                <Users className="w-12 h-12 text-green-500" />
              </div>
            </div>
          )}

          {user?.role === 'student' && (
            <>
              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-gray-600 text-sm">Payments</p>
                    <p className="text-3xl font-bold text-gray-800">{stats.payments}</p>
                  </div>
                  <DollarSign className="w-12 h-12 text-yellow-500" />
                </div>
              </div>

              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-gray-600 text-sm">Assignments</p>
                    <p className="text-3xl font-bold text-gray-800">{stats.assignments}</p>
                  </div>
                  <FileText className="w-12 h-12 text-purple-500" />
                </div>
              </div>
            </>
          )}
        </div>

        <div className="bg-white rounded-lg shadow overflow-hidden">
          <button
            onClick={() => setIsRecentExpanded(!isRecentExpanded)}
            className="w-full flex items-center justify-between p-6 hover:bg-gray-50 transition border-b"
          >
            <h3 className="text-lg font-semibold">Recent Activity & Classrooms</h3>
            {isRecentExpanded ? <ChevronUp className="w-5 h-5 text-gray-500" /> : <ChevronDown className="w-5 h-5 text-gray-500" />}
          </button>

          {isRecentExpanded && (
            <div className="p-6 pt-0 divide-y divide-gray-100">
              {recentClassrooms.length > 0 ? (
                recentClassrooms.map((classroom) => (
                  <Link
                    key={classroom._id}
                    to={`/classrooms/${classroom._id}`}
                    className="flex flex-col md:flex-row md:items-center justify-between py-4 hover:bg-gray-50 transition px-2 rounded-md"
                  >
                    <div className="flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h4 className="font-semibold text-gray-800">{classroom.name}</h4>
                        {classroom.activities?.map((act, idx) => (
                          <span
                            key={idx}
                            className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium space-x-1 ${act.type === 'meeting' ? 'bg-red-100 text-red-800 animate-pulse' :
                              act.type === 'assignment' ? 'bg-orange-100 text-orange-800' :
                                'bg-green-100 text-green-800'
                              }`}
                          >
                            {act.type === 'meeting' && <Monitor className="w-3 h-3" />}
                            {act.type === 'assignment' && <AlertCircle className="w-3 h-3" />}
                            <span>{act.label}</span>
                          </span>
                        ))}
                      </div>
                      <div className="flex items-center space-x-4 mt-1 text-sm text-gray-600">
                        <span className="flex items-center">
                          <Calendar className="w-4 h-4 mr-1 text-gray-400" />
                          {classroom.schedule && classroom.schedule.length > 0 ? (
                            classroom.schedule.map((session, index) => (
                              <span key={index} className="mr-2">
                                {session.dayOfWeek.substring(0, 3)} {session.startTime}-{session.endTime}
                              </span>
                            ))
                          ) : (
                            <span>No schedule available</span>
                          )}
                        </span>
                        {user?.role !== 'student' && (
                          <span className="flex items-center">
                            <Users className="w-4 h-4 mr-1 text-gray-400" />
                            {classroom.students?.length || 0} enrolled
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="mt-2 md:mt-0 flex flex-wrap items-center gap-2">
                      {classroom.isPaid && classroom.pricing?.amount > 0 ? (
                        <span className="bg-green-100 text-green-800 px-3 py-1 rounded-full text-xs font-bold">
                          {formatAmount(classroom.pricing?.amount || 0, classroom.pricing?.currency || 'NGN')}
                        </span>
                      ) : (
                        <span className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-xs font-bold">
                          Free
                        </span>
                      )}
                      <span className={`px-2 py-1 rounded-full text-xs font-semibold ${(Array.isArray(classroom.schoolId) ? classroom.schoolId.length > 0 : classroom.schoolId) ? 'bg-indigo-100 text-indigo-800' : 'bg-purple-100 text-purple-800'}`}>
                        {(Array.isArray(classroom.schoolId) ? (classroom.schoolId[0]?.name || classroom.schoolId[0]) : classroom.schoolId?.name) || classroom.teacherId?.tutorialId?.name || 'Tutorial'}
                        {Array.isArray(classroom.schoolId) && classroom.schoolId.length > 1 && ` +${classroom.schoolId.length - 1}`}
                      </span>
                    </div>
                  </Link>
                ))
              ) : (
                <p className="text-gray-500 text-center py-8">No recent activity or classrooms found</p>
              )}
            </div>
          )}
        </div>

        <div className="bg-white rounded-lg shadow overflow-hidden">
          <button
            onClick={() => setIsMyClassesExpanded(!isMyClassesExpanded)}
            className="w-full flex items-center justify-between p-6 hover:bg-gray-50 transition border-b"
          >
            <h3 className="text-lg font-semibold">
              {user?.role === 'student' ? 'My Enrolled Classrooms' :
                user?.role === 'teacher' || user?.role === 'personal_teacher' ? 'Classrooms I Teach' :
                  'All Related Classrooms'}
            </h3>
            {isMyClassesExpanded ? <ChevronUp className="w-5 h-5 text-gray-500" /> : <ChevronDown className="w-5 h-5 text-gray-500" />}
          </button>

          {isMyClassesExpanded && (
            <div className="p-6 pt-0 divide-y divide-gray-100">
              {userClassrooms.length > 0 ? (
                userClassrooms.map((classroom) => (
                  <Link
                    key={classroom._id}
                    to={`/classrooms/${classroom._id}`}
                    className="flex flex-col md:items-center md:flex-row justify-between py-4 hover:bg-gray-50 transition px-2 rounded-md"
                  >
                    <div className="flex-1">
                      <h4 className="font-semibold text-gray-800">{classroom.name}</h4>
                      <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">{classroom.description}</p>
                      <div className="flex flex-wrap items-center gap-2 mt-2 text-xs text-gray-600">
                        <span className={`px-2 py-0.5 rounded text-xs font-semibold ${(Array.isArray(classroom.schoolId) ? classroom.schoolId.length > 0 : classroom.schoolId) ? 'bg-indigo-100 text-indigo-700' : 'bg-purple-100 text-purple-700'}`}>
                          {(Array.isArray(classroom.schoolId) ? (classroom.schoolId[0]?.name || classroom.schoolId[0]) : classroom.schoolId?.name) || classroom.teacherId?.tutorialId?.name || 'Tutorial'}
                          {Array.isArray(classroom.schoolId) && classroom.schoolId.length > 1 && ` +${classroom.schoolId.length - 1}`}
                        </span>
                        <span className="flex items-center">
                          <Calendar className="w-3.5 h-3.5 mr-1 text-gray-400" />
                          {classroom.schedule?.[0]?.dayOfWeek.substring(0, 3)} {classroom.schedule?.[0]?.startTime}
                          {classroom.schedule?.length > 1 && ` +${classroom.schedule.length - 1} more`}
                        </span>
                        {user?.role !== 'student' && (
                          <span className="flex items-center">
                            <Users className="w-3.5 h-3.5 mr-1 text-gray-400" />
                            {classroom.students?.length || 0} students
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="mt-2 md:mt-0">
                      <span className="text-xs font-semibold text-indigo-600 bg-indigo-50 px-2 py-1 rounded">
                        View Classroom →
                      </span>
                    </div>
                  </Link>
                ))
              ) : (
                <p className="text-gray-500 text-center py-8">No classrooms found in this section</p>
              )}
            </div>
          )}
        </div>
      </div>
    </Layout >
  );
};






export default Dashboard;

