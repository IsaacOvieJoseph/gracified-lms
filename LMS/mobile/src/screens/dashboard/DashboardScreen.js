import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, Pressable, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import api from '../../api/api';
import { canUseAssignmentsPortal, getEntityId, getRoleDisplayName, isStudent } from '../../utils/roles';

const normalizeListResponse = (payload) => {
  if (Array.isArray(payload)) return payload;
  if (payload && typeof payload === 'object') {
    if (Array.isArray(payload.classrooms)) return payload.classrooms;
    if (Array.isArray(payload.assignments)) return payload.assignments;
    if (Array.isArray(payload.notifications)) return payload.notifications;
    if (Array.isArray(payload.activeSessions)) return payload.activeSessions;
    if (Array.isArray(payload.data)) return payload.data;
    if (Array.isArray(payload.items)) return payload.items;
  }
  return [];
};

export default function DashboardScreen({ navigation }) {
  const { user } = useAuth();
  const { theme } = useTheme();
  const [classroomsCount, setClassroomsCount] = useState(0);
  const [assignmentsCount, setAssignmentsCount] = useState(0);
  const [meetingsCount, setMeetingsCount] = useState(0);
  const [activeMeetings, setActiveMeetings] = useState([]);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const isStudentEnrolled = (classroom) => {
    const studentId = getEntityId(user);
    if (!studentId) return false;

    const hasDirectMatch = (user?.enrolledClasses || []).some((id) => getEntityId(id) === getEntityId(classroom));
    const hasClassroomMatch = (classroom?.students || []).some((student) => getEntityId(student) === studentId);
    return hasDirectMatch || hasClassroomMatch;
  };

  const getClassroomIdFromSession = (session) => getEntityId(session?.classroomId) || getEntityId(session?.classId);

  const formatStartedTime = (startedAt) => {
    if (!startedAt) return 'Live now';
    return `Started ${new Date(startedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  };

  const loadDashboardData = async (showLoading = true) => {
    if (showLoading) setLoading(true);
    setError(null);
    try {
      const results = await Promise.allSettled([
        api.get('/classrooms'),
        api.get('/assignments'),
        api.get('/classrooms/active-meetings'),
        api.get('/notifications/inapp'),
      ]);

      const [classroomsRes, assignmentsRes, meetingsRes, notificationsRes] = results;

      let classroomList = [];
      let visibleClassrooms = [];

      if (classroomsRes.status === 'fulfilled') {
        classroomList = normalizeListResponse(classroomsRes.value.data);
        visibleClassrooms = isStudent(user) ? classroomList.filter(isStudentEnrolled) : classroomList;
        setClassroomsCount(visibleClassrooms.length);
      } else {
        console.log('Dashboard classrooms load failed:', classroomsRes.reason);
      }

      if (assignmentsRes.status === 'fulfilled') {
        setAssignmentsCount(normalizeListResponse(assignmentsRes.value.data).length);
      } else {
        console.log('Dashboard assignments load failed:', assignmentsRes.reason);
      }

      if (meetingsRes.status === 'fulfilled') {
        const meetingList = normalizeListResponse(meetingsRes.value.data);
        const visibleClassroomIds = new Set(visibleClassrooms.map(getEntityId).filter(Boolean));
        const visibleMeetings = isStudent(user) && visibleClassroomIds.size > 0
          ? meetingList.filter((session) => visibleClassroomIds.has(getClassroomIdFromSession(session)))
          : meetingList;
        setActiveMeetings(visibleMeetings);
        setMeetingsCount(visibleMeetings.length);
      } else {
        console.log('Dashboard meetings load failed:', meetingsRes.reason);
        setActiveMeetings([]);
        setMeetingsCount(0);
      }

      if (notificationsRes.status === 'fulfilled') {
        const unread = normalizeListResponse(notificationsRes.value.data).filter(n => !n.read)?.length || 0;
        setUnreadNotifications(unread);
      } else {
        console.log('Dashboard notifications load failed:', notificationsRes.reason);
      }

      const rejected = results.find((result) => result.status === 'rejected');
      if (rejected) {
        const err = rejected.reason;
        setError(err?.response?.data?.message || 'Unable to load some dashboard data.');
      }
    } catch (err) {
      setError(err?.response?.data?.message || 'Unable to load dashboard data.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadDashboardData();

    const interval = setInterval(() => {
      loadDashboardData(false);
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    loadDashboardData(false);
  };

  const studentUser = isStudent(user);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={[styles.header, { borderBottomColor: theme.border }]}>
        <View>
          <Text style={[styles.eyebrow, { color: theme.muted }]}>Gracified LMS</Text>
          <View style={styles.roleRow}>
            <Text style={[styles.roleText, { color: theme.muted }]}>{getRoleDisplayName(user?.role)}</Text>
          </View>
        </View>

        <Pressable onPress={() => navigation.navigate('Notifications')} style={[styles.notificationBell, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Ionicons name="notifications-outline" size={24} color={theme.text} />
          {unreadNotifications > 0 && (
            <View style={[styles.badgeCount, { backgroundColor: `${theme.danger}1A` }]}>
              <Text style={[styles.badgeCountText, { color: theme.danger }]}>{unreadNotifications}</Text>
            </View>
          )}
        </Pressable>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.primary} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />}
        >
          {error && <Text style={[styles.error, { color: theme.danger }]}>{error}</Text>}

          <View style={styles.hero}>
            <Text style={[styles.title, { color: theme.text }]}>Hello, {user?.name || 'Learner'}</Text>
            <Text style={[styles.subtitle, { color: theme.muted }]}>
              {studentUser
                ? 'Track your classes, assignments, and live sessions.'
                : 'Manage your classes, learners, assessments, and revenue.'}
            </Text>
          </View>

          <View style={styles.grid}>
            <Pressable style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]} onPress={() => navigation.navigate('Classes')}>
              <View style={[styles.cardIcon, { backgroundColor: theme.surfaceElevated }]}>
                <Ionicons name="school-outline" size={22} color={theme.text} />
              </View>
              <Text style={[styles.cardValue, { color: theme.text }]}>{classroomsCount}</Text>
              <Text style={[styles.cardTitle, { color: theme.muted }]}>{studentUser ? 'Enrolled Classes' : 'Managed Classes'}</Text>
            </Pressable>

            {canUseAssignmentsPortal(user) && (
              <Pressable style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]} onPress={() => navigation.navigate('Assignments')}>
                <View style={[styles.cardIcon, { backgroundColor: `${theme.info}1A` }]}>
                  <Ionicons name="clipboard-outline" size={22} color={theme.info} />
                </View>
                <Text style={[styles.cardValue, { color: theme.text }]}>{assignmentsCount}</Text>
                <Text style={[styles.cardTitle, { color: theme.muted }]}>Assignments</Text>
              </Pressable>
            )}
          </View>

          <View style={[styles.meetingsCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <View style={styles.meetingsHeader}>
              <View style={[styles.dot, { backgroundColor: theme.danger }]} />
              <Text style={[styles.meetingsTitle, { color: theme.danger }]}>Live Sessions</Text>
            </View>
            <Text style={[styles.meetingsValue, { color: theme.text }]}>
              {meetingsCount === 0 ? 'No live classes right now.' : `${meetingsCount} live ${meetingsCount === 1 ? 'lecture' : 'lectures'}`}
            </Text>
            <Text style={[styles.meetingsSub, { color: theme.muted }]}>
              {meetingsCount === 0 ? 'You will see a join button here when your instructor starts a lecture.' : 'Tap Join Lecture to enter through the class page.'}
            </Text>
            {activeMeetings.length > 0 && (
              <View style={styles.liveList}>
                {activeMeetings.slice(0, 3).map((session) => {
                  const sessionClassroomId = getClassroomIdFromSession(session);
                  const classroomName = session?.classroomId?.name || 'Live classroom';
                  const subject = session?.classroomId?.subject;
                  return (
                    <Pressable
                      key={session._id || `${sessionClassroomId}-${session.startedAt}`}
                      style={[styles.liveItem, { backgroundColor: theme.surfaceElevated, borderColor: theme.border }]}
                      onPress={() => navigation.navigate('ClassroomDetail', { classroomId: sessionClassroomId })}
                      disabled={!sessionClassroomId}
                    >
                      <View style={styles.liveInfo}>
                        <View style={styles.liveTitleRow}>
                          <View style={[styles.livePulse, { backgroundColor: theme.danger }]} />
                          <Text style={[styles.liveTitle, { color: theme.text }]} numberOfLines={1}>{classroomName}</Text>
                        </View>
                        <Text style={[styles.liveMeta, { color: theme.muted }]} numberOfLines={1}>
                          {[subject, formatStartedTime(session.startedAt)].filter(Boolean).join(' • ')}
                        </Text>
                      </View>
                      <View style={[styles.joinBtn, { backgroundColor: theme.danger }]}>
                        <Text style={[styles.joinBtnText, { color: theme.onPrimary }]}>Join Lecture</Text>
                        <Ionicons name="enter-outline" size={14} color={theme.onPrimary} />
                      </View>
                    </Pressable>
                  );
                })}
                {activeMeetings.length > 3 && (
                  <Text style={[styles.meetingsSub, { color: theme.muted }]}>+ {activeMeetings.length - 3} more live lectures</Text>
                )}
              </View>
            )}
          </View>

          <Text style={[styles.sectionTitle, { color: theme.text }]}>Portals</Text>
          <View style={styles.portalsList}>
            {!studentUser && <Pressable style={[styles.portalItem, { backgroundColor: theme.surface, borderColor: theme.border }]} onPress={() => navigation.navigate('AIAssistant')}>
              <View style={[styles.portalIcon, { backgroundColor: `${theme.warning}26` }]}>
                <Ionicons name="sparkles-outline" size={20} color={theme.warning} />
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={[styles.portalTitle, { color: theme.text }]}>AI Assistant (Gracy)</Text>
                <Text style={[styles.portalSub, { color: theme.muted }]}>Generate topics, assignments, exams, slides, syllabi, and ask questions.</Text>
              </View>
              <Ionicons name="chevron-forward-outline" size={18} color={theme.muted} />
            </Pressable>}
            {studentUser && <Pressable style={[styles.portalItem, { backgroundColor: theme.surface, borderColor: theme.border }]} onPress={() => navigation.navigate('AITutor')}>
              <View style={[styles.portalIcon, { backgroundColor: `${theme.primary}26` }]}>
                <Ionicons name="sparkles-outline" size={20} color={theme.primary} />
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={[styles.portalTitle, { color: theme.text }]}>AI Study Partner (Gracy)</Text>
                <Text style={[styles.portalSub, { color: theme.muted }]}>Ask questions, take practice quizzes, and track your growth.</Text>
              </View>
              <Ionicons name="chevron-forward-outline" size={18} color={theme.muted} />
            </Pressable>}
            <Pressable style={[styles.portalItem, { backgroundColor: theme.surface, borderColor: theme.border }]} onPress={() => navigation.navigate('Schedule')}>
              <View style={[styles.portalIcon, { backgroundColor: `${theme.info}1A` }]}>
                <Ionicons name="calendar-outline" size={20} color={theme.info} />
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={[styles.portalTitle, { color: theme.text }]}>Schedule</Text>
                <Text style={[styles.portalSub, { color: theme.muted }]}>View your daily and weekly class schedule.</Text>
              </View>
              <Ionicons name="chevron-forward-outline" size={18} color={theme.muted} />
            </Pressable>

            <Pressable style={[styles.portalItem, { backgroundColor: theme.surface, borderColor: theme.border }]} onPress={() => navigation.navigate('Reports')}>
              <View style={[styles.portalIcon, { backgroundColor: `${theme.primary}26` }]}>
                <Ionicons name="bar-chart-outline" size={20} color={theme.primary} />
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={[styles.portalTitle, { color: theme.text }]}>Reports & Analytics</Text>
                <Text style={[styles.portalSub, { color: theme.muted }]}>Track overall grades, classroom performance, and submission stats.</Text>
              </View>
              <Ionicons name="chevron-forward-outline" size={18} color={theme.muted} />
            </Pressable>

            <Pressable style={[styles.portalItem, { backgroundColor: theme.surface, borderColor: theme.border }]} onPress={() => navigation.navigate('Exams')}>
              <View style={[styles.portalIcon, { backgroundColor: `${theme.success}26` }]}>
                <Ionicons name="journal-outline" size={20} color={theme.success} />
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={[styles.portalTitle, { color: theme.text }]}>Exams Portal</Text>
                <Text style={[styles.portalSub, { color: theme.muted }]}>{studentUser ? 'Take timed multiple-choice and theory examinations.' : 'Review exams available to your classrooms.'}</Text>
              </View>
              <Ionicons name="chevron-forward-outline" size={18} color={theme.muted} />
            </Pressable>
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  eyebrow: { fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1.2, fontSize: 11 },
  roleRow: { marginTop: 2 },
  roleText: { fontSize: 13, fontWeight: '700' },
  notificationBell: {
    position: 'relative',
    padding: 6,
    borderRadius: 10,
    borderWidth: 1,
  },
  badgeCount: {
    position: 'absolute',
    top: -4,
    right: -4,
    borderRadius: 8,
    width: 16,
    height: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  badgeCountText: { fontSize: 9, fontWeight: '800' },
  content: { padding: 20, paddingBottom: 40 },
  hero: { marginBottom: 24 },
  title: { fontSize: 28, fontWeight: '800' },
  subtitle: { marginTop: 8, fontSize: 15, lineHeight: 22 },
  grid: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  card: { flex: 1, borderRadius: 20, padding: 16, borderWidth: 1 },
  cardIcon: { width: 38, height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  cardValue: { fontSize: 24, fontWeight: '800' },
  cardTitle: { fontSize: 12, marginTop: 4, fontWeight: '600' },
  meetingsCard: { borderRadius: 20, padding: 18, borderWidth: 1, marginBottom: 24 },
  meetingsHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  meetingsTitle: { fontWeight: '700', fontSize: 13 },
  meetingsValue: { fontSize: 18, fontWeight: '800' },
  meetingsSub: { fontSize: 12, marginTop: 6, lineHeight: 18 },
  liveList: { marginTop: 14, gap: 10 },
  liveItem: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 16, padding: 12 },
  liveInfo: { flex: 1, minWidth: 0, marginRight: 10 },
  liveTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  livePulse: { width: 8, height: 8, borderRadius: 4 },
  liveTitle: { flex: 1, fontSize: 14, fontWeight: '800' },
  liveMeta: { fontSize: 11, fontWeight: '600', marginTop: 3 },
  joinBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 8 },
  joinBtnText: { fontSize: 11, fontWeight: '800' },
  sectionTitle: { fontSize: 16, fontWeight: '700', marginBottom: 12, marginTop: 4 },
  portalsList: { gap: 10 },
  portalItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 18,
    borderWidth: 1,
  },
  portalIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  portalTitle: { fontSize: 14, fontWeight: '700' },
  portalSub: { fontSize: 11, marginTop: 2, lineHeight: 15 },
  error: { textAlign: 'center', marginBottom: 12, fontWeight: '600' },
});
