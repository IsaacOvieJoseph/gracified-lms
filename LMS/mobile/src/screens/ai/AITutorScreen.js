import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import api from '../../api/api';
import { useTheme } from '../../context/ThemeContext';
import KeyboardAwareScrollView from '../../components/ui/KeyboardAwareScrollView';

export default function AITutorScreen({ route, navigation }) {
  const { theme } = useTheme();
  const { topicId, subject, context } = route.params || {};

  const [access, setAccess] = useState(null);
  const [accessLoading, setAccessLoading] = useState(true);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [sessionId, setSessionId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showGrowth, setShowGrowth] = useState(false);
  const [growth, setGrowth] = useState(null);
  const [growthLoading, setGrowthLoading] = useState(false);
  const scrollRef = useRef(null);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      setAccessLoading(true);
      try {
        const res = await api.get('/ai/tutor/access');
        if (!mounted) return;
        setAccess(res.data);
        if (res.data?.enabled) {
          try {
            const historyRes = await api.get('/ai/tutor/history');
            if (!mounted) return;
            const sessions = historyRes.data?.history || [];
            const match = topicId
              ? sessions.find((s) => String(s.topicId || '') === String(topicId))
              : sessions[0];
            if (match) setSessionId(match._id);
          } catch (_) { /* history load is best-effort */ }
        }
      } catch (err) {
        if (mounted) setError(err?.response?.data?.message || 'Unable to check AI Tutor access.');
      } finally {
        if (mounted) setAccessLoading(false);
      }
    };
    load();
    return () => { mounted = false; };
  }, [topicId]);

  const send = async () => {
    const question = input.trim();
    if (!question || loading) return;
    setMessages((prev) => [...prev, { role: 'user', content: question }]);
    setInput('');
    setLoading(true);
    setError('');
    try {
      const res = await api.post('/ai/tutor/chat', { question, context: context || subject || '', topicId, sessionId });
      const data = res.data;
      setSessionId(data.sessionId);
      setMessages((prev) => [...prev, { role: 'assistant', content: data.answer, followUps: data.suggestedFollowUp || [] }]);
      setAccess((prev) => prev ? { ...prev, usedToday: (prev.usedToday || 0) + 1, remaining: Math.max(0, (prev.remaining || 1) - 1) } : prev);
    } catch (err) {
      setError(err?.response?.data?.message || 'AI Tutor is unavailable right now. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const loadGrowth = async () => {
    setShowGrowth((prev) => !prev);
    if (showGrowth || growthLoading || growth) return;
    setGrowthLoading(true);
    try {
      const res = await api.get('/ai/tutor/progress');
      setGrowth(res.data);
      setAccess((prev) => prev ? { ...prev, usedToday: (prev.usedToday || 0) + 1, remaining: Math.max(0, (prev.remaining || 1) - 1) } : prev);
    } catch (err) {
      Alert.alert('Growth report unavailable', err?.response?.data?.message || 'Please try again later.');
    } finally {
      setGrowthLoading(false);
    }
  };

  if (accessLoading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
        <View style={styles.loading}>
          <ActivityIndicator size="large" color={theme.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (!access?.enabled) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
        <View style={[styles.header, { borderBottomColor: theme.border }]}>
          <Pressable onPress={() => navigation.goBack()}><Ionicons name="arrow-back-outline" size={24} color={theme.text} /></Pressable>
          <Text style={[styles.headerTitle, { color: theme.text }]}>AI Tutor</Text>
          <View style={{ width: 24 }} />
        </View>
        <View style={styles.restricted}>
          <Ionicons name="sparkles-outline" size={34} color={theme.muted} />
          <Text style={[styles.restrictedTitle, { color: theme.text }]}>AI Tutor unavailable</Text>
          <Text style={[styles.restrictedText, { color: theme.muted }]}>
            AI Tutor has not been enabled for your account. Contact your academy administrator to request access.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const quickChips = messages.length && messages[messages.length - 1]?.followUps?.length
    ? messages[messages.length - 1].followUps
    : [];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={[styles.header, { borderBottomColor: theme.border }]}>
        <Pressable onPress={() => navigation.goBack()}><Ionicons name="arrow-back-outline" size={24} color={theme.text} /></Pressable>
        <Text style={[styles.headerTitle, { color: theme.text }]}>AI Tutor</Text>
        <Pressable onPress={loadGrowth} disabled={growthLoading}>
          <Ionicons name="trending-up-outline" size={22} color={growthLoading ? theme.muted : theme.primary} />
        </Pressable>
      </View>

      <KeyboardAwareScrollView
        ref={scrollRef}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        {subject ? <Text style={[styles.subject, { color: theme.muted }]}>Studying: {subject}</Text> : null}
        {access ? (
          <Text style={[styles.quota, { color: theme.muted }]}>
            Daily AI Tutor quota: {access.remaining} of {access.dailyLimit} remaining
          </Text>
        ) : null}

        <View style={styles.actionsRow}>
          <Pressable
            style={[styles.actionBtn, { backgroundColor: `${theme.primary}1A`, borderColor: theme.primary }]}
            onPress={() => navigation.navigate('AITutorQuiz', { topicId, subject, context: context || subject || '', sessionId })}
          >
            <Ionicons name="clipboard-outline" size={18} color={theme.primary} />
            <Text style={[styles.actionBtnText, { color: theme.primary }]}>Practice Quiz</Text>
          </Pressable>
          <Pressable
            style={[styles.actionBtn, { backgroundColor: theme.surface, borderColor: theme.border }]}
            onPress={loadGrowth}
          >
            <Ionicons name="trending-up-outline" size={18} color={theme.text} />
            <Text style={[styles.actionBtnText, { color: theme.text }]}>My Growth</Text>
          </Pressable>
        </View>

        {showGrowth && (
          <View style={[styles.growthCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            {growthLoading ? (
              <ActivityIndicator color={theme.primary} style={{ padding: 16 }} />
            ) : growth ? (
              <>
                <Text style={[styles.growthTitle, { color: theme.text }]}>Your growth</Text>
                <View style={styles.metricRow}>
                  {[
                    ['Topics', growth.metrics?.topicsCompleted || 0],
                    ['Assignments avg', growth.metrics?.assignmentAverage ?? '—'],
                    ['Exams avg', growth.metrics?.examAverage ?? '—'],
                    ['AI quizzes avg', growth.metrics?.aiQuizAverage ?? '—'],
                  ].map(([label, value]) => (
                    <View key={label} style={[styles.metricChip, { backgroundColor: theme.surfaceElevated, borderColor: theme.border }]}>
                      <Text style={[styles.metricValue, { color: theme.text }]}>{typeof value === 'number' ? `${value}%` : value}</Text>
                      <Text style={[styles.metricLabel, { color: theme.muted }]}>{label}</Text>
                    </View>
                  ))}
                </View>
                {growth.summary ? <Text style={[styles.growthText, { color: theme.text }]}>{growth.summary}</Text> : null}
                {growth.nextStep ? (
                  <View style={[styles.nextStep, { backgroundColor: `${theme.success}1A`, borderColor: theme.success }]}>
                    <Ionicons name="sparkles-outline" size={16} color={theme.success} />
                    <Text style={[styles.nextStepText, { color: theme.text }]}>{growth.nextStep}</Text>
                  </View>
                ) : null}
              </>
            ) : null}
          </View>
        )}

        {messages.length === 0 ? (
          <View style={[styles.welcome, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Ionicons name="sparkles-outline" size={30} color={theme.primary} />
            <Text style={[styles.welcomeTitle, { color: theme.text }]}>Ask me anything</Text>
            <Text style={[styles.welcomeText, { color: theme.muted }]}>
              I can help you understand concepts, work through problems, or quiz yourself. Just type a question below.
            </Text>
          </View>
        ) : (
          <View style={styles.messages}>
            {messages.map((msg, index) => (
              <View
                key={index}
                style={[
                  styles.bubble,
                  msg.role === 'user'
                    ? [styles.userBubble, { backgroundColor: theme.primary }]
                    : [styles.assistantBubble, { backgroundColor: theme.surface, borderColor: theme.border }],
                ]}
              >
                <Text style={[styles.bubbleText, { color: msg.role === 'user' ? theme.onPrimary : theme.text }]}>
                  {msg.content}
                </Text>
              </View>
            ))}
          </View>
        )}

        {quickChips.length > 0 && (
          <View style={styles.chips}>
            {quickChips.map((chip) => (
              <Pressable key={chip} style={[styles.chip, { backgroundColor: theme.surfaceElevated, borderColor: theme.border }]} onPress={() => setInput(chip)}>
                <Text style={[styles.chipText, { color: theme.text }]} numberOfLines={1}>{chip}</Text>
              </Pressable>
            ))}
          </View>
        )}

        {error ? <Text style={[styles.error, { color: theme.danger }]}>{error}</Text> : null}

        <View style={[styles.inputBar, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <TextInput
            style={[styles.input, { color: theme.text }]}
            placeholder="Ask a question..."
            placeholderTextColor={theme.muted}
            value={input}
            onChangeText={setInput}
            multiline
          />
          <Pressable
            onPress={send}
            disabled={loading || !input.trim()}
            style={[styles.sendBtn, { backgroundColor: theme.primary }, (loading || !input.trim()) && { opacity: 0.4 }]}
          >
            {loading ? <ActivityIndicator color={theme.onPrimary} size="small" /> : <Ionicons name="send" size={17} color={theme.onPrimary} />}
          </Pressable>
        </View>
      </KeyboardAwareScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  headerTitle: { fontSize: 18, fontWeight: '800' },
  restricted: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  restrictedTitle: { fontSize: 18, fontWeight: '800', marginTop: 14 },
  restrictedText: { fontSize: 13, textAlign: 'center', lineHeight: 19, marginTop: 8 },
  content: { padding: 16, paddingBottom: 40 },
  subject: { fontSize: 12, fontWeight: '700', marginBottom: 6 },
  quota: { fontSize: 11, fontWeight: '600', marginBottom: 14 },
  actionsRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
  },
  actionBtnText: { fontSize: 12, fontWeight: '800' },
  growthCard: { borderWidth: 1, borderRadius: 16, padding: 16, marginBottom: 16 },
  growthTitle: { fontSize: 15, fontWeight: '800', marginBottom: 12 },
  metricRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  metricChip: { borderRadius: 10, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 8, minWidth: 80 },
  metricValue: { fontSize: 16, fontWeight: '800' },
  metricLabel: { fontSize: 10, fontWeight: '600', marginTop: 2 },
  growthText: { fontSize: 14, lineHeight: 21 },
  nextStep: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginTop: 12,
  },
  nextStepText: { flex: 1, fontSize: 13, lineHeight: 19, fontWeight: '600' },
  welcome: { alignItems: 'center', borderWidth: 1, borderRadius: 18, padding: 24, marginBottom: 16 },
  welcomeTitle: { fontSize: 17, fontWeight: '800', marginTop: 10 },
  welcomeText: { fontSize: 13, textAlign: 'center', lineHeight: 19, marginTop: 6 },
  messages: { gap: 10, marginBottom: 12 },
  bubble: { borderRadius: 16, paddingHorizontal: 14, paddingVertical: 11, maxWidth: '92%' },
  userBubble: { alignSelf: 'flex-end', borderBottomRightRadius: 4 },
  assistantBubble: { alignSelf: 'flex-start', borderWidth: 1, borderBottomLeftRadius: 4 },
  bubbleText: { fontSize: 14, lineHeight: 20 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  chip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8, maxWidth: '100%' },
  chipText: { fontSize: 12, fontWeight: '700' },
  error: { fontSize: 13, marginBottom: 10 },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
    borderWidth: 1,
    borderRadius: 16,
    padding: 10,
  },
  input: { flex: 1, fontSize: 14, maxHeight: 100, paddingTop: 4 },
  sendBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
