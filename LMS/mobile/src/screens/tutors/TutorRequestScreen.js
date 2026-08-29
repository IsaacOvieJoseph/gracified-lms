import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import api from '../../api/api';
import { useTheme } from '../../context/ThemeContext';

const URGENCY_OPTIONS = [
  { key: 'low', label: 'Low', icon: 'leaf-outline' },
  { key: 'medium', label: 'Medium', icon: 'speedometer-outline' },
  { key: 'high', label: 'Urgent', icon: 'flame-outline' },
];

export const STATUS_META = {
  open: { label: 'Open', color: '#f59e0b' },
  in_progress: { label: 'In Progress', color: '#3b82f6' },
  resolved: { label: 'Resolved', color: '#10b981' },
  rejected: { label: 'Not Approved', color: '#ef4444' },
};

export default function TutorRequestScreen({ navigation }) {
  const { theme } = useTheme();
  const [suggestions, setSuggestions] = useState([]);
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ subject: '', description: '', urgency: 'medium', preferredSchedule: '' });

  const load = useCallback(async (showLoading = true) => {
    if (showLoading) setLoading(true);
    setError('');
    try {
      const [sugRes, reqRes] = await Promise.all([
        api.get('/tutor-requests/suggestions').catch(() => ({ data: { suggestions: [] } })),
        api.get('/tutor-requests/mine'),
      ]);
      setSuggestions(sugRes.data?.suggestions || []);
      setRequests(reqRes.data?.requests || []);
    } catch (err) {
      setError(err?.response?.data?.message || 'Unable to load tutor matching.');
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

  const submit = async () => {
    if (!form.subject.trim() || form.description.trim().length < 10 || submitting) return;
    setSubmitting(true);
    setError('');
    try {
      await api.post('/tutor-requests', form);
      setForm({ subject: '', description: '', urgency: 'medium', preferredSchedule: '' });
      setShowForm(false);
      await load(false);
    } catch (err) {
      setError(err?.response?.data?.message || 'Could not submit your request.');
    } finally {
      setSubmitting(false);
    }
  };

  const activeCount = requests.filter((r) => ['open', 'in_progress'].includes(r.status)).length;

  const renderSuggestion = (s) => (
    <View key={String(s.tutorId)} style={[styles.sugCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      <View style={[styles.avatar, { backgroundColor: `${theme.primary}1A` }]}>
        <Text style={[styles.avatarText, { color: theme.primary }]}>{(s.name || '?').charAt(0).toUpperCase()}</Text>
        <View style={[styles.activeDot, { backgroundColor: s.isCurrentlyActive ? '#10b981' : theme.muted }]} />
      </View>
      <View style={styles.sugBody}>
        <Text style={[styles.sugName, { color: theme.text }]} numberOfLines={1}>{s.name}</Text>
        {s.reasons.map((r, i) => (
          <Text key={i} style={[styles.sugReason, { color: theme.muted }]} numberOfLines={1}>• {r}</Text>
        ))}
      </View>
      <Ionicons name="person-circle-outline" size={20} color={theme.primary} />
    </View>
  );

  const renderRequest = (r) => {
    const meta = STATUS_META[r.status];
    return (
      <Pressable
        key={r._id}
        style={[styles.reqCard, { backgroundColor: theme.surface, borderColor: theme.border }]}
        onPress={() => navigation.navigate('TutorRequestDetail', { requestId: r._id })}
      >
        <View style={styles.reqTop}>
          <Text style={[styles.reqSubject, { color: theme.text }]} numberOfLines={1}>{r.subject}</Text>
          <View style={[styles.statusBadge, { backgroundColor: `${meta.color}1A` }]}>
            <Text style={[styles.statusText, { color: meta.color }]}>{meta.label}</Text>
          </View>
        </View>
        <Text style={[styles.reqDesc, { color: theme.muted }]} numberOfLines={2}>{r.description}</Text>
        <View style={styles.reqBottom}>
          <Ionicons name="chatbubbles-outline" size={13} color={theme.muted} />
          <Text style={[styles.reqMeta, { color: theme.muted }]}>{r.messages?.length || 0} messages</Text>
          <Text style={[styles.reqDate, { color: theme.muted }]}>
            {new Date(r.createdAt).toLocaleDateString()}
          </Text>
        </View>
      </Pressable>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={[styles.header, { borderBottomColor: theme.border }]}>
        <Pressable onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back-outline" size={24} color={theme.text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: theme.text }]}>Find a Tutor</Text>
        <Pressable onPress={() => setShowForm((v) => !v)}>
          <Ionicons name={showForm ? 'close' : 'add-circle'} size={24} color={theme.primary} />
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(false); }} />}
      >
        {showForm ? (
          <View style={[styles.formCard, { backgroundColor: theme.surface, borderColor: theme.primary }]}>
            <Text style={[styles.formTitle, { color: theme.text }]}>Request a Tutor</Text>
            <Text style={[styles.formHint, { color: theme.muted }]}>
              Our team will review and connect you with the right tutor.
            </Text>

            <Text style={[styles.label, { color: theme.text }]}>Subject *</Text>
            <TextInput
              style={[styles.input, { color: theme.text, backgroundColor: theme.surfaceElevated, borderColor: theme.border }]}
              placeholder="e.g. Mathematics, Physics"
              placeholderTextColor={theme.muted}
              value={form.subject}
              onChangeText={(t) => setForm((f) => ({ ...f, subject: t }))}
              maxLength={120}
            />

            <Text style={[styles.label, { color: theme.text }]}>Describe what you need help with *</Text>
            <TextInput
              style={[styles.input, styles.textArea, { color: theme.text, backgroundColor: theme.surfaceElevated, borderColor: theme.border }]}
              placeholder="e.g. I struggle with quadratic equations and have an exam in 3 weeks..."
              placeholderTextColor={theme.muted}
              value={form.description}
              onChangeText={(t) => setForm((f) => ({ ...f, description: t }))}
              multiline
              textAlignVertical="top"
            />

            <Text style={[styles.label, { color: theme.text }]}>Preferred schedule</Text>
            <TextInput
              style={[styles.input, { color: theme.text, backgroundColor: theme.surfaceElevated, borderColor: theme.border }]}
              placeholder="e.g. Weekdays after 4pm"
              placeholderTextColor={theme.muted}
              value={form.preferredSchedule}
              onChangeText={(t) => setForm((f) => ({ ...f, preferredSchedule: t }))}
              maxLength={200}
            />

            <Text style={[styles.label, { color: theme.text }]}>Urgency</Text>
            <View style={styles.urgencyRow}>
              {URGENCY_OPTIONS.map((u) => (
                <Pressable
                  key={u.key}
                  style={[
                    styles.urgencyChip,
                    { borderColor: form.urgency === u.key ? theme.primary : theme.border },
                    form.urgency === u.key && { backgroundColor: `${theme.primary}1A` },
                  ]}
                  onPress={() => setForm((f) => ({ ...f, urgency: u.key }))}
                >
                  <Ionicons name={u.icon} size={14} color={form.urgency === u.key ? theme.primary : theme.muted} />
                  <Text style={[styles.urgencyText, { color: form.urgency === u.key ? theme.primary : theme.muted }]}>{u.label}</Text>
                </Pressable>
              ))}
            </View>

            {error ? <Text style={[styles.error, { color: theme.danger }]}>{error}</Text> : null}

            <Pressable
              style={[styles.submitBtn, { backgroundColor: theme.primary }, (!form.subject.trim() || form.description.trim().length < 10 || submitting) && { opacity: 0.5 }]}
              onPress={submit}
              disabled={!form.subject.trim() || form.description.trim().length < 10 || submitting}
            >
              {submitting ? (
                <ActivityIndicator color={theme.onPrimary} size="small" />
              ) : (
                <>
                  <Ionicons name="send" size={16} color={theme.onPrimary} />
                  <Text style={[styles.submitText, { color: theme.onPrimary }]}>Submit Request</Text>
                </>
              )}
            </Pressable>
          </View>
        ) : null}

        <View style={styles.sectionHeader}>
          <Ionicons name="sparkles-outline" size={16} color={theme.primary} />
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Suggested for you</Text>
        </View>
        <Text style={[styles.sectionHint, { color: theme.muted }]}>
          Based on your classes and tutors active right now.
        </Text>
        {loading ? (
          <ActivityIndicator style={{ marginVertical: 20 }} color={theme.primary} />
        ) : suggestions.length > 0 ? (
          <View style={styles.sugList}>{suggestions.map(renderSuggestion)}</View>
        ) : (
          <Text style={[styles.emptySmall, { color: theme.muted }]}>No tutor matches found yet.</Text>
        )}

        <View style={[styles.divider, { borderColor: theme.border }]} />

        <View style={styles.sectionHeader}>
          <Ionicons name="document-text-outline" size={16} color={theme.primary} />
          <Text style={[styles.sectionTitle, { color: theme.text }]}>My Requests</Text>
          {activeCount > 0 && (
            <View style={[styles.countBadge, { backgroundColor: `${theme.primary}1A` }]}>
              <Text style={[styles.countText, { color: theme.primary }]}>{activeCount}</Text>
            </View>
          )}
        </View>
        {requests.length > 0 ? (
          <View style={styles.reqList}>{requests.map(renderRequest)}</View>
        ) : (
          <View style={[styles.emptyCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Ionicons name="people-outline" size={28} color={theme.muted} />
            <Text style={[styles.emptyTitle, { color: theme.text }]}>No requests yet</Text>
            <Text style={[styles.emptyText, { color: theme.muted }]}>
              Didn&apos;t find a match above? Tap + to request a tutor and our team will find one for you.
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
  formCard: { borderWidth: 1.5, borderRadius: 18, padding: 18, marginBottom: 22 },
  formTitle: { fontSize: 16, fontWeight: '800' },
  formHint: { fontSize: 12, lineHeight: 17, marginTop: 4, marginBottom: 14 },
  label: { fontSize: 12, fontWeight: '700', marginTop: 12, marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 14,
  },
  textArea: { minHeight: 90, paddingTop: 11 },
  urgencyRow: { flexDirection: 'row', gap: 8 },
  urgencyChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    flex: 1,
    justifyContent: 'center',
  },
  urgencyText: { fontSize: 12, fontWeight: '700' },
  error: { fontSize: 12, marginTop: 10 },
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    borderRadius: 14,
    paddingVertical: 14,
    marginTop: 16,
  },
  submitText: { fontWeight: '800', fontSize: 14 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  sectionTitle: { fontSize: 15, fontWeight: '800' },
  sectionHint: { fontSize: 11, marginTop: 3, marginBottom: 10 },
  sugList: { gap: 8 },
  sugCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    gap: 11,
  },
  avatar: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 16, fontWeight: '800' },
  activeDot: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 2,
    borderColor: '#fff',
  },
  sugBody: { flex: 1 },
  sugName: { fontSize: 14, fontWeight: '700' },
  sugReason: { fontSize: 11, lineHeight: 15, marginTop: 1 },
  divider: { borderTopWidth: 1, marginVertical: 20 },
  countBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999 },
  countText: { fontSize: 11, fontWeight: '800' },
  reqList: { gap: 10, marginTop: 10 },
  reqCard: { borderWidth: 1, borderRadius: 14, padding: 14 },
  reqTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  reqSubject: { fontSize: 14, fontWeight: '800', flexShrink: 1 },
  statusBadge: { paddingHorizontal: 9, paddingVertical: 3, borderRadius: 999 },
  statusText: { fontSize: 10, fontWeight: '800' },
  reqDesc: { fontSize: 12, lineHeight: 17, marginTop: 5 },
  reqBottom: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 9 },
  reqMeta: { fontSize: 11, fontWeight: '600' },
  reqDate: { fontSize: 11, marginLeft: 'auto' },
  emptyCard: { alignItems: 'center', borderWidth: 1, borderRadius: 16, padding: 24, marginTop: 10 },
  emptyTitle: { fontSize: 15, fontWeight: '800', marginTop: 10 },
  emptyText: { fontSize: 12, textAlign: 'center', lineHeight: 17, marginTop: 5 },
  emptySmall: { fontSize: 12, marginVertical: 8 },
});
