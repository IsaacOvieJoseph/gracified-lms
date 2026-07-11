import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, Pressable, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import api from '../../api/api';
import { canUseAssignmentsPortal, getRoleDisplayName, isStudent } from '../../utils/roles';

const normalizeListResponse = (payload) => {
  if (Array.isArray(payload)) return payload;
  if (payload && typeof payload === 'object') {
    if (Array.isArray(payload.classrooms)) return payload.classrooms;
    if (Array.isArray(payload.assignments)) return payload.assignments;
    if (Array.isArray(payload.notifications)) return payload.notifications;
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
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

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

      if (classroomsRes.status === 'fulfilled') {
        setClassroomsCount(normalizeListResponse(classroomsRes.value.data).length);
      } else {
        console.log('Dashboard classrooms load failed:', classroomsRes.reason);
      }

      if (assignmentsRes.status === 'fulfilled') {
        setAssignmentsCount(normalizeListResponse(assignmentsRes.value.data).length);
      } else {
        console.log('Dashboard assignments load failed:', assignmentsRes.reason);
      }

      if (meetingsRes.status === 'fulfilled') {
        setMeetingsCount(normalizeListResponse(meetingsRes.value.data).length);
      } else {
        console.log('Dashboard meetings load failed:', meetingsRes.reason);
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
            <View style={[styles.badgeCount, { backgroundColor: theme.danger }]}>
              <Text style={[styles.badgeCountText, { color: theme.onPrimary }]}>{unreadNotifications}</Text>
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
              {meetingsCount === 0 ? 'No live classes right now.' : `${meetingsCount} session active`}
            </Text>
            <Text style={[styles.meetingsSub, { color: theme.muted }]}>Open a class details page to join its interactive whiteboard.</Text>
          </View>

          <Text style={[styles.sectionTitle, { color: theme.text }]}>Portals</Text>
          <View style={styles.portalsList}>
            {canUseAssignmentsPortal(user) && (
              <Pressable style={[styles.portalItem, { backgroundColor: theme.surface, borderColor: theme.border }]} onPress={() => navigation.navigate('Assignments')}>
                <View style={[styles.portalIcon, { backgroundColor: theme.surfaceElevated }]}>
                  <Ionicons name="clipboard-outline" size={20} color={theme.text} />
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={[styles.portalTitle, { color: theme.text }]}>Assignments Center</Text>
                  <Text style={[styles.portalSub, { color: theme.muted }]}>View and submit homework, check graded feedback.</Text>
                </View>
                <Ionicons name="chevron-forward-outline" size={18} color={theme.muted} />
              </Pressable>
            )}

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

            <Pressable style={[styles.portalItem, { backgroundColor: theme.surface, borderColor: theme.border }]} onPress={() => navigation.navigate('Payments')}>
              <View style={[styles.portalIcon, { backgroundColor: `${theme.warning}26` }]}>
                <Ionicons name="receipt-outline" size={20} color={theme.warning} />
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={[styles.portalTitle, { color: theme.text }]}>{studentUser ? 'Payments' : 'Payments & Payouts'}</Text>
                <Text style={[styles.portalSub, { color: theme.muted }]}>{studentUser ? 'View course payment receipts and billing history.' : 'View classroom revenue, payouts, and transaction history.'}</Text>
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
