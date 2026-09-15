import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Book, Users, DollarSign, FileText, Calendar, ChevronDown, ChevronUp, ArrowRight, Monitor, Clock, School, Loader2 } from 'lucide-react';
import Layout from '../components/Layout';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { formatAmount } from '../utils/currency';
import { convertUTCToLocal } from '../utils/timezone';

import CreateSchoolModal from './Schools';

const StatCard = ({ label, value, icon: Icon, loading, iconClass, loadingClass }) => (
  <div className="rounded-xl border border-border bg-card p-5 shadow-none transition-all hover:shadow-none">
    <div className="flex items-center justify-between gap-4">
      <div className="min-w-0">
        <p className="truncate text-xs font-medium tracking-wide text-muted-foreground">{label}</p>
        <p className="mt-2 text-3xl font-semibold leading-none text-foreground tabular-nums">
          {loading ? <Loader2 className={`h-7 w-7 animate-spin ${loadingClass}`} /> : value}
        </p>
      </div>
      <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border ${iconClass}`}>
        <Icon className="h-6 w-6" />
      </div>
    </div>
  </div>
);



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

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const firstName = (user?.name || '').split(' ')[0];
  const todayLabel = new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const roleOverview = () => {
    switch (user?.role) {
      case 'student': return 'Learning overview';
      case 'personal_teacher': return 'Tutor overview';
      case 'teacher': return 'Teaching overview';
      case 'school_admin': return 'School overview';
      case 'root_admin': return 'Platform overview';
      default: return 'Overview';
    }
  };

  return (
    <Layout>
      <div className="space-y-6">
        {/* Page header */}
        <div className="flex flex-col gap-1">
          <p className="text-xs font-semibold tracking-wide text-muted-foreground">{roleOverview()}</p>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            {greeting}, {firstName || 'there'} &middot; {todayLabel}
          </p>
        </div>

        {/* Key metrics */}
        <div className={`grid grid-cols-1 gap-4 sm:grid-cols-2 ${user?.role === 'student' ? 'lg:grid-cols-3' : 'lg:grid-cols-4'}`}>
          <StatCard
            label={user?.role === 'student' ? 'My Classes' : 'Total Classes'}
            value={stats.classrooms}
            icon={Book}
            loading={loading}
            iconClass="bg-primary/10 text-primary border-primary/10"
            loadingClass="text-primary/40"
          />

          {user?.role !== 'student' && (
            <StatCard
              label="Students Enrolled"
              value={stats.students}
              icon={Users}
              loading={loading}
              iconClass="bg-emerald-500/10 text-emerald-600 border-emerald-500/10"
              loadingClass="text-emerald-500/40"
            />
          )}

          {user?.role === 'student' && (
            <>
              <StatCard
                label="Payments Made"
                value={stats.payments}
                icon={DollarSign}
                loading={loading}
                iconClass="bg-amber-500/10 text-amber-600 border-amber-500/10"
                loadingClass="text-amber-500/40"
              />
              <StatCard
                label="Assignments"
                value={stats.assignments}
                icon={FileText}
                loading={loading}
                iconClass="bg-primary/10 text-primary border-primary/20"
                loadingClass="text-primary/40"
              />
            </>
          )}
        </div>

        {/* Schedule */}
        <div className="overflow-hidden rounded-xl border border-border bg-card shadow-none">
          <div className="flex flex-col gap-3 border-b border-border px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Calendar className="h-4 w-4" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-foreground">Schedule</h2>
                <p className="text-xs text-muted-foreground">Upcoming class sessions</p>
              </div>
            </div>
            <div className="flex bg-muted p-1 rounded-xl w-fit">
              <button
                onClick={() => setCurrentScheduleTab('day')}
                className={`px-4 py-1.5 rounded-md text-xs font-semibold transition-all ${currentScheduleTab === 'day' ? 'bg-card text-foreground shadow-none' : 'text-muted-foreground hover:text-foreground'}`}
              >
                Today
              </button>
              <button
                onClick={() => setCurrentScheduleTab('week')}
                className={`px-4 py-1.5 rounded-md text-xs font-semibold transition-all ${currentScheduleTab === 'week' ? 'bg-card text-foreground shadow-none' : 'text-muted-foreground hover:text-foreground'}`}
              >
                Weekly
              </button>
            </div>
          </div>

          <div className="p-4">
            {currentScheduleTab === 'day' ? (
              <div className="space-y-2">
                {scheduleData.today.length > 0 ? (
                  scheduleData.today.map((session, idx) => (
                    <div key={idx} className="flex items-center gap-4 rounded-xl border border-border bg-card p-4 shadow-none">
                      <div className="hidden min-w-[80px] flex-col items-center justify-center rounded-xl border border-border bg-muted px-3 py-1.5 sm:flex">
                        <span className="text-sm font-semibold tabular-nums text-foreground">{session.startTime}</span>
                        <span className="text-xs font-medium text-muted-foreground">{session.timezone.split(' ')[0]}</span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="mb-1 flex items-center gap-1.5 text-xs text-muted-foreground sm:hidden">
                          <Clock className="h-3 w-3" />
                          <span>{session.startTime} ({session.timezone.split(' ')[0]})</span>
                        </div>
                        <Link to={`/classrooms/${session.classId}`} className="block truncate font-semibold text-foreground transition-colors hover:text-primary">
                          {session.className}
                        </Link>
                        <p className="truncate text-xs text-muted-foreground">{session.subject || 'Tutorial Class'}</p>
                      </div>
                      <div className="flex shrink-0 items-center gap-3">
                        {session.isCurrent ? (
                          <span className="flex items-center gap-1.5 rounded-full bg-rose-500/10 px-2.5 py-1 text-xs font-semibold text-rose-600">
                            <span className="h-1.5 w-1.5 rounded-full bg-rose-500 animate-pulse" />
                            Live
                          </span>
                        ) : null}
                        <Link to={`/classrooms/${session.classId}`} className="whitespace-nowrap text-xs font-semibold text-primary hover:underline">
                          Open Class
                        </Link>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="py-10 text-center">
                    <Clock className="mx-auto mb-3 h-8 w-8 text-muted-foreground/30" />
                    <p className="text-sm font-medium text-muted-foreground">No sessions scheduled for today.</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7">
                {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map(day => (
                  <div key={day} className="flex flex-col">
                    <h5 className="mb-2 text-[11px] font-semibold tracking-wide text-muted-foreground">{day.slice(0, 3)}</h5>
                    <div className="flex-1 space-y-1.5">
                      {scheduleData.weekly[day] && scheduleData.weekly[day].length > 0 ? (
                        scheduleData.weekly[day].map((session, idx) => (
                          <Link
                            key={idx}
                            to={`/classrooms/${session.classId}`}
                            className="block rounded-xl border border-border bg-card p-2.5 transition-all hover:border-primary/40 hover:shadow-none"
                          >
                            <p className="text-xs font-semibold tabular-nums text-primary">{session.startTime}</p>
                            <p className="mt-0.5 truncate text-xs font-semibold text-foreground">{session.className}</p>
                          </Link>
                        ))
                      ) : (
                        <div className="flex h-10 items-center justify-center rounded-xl border border-dashed border-border">
                          <span className="text-[11px] text-muted-foreground/60">No sessions</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Recent Activity */}
        <div className="overflow-hidden rounded-xl border border-border bg-card shadow-none">
          <button
            onClick={() => setIsRecentExpanded(!isRecentExpanded)}
            className="flex w-full items-center justify-between border-b border-border px-5 py-4 transition hover:bg-muted"
          >
            <h2 className="text-sm font-semibold tracking-wide text-muted-foreground">Recent Activity</h2>
            {isRecentExpanded ? <ChevronUp className="h-5 w-5 text-muted-foreground/40" /> : <ChevronDown className="h-5 w-5 text-muted-foreground/40" />}
          </button>

          {isRecentExpanded && (
            <div className="divide-y divide-border">
              {recentClassrooms.length > 0 ? (
                recentClassrooms.map((classroom) => (
                  <Link
                    key={classroom._id}
                    to={`/classrooms/${classroom._id}`}
                    className="flex flex-col justify-between px-5 py-4 transition hover:bg-muted/40 md:flex-row md:items-center"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h4 className="font-semibold text-foreground">{classroom.name}</h4>
                        {classroom.activities?.map((act, idx) => (
                          <span
                            key={idx}
                            className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-medium ${
                              act.type === 'meeting' ? 'bg-rose-500/10 text-rose-600' :
                                act.type === 'assignment' ? 'bg-amber-500/10 text-amber-600' :
                                  act.type === 'topic' ? 'bg-primary/10 text-primary' : 'bg-emerald-500/10 text-emerald-600'
                            }`}
                          >
                            {act.type === 'meeting' && <Monitor className="h-3 w-3" />}
                            {act.type === 'topic' && <Clock className="h-3 w-3" />}
                            <span>{act.label}</span>
                          </span>
                        ))}
                      </div>
                      <div className="mt-1.5 flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                        <span className="flex items-center">
                          <Calendar className="mr-1 h-4 w-4 opacity-40" />
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
                            <span className="ml-1 text-xs font-semibold text-muted-foreground">(weekly)</span>
                          )}
                        </span>
                        {user?.role !== 'student' && (
                          <span className="flex items-center">
                            <Users className="mr-1 h-4 w-4 opacity-40" />
                            {classroom.students?.length || 0} students
                          </span>
                        )}
                        <span className="flex items-center">
                          <Book className="mr-1 h-4 w-4 opacity-40" />
                          {classroom.topics?.length || 0} topics
                        </span>
                        <span className="flex min-w-0 items-center max-w-[200px]">
                          <School className="mr-1 h-4 w-4 shrink-0 opacity-40" />
                          <span className="truncate text-xs" title={(Array.isArray(classroom.schoolId) ? classroom.schoolId.map(s => s?.name || s).join(', ') : classroom.schoolId?.name) || classroom.teacherId?.tutorialId?.name || 'Tutorial'}>
                            {(Array.isArray(classroom.schoolId) ? (classroom.schoolId[0]?.name || classroom.schoolId[0]) : classroom.schoolId?.name) || classroom.teacherId?.tutorialId?.name || 'Tutorial'}
                            {Array.isArray(classroom.schoolId) && classroom.schoolId.length > 1 && ` +${classroom.schoolId.length - 1}`}
                          </span>
                        </span>
                      </div>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-2 md:mt-0">
                      {classroom.isPaid && classroom.pricing?.amount > 0 ? (
                        <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-600">
                          {formatAmount(classroom.pricing?.amount || 0, classroom.pricing?.currency || 'NGN')}
                        </span>
                      ) : (
                        <span className="rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                          Free
                        </span>
                      )}
                    </div>
                  </Link>
                ))
              ) : (
                <div className="py-12 text-center">
                  <p className="text-sm font-medium text-muted-foreground">No recent activity yet.</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* My Classes */}
        <div className="overflow-hidden rounded-xl border border-border bg-card shadow-none">
          <button
            onClick={() => setIsMyClassesExpanded(!isMyClassesExpanded)}
            className="flex w-full items-center justify-between border-b border-border px-5 py-4 transition hover:bg-muted"
          >
            <h2 className="text-base font-semibold text-foreground">
              {user?.role === 'student' ? 'My Classes' :
                user?.role === 'teacher' || user?.role === 'personal_teacher' ? 'Classes I Teach' : 'All Classes'}
            </h2>
            {isMyClassesExpanded ? <ChevronUp className="h-5 w-5 text-muted-foreground/40" /> : <ChevronDown className="h-5 w-5 text-muted-foreground/40" />}
          </button>

          {isMyClassesExpanded && (
            <div className="divide-y divide-border">
              {userClassrooms.length > 0 ? (
                userClassrooms.map((classroom) => (
                  <Link
                    key={classroom._id}
                    to={`/classrooms/${classroom._id}`}
                    className="flex flex-col justify-between px-5 py-4 transition hover:bg-muted/40 md:flex-row md:items-center"
                  >
                    <div className="min-w-0 flex-1">
                      <h4 className="font-semibold text-foreground">{classroom.name}</h4>
                      <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">{classroom.description}</p>
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <span className="flex min-w-0 items-center max-w-[200px]">
                          <School className="mr-1 h-3.5 w-3.5 shrink-0 opacity-40" />
                          <span className="truncate text-xs" title={(Array.isArray(classroom.schoolId) ? classroom.schoolId.map(s => s?.name || s).join(', ') : classroom.schoolId?.name) || classroom.teacherId?.tutorialId?.name || 'Tutorial'}>
                            {(Array.isArray(classroom.schoolId) ? (classroom.schoolId[0]?.name || classroom.schoolId[0]) : classroom.schoolId?.name) || classroom.teacherId?.tutorialId?.name || 'Tutorial'}
                            {Array.isArray(classroom.schoolId) && classroom.schoolId.length > 1 && ` +${classroom.schoolId.length - 1}`}
                          </span>
                        </span>
                        <span className="flex items-center">
                          <Calendar className="mr-1 h-3.5 w-3.5 opacity-40" />
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
                        </span>
                        {user?.role !== 'student' && (
                          <span className="flex items-center">
                            <Users className="mr-1 h-3.5 w-3.5 opacity-40" />
                            {classroom.students?.length || 0} students
                          </span>
                        )}
                        {(() => {
                          const currentTopic = classroom.topics?.find(t => t.status === 'active');
                          if (currentTopic) {
                            return (
                              <span className="flex items-center rounded border border-primary/20 bg-primary/10 px-1.5 py-0.5 text-primary">
                                <Clock className="mr-1 h-3 w-3" />
                                Current: {currentTopic.name}
                              </span>
                            );
                          }
                          return null;
                        })()}
                      </div>
                    </div>
                    <div className="mt-2 flex shrink-0 items-center md:mt-0 md:ml-4">
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-primary">
                        View Class <ArrowRight className="h-3.5 w-3.5" />
                      </span>
                    </div>
                  </Link>
                ))
              ) : (
                <div className="py-12 text-center">
                  <p className="text-sm font-medium text-muted-foreground">No classes available.</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
};

export default Dashboard;
