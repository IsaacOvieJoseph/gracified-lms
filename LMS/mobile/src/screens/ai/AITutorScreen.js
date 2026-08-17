import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import api from '../../api/api';
import { useTheme } from '../../context/ThemeContext';
import KeyboardAwareScrollView from '../../components/ui/KeyboardAwareScrollView';
import { isPracticeRequest, extractPracticeArea, extractPracticeQuantity, extractPracticeQuantityFromMessage, isQuantityOnly } from '../../utils/tutor';

export default function AITutorScreen({ route, navigation }) {
  const { theme } = useTheme();
  const { topicId, subject, context } = route.params || {};

  const [access, setAccess] = useState(null);
  const [accessLoading, setAccessLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('chat');
  const [quizArea, setQuizArea] = useState('');
  const [quizGeneral, setQuizGeneral] = useState(false);
  const [quizCount, setQuizCount] = useState('5');
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [pendingPractice, setPendingPractice] = useState(null);
  const [sessionId, setSessionId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
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
        if (mounted) setError(err?.response?.data?.message || 'Unable to check Gracy access.');
      } finally {
        if (mounted) setAccessLoading(false);
      }
    };
    load();
    return () => { mounted = false; };
  }, [topicId]);

  useEffect(() => {
    if (messages.length) {
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [messages]);

  const startQuiz = (area, general, questionCount) => {
    const trimmed = (area || '').trim();
    const useArea = !!trimmed;
    const useGeneral = general && !useArea;
    const count = Math.min(Math.max(parseInt(questionCount) || 5, 1), 20);
    navigation.navigate('AITutorQuiz', {
      topicId: useArea || useGeneral ? null : topicId,
      subject,
      area: trimmed,
      general: useGeneral,
      questionCount: count,
    });
  };

  const send = async () => {
    const question = input.trim();
    if (!question || loading) return;
    setMessages((prev) => [...prev, { role: 'user', content: question }]);
    setInput('');

    if (pendingPractice) {
      const qty = extractPracticeQuantityFromMessage(question);
      if (qty || isQuantityOnly(question)) {
        const count = qty || parseInt(question, 10) || 5;
        const area = pendingPractice.area;
        setPendingPractice(null);
        startQuiz(area, !area, count);
        return;
      }
      setPendingPractice(null);
    }

    if (isPracticeRequest(question)) {
      const area = extractPracticeArea(question);
      const qty = extractPracticeQuantityFromMessage(question);
      if (qty) {
        startQuiz(area || '', !area, qty);
        return;
      }
      setPendingPractice({ area: area || '' });
      setMessages((prev) => [...prev, {
        role: 'assistant',
        content: area
          ? `Great! How many questions would you like for your ${area} quiz?`
          : 'How many questions would you like? (1-20)',
        followUps: ['5 questions', '10 questions', '15 questions'],
      }]);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await api.post('/ai/tutor/chat', { question, context: context || subject || '', topicId, sessionId });
      const data = res.data;
      setSessionId(data.sessionId);
      setMessages((prev) => [...prev, { role: 'assistant', content: data.answer, followUps: data.suggestedFollowUp || [] }]);
      setAccess((prev) => prev ? { ...prev, usedToday: (prev.usedToday || 0) + 1, remaining: Math.max(0, (prev.remaining || 1) - 1) } : prev);
    } catch (err) {
      if (err?.response?.status === 429) {
        setError(err?.response?.data?.message || 'You have used up today\u2019s Gracy quota.');
      } else {
        setError(err?.response?.data?.message || 'Gracy is unavailable right now. Please try again.');
      }
    } finally {
      setLoading(false);
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
          <Text style={[styles.headerTitle, { color: theme.text }]}>Gracy</Text>
          <View style={{ width: 24 }} />
        </View>
        <View style={styles.restricted}>
          <Ionicons name="sparkles-outline" size={34} color={theme.muted} />
          <Text style={[styles.restrictedTitle, { color: theme.text }]}>Gracy unavailable</Text>
          <Text style={[styles.restrictedText, { color: theme.muted }]}>
            Gracy has not been enabled for your account. Contact your academy administrator to request access.
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
        <Text style={[styles.headerTitle, { color: theme.text }]}>Gracy</Text>
        <Pressable onPress={() => navigation.navigate('AITutorGrowth')}>
          <Ionicons name="trending-up-outline" size={22} color={theme.primary} />
        </Pressable>
      </View>

      <View style={[styles.tabBar, { borderBottomColor: theme.border }]}>
        {[
          { key: 'quiz', label: 'Practice Quiz', icon: 'clipboard-outline' },
          { key: 'chat', label: 'Chat', icon: 'chatbubbles-outline' },
        ].map((tab) => (
          <Pressable
            key={tab.key}
            style={[
              styles.tab,
              activeTab === tab.key && { borderBottomColor: theme.primary },
            ]}
            onPress={() => setActiveTab(tab.key)}
          >
            <Ionicons
              name={tab.icon}
              size={16}
              color={activeTab === tab.key ? theme.primary : theme.muted}
            />
            <Text
              style={[
                styles.tabText,
                { color: activeTab === tab.key ? theme.primary : theme.muted },
              ]}
            >
              {tab.label}
            </Text>
          </Pressable>
        ))}
      </View>

      <KeyboardAwareScrollView
        ref={scrollRef}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        {subject ? <Text style={[styles.subject, { color: theme.muted }]}>Studying: {subject}</Text> : null}
        {access ? (
          <Text style={[styles.quota, { color: theme.muted }]}>
            Daily Gracy quota: {access.remaining} of {access.dailyLimit} remaining
          </Text>
        ) : null}

        {activeTab === 'quiz' ? (
          <View style={[styles.quizSetup, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Text style={[styles.quizSetupTitle, { color: theme.text }]}>Create a practice quiz</Text>
            <TextInput
              style={[styles.quizInput, { color: theme.text, backgroundColor: theme.surfaceElevated, borderColor: theme.border }]}
              placeholder="What do you want to practice? (e.g. Fractions, Photosynthesis)"
              placeholderTextColor={theme.muted}
              value={quizArea}
              onChangeText={setQuizArea}
              editable={!quizGeneral}
            />
            <View style={styles.modeRow}>
              <Pressable
                style={[styles.modeChip, { borderColor: !quizGeneral ? theme.primary : theme.border }, !quizGeneral && { backgroundColor: `${theme.primary}1A` }]}
                onPress={() => setQuizGeneral(false)}
              >
                <Ionicons name="create-outline" size={15} color={!quizGeneral ? theme.primary : theme.muted} />
                <Text style={[styles.modeChipText, { color: !quizGeneral ? theme.primary : theme.muted }]}>Custom area</Text>
              </Pressable>
              <Pressable
                style={[styles.modeChip, { borderColor: quizGeneral ? theme.primary : theme.border }, quizGeneral && { backgroundColor: `${theme.primary}1A` }]}
                onPress={() => setQuizGeneral(true)}
              >
                <Ionicons name="layers-outline" size={15} color={quizGeneral ? theme.primary : theme.muted} />
                <Text style={[styles.modeChipText, { color: quizGeneral ? theme.primary : theme.muted }]}>General</Text>
              </Pressable>
            </View>
            <Text style={[styles.modeHint, { color: theme.muted }]}>
              {quizGeneral
                ? 'General picks from all topics you have completed in classes you are enrolled in.'
                : 'Type the area you want to be quizzed on, or pick General for a mix of your completed topics.'}
            </Text>
            <View style={styles.countRow}>
              <Text style={[styles.countLabel, { color: theme.text }]}>Questions</Text>
              <View style={styles.countControls}>
                <Pressable
                  hitSlop={8}
                  style={[styles.countBtn, { backgroundColor: theme.surfaceElevated, borderColor: theme.border }]}
                  onPress={() => setQuizCount((prev) => String(Math.max(parseInt(prev) || 5, 1) - 1))}
                >
                  <Ionicons name="remove" size={16} color={theme.text} />
                </Pressable>
                <TextInput
                  style={[styles.countInput, { color: theme.text, backgroundColor: theme.surfaceElevated, borderColor: theme.border }]}
                  value={quizCount}
                  onChangeText={(t) => {
                    const cleaned = t.replace(/[^0-9]/g, '');
                    if (cleaned === '') { setQuizCount(''); return; }
                    const n = parseInt(cleaned, 10);
                    if (n >= 1 && n <= 20) setQuizCount(cleaned);
                  }}
                  keyboardType="numeric"
                  maxLength={2}
                  showSoftInputOnFocus={false}
                />
                <Pressable
                  hitSlop={8}
                  style={[styles.countBtn, { backgroundColor: theme.surfaceElevated, borderColor: theme.border }]}
                  onPress={() => setQuizCount((prev) => String(Math.min(parseInt(prev) || 5, 20)))}
                >
                  <Ionicons name="add" size={16} color={theme.text} />
                </Pressable>
              </View>
            </View>
            <Pressable
              style={[styles.startBtn, { backgroundColor: theme.primary }]}
              onPress={() => startQuiz(quizArea, quizGeneral, quizCount)}
            >
              <Ionicons name="clipboard-outline" size={17} color={theme.onPrimary} />
              <Text style={[styles.startBtnText, { color: theme.onPrimary }]}>Start Practice Quiz</Text>
            </Pressable>
          </View>
        ) : (
          <>
            {messages.length === 0 ? (
              <View style={[styles.welcome, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                <Ionicons name="sparkles-outline" size={30} color={theme.primary} />
                <Text style={[styles.welcomeTitle, { color: theme.text }]}>Ask Gracy anything</Text>
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
          </>
        )}
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
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    paddingHorizontal: 16,
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabText: { fontSize: 13, fontWeight: '800' },
  content: { padding: 16, paddingBottom: 40 },
  subject: { fontSize: 12, fontWeight: '700', marginBottom: 6 },
  quota: { fontSize: 11, fontWeight: '600', marginBottom: 14 },
  quizSetup: { borderWidth: 1, borderRadius: 18, padding: 18 },
  quizSetupTitle: { fontSize: 16, fontWeight: '800', marginBottom: 14 },
  quizInput: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
  },
  modeRow: { flexDirection: 'row', gap: 10, marginTop: 12 },
  modeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  modeChipText: { fontSize: 12, fontWeight: '800' },
  modeHint: { fontSize: 11, lineHeight: 16, marginTop: 12 },
  countRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 14 },
  countLabel: { fontSize: 13, fontWeight: '700' },
  countControls: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  countBtn: {
    width: 38,
    height: 38,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  countInput: {
    width: 48,
    height: 38,
    borderRadius: 10,
    borderWidth: 1,
    textAlign: 'center',
    textAlignVertical: 'center',
    fontSize: 15,
    fontWeight: '800',
    padding: 0,
  },
  startBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 14,
    paddingVertical: 14,
    marginTop: 16,
  },
  startBtnText: { fontWeight: '800', fontSize: 14 },
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
