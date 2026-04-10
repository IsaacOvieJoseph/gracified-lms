import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Book, Users, DollarSign, FileText, Calendar, ChevronDown, ChevronUp, Monitor, AlertCircle, Clock, School, Loader2 } from 'lucide-react';
import Layout from '../components/Layout';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { formatAmount } from '../utils/currency';
import { convertUTCToLocal } from '../utils/timezone';

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
  const [loading, setLoading] = useState(true);
  const [selectedSchools, setSelectedSchools] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('selectedSchools')) || [];
    } catch {
      return [];
    }
  });

  const [currentScheduleTab, setCurrentScheduleTab] = useState('day');
  const [scheduleData, setScheduleData] = useState({ today: [], weekly: {} });

  useEffect(() => {
    fetchData();
  }, [selectedSchools, user]);

  useEffect(() => {
    // Determine today's day of week
    const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const todayIndex = new Date().getDay();
    const todayName = DAYS[todayIndex];

    const todaySchedules = [];
    const weekGrouped = { 'Monday': [], 'Tuesday': [], 'Wednesday': [], 'Thursday': [], 'Friday': [], 'Saturday': [], 'Sunday': [] };

    userClassrooms.forEach(classroom => {
      if (classroom.schedule && Array.isArray(classroom.schedule)) {
        classroom.schedule.forEach(session => {
          const local = convertUTCToLocal(session.dayOfWeek, session.startTime);
          const localEnd = convertUTCToLocal(session.dayOfWeek, session.endTime);

          const scheduleItem = {
            classId: classroom._id,
            className: classroom.name,
            subject: classroom.subject,
            startTime: local.hhmm,
            endTime: localEnd.hhmm,
            day: local.dayOfWeek,
            timezone: local.timezone,
            isCurrent: classroom.activities?.some(a => a.type === 'meeting')
          };

          if (local.dayOfWeek === todayName) {
            todaySchedules.push(scheduleItem);
          }
          if (weekGrouped[local.dayOfWeek]) {
            weekGrouped[local.dayOfWeek].push(scheduleItem);
          }
        });
      }
    });

    // Sort today's schedules by start time
    todaySchedules.sort((a, b) => a.startTime.localeCompare(b.startTime));
    // Sort weekly segments
    Object.keys(weekGrouped).forEach(day => {
      weekGrouped[day].sort((a, b) => a.startTime.localeCompare(b.startTime));
    });

    setScheduleData({ today: todaySchedules, weekly: weekGrouped });
  }, [userClassrooms]);

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

      const assignments = assignmentsRes.data.assignments || [];
      const activeMeetings = meetingsRes.data.activeSessions || [];
      const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);

      // Map activities to classrooms and identify "Recent" ones
      const classroomsWithActivity = relatedClassrooms.map(c => {
        const activities = [];
        const activeMeeting = activeMeetings.find(m => m.classroomId?.toString() === c._id.toString());
        if (activeMeeting) activities.push({ type: 'meeting', label: 'Active Lecture' });

        const newAssignments = assignments.filter(a =>
          a.classroomId?._id?.toString() === c._id.toString() &&
          new Date(a.createdAt) > threeDaysAgo
        );
        if (newAssignments.length > 0) activities.push({ type: 'assignment', label: `${newAssignments.length} New Assignment${newAssignments.length > 1 ? 's' : ''}` });

        const activeTopic = c.topics?.find(t => t.status === 'active');
        if (activeTopic) activities.push({ type: 'topic', label: `Topic: ${activeTopic.name}` });

        return { ...c, activities };
      });

      const recent = classroomsWithActivity
        .filter(c => c.activities.length > 0)
        .sort((a, b) => {
          if (a.activities.length !== b.activities.length) return b.activities.length - a.activities.length;
          return new Date(b.updatedAt) - new Date(a.updatedAt);
        });

      setRecentClassrooms(recent.slice(0, 10));

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
    } finally {
      setLoading(false);
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
          <div className="card-premium p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-500 text-sm font-semibold mb-1">Classrooms</p>
                <div className="text-3xl font-bold text-slate-900">
                  {loading ? <Loader2 className="w-5 h-5 animate-spin text-primary/30" /> : stats.classrooms}
                </div>
              </div>
              <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center text-primary">
                <Book className="w-6 h-6" />
              </div>
            </div>
          </div>

          {user?.role !== 'student' && (
            <div className="card-premium p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-slate-500 text-sm font-semibold mb-1">Students</p>
                  <div className="text-3xl font-bold text-slate-900">
                    {loading ? <Loader2 className="w-5 h-5 animate-spin text-emerald-300" /> : stats.students}
                  </div>
                </div>
                <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center text-emerald-600">
                  <Users className="w-6 h-6" />
                </div>
              </div>
            </div>
          )}

          {user?.role === 'student' && (
            <>
              <div className="card-premium p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-slate-500 text-sm font-semibold mb-1">Payments</p>
                    <div className="text-3xl font-bold text-slate-900">
                      {loading ? <Loader2 className="w-5 h-5 animate-spin text-amber-300" /> : stats.payments}
                    </div>
                  </div>
                  <div className="w-12 h-12 bg-amber-100 rounded-xl flex items-center justify-center text-amber-600">
                    <DollarSign className="w-6 h-6" />
                  </div>
                </div>
              </div>

              <div className="card-premium p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-slate-500 text-sm font-semibold mb-1">Assignments</p>
                    <div className="text-3xl font-bold text-slate-900">
                      {loading ? <Loader2 className="w-5 h-5 animate-spin text-indigo-300" /> : stats.assignments}
                    </div>
                  </div>
                  <div className="w-12 h-12 bg-indigo-100 rounded-xl flex items-center justify-center text-indigo-600">
                    <FileText className="w-6 h-6" />
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Schedule Display */}
        <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="p-6 border-b border-slate-50 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-600 shadow-sm border border-indigo-100">
                <Calendar className="w-5 h-5" />
              </div>
              <h3 className="text-xl font-black text-slate-900 tracking-tight">Class Schedule</h3>
            </div>
            <div className="flex bg-slate-100 p-1 rounded-xl">
              <button
                onClick={() => setCurrentScheduleTab('day')}
                className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${currentScheduleTab === 'day' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                Today
              </button>
              <button
                onClick={() => setCurrentScheduleTab('week')}
                className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${currentScheduleTab === 'week' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                Weekly
              </button>
            </div>
          </div>

          <div className="p-4 bg-slate-50/30">
            {currentScheduleTab === 'day' ? (
              <div className="flex flex-row md:flex-col overflow-x-auto md:overflow-x-visible md:max-h-[320px] md:overflow-y-auto snap-x snap-mandatory gap-3 pb-3 md:pb-0 md:space-y-2 scrollbar-hide">
                {scheduleData.today.length > 0 ? (
                  scheduleData.today.map((session, idx) => (
                    <div key={idx} className="bg-white p-3 rounded-xl border border-slate-100 shadow-sm flex items-center gap-3 group hover:border-indigo-300 transition-all min-w-[85%] md:min-w-0 snap-center shrink-0">
                      <div className="hidden sm:flex flex-col items-center justify-center py-1.5 px-2 bg-slate-50 rounded-lg border border-slate-100 min-w-[75px]">
                        <span className="text-[10px] font-black text-slate-800 uppercase tracking-widest">{session.startTime}</span>
                        <div className="w-0.5 h-1 bg-slate-300 my-0.5 rounded-full opacity-50" />
                        <span className="text-[8px] font-bold text-slate-400">{session.timezone.split(' ')[0]}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex sm:hidden items-center gap-1.5 mb-1 text-[8px] font-black text-indigo-400 uppercase tracking-widest">
                          <Clock className="w-2.5 h-2.5" />
                          <span>{session.startTime} ({session.timezone.split(' ')[0]})</span>
                        </div>
                        <Link to={`/classrooms/${session.classId}`} className="block group-hover:text-indigo-600">
                          <h4 className="font-bold text-slate-900 truncate text-xs sm:text-sm">{session.className}</h4>
                        </Link>
                        <p className="text-[9px] sm:text-[10px] text-slate-500 font-medium truncate">{session.subject || 'Tutorial Class'}</p>
                      </div>
                      <div className="flex flex-col items-end gap-1.5 text-right">
                        {session.isCurrent ? (
                          <div className="flex items-center gap-1 bg-rose-50 text-rose-600 px-2 py-0.5 rounded-full border border-rose-100 animate-pulse">
                             <div className="w-1 h-1 rounded-full bg-rose-600" />
                             <span className="text-[8px] font-bold uppercase tracking-wider text-nowrap">Live</span>
                          </div>
                        ) : null}
                         <Link to={`/classrooms/${session.classId}`} className="text-[9px] font-black text-indigo-500 uppercase tracking-widest hover:text-indigo-700 transition">Enter Class</Link>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="w-full py-8 bg-white rounded-2xl border border-dashed border-slate-200 text-center flex flex-col items-center">
                    <div className="w-10 h-10 bg-slate-50 rounded-full flex items-center justify-center mb-2">
                       <Clock className="w-5 h-5 text-slate-300" />
                    </div>
                    <p className="text-slate-400 font-bold text-xs">Free Day!</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex flex-row overflow-x-auto snap-x snap-mandatory gap-3 pb-2 scrollbar-hide">
                {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map(day => (
                  <div key={day} className="flex flex-col min-w-[42%] sm:min-w-[32%] md:min-w-[24%] lg:min-w-[18%] xl:min-w-[13.5%] snap-center shrink-0">
                    <h5 className="text-[8px] font-black uppercase tracking-[0.2em] text-slate-400 mb-2 ml-1">{day}</h5>
                    <div className="flex-1 space-y-1.5 overflow-y-auto max-h-[200px] scrollbar-hide">
                      {scheduleData.weekly[day] && scheduleData.weekly[day].length > 0 ? (
                        scheduleData.weekly[day].map((session, idx) => (
                          <Link
                            key={idx}
                            to={`/classrooms/${session.classId}`}
                            className="block p-2 bg-white rounded-xl border border-slate-100 shadow-sm hover:border-indigo-200 hover:-translate-y-0.5 transition-all"
                          >
                            <p className="text-[9px] font-black text-indigo-600 flex items-center justify-between">
                              <span>{session.startTime}</span>
                            </p>
                            <p className="text-[10px] font-bold text-slate-800 truncate">{session.className}</p>
                          </Link>
                        ))
                      ) : (
                        <div className="h-10 border border-dashed border-slate-200 rounded-lg flex items-center justify-center p-2">
                           <span className="text-[7px] font-black text-slate-300 uppercase tracking-widest">Quiet</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow overflow-hidden">
          <button
            onClick={() => setIsRecentExpanded(!isRecentExpanded)}
            className="w-full flex items-center justify-between p-6 hover:bg-gray-50 transition border-b"
          >
            <h3 className="text-lg font-semibold">Recent Activity</h3>
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
                                act.type === 'topic' ? 'bg-blue-100 text-blue-800' :
                                  'bg-green-100 text-green-800'
                              }`}
                          >
                            {act.type === 'meeting' && <Monitor className="w-3 h-3" />}
                            {act.type === 'assignment' && <AlertCircle className="w-3 h-3" />}
                            {act.type === 'topic' && <Clock className="w-3 h-3 animate-pulse" />}
                            <span>{act.label}</span>
                          </span>
                        ))}
                      </div>
                      <div className="flex items-center space-x-4 mt-1 text-sm text-gray-600">
                        <span className="flex items-center">
                          <Calendar className="w-4 h-4 mr-1 text-gray-400" />
                          {classroom.schedule && classroom.schedule.length > 0 ? (
                            classroom.schedule.map((session, index) => {
                              const local = convertUTCToLocal(session.dayOfWeek, session.startTime);
                              const localEnd = convertUTCToLocal(session.dayOfWeek, session.endTime);
                              const isMultiDay = classroom.schedule.length > 1;
                              return (
                                <span key={index} className="mr-2">
                                  {local.dayOfWeek.substring(0, 3)}
                                  {!isMultiDay && ` ${local.time}-${localEnd.time}`}
                                  {isMultiDay && index < classroom.schedule.length - 1 ? ',' : ''}
                                </span>
                              );
                            })
                          ) : (
                            <span>No schedule available</span>
                          )}
                          {classroom.schedule?.length > 0 && (
                            <span className="ml-1 text-[10px] font-bold text-indigo-500 uppercase">(Weekly)</span>
                          )}
                        </span>
                        {user?.role !== 'student' && (
                          <span className="flex items-center">
                            <Users className="w-4 h-4 mr-1 text-gray-400" />
                            {classroom.students?.length || 0} enrolled
                          </span>
                        )}
                        <span className="flex items-center">
                          <Book className="w-4 h-4 mr-1 text-gray-400" />
                          {classroom.topics?.length || 0} topics
                        </span>
                        <span className="flex items-center min-w-0 max-w-[200px]">
                          <School className="w-4 h-4 mr-1 text-gray-400 shrink-0" />
                          <span className="truncate text-xs" title={(Array.isArray(classroom.schoolId) ? classroom.schoolId.map(s => s?.name || s).join(', ') : classroom.schoolId?.name) || classroom.teacherId?.tutorialId?.name || 'Tutorial'}>
                            {(Array.isArray(classroom.schoolId) ? (classroom.schoolId[0]?.name || classroom.schoolId[0]) : classroom.schoolId?.name) || classroom.teacherId?.tutorialId?.name || 'Tutorial'}
                            {Array.isArray(classroom.schoolId) && classroom.schoolId.length > 1 && ` +${classroom.schoolId.length - 1}`}
                          </span>
                        </span>
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
                        <span className="flex items-center min-w-0 max-w-[200px]">
                          <School className="w-3.5 h-3.5 mr-1 text-gray-400 shrink-0" />
                          <span className="truncate text-xs" title={(Array.isArray(classroom.schoolId) ? classroom.schoolId.map(s => s?.name || s).join(', ') : classroom.schoolId?.name) || classroom.teacherId?.tutorialId?.name || 'Tutorial'}>
                            {(Array.isArray(classroom.schoolId) ? (classroom.schoolId[0]?.name || classroom.schoolId[0]) : classroom.schoolId?.name) || classroom.teacherId?.tutorialId?.name || 'Tutorial'}
                            {Array.isArray(classroom.schoolId) && classroom.schoolId.length > 1 && ` +${classroom.schoolId.length - 1}`}
                          </span>
                        </span>
                        <span className="flex items-center">
                          <Calendar className="w-3.5 h-3.5 mr-1 text-gray-400" />
                          {(() => {
                            if (!classroom.schedule || classroom.schedule.length === 0) return 'No schedule';
                            if (classroom.schedule.length === 1) {
                              const local = convertUTCToLocal(classroom.schedule[0].dayOfWeek, classroom.schedule[0].startTime);
                              return `${local.dayOfWeek.substring(0, 3)} ${local.time}`;
                            }
                            return classroom.schedule.slice(0, 3).map((s, i) => {
                              const local = convertUTCToLocal(s.dayOfWeek, s.startTime);
                              return `${local.dayOfWeek.substring(0, 3)}${i < Math.min(classroom.schedule.length, 3) - 1 ? ',' : ''}`;
                            }).join(' ') + (classroom.schedule.length > 3 ? ` +${classroom.schedule.length - 3}` : '');
                          })()}
                          <span className="ml-1 text-[10px] font-bold text-indigo-500 uppercase">(Weekly)</span>
                        </span>
                        {user?.role !== 'student' && (
                          <span className="flex items-center">
                            <Users className="w-3.5 h-3.5 mr-1 text-gray-400" />
                            {classroom.students?.length || 0} students
                          </span>
                        )}
                        {(() => {
                          const currentTopic = classroom.topics?.find(t => t.status === 'active');
                          if (currentTopic) {
                            return (
                              <span className="flex items-center bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded border border-blue-100">
                                <Clock className="w-3 h-3 mr-1 animate-pulse" />
                                Current: {currentTopic.name}
                              </span>
                            );
                          }
                          return null;
                        })()}
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
    </Layout>
  );
};

export default Dashboard;
