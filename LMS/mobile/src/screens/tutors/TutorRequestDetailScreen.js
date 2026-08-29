import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import api from '../../api/api';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';

const STATUS_META = {
  open: { label: 'Open', color: '#f59e0b' },
  in_progress: { label: 'In Progress', color: '#3b82f6' },
  resolved: { label: 'Resolved', color: '#10b981' },
  rejected: { label: 'Not Approved', color: '#ef4444' },
};

export default function TutorRequestDetailScreen({ route, navigation }) {
  const { requestId } = route.params || {};
  const { theme } = useTheme();
  const { user } = useAuth();
  const [request, setRequest] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [reply, setReply] = useState('');
  const [error, setError] = useState('');
  const scrollRef = useRef(null);

  const load = useCallback(async () => {
    try {
      const res = await api.get(`/tutor-requests/${requestId}`);
      setRequest(res.data?.request || null);
      setError('');
    } catch (err) {
      setError(err?.response?.data?.message || 'Unable to load this request.');
    } finally {
      setLoading(false);
    }
  }, [requestId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (request?.messages?.length) {
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [request]);

  const send = async () => {
    const msg = reply.trim();
    if (!msg || sending) return;
    setSending(true);
    try {
      const res = await api.post(`/tutor-requests/${requestId}/messages`, { message: msg });
      setRequest(res.data?.request);
      setReply('');
    } catch (err) {
      setError(err?.response?.data?.message || 'Could not send your message.');
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
        <View style={styles.center}><ActivityIndicator size="large" color={theme.primary} /></View>
      </SafeAreaView>
    );
  }

  if (!request) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
        <View style={[styles.header, { borderBottomColor: theme.border }]}>
          <Pressable onPress={() => navigation.goBack()}><Ionicons name="arrow-back-outline" size={24} color={theme.text} /></Pressable>
          <Text style={[styles.headerTitle, { color: theme.text }]}>Request</Text>
          <View style={{ width: 24 }} />
        </View>
        <View style={styles.center}>
          <Ionicons name="alert-circle-outline" size={32} color={theme.muted} />
          <Text style={[styles.emptyText, { color: theme.muted }]}>{error || 'Request not found.'}</Text>
        </View>
      </SafeAreaView>
    );
  }

  const meta = STATUS_META[request.status];
  const isClosed = ['resolved', 'rejected'].includes(request.status);
  const viewerRole = ['student', 'personal_teacher', 'root_admin'].includes(user?.role) ? user.role : 'student';
  const viewerIsStudent = viewerRole === 'student';
  const authorOf = (m) => {
    if (m.senderRole === viewerRole) return 'You';
    if (m.senderRole === 'personal_teacher') return m.senderId?.name || request.referral?.tutorName || 'Your Tutor';
    if (m.senderRole === 'root_admin') return 'Gracified Team';
    return m.senderId?.name || 'Student';
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={[styles.header, { borderBottomColor: theme.border }]}>
        <Pressable onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back-outline" size={24} color={theme.text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: theme.text }]} numberOfLines={1}>{request.subject}</Text>
        <View style={[styles.statusBadge, { backgroundColor: `${meta.color}1A` }]}>
          <Text style={[styles.statusText, { color: meta.color }]}>{meta.label}</Text>
        </View>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView ref={scrollRef} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={[styles.detailCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Text style={[styles.label, { color: theme.muted }]}>What you need help with</Text>
            <Text style={[styles.description, { color: theme.text }]}>{request.description}</Text>
            <View style={styles.metaRow}>
              <Ionicons name="speedometer-outline" size={13} color={theme.muted} />
              <Text style={[styles.metaText, { color: theme.muted }]}>Urgency: {request.urgency}</Text>
            </View>
            {request.preferredSchedule ? (
              <View style={styles.metaRow}>
                <Ionicons name="time-outline" size={13} color={theme.muted} />
                <Text style={[styles.metaText, { color: theme.muted }]}>Preferred: {request.preferredSchedule}</Text>
              </View>
            ) : null}
          </View>

          {isClosed && request.referral?.givenAt ? (
            <View style={[styles.referralCard, { backgroundColor: `${theme.success}14`, borderColor: theme.success }]}>
              <View style={styles.referralHeader}>
                <Ionicons name="checkmark-done-circle" size={20} color={theme.success} />
                <Text style={[styles.referralTitle, { color: theme.success }]}>Tutor Referral</Text>
              </View>
              <Text style={[styles.referralName, { color: theme.text }]}>{request.referral.tutorName}</Text>
              {request.referral.tutorContact ? (
                <Text style={[styles.referralLine, { color: theme.muted }]}>Contact: {request.referral.tutorContact}</Text>
              ) : null}
              {request.referral.notes ? (
                <Text style={[styles.referralLine, { color: theme.muted }]}>{request.referral.notes}</Text>
              ) : null}
            </View>
          ) : null}

          {request.status === 'rejected' && !request.referral?.givenAt ? (
            <View style={[styles.rejectedCard, { backgroundColor: `${theme.danger}14`, borderColor: theme.danger }]}>
              <Ionicons name="close-circle" size={18} color={theme.danger} />
              <Text style={[styles.rejectedText, { color: theme.danger }]}>This request was reviewed and could not be approved.</Text>
            </View>
          ) : null}

          {!isClosed ? (
            <>
              <View style={styles.sectionHeader}>
                <Ionicons name="chatbubbles-outline" size={15} color={theme.primary} />
                <Text style={[styles.sectionTitle, { color: theme.text }]}>Conversation</Text>
              </View>
              {request.messages.length === 0 ? (
                <Text style={[styles.threadEmpty, { color: theme.muted }]}>
                  Our team has been notified. Replies will appear here.
                </Text>
              ) : (
                <View style={styles.thread}>
                  {request.messages.map((m, i) => {
                    const mine = m.senderRole === viewerRole;
                    const author = authorOf(m);
                    return (
                      <View
                        key={i}
                        style={[
                          styles.bubble,
                          mine
                            ? [styles.userBubble, { backgroundColor: theme.primary }]
                            : [styles.adminBubble, { backgroundColor: theme.surface, borderColor: theme.border }],
                        ]}
                      >
                        <Text style={[styles.bubbleAuthor, { color: mine ? `${theme.onPrimary}CC` : theme.primary }]}>
                          {author}
                        </Text>
                        <Text style={[styles.bubbleText, { color: mine ? theme.onPrimary : theme.text }]}>
                          {m.message}
                        </Text>
                      </View>
                    );
                  })}
                </View>
              )}
            </>
          ) : null}

          {error ? <Text style={[styles.error, { color: theme.danger }]}>{error}</Text> : null}
        </ScrollView>

        {!isClosed ? (
          <View style={[styles.inputBar, { backgroundColor: theme.surface, borderTopColor: theme.border }]}>
            <TextInput
              style={[styles.input, { color: theme.text }]}
              placeholder="Type a message..."
              placeholderTextColor={theme.muted}
              value={reply}
              onChangeText={setReply}
              multiline
            />
            <Pressable
              onPress={send}
              disabled={sending || !reply.trim()}
              style={[styles.sendBtn, { backgroundColor: theme.primary }, (sending || !reply.trim()) && { opacity: 0.4 }]}
            >
              {sending ? <ActivityIndicator color={theme.onPrimary} size="small" /> : <Ionicons name="send" size={16} color={theme.onPrimary} />}
            </Pressable>
          </View>
        ) : null}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, padding: 32 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  headerTitle: { fontSize: 17, fontWeight: '800', flexShrink: 1 },
  statusBadge: { paddingHorizontal: 9, paddingVertical: 3, borderRadius: 999, marginLeft: 'auto' },
  statusText: { fontSize: 10, fontWeight: '800' },
  content: { padding: 16, paddingBottom: 30 },
  detailCard: { borderWidth: 1, borderRadius: 16, padding: 16 },
  label: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  description: { fontSize: 14, lineHeight: 20, marginTop: 6 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 8 },
  metaText: { fontSize: 12, fontWeight: '600' },
  referralCard: { borderWidth: 1.5, borderRadius: 16, padding: 16, marginTop: 14 },
  referralHeader: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  referralTitle: { fontSize: 13, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 },
  referralName: { fontSize: 18, fontWeight: '900', marginTop: 8 },
  referralLine: { fontSize: 13, lineHeight: 18, marginTop: 4 },
  rejectedCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1.5,
    borderRadius: 14,
    padding: 14,
    marginTop: 14,
  },
  rejectedText: { fontSize: 13, fontWeight: '600', flex: 1, lineHeight: 18 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 22, marginBottom: 10 },
  sectionTitle: { fontSize: 13, fontWeight: '800' },
  threadEmpty: { fontSize: 12, lineHeight: 17 },
  thread: { gap: 10 },
  bubble: { borderRadius: 16, paddingHorizontal: 14, paddingVertical: 10, maxWidth: '92%' },
  userBubble: { alignSelf: 'flex-end', borderBottomRightRadius: 4 },
  adminBubble: { alignSelf: 'flex-start', borderWidth: 1, borderBottomLeftRadius: 4 },
  bubbleAuthor: { fontSize: 10, fontWeight: '800', marginBottom: 2 },
  bubbleText: { fontSize: 14, lineHeight: 19 },
  error: { fontSize: 12, marginTop: 10 },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
    borderTopWidth: 1,
    padding: 10,
  },
  input: { flex: 1, fontSize: 14, maxHeight: 90, paddingTop: 6 },
  sendBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
