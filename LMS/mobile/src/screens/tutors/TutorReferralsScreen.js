import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import api from '../../api/api';
import { useTheme } from '../../context/ThemeContext';

const STATUS_META = {
  open: { label: 'Open', color: '#f59e0b' },
  in_progress: { label: 'In Progress', color: '#3b82f6' },
  resolved: { label: 'Resolved', color: '#10b981' },
  rejected: { label: 'Not Approved', color: '#ef4444' },
};

export default function TutorReferralsScreen({ navigation }) {
  const { theme } = useTheme();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async (showLoading = true) => {
    if (showLoading) setLoading(true);
    setError('');
    try {
      const res = await api.get('/tutor-requests/referred');
      setRequests(res.data?.requests || []);
    } catch (err) {
      setError(err?.response?.data?.message || 'Unable to load referrals.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const unsub = navigation.addListener('focus', () => load(false));
    return unsub;
  }, [navigation, load]);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={[styles.header, { borderBottomColor: theme.border }]}>
        <Pressable onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back-outline" size={24} color={theme.text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: theme.text }]}>Student Referrals</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(false); }} />}
      >
        <Text style={[styles.hint, { color: theme.muted }]}>
          Students matched to you by the Gracified team. Reach out and start teaching.
        </Text>

        {error ? <Text style={[styles.error, { color: theme.danger }]}>{error}</Text> : null}

        {loading ? (
          <ActivityIndicator style={{ marginVertical: 24 }} color={theme.primary} />
        ) : requests.length > 0 ? (
          <View style={styles.list}>
            {requests.map((r) => {
              const meta = STATUS_META[r.status];
              const unread = (r.messages || []).filter((m) => m.senderRole === 'student' && !m.readByTutor).length;
              return (
                <Pressable
                  key={r._id}
                  style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}
                  onPress={() => navigation.navigate('TutorRequestDetail', { requestId: r._id })}
                >
                  <View style={styles.cardTop}>
                    <View style={[styles.avatar, { backgroundColor: `${theme.primary}1A` }]}>
                      <Text style={[styles.avatarText, { color: theme.primary }]}>
                        {(r.studentId?.name || 'S').charAt(0).toUpperCase()}
                      </Text>
                    </View>
                    <View style={styles.cardBody}>
                      <View style={styles.nameRow}>
                        <Text style={[styles.studentName, { color: theme.text }]} numberOfLines={1}>
                          {r.studentId?.name || 'Student'}
                        </Text>
                        <View style={[styles.statusBadge, { backgroundColor: `${meta.color}1A` }]}>
                          <Text style={[styles.statusText, { color: meta.color }]}>{meta.label}</Text>
                        </View>
                      </View>
                      <Text style={[styles.subject, { color: theme.muted }]} numberOfLines={1}>{r.subject}</Text>
                    </View>
                    {unread > 0 ? (
                      <View style={[styles.unreadBadge, { backgroundColor: theme.primary }]}>
                        <Text style={[styles.unreadText, { color: theme.onPrimary }]}>{unread}</Text>
                      </View>
                    ) : null}
                  </View>
                  <Text style={[styles.desc, { color: theme.muted }]} numberOfLines={2}>{r.description}</Text>
                  <View style={styles.cardBottom}>
                    <Ionicons name="calendar-outline" size={13} color={theme.muted} />
                    <Text style={[styles.metaText, { color: theme.muted }]}>
                      {new Date(r.createdAt).toLocaleDateString()}
                    </Text>
                    <Text style={[styles.metaText, { color: theme.muted }]}>
                      • {(r.messages || []).length} messages
                    </Text>
                    <Ionicons name="chevron-forward" size={15} color={theme.primary} style={{ marginLeft: 'auto' }} />
                  </View>
                </Pressable>
              );
            })}
          </View>
        ) : (
          <View style={[styles.emptyCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Ionicons name="people-outline" size={30} color={theme.muted} />
            <Text style={[styles.emptyTitle, { color: theme.text }]}>No referrals yet</Text>
            <Text style={[styles.emptyText, { color: theme.muted }]}>
              When a student requests a tutor and you&apos;re matched, it will appear here.
            </Text>
          </View>
        )}
      </ScrollView>
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
  headerTitle: { fontSize: 18, fontWeight: '800' },
  content: { padding: 16, paddingBottom: 40 },
  hint: { fontSize: 12, lineHeight: 17, marginBottom: 14 },
  error: { fontSize: 12, marginBottom: 10 },
  list: { gap: 10 },
  card: { borderWidth: 1, borderRadius: 14, padding: 14 },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  avatar: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 15, fontWeight: '800' },
  cardBody: { flex: 1 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  studentName: { fontSize: 14, fontWeight: '800', flexShrink: 1 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999 },
  statusText: { fontSize: 10, fontWeight: '800' },
  subject: { fontSize: 12, fontWeight: '600', marginTop: 2 },
  unreadBadge: { minWidth: 19, height: 19, borderRadius: 10, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5 },
  unreadText: { fontSize: 10, fontWeight: '800' },
  desc: { fontSize: 12, lineHeight: 17, marginTop: 9 },
  cardBottom: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 9 },
  metaText: { fontSize: 11, fontWeight: '600' },
  emptyCard: { alignItems: 'center', borderWidth: 1, borderRadius: 16, padding: 24, marginTop: 10 },
  emptyTitle: { fontSize: 15, fontWeight: '800', marginTop: 10 },
  emptyText: { fontSize: 12, textAlign: 'center', lineHeight: 17, marginTop: 5 },
});