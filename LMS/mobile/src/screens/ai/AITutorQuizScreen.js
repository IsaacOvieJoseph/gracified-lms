import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import api from '../../api/api';
import { useTheme } from '../../context/ThemeContext';

export default function AITutorQuizScreen({ route, navigation }) {
  const { theme } = useTheme();
  const { topicId, subject, area, general } = route.params || {};

  const [generating, setGenerating] = useState(true);
  const [quiz, setQuiz] = useState(null); // { sessionId, quizIndex, title, questions }
  const [pickedTopics, setPickedTopics] = useState([]);
  const [answers, setAnswers] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null); // { score, total, perQuestion, summaryFeedback }
  const [error, setError] = useState('');

  const generate = async () => {
    setGenerating(true);
    setError('');
    try {
      const res = await api.post('/ai/tutor/quiz', {
        topicId,
        subject: subject || '',
        level: '',
        questionCount: 5,
        area,
        general: !!general,
      });
      setQuiz({ sessionId: res.data.sessionId, quizIndex: res.data.quizIndex, title: res.data.title, questions: res.data.questions });
      setPickedTopics(res.data.pickedTopics || []);
      setAnswers(new Array(res.data.questions.length).fill(''));
      setResult(null);
    } catch (err) {
      setError(err?.response?.data?.message || 'Could not generate a quiz. Please try again.');
    } finally {
      setGenerating(false);
    }
  };

  useEffect(() => { generate(); }, []);

  const selectAnswer = (qIndex, option) => {
    setAnswers((prev) => prev.map((a, i) => (i === qIndex ? option : a)));
  };

  const submit = async () => {
    const unanswered = answers.filter((a) => !a).length;
    if (unanswered > 0) {
      Alert.alert('Quiz incomplete', `You have ${unanswered} unanswered question${unanswered > 1 ? 's' : ''}. Submit anyway?`, [
        { text: 'Keep answering', style: 'cancel' },
        { text: 'Submit', onPress: () => doSubmit() },
      ]);
      return;
    }
    doSubmit();
  };

  const doSubmit = async () => {
    setSubmitting(true);
    setError('');
    try {
      const res = await api.post('/ai/tutor/quiz/submit', {
        sessionId: quiz.sessionId,
        quizIndex: quiz.quizIndex,
        answers,
      });
      setResult(res.data);
    } catch (err) {
      setError(err?.response?.data?.message || 'Could not submit the quiz. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={[styles.header, { borderBottomColor: theme.border }]}>
        <Pressable onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back-outline" size={24} color={theme.text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: theme.text }]}>Practice with Gracy</Text>
        <Pressable onPress={generate} disabled={generating || submitting}>
          <Ionicons name="refresh" size={22} color={generating || submitting ? theme.muted : theme.primary} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {generating ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={theme.primary} />
            <Text style={[styles.centerText, { color: theme.muted }]}>Preparing your quiz...</Text>
          </View>
        ) : error && !quiz ? (
          <View style={styles.center}>
            <Text style={[styles.error, { color: theme.danger }]}>{error}</Text>
            <Pressable style={[styles.retryBtn, { backgroundColor: theme.primary }]} onPress={generate}>
              <Text style={[styles.retryBtnText, { color: theme.onPrimary }]}>Try again</Text>
            </Pressable>
          </View>
        ) : quiz ? (
          <>
            <Text style={[styles.quizTitle, { color: theme.text }]}>{quiz.title}</Text>
            <Text style={[styles.subject, { color: theme.muted }]}>Topic: {subject || area || 'General'}</Text>
            {pickedTopics.length > 0 ? (
              <Text style={[styles.picked, { color: theme.muted }]}>Based on: {pickedTopics.join(' • ')}</Text>
            ) : null}

            {result ? (
              <View style={[styles.resultCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                <Text style={[styles.scoreText, { color: theme.primary }]}>
                  {result.score} / {result.total}
                </Text>
                <Text style={[styles.scoreLabel, { color: theme.muted }]}>
                  {Math.round((result.score / result.total) * 100)}% correct
                </Text>
                {result.summaryFeedback ? (
                  <Text style={[styles.summary, { color: theme.text }]}>{result.summaryFeedback}</Text>
                ) : null}
                <Pressable style={[styles.againBtn, { backgroundColor: theme.primary }]} onPress={generate}>
                  <Text style={[styles.againBtnText, { color: theme.onPrimary }]}>New quiz</Text>
                </Pressable>
              </View>
            ) : null}

            {quiz.questions.map((q, qIndex) => {
              const review = result?.perQuestion?.[qIndex];
              const isReviewed = !!review;
              const isCorrect = review?.isCorrect;
              return (
                <View key={qIndex} style={[styles.questionCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                  <Text style={[styles.questionText, { color: theme.text }]}>
                    {qIndex + 1}. {q.questionText}
                  </Text>
                  <View style={styles.options}>
                    {q.options.map((option, oIndex) => {
                      const selected = answers[qIndex] === option;
                      let optionStyle = [styles.option, { backgroundColor: theme.surfaceElevated, borderColor: theme.border }];
                      let optionTextStyle = [styles.optionText, { color: theme.text }];
                      let icon = null;
                      if (isReviewed) {
                        if (option === review.correct) {
                          optionStyle = [styles.option, { backgroundColor: `${theme.success}1A`, borderColor: theme.success }];
                          optionTextStyle = [styles.optionText, { color: theme.success }];
                          icon = <Ionicons name="checkmark-circle" size={17} color={theme.success} />;
                        } else if (selected) {
                          optionStyle = [styles.option, { backgroundColor: `${theme.danger}1A`, borderColor: theme.danger }];
                          optionTextStyle = [styles.optionText, { color: theme.danger }];
                          icon = <Ionicons name="close-circle" size={17} color={theme.danger} />;
                        }
                      } else if (selected) {
                        optionStyle = [styles.option, { backgroundColor: `${theme.primary}1A`, borderColor: theme.primary }];
                        optionTextStyle = [styles.optionText, { color: theme.primary }];
                        icon = <Ionicons name="radio-button-on" size={17} color={theme.primary} />;
                      } else {
                        icon = <Ionicons name="radio-button-off" size={17} color={theme.muted} />;
                      }
                      return (
                        <Pressable
                          key={oIndex}
                          style={optionStyle}
                          disabled={isReviewed}
                          onPress={() => selectAnswer(qIndex, option)}
                        >
                          {icon}
                          <Text style={optionTextStyle}>{option}</Text>
                        </Pressable>
                      );
                    })}
                  </View>
                  {isReviewed ? (
                    <View style={[styles.explanation, { backgroundColor: isCorrect ? `${theme.success}14` : `${theme.danger}14`, borderColor: isCorrect ? theme.success : theme.danger }]}>
                      <Text style={[styles.explanationText, { color: theme.text }]}>
                        {review.explanation}
                      </Text>
                    </View>
                  ) : null}
                </View>
              );
            })}

            {error ? <Text style={[styles.error, { color: theme.danger }]}>{error}</Text> : null}

            {!result ? (
              <Pressable style={[styles.submitBtn, { backgroundColor: theme.primary }, submitting && { opacity: 0.5 }]} onPress={submit} disabled={submitting}>
                {submitting ? (
                  <ActivityIndicator color={theme.onPrimary} size="small" />
                ) : (
                  <Text style={[styles.submitBtnText, { color: theme.onPrimary }]}>Submit quiz</Text>
                )}
              </Pressable>
            ) : null}
          </>
        ) : null}
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
  center: { alignItems: 'center', justifyContent: 'center', paddingVertical: 48, gap: 12 },
  centerText: { fontSize: 14 },
  error: { fontSize: 14, textAlign: 'center', lineHeight: 20 },
  retryBtn: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 12, marginTop: 4 },
  retryBtnText: { fontWeight: '800', fontSize: 13 },
  quizTitle: { fontSize: 18, fontWeight: '800' },
  subject: { fontSize: 12, fontWeight: '600', marginTop: 4 },
  picked: { fontSize: 11, fontWeight: '600', marginTop: 2, marginBottom: 14 },
  resultCard: {
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 16,
    padding: 18,
    marginBottom: 18,
  },
  scoreText: { fontSize: 30, fontWeight: '900' },
  scoreLabel: { fontSize: 12, fontWeight: '700', marginTop: 2 },
  summary: { fontSize: 13, lineHeight: 19, marginTop: 12, textAlign: 'center' },
  againBtn: { paddingHorizontal: 18, paddingVertical: 10, borderRadius: 12, marginTop: 14 },
  againBtnText: { fontWeight: '800', fontSize: 13 },
  questionCard: { borderWidth: 1, borderRadius: 16, padding: 16, marginBottom: 14 },
  questionText: { fontSize: 15, fontWeight: '700', lineHeight: 21 },
  options: { gap: 8, marginTop: 12 },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 11,
  },
  optionText: { flex: 1, fontSize: 14, lineHeight: 19 },
  explanation: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
    marginTop: 10,
  },
  explanationText: { fontSize: 12, lineHeight: 18 },
  submitBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    paddingVertical: 15,
    marginTop: 8,
  },
  submitBtnText: { fontWeight: '800', fontSize: 15 },
});
