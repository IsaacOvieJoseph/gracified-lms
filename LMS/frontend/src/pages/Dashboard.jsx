import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Book, Users, DollarSign, FileText, Calendar } from 'lucide-react';
import Layout from '../components/Layout';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';

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
  const [showWelcome, setShowWelcome] = useState(true);
  const [schoolModalOpen, setSchoolModalOpen] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (showWelcome) {
      const timer = setTimeout(() => setShowWelcome(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [showWelcome]);

  const fetchData = async () => {
    try {
      const [classroomsRes, paymentsRes] = await Promise.all([
        api.get('/classrooms'),
        user?.role === 'student' ? api.get('/payments/history') : Promise.resolve({ data: { payments: [] } })
      ]);

      // Filter to show only published classrooms in recent classrooms for students and teachers
      let filteredClassrooms = classroomsRes.data.classrooms;
      if (user?.role === 'student' || user?.role === 'teacher') {
        filteredClassrooms = classroomsRes.data.classrooms.filter(c => c.published);
      }

      setRecentClassrooms(filteredClassrooms.slice(0, 5));

      // Calculate student count based on role
      let studentCount = 0;
      let classroomCount = 0;

      if (user?.role === 'root_admin' || user?.role === 'school_admin') {
        // Admins see total students and all classrooms
        studentCount = classroomsRes.data.classrooms.reduce((acc, c) => acc + (c.students?.length || 0), 0);
        classroomCount = classroomsRes.data.classrooms.length;
      } else if (user?.role === 'teacher' || user?.role === 'personal_teacher') {
        // Teachers see only students in their classes and only published classrooms count
        const teacherClassrooms = classroomsRes.data.classrooms.filter(c => c.teacherId?._id === user?._id);
        studentCount = teacherClassrooms.reduce((acc, c) => acc + (c.students?.length || 0), 0);
        classroomCount = teacherClassrooms.filter(c => c.published).length;
      } else if (user?.role === 'student') {
        // Students see only published classrooms
        classroomCount = filteredClassrooms.length;
      }

      setStats({
        classrooms: classroomCount,
        students: studentCount,
        payments: paymentsRes.data.payments?.length || 0,
        assignments: 0
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

        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-4">Recent Classrooms</h3>
          <div className="space-y-3">
            {recentClassrooms.length > 0 ? (
              recentClassrooms.map((classroom) => (
                <Link
                  key={classroom._id}
                  to={`/classrooms/${classroom._id}`}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 transition"
                >
                  <div>
                    <h4 className="font-semibold text-gray-800">{classroom.name}</h4>
                    <div className="flex items-center space-x-4 mt-1 text-sm text-gray-600">
                      <span className="flex items-center">
                        <Calendar className="w-4 h-4 mr-1" />
                        {/*   {classroom.schedule} */}

                        {/* Displaying schedule - iterate over the array */}
                        {classroom.schedule && classroom.schedule.length > 0 ? (
                          classroom.schedule.map((session, index) => (
                            <span key={index} className="mr-2">
                              {session.dayOfWeek} {session.startTime}-{session.endTime}
                            </span>
                          ))
                        ) : (
                          <span>No schedule available</span>
                        )}
                      </span>


                    {user?.role !== 'student' && (
                      <span className="flex items-center">
                        <Users className="w-4 h-4 mr-1" />
                        {classroom.students?.length || 0} students
                      </span>
                    )}
                  </div>
                </div>
                  {
                  classroom.isPaid && classroom.pricing?.amount > 0 ? (
                    <span className="bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm font-semibold">
                      ${classroom.pricing?.amount || 0}
                    </span>
                  ) : (
                    <span className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-semibold">
                      Free
                    </span>
                  )
                }
                  {!classroom.schoolId && classroom.teacherId?.role === 'personal_teacher' && (
                <span className="bg-purple-100 text-purple-800 px-2 py-1 rounded-full text-xs font-semibold ml-1">
                  Personal
                </span>
              )}
          </Link>
          ))
          ) : (
          <p className="text-gray-500 text-center py-4">No classrooms yet</p>
            )}
        </div>
      </div>

    </div>
    </Layout >
  );
};






export default Dashboard;

