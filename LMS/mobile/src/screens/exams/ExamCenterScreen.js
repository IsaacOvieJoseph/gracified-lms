import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, Pressable, Alert, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import api from '../../api/api';
import Button from '../../components/ui/Button';

export default function ExamCenterScreen({ route, navigation }) {
  const { theme } = useTheme();
  const { token } = route.params || {};
  const { user } = useAuth();

  const [exam, setExam] = useState(null);
  const [loading, setLoading] = useState(true);
  const [started, setStarted] = useState(false);
  const [finished, setFinished] = useState(false);
  const [submissionId, setSubmissionId] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState([]);
  const [score, setScore] = useState(null);
  const [submissionStatus, setSubmissionStatus] = useState(null);
  const [timeLeft, setTimeLeft] = useState(0); // In seconds
  const [submitting, setSubmitting] = useState(false);

  const timerRef = useRef(null);
  const answersRef = useRef([]);

  useEffect(() => {
    answersRef.current = answers;
  }, [answers]);

  const loadExamMeta = async () => {
    setLoading(true);
    try {
      const response = await api.get(`/exams/public/${token}`);
      setExam(response.data);
    } catch (err) {
      Alert.alert('Load error', err?.response?.data?.message || 'Unable to load exam details.');
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) {
      loadExamMeta();
    }
  }, [token]);

  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const handleStartExam = async () => {
    setLoading(true);
    try {
      const payload = {};
      if (exam?.accessMode === 'open') {
        payload.name = user?.name || 'Guest Student';
        payload.email = user?.email || 'guest@example.com';
      }

      const response = await api.post(`/exams/public/${token}/start`, payload);
      setSubmissionId(response.data.submissionId);

      const examQuestions = response.data.questions || [];
      setQuestions(examQuestions);
      setAnswers(new Array(examQuestions.length).fill(''));

      // Setup Timer (duration is in minutes)
      const durationSec = (response.data.duration || exam?.duration || 60) * 60;
      setTimeLeft(durationSec);
      setStarted(true);

      startTimer(durationSec, response.data.submissionId);
    } catch (err) {
      Alert.alert('Start error', err?.response?.data?.message || 'Failed to start exam session.');
    } finally {
      setLoading(false);
    }
  };

  const startTimer = (initialTime, subId) => {
    if (timerRef.current) clearInterval(timerRef.current);

    let currentVal = initialTime;
    timerRef.current = setInterval(() => {
      currentVal -= 1;
      setTimeLeft(currentVal);

      if (currentVal <= 0) {
        clearInterval(timerRef.current);
        handleExamSubmit(true, subId);
      }
    }, 1000);
  };

  const handleExamSubmit = async (isAuto = false, targetSubId = null) => {
    const activeSubId = targetSubId || submissionId;
    if (!activeSubId) return;

    if (timerRef.current) clearInterval(timerRef.current);

    setSubmitting(true);
    try {
      const response = await api.post(`/exams/submissions/${activeSubId}/submit`, {
        answers: answersRef.current
      });
      setScore(response.data.score);
      setSubmissionStatus(response.data.status);
      setFinished(true);

      if (isAuto) {
        Alert.alert('Time Expired', 'Your exam time expired. Your answers were auto-submitted.');
      } else {
        Alert.alert('Success', 'Exam submitted successfully!');
      }
    } catch (error) {
      Alert.alert('Submission failed', 'Failed to submit exam answers. Please check your network.');
    } finally {
      setSubmitting(false);
    }
  };

  const formatTime = (sec) => {
    const minutes = Math.floor(sec / 60);
    const seconds = sec % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.loadingContainer, { backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" color={theme.primary} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: theme.border }]}>
        <Pressable onPress={() => navigation.goBack()} style={styles.iconButton}>
          <Ionicons name="close-outline" size={26} color={theme.text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: theme.text }]} numberOfLines={1}>{exam?.title || 'Exam Center'}</Text>
        {started && !finished ? (
          <View style={[styles.timerContainer, { backgroundColor: `${theme.danger}1A` }]}>
            <Ionicons name="time-outline" size={16} color={theme.danger} />
            <Text style={[styles.timerText, { color: theme.danger }]}>{formatTime(timeLeft)}</Text>
          </View>
        ) : (
          <View style={{ width: 24 }} />
        )}
      </View>

      {!started ? (
        // Start Exam Instructions Page
        <View style={styles.instructionsContainer}>
          <View style={[styles.instructionsCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Ionicons name="document-text-outline" size={48} color={theme.muted} style={styles.instructIcon} />
            <Text style={[styles.instructTitle, { color: theme.text }]}>{exam?.title}</Text>
            <Text style={[styles.instructSubtitle, { color: theme.muted }]}>{exam?.description || 'Please review the exam constraints before starting.'}</Text>

            <View style={[styles.metaBox, { backgroundColor: theme.surfaceElevated }]}>
              <View style={styles.metaItem}>
                <Text style={[styles.metaLabel, { color: theme.muted }]}>Duration</Text>
                <Text style={[styles.metaValue, { color: theme.text }]}>{exam?.duration || 60} minutes</Text>
              </View>
              <View style={styles.metaItem}>
                <Text style={[styles.metaLabel, { color: theme.muted }]}>Questions</Text>
                <Text style={[styles.metaValue, { color: theme.text }]}>{exam?.questions?.length || 0} items</Text>
              </View>
              <View style={styles.metaItem}>
                <Text style={[styles.metaLabel, { color: theme.muted }]}>Access Mode</Text>
                <Text style={[styles.metaValue, { color: theme.text }]}>{exam?.accessMode?.toUpperCase() || 'REGISTERED'}</Text>
              </View>
            </View>

            <Button title="Start exam" onPress={handleStartExam} />
          </View>
        </View>
      ) : finished ? (
        // Finished / Results Page
        <View style={styles.resultsContainer}>
          <View style={[styles.resultsCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Ionicons name="checkmark-circle-outline" size={64} color={theme.success} />
            <Text style={[styles.resultsTitle, { color: theme.text }]}>Exam Completed</Text>
            <Text style={[styles.resultsSubtitle, { color: theme.muted }]}>Your answers have been securely submitted to the grading engine.</Text>

            {score !== undefined && score !== null ? (
              <View style={[styles.scoreBox, { backgroundColor: theme.surfaceElevated }]}>
                <Text style={[styles.scoreLabel, { color: theme.text }]}>Automatic MCQ Score</Text>
                <Text style={[styles.scoreValue, { color: theme.success }]}>{score} Points</Text>
              </View>
            ) : null}

            <Button title="Return to portal" onPress={() => navigation.goBack()} />
          </View>
        </View>
      ) : (
        // Main Exam Taking Form
        <ScrollView contentContainerStyle={styles.examScroll}>
          {questions.map((q, idx) => (
            <View key={q._id || idx} style={[styles.questionCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <Text style={[styles.questionNum, { color: theme.text }]}>Question {idx + 1}</Text>
              <Text style={[styles.questionText, { color: theme.text }]}>{q.questionText}</Text>

              {q.options && q.options.length > 0 ? (
                // MCQ Question
                <View style={styles.optionsList}>
                  {q.options.map((opt, oIdx) => {
                    const isSelected = answers[idx] === opt;
                    return (
                      <Pressable
                        key={oIdx}
                        style={[
                          styles.optionCard,
                          { backgroundColor: theme.surfaceElevated, borderColor: theme.neutral },
                          isSelected && { borderColor: theme.text, backgroundColor: theme.surfaceElevated },
                        ]}
                        onPress={() => {
                          const nextAnswers = [...answers];
                          nextAnswers[idx] = opt;
                          setAnswers(nextAnswers);
                        }}
                      >
                        <Ionicons
                          name={isSelected ? 'radio-button-on' : 'radio-button-off'}
                          size={20}
                          color={isSelected ? theme.text : theme.muted}
                        />
                        <Text style={[styles.optionText, { color: theme.neutral }, isSelected && { color: theme.text, fontWeight: '700' }]}>{opt}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              ) : (
                // Theory Question
                <TextInput
                  style={[styles.theoryInput, { backgroundColor: theme.surfaceElevated, borderColor: theme.neutral, color: theme.text }]}
                  placeholder="Write your answer details here..."
                  placeholderTextColor={theme.muted}
                  value={answers[idx]}
                  onChangeText={(txt) => {
                    const nextAnswers = [...answers];
                    nextAnswers[idx] = txt;
                    setAnswers(nextAnswers);
                  }}
                  multiline
                  numberOfLines={5}
                />
              )}
            </View>
          ))}

          <Button
            title={submitting ? 'Submitting...' : 'Finish & Submit exam'}
            onPress={() => {
              Alert.alert(
                'Submit Exam',
                'Are you sure you want to finish and submit your answers?',
                [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Yes, Submit', onPress: () => handleExamSubmit(false) }
                ]
              );
            }}
            disabled={submitting}
          />
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
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  iconButton: { padding: 4 },
  headerTitle: { fontSize: 18, fontWeight: '800', flex: 1, marginLeft: 12 },
  timerContainer: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 4, paddingHorizontal: 10, borderRadius: 10 },
  timerText: { fontSize: 13, fontWeight: '700' },
  instructionsContainer: { flex: 1, padding: 20, justifyContent: 'center' },
  instructionsCard: { borderRadius: 24, padding: 24, borderWidth: 1 },
  instructIcon: { alignSelf: 'center', marginBottom: 16 },
  instructTitle: { fontSize: 20, fontWeight: '800', textAlign: 'center', marginBottom: 8 },
  instructSubtitle: { fontSize: 14, textAlign: 'center', lineHeight: 20, marginBottom: 24 },
  metaBox: { flexDirection: 'row', padding: 14, borderRadius: 16, marginBottom: 24, gap: 10 },
  metaItem: { flex: 1, alignItems: 'center' },
  metaLabel: { fontSize: 11, fontWeight: '600' },
  metaValue: { fontSize: 14, fontWeight: '700', marginTop: 4 },
  examScroll: { padding: 16, paddingBottom: 40 },
  questionCard: { borderRadius: 20, padding: 16, marginBottom: 14, borderWidth: 1 },
  questionNum: { fontSize: 12, fontWeight: '700', marginBottom: 8 },
  questionText: { fontSize: 15, fontWeight: '600', marginBottom: 14, lineHeight: 22 },
  optionsList: { gap: 8 },
  optionCard: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderRadius: 12, padding: 12 },
  optionText: { fontSize: 14 },
  theoryInput: { borderWidth: 1, borderRadius: 14, padding: 12, fontSize: 14, textAlignVertical: 'top', minHeight: 100 },
  resultsContainer: { flex: 1, padding: 20, justifyContent: 'center' },
  resultsCard: { borderRadius: 24, padding: 24, alignItems: 'center', borderWidth: 1 },
  resultsTitle: { fontSize: 22, fontWeight: '800', marginTop: 16, marginBottom: 8 },
  resultsSubtitle: { fontSize: 14, textAlign: 'center', lineHeight: 20, marginBottom: 24 },
  scoreBox: { paddingVertical: 14, paddingHorizontal: 24, borderRadius: 16, alignItems: 'center', marginBottom: 24 },
  scoreLabel: { fontSize: 12, fontWeight: '700' },
  scoreValue: { fontSize: 24, fontWeight: '800', marginTop: 4 },
});
