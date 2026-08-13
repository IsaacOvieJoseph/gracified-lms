import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import api from '../../api/api';
import { getEntityId, isStudent } from '../../utils/roles';
import { convertUTCToLocal } from '../../utils/timezone';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const DAYS_FULL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const normalizeListResponse = (payload) => {
  if (Array.isArray(payload)) return payload;
  if (payload && typeof payload === 'object') {
    if (Array.isArray(payload.classrooms)) return payload.classrooms;
    if (Array.isArray(payload.data)) return payload.data;
    if (Array.isArray(payload.items)) return payload.items;
  }
  return [];
};

export default function ScheduleScreen({ navigation }) {
  const { user } = useAuth();
  const { theme } = useTheme();
  const [tab, setTab] = useState('day');
  const [todayName, setTodayName] = useState('');
  const [today, setToday] = useState([]);
  const [weekly, setWeekly] = useState([]);
  const [liveClassIds, setLiveClassIds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const load = async (showLoading = true) => {
    if (showLoading) setLoading(true);
    setError(null);
    try {
      const [classroomsRes, meetingsRes] = await Promise.allSettled([
        api.get('/classrooms'),
        api.get('/classrooms/active-meetings'),
      ]);

      let classrooms = classroomsRes.status === 'fulfilled' ? normalizeListResponse(classroomsRes.value.data) : [];
      if (isStudent(user)) {
        const studentId = getEntityId(user);
        classrooms = classrooms.filter((c) =>
          (c.students || []).some((s) => getEntityId(s) === studentId) ||
          (user?.enrolledClasses || []).some((id) => getEntityId(id) === getEntityId(c))
        );
      }

      const liveIds = meetingsRes.status === 'fulfilled'
        ? normalizeListResponse(meetingsRes.value.data).map((m) => getEntityId(m?.classroomId) || getEntityId(m?.classId)).filter(Boolean)
        : [];
      setLiveClassIds(liveIds);

      const todayIndex = new Date().getDay();
      const todayFull = DAYS_FULL[todayIndex];
      setTodayName(todayFull);

      const todaySessions = [];
      const weekGrouped = { Monday: [], Tuesday: [], Wednesday: [], Thursday: [], Friday: [], Saturday: [], Sunday: [] };

      classrooms.forEach((c) => {
        if (c.schedule && Array.isArray(c.schedule)) {
          c.schedule.forEach((session) => {
            const local = convertUTCToLocal(session.dayOfWeek, session.startTime);
            const localEnd = convertUTCToLocal(session.dayOfWeek, session.endTime);
            const item = {
              classId: getEntityId(c),
              className: c.name,
              subject: c.subject,
              startTime: local.hhmm,
              endTime: localEnd.hhmm,
              day: local.dayOfWeek,
              timezone: local.timezone,
              isCurrent: liveIds.includes(getEntityId(c)),
            };
            if (local.dayOfWeek === todayFull) todaySessions.push(item);
            if (weekGrouped[local.dayOfWeek]) weekGrouped[local.dayOfWeek].push(item);
          });
        }
      });

      todaySessions.sort((a, b) => a.startTime.localeCompare(b.startTime));
      DAYS.forEach((day) => weekGrouped[day].sort((a, b) => a.startTime.localeCompare(b.startTime)));

      setToday(todaySessions);
      setWeekly(DAYS.map((day) => ({ day, sessions: weekGrouped[day] })));
    } catch (err) {
      setError(err?.response?.data?.message || 'Unable to load your schedule.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    load(false);
  };

  const todayHeader = new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'short' });

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={[styles.header, { borderBottomColor: theme.border }]}>
        <Pressable onPress={() => navigation.goBack()} style={styles.iconBtn}>
          <Ionicons name="arrow-back-outline" size={24} color={theme.text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: theme.text }]}>My Schedule</Text>
        <Pressable onPress={() => { setRefreshing(true); load(false); }} style={styles.iconBtn}>
          <Ionicons name="refresh" size={22} color={loading ? theme.muted : theme.primary} />
        </Pressable>
      </View>

      <View style={[styles.tabBar, { borderBottomColor: theme.border }]}>
        {[
          { key: 'day', label: 'Today' },
          { key: 'week', label: 'Weekly' },
        ].map((t) => (
          <Pressable
            key={t.key}
            style={[styles.tab, tab === t.key && { borderBottomColor: theme.primary }]}
            onPress={() => setTab(t.key)}
          >
            <Text style={[styles.tabText, { color: tab === t.key ? theme.primary : theme.muted }]}>{t.label}</Text>
          </Pressable>
        ))}
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={theme.primary} />
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Ionicons name="calendar-outline" size={32} color={theme.muted} />
          <Text style={[styles.errorText, { color: theme.muted }]}>{error}</Text>
          <Pressable style={[styles.retryBtn, { backgroundColor: theme.primary }]} onPress={() => { setRefreshing(true); load(false); }}>
            <Text style={[styles.retryBtnText, { color: theme.onPrimary }]}>Try again</Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />}
          showsVerticalScrollIndicator={false}
        >
          {tab === 'day' ? (
            <>
              <Text style={[styles.sectionLabel, { color: theme.muted }]}>{todayHeader}</Text>
              {today.length > 0 ? (
                <View style={styles.list}>
                  {today.map((session, idx) => (
                    <Pressable
                      key={`${session.classId}-${session.startTime}-${idx}`}
                      style={[styles.sessionCard, { backgroundColor: theme.surface, borderColor: theme.border }]}
                      onPress={() => navigation.navigate('ClassroomDetail', { classroomId: session.classId })}
                      disabled={!session.classId}
                    >
                      <View style={[styles.timeBox, { backgroundColor: theme.surfaceElevated, borderColor: theme.border }]}>
                        <Text style={[styles.timeText, { color: theme.text }]}>{session.startTime}</Text>
                        <View style={styles.timeDivider} />
                        <Text style={[styles.timezoneText, { color: theme.muted }]}>{session.timezone.replace('GMT', '')}</Text>
                      </View>
                      <View style={styles.sessionInfo}>
                        <Text style={[styles.className, { color: theme.text }]} numberOfLines={1}>{session.className}</Text>
                        <Text style={[styles.subject, { color: theme.muted }]} numberOfLines={1}>{session.subject || 'Class session'}</Text>
                        <Text style={[styles.sessionTime, { color: theme.muted }]}>
                          {session.startTime} – {session.endTime} ({session.timezone})
                        </Text>
                      </View>
                      <View style={styles.sessionRight}>
                        {session.isCurrent ? (
                          <View style={[styles.liveBadge, { backgroundColor: `${theme.danger}1A`, borderColor: theme.danger }]}>
                            <View style={[styles.liveDot, { backgroundColor: theme.danger }]} />
                            <Text style={[styles.liveText, { color: theme.danger }]}>Live</Text>
                          </View>
                        ) : null}
                        <Ionicons name="chevron-forward-outline" size={18} color={theme.muted} />
                      </View>
                    </Pressable>
                  ))}
                </View>
              ) : (
                <View style={[styles.emptyBox, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                  <Ionicons name="time-outline" size={28} color={theme.muted} />
                  <Text style={[styles.emptyText, { color: theme.muted }]}>No classes scheduled today.</Text>
                  <Text style={[styles.emptySub, { color: theme.muted }]}>Enjoy the quiet moment.</Text>
                </View>
              )}
            </>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.weekRow}>
              {weekly.map(({ day, sessions }) => (
                <View key={day} style={[styles.dayColumn, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                  <Text style={[styles.dayHeader, { color: theme.muted }]}>
                    {day.substring(0, 3).toUpperCase()}
                  </Text>
                  {sessions.length > 0 ? (
                    <View style={styles.daySessions}>
                      {sessions.map((session, idx) => (
                        <Pressable
                          key={`${day}-${session.classId}-${session.startTime}-${idx}`}
                          style={[styles.daySession, { backgroundColor: theme.surfaceElevated, borderColor: theme.border }]}
                          onPress={() => navigation.navigate('ClassroomDetail', { classroomId: session.classId })}
                          disabled={!session.classId}
                        >
                          <Text style={[styles.dayTime, { color: theme.primary }]}>{session.startTime}</Text>
                          <Text style={[styles.dayClass, { color: theme.text }]} numberOfLines={2}>{session.className}</Text>
                          {session.isCurrent ? (
                            <View style={[styles.liveDotMini, { backgroundColor: theme.danger }]} />
                          ) : null}
                        </Pressable>
                      ))}
                    </View>
                  ) : (
                    <View style={styles.quietBox}>
                      <Text style={[styles.quietText, { color: theme.muted }]}>Quiet</Text>
                    </View>
                  )}
                </View>
              ))}
            </ScrollView>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  iconBtn: { padding: 6 },
  headerTitle: { fontSize: 18, fontWeight: '800' },
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    paddingHorizontal: 16,
  },
  tab: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabText: { fontSize: 13, fontWeight: '800' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  errorText: { fontSize: 14, textAlign: 'center', lineHeight: 20, marginTop: 12 },
  retryBtn: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 12, marginTop: 14 },
  retryBtnText: { fontWeight: '800', fontSize: 13 },
  content: { padding: 16, paddingBottom: 40 },
  sectionLabel: { fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 },
  list: { gap: 10 },
  sessionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 16,
    padding: 12,
  },
  timeBox: {
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 10,
    minWidth: 64,
  },
  timeText: { fontSize: 13, fontWeight: '900' },
  timeDivider: { width: 16, height: 1, backgroundColor: 'rgba(128,128,128,0.3)', marginVertical: 3 },
  timezoneText: { fontSize: 8, fontWeight: '700', opacity: 0.7 },
  sessionInfo: { flex: 1, marginLeft: 12, minWidth: 0 },
  className: { fontSize: 15, fontWeight: '800' },
  subject: { fontSize: 11, fontWeight: '600', marginTop: 2 },
  sessionTime: { fontSize: 10, fontWeight: '600', marginTop: 3, opacity: 0.7 },
  sessionRight: { alignItems: 'flex-end', gap: 6 },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  liveDot: { width: 6, height: 6, borderRadius: 3 },
  liveText: { fontSize: 9, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.5 },
  emptyBox: {
    alignItems: 'center',
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: 16,
    paddingVertical: 40,
    paddingHorizontal: 20,
  },
  emptyText: { fontSize: 14, fontWeight: '700', marginTop: 12 },
  emptySub: { fontSize: 12, marginTop: 4 },
  weekRow: { gap: 10, paddingBottom: 8 },
  dayColumn: {
    width: 132,
    borderWidth: 1,
    borderRadius: 16,
    padding: 10,
  },
  dayHeader: { fontSize: 9, fontWeight: '900', letterSpacing: 1.5, marginBottom: 10 },
  daySessions: { gap: 8 },
  daySession: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 8,
  },
  dayTime: { fontSize: 10, fontWeight: '900' },
  dayClass: { fontSize: 11, fontWeight: '700', marginTop: 3, lineHeight: 15 },
  liveDotMini: { width: 6, height: 6, borderRadius: 3, marginTop: 6 },
  quietBox: {
    height: 44,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: 'rgba(128,128,128,0.25)',
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quietText: { fontSize: 9, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1, opacity: 0.5 },
});
