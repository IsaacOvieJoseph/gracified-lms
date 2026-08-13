import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import api from '../../api/api';
import { useTheme } from '../../context/ThemeContext';
import { isPracticeRequest, extractPracticeArea } from '../../utils/tutor';

export default function AITutorChatOverlay({ visible, onClose, topicId, subject, context }) {
  const { theme } = useTheme();
  const navigation = useNavigation();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [sessionId, setSessionId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [access, setAccess] = useState(null);
  const scrollRef = useRef(null);

  useEffect(() => {
    if (!visible) return;
    let mounted = true;
    const load = async () => {
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
      }
    };
    load();
    return () => { mounted = false; };
  }, [visible, topicId]);

  useEffect(() => {
    if (messages.length) {
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [messages]);

  const send = async () => {
    const question = input.trim();
    if (!question || loading) return;
    setMessages((prev) => [...prev, { role: 'user', content: question }]);
    setInput('');
    if (isPracticeRequest(question)) {
      const area = extractPracticeArea(question);
      onClose();
      navigation.navigate('AITutorQuiz', {
        topicId: area ? null : topicId,
        subject,
        area,
        general: !area,
      });
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

  const quickChips = messages.length && messages[messages.length - 1]?.followUps?.length
    ? messages[messages.length - 1].followUps
    : [];

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <SafeAreaView style={[styles.sheet, { backgroundColor: theme.background }]}>
          <View style={[styles.sheetHeader, { borderBottomColor: theme.border }]}>
            <View style={styles.sheetTitleRow}>
              <Ionicons name="sparkles-outline" size={18} color={theme.primary} />
              <Text style={[styles.sheetTitle, { color: theme.text }]} numberOfLines={1}>
                Ask Gracy{subject ? ` — ${subject}` : ''}
              </Text>
            </View>
            <Pressable onPress={onClose} hitSlop={10}>
              <Ionicons name="close" size={22} color={theme.text} />
            </Pressable>
          </View>

          {access && !access.enabled ? (
            <View style={styles.disabledBox}>
              <Ionicons name="sparkles-outline" size={30} color={theme.muted} />
              <Text style={[styles.disabledTitle, { color: theme.text }]}>Gracy unavailable</Text>
              <Text style={[styles.disabledText, { color: theme.muted }]}>
                Gracy has not been enabled for your account. Contact your academy administrator to request access.
              </Text>
            </View>
          ) : (
            <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
              <ScrollView
                ref={scrollRef}
                contentContainerStyle={styles.messages}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
              >
                {messages.length === 0 ? (
                  <View style={styles.placeholder}>
                    <Ionicons name="chatbubble-ellipses-outline" size={26} color={theme.muted} />
                    <Text style={[styles.placeholderText, { color: theme.muted }]}>
                      Ask me anything about this topic while the video is paused.
                    </Text>
                  </View>
                ) : (
                  messages.map((msg, index) => (
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
                  ))
                )}
              </ScrollView>

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

              <View style={[styles.inputBar, { backgroundColor: theme.surface, borderTopColor: theme.border }]}>
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
            </KeyboardAvoidingView>
          )}
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'flex-end',
  },
  sheet: {
    height: '82%',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: 'hidden',
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  sheetTitleRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sheetTitle: { fontSize: 16, fontWeight: '800', flexShrink: 1 },
  disabledBox: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  disabledTitle: { fontSize: 17, fontWeight: '800', marginTop: 12 },
  disabledText: { fontSize: 13, textAlign: 'center', lineHeight: 19, marginTop: 8 },
  messages: { padding: 16, gap: 10 },
  placeholder: { alignItems: 'center', paddingVertical: 40, gap: 10 },
  placeholderText: { fontSize: 13, textAlign: 'center', lineHeight: 19 },
  bubble: { borderRadius: 16, paddingHorizontal: 14, paddingVertical: 11, maxWidth: '92%' },
  userBubble: { alignSelf: 'flex-end', borderBottomRightRadius: 4 },
  assistantBubble: { alignSelf: 'flex-start', borderWidth: 1, borderBottomLeftRadius: 4 },
  bubbleText: { fontSize: 14, lineHeight: 20 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 16, paddingBottom: 8 },
  chip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8, maxWidth: '100%' },
  chipText: { fontSize: 12, fontWeight: '700' },
  error: { fontSize: 13, paddingHorizontal: 16, paddingVertical: 4 },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
    borderTopWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
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
