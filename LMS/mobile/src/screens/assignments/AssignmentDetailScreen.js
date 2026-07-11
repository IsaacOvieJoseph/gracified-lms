import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, Pressable, Alert, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import api from '../../api/api';
import Input from '../../components/ui/Input';
import Button from '../../components/ui/Button';

export default function AssignmentDetailScreen({ route, navigation }) {
  const { assignmentId } = route.params || {};
  const { user } = useAuth();
  const { theme } = useTheme();
  const [assignment, setAssignment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Student states
  const [studentAnswers, setStudentAnswers] = useState([]);
  const [submitLoading, setSubmitLoading] = useState(false);

  // Teacher grading states
  const [selectedSubmission, setSelectedSubmission] = useState(null);
  const [gradeScore, setGradeScore] = useState('');
  const [gradeFeedback, setGradeFeedback] = useState('');
  const [gradeLoading, setGradeLoading] = useState(false);

  const isTeacher = user?.role === 'teacher' || user?.role === 'personal_teacher' || user?.role === 'school_admin' || user?.role === 'root_admin';

  const loadAssignment = async () => {
    setLoading(true);
    try {
      const response = await api.get(`/assignments/${assignmentId}`);
      const data = response.data?.assignment || response.data;
      setAssignment(data);

      // Pre-populate student answer array if mcq or theory
      if (data?.questions) {
        setStudentAnswers(new Array(data.questions.length).fill(''));
      }
    } catch (err) {
      setError(err?.response?.data?.message || 'Unable to load assignment details.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (assignmentId) {
      loadAssignment();
    }
  }, [assignmentId]);

  // Check if current student has already submitted
  const studentSubmission = !isTeacher && assignment?.submissions?.find(
    sub => (sub.studentId?._id || sub.studentId) === user?._id
  );

  const formatScore = (score) => {
    if (typeof score !== 'number' || Number.isNaN(score)) return '0.0';
    return score.toFixed(1);
  };

  const formatPercentage = (score, maxScore) => {
    if (typeof score !== 'number' || typeof maxScore !== 'number' || maxScore <= 0) return '0.0%';
    return `${((score / maxScore) * 100).toFixed(1)}%`;
  };

  const getQuestionPoints = (q) => {
    if (typeof q.maxScore === 'number' && q.maxScore > 0) {
      return q.maxScore;
    }
    if (assignment?.assignmentType === 'mcq' && assignment?.questions?.length > 0 && typeof assignment.maxScore === 'number') {
      return assignment.maxScore / assignment.questions.length;
    }
    return 0;
  };

  const handleStudentSubmit = async () => {
    // Validate
    const unfilledIndex = studentAnswers.findIndex(ans => !ans || ans.trim() === '');
    if (unfilledIndex !== -1) {
      Alert.alert('Incomplete Answers', `Please answer all questions before submitting. Question ${unfilledIndex + 1} is empty.`);
      return;
    }

    setSubmitLoading(true);
    try {
      await api.post(`/assignments/${assignmentId}/submit`, {
        answers: studentAnswers,
        files: []
      });
      Alert.alert('Success', 'Assignment submitted successfully!');
      loadAssignment();
    } catch (err) {
      Alert.alert('Error', err?.response?.data?.message || 'Failed to submit assignment.');
    } finally {
      setSubmitLoading(false);
    }
  };

  const handleGradeSubmit = async () => {
    const parsedScore = parseFloat(gradeScore);
    if (isNaN(parsedScore) || parsedScore < 0 || parsedScore > (assignment?.maxScore || 100)) {
      Alert.alert('Invalid Score', `Please enter a valid score between 0 and ${assignment?.maxScore || 100}.`);
      return;
    }

    setGradeLoading(true);
    try {
      await api.put(`/assignments/${assignmentId}/grade`, {
        studentId: selectedSubmission.studentId?._id || selectedSubmission.studentId,
        score: parsedScore,
        feedback: gradeFeedback
      });
      Alert.alert('Success', 'Submission graded successfully!');
      setSelectedSubmission(null);
      setGradeScore('');
      setGradeFeedback('');
      loadAssignment();
    } catch (err) {
      Alert.alert('Error', err?.response?.data?.message || 'Failed to submit grade.');
    } finally {
      setGradeLoading(false);
    }
  };

  const selectSubmissionForGrading = (sub) => {
    setSelectedSubmission(sub);
    setGradeScore(sub.score?.toString() || '');
    setGradeFeedback(sub.feedback || '');
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.loadingContainer, { backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" color={theme.primary} />
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={[styles.loadingContainer, { backgroundColor: theme.background }]}>
        <Text style={[styles.errorText, { color: theme.danger }]}>{error}</Text>
        <Pressable style={[styles.backBtn, { backgroundColor: theme.border }]} onPress={() => navigation.goBack()}>
          <Text style={[styles.backBtnText, { color: theme.text }]}>Go back</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={[styles.header, { borderBottomColor: theme.border }]}>
        <Pressable onPress={() => navigation.goBack()} style={styles.iconButton}>
          <Ionicons name="arrow-back-outline" size={24} color={theme.text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: theme.text }]} numberOfLines={1}>{assignment?.title}</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.metaRow}>
          <View style={[styles.badge, { backgroundColor: theme.border }]}>
            <Text style={[styles.badgeText, { color: theme.muted }]}>MAX SCORE: {assignment?.maxScore || 100}</Text>
          </View>
          <View style={[styles.badge, { backgroundColor: theme.border }]}>
            <Text style={[styles.badgeText, { color: theme.muted }]}>{assignment?.assignmentType?.toUpperCase()}</Text>
          </View>
        </View>

        <Text style={[styles.description, { color: theme.muted }]}>{assignment?.description || 'No description provided.'}</Text>

        {assignment?.dueDate && (
          <Text style={[styles.dueDateText, { color: theme.danger }]}>
            Due: {new Date(assignment.dueDate).toLocaleDateString()} at {new Date(assignment.dueDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </Text>
        )}

        {/* -------------------- STUDENT VIEWS -------------------- */}
        {!isTeacher && (
          <View style={styles.section}>
            {studentSubmission ? (
              // Submitted View
              <View style={styles.submissionSummary}>
                <Text style={[styles.sectionTitle, { color: theme.text }]}>Your submission</Text>
                <View style={[styles.submissionCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                  <View style={[styles.summaryHeader, { borderBottomColor: theme.border }]}>
                    <Text style={[styles.summaryStatus, { color: theme.muted }]}>
                      Status:{' '}
                      <Text style={{ color: studentSubmission.status === 'graded' ? theme.success : theme.info, fontWeight: '800' }}>
                        {studentSubmission.status?.toUpperCase()}
                      </Text>
                    </Text>
                    {studentSubmission.status === 'graded' && (
                      <Text style={[styles.scoreText, { color: theme.text }]}>
                        Score: {formatScore(studentSubmission.score)}/{formatScore(assignment?.maxScore || 100)} • {formatPercentage(studentSubmission.score, assignment?.maxScore || 100)}
                      </Text>
                    )}
                  </View>
                  
                  {studentSubmission.feedback ? (
                    <View style={[styles.feedbackBox, { backgroundColor: theme.surfaceElevated, borderLeftColor: theme.success }]}>
                      <Text style={[styles.feedbackLabel, { color: theme.success }]}>Teacher feedback:</Text>
                      <Text style={[styles.feedbackText, { color: theme.muted }]}>{studentSubmission.feedback}</Text>
                    </View>
                  ) : null}

                  <Text style={[styles.answersSubmittedLabel, { color: theme.text }]}>Answers submitted:</Text>
                  {assignment?.questions?.map((q, idx) => {
                    const ans = studentSubmission.answers && studentSubmission.answers[idx];
                    const points = formatScore(getQuestionPoints(q));
                    return (
                      <View key={q._id || idx} style={[styles.subQuestionCard, { backgroundColor: theme.surfaceElevated }]}>
                        <Text style={[styles.questionNum, { color: theme.text }]}>Question {idx + 1} ({points} pts): {q.questionText}</Text>
                        <Text style={[styles.submittedAnswerText, { color: theme.text }]}>Your Answer: {ans || 'N/A'}</Text>
                        {q.correctOption && (
                          <Text style={[styles.correctOptionText, { color: theme.success }]}>Correct Option: {q.correctOption}</Text>
                        )}
                      </View>
                    );
                  })}
                </View>
              </View>
            ) : (
              // Form View (Pending submission)
              <View style={styles.formContainer}>
                <Text style={[styles.sectionTitle, { color: theme.text }]}>Questions</Text>
                {assignment?.questions?.map((q, idx) => (
                  <View key={q._id || idx} style={[styles.questionCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                    <Text style={[styles.questionNum, { color: theme.text }]}>Question {idx + 1} ({formatScore(getQuestionPoints(q))} pts)</Text>
                    <Text style={[styles.questionText, { color: theme.text }]}>{q.questionText}</Text>

                    {assignment.assignmentType === 'mcq' ? (
                      <View style={styles.optionsList}>
                        {q.options?.map((opt, oIdx) => {
                          const isSelected = studentAnswers[idx] === opt;
                          return (
                            <Pressable
                              key={oIdx}
                              style={[
                                styles.optionCard,
                                { backgroundColor: theme.surfaceElevated, borderColor: theme.neutral },
                                isSelected && { borderColor: theme.text, backgroundColor: theme.surfaceElevated },
                              ]}
                              onPress={() => {
                                const newAnswers = [...studentAnswers];
                                newAnswers[idx] = opt;
                                setStudentAnswers(newAnswers);
                              }}
                            >
                              <Ionicons
                                name={isSelected ? 'radio-button-on' : 'radio-button-off'}
                                size={20}
                                color={isSelected ? theme.text : theme.muted}
                              />
                              <Text style={[
                                styles.optionText,
                                { color: theme.muted },
                                isSelected && { color: theme.text, fontWeight: '700' },
                              ]}>
                                {opt}
                              </Text>
                            </Pressable>
                          );
                        })}
                      </View>
                    ) : (
                      <TextInput
                        style={[styles.theoryInput, { backgroundColor: theme.surfaceElevated, borderColor: theme.neutral, color: theme.text }]}
                        placeholder="Type your answer here..."
                        placeholderTextColor={theme.muted}
                        value={studentAnswers[idx]}
                        onChangeText={(txt) => {
                          const newAnswers = [...studentAnswers];
                          newAnswers[idx] = txt;
                          setStudentAnswers(newAnswers);
                        }}
                        multiline
                        numberOfLines={4}
                      />
                    )}
                  </View>
                ))}

                <Button
                  title={submitLoading ? 'Submitting...' : 'Submit assignment'}
                  onPress={handleStudentSubmit}
                  disabled={submitLoading}
                />
              </View>
            )}
          </View>
        )}

        {/* -------------------- TEACHER VIEWS -------------------- */}
        {isTeacher && (
          <View style={styles.section}>
            {selectedSubmission ? (
              // Grading Detail View
              <View style={styles.gradingContainer}>
                <View style={styles.gradingHeader}>
                  <Text style={[styles.sectionTitle, { color: theme.text }]}>Grading student</Text>
                  <Pressable onPress={() => setSelectedSubmission(null)} style={styles.cancelGradingBtn}>
                    <Text style={[styles.cancelGradingText, { color: theme.danger }]}>Cancel</Text>
                  </Pressable>
                </View>

                <View style={[styles.submissionCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                  <Text style={[styles.studentName, { color: theme.text }]}>
                    Student: {selectedSubmission.studentId?.name || 'Unknown Student'}
                  </Text>
                  <Text style={[styles.studentEmail, { color: theme.muted }]}>
                    {selectedSubmission.studentId?.email}
                  </Text>

                  {assignment?.questions?.map((q, idx) => {
                    const ans = selectedSubmission.answers && selectedSubmission.answers[idx];
                    return (
                      <View key={q._id || idx} style={[styles.subQuestionCard, { backgroundColor: theme.surfaceElevated }]}>
                        <Text style={[styles.questionNum, { color: theme.text }]}>Question {idx + 1}: {q.questionText}</Text>
                        <Text style={[styles.submittedAnswerText, { color: theme.text }]}>Student Answer: {ans || 'N/A'}</Text>
                        {q.correctOption && (
                          <Text style={[styles.correctOptionText, { color: theme.success }]}>Correct Option: {q.correctOption}</Text>
                        )}
                      </View>
                    );
                  })}
                </View>

                <View style={[styles.gradingForm, { backgroundColor: theme.surface, borderColor: theme.neutral }]}>
                  <Text style={[styles.inputLabel, { color: theme.muted }]}>Grade score (Max: {assignment?.maxScore || 100})</Text>
                  <Input
                    placeholder="Enter score"
                    value={gradeScore}
                    onChangeText={setGradeScore}
                    keyboardType="numeric"
                  />

                  <Text style={[styles.inputLabel, { color: theme.muted }]}>Feedback</Text>
                  <TextInput
                    style={[styles.theoryInput, { backgroundColor: theme.surfaceElevated, borderColor: theme.neutral, color: theme.text }]}
                    placeholder="Provide comments or feedback..."
                    placeholderTextColor={theme.muted}
                    value={gradeFeedback}
                    onChangeText={setGradeFeedback}
                    multiline
                    numberOfLines={3}
                  />

                  <Button
                    title={gradeLoading ? 'Saving...' : 'Submit grade'}
                    onPress={handleGradeSubmit}
                    disabled={gradeLoading}
                  />
                </View>
              </View>
            ) : (
              // Submissions list view
              <View style={styles.submissionsList}>
                <Text style={[styles.sectionTitle, { color: theme.text }]}>Student submissions</Text>
                {assignment?.submissions && assignment.submissions.length > 0 ? (
                  assignment.submissions.map((sub, idx) => (
                    <View key={sub._id || idx} style={[styles.submissionRow, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.rowStudentName, { color: theme.text }]}>{sub.studentId?.name || 'Student'}</Text>
                        <Text style={[styles.rowStudentEmail, { color: theme.muted }]}>{sub.studentId?.email || 'N/A'}</Text>
                        <Text style={[styles.rowStatus, { color: theme.muted }]}>
                          Status: <Text style={{ color: sub.status === 'graded' ? theme.success : theme.info, fontWeight: '700' }}>{sub.status?.toUpperCase()}</Text>
                          {sub.status === 'graded' ? ` • Score: ${formatScore(sub.score)}/${formatScore(assignment.maxScore)} (${formatPercentage(sub.score, assignment.maxScore)})` : ''}
                        </Text>
                      </View>
                      <Pressable style={[styles.gradeBtn, { backgroundColor: theme.primary }]} onPress={() => selectSubmissionForGrading(sub)}>
                        <Text style={[styles.gradeBtnText, { color: theme.onPrimary }]}>{sub.status === 'graded' ? 'Regrade' : 'Grade'}</Text>
                      </Pressable>
                    </View>
                  ))
                ) : (
                  <Text style={[styles.emptyText, { color: theme.muted }]}>No submissions received yet.</Text>
                )}
              </View>
            )}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  errorText: { fontSize: 16, textAlign: 'center', marginBottom: 20 },
  backBtn: { borderRadius: 12, paddingVertical: 12, paddingHorizontal: 24 },
  backBtnText: { fontWeight: '700' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  iconButton: { padding: 4 },
  headerTitle: { fontSize: 18, fontWeight: '800', flex: 1, textAlign: 'center' },
  content: { padding: 20, paddingBottom: 40 },
  metaRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  badgeText: { fontSize: 11, fontWeight: '800' },
  description: { fontSize: 15, lineHeight: 22, marginBottom: 12 },
  dueDateText: { fontSize: 13, fontWeight: '600', marginBottom: 24 },
  section: { marginTop: 8 },
  sectionTitle: { fontSize: 16, fontWeight: '700', marginBottom: 12 },
  submissionSummary: { marginTop: 8 },
  submissionCard: { borderRadius: 20, padding: 16, borderWidth: 1, marginBottom: 16 },
  summaryHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12, borderBottomWidth: 1, paddingBottom: 8 },
  summaryStatus: { fontSize: 14 },
  scoreText: { fontWeight: '700', fontSize: 14 },
  feedbackBox: { borderRadius: 12, padding: 12, borderLeftWidth: 3, marginBottom: 16 },
  feedbackLabel: { fontSize: 12, fontWeight: '700', marginBottom: 4 },
  feedbackText: { fontSize: 13, lineHeight: 18 },
  answersSubmittedLabel: { fontWeight: '700', fontSize: 14, marginBottom: 10 },
  subQuestionCard: { borderRadius: 14, padding: 12, marginBottom: 8 },
  questionNum: { fontWeight: '700', fontSize: 13, marginBottom: 6 },
  submittedAnswerText: { fontSize: 14, fontWeight: '600' },
  correctOptionText: { fontSize: 12, marginTop: 4, fontWeight: '600' },
  formContainer: { marginTop: 8 },
  questionCard: { borderRadius: 20, padding: 16, marginBottom: 14, borderWidth: 1 },
  questionText: { fontSize: 15, fontWeight: '600', marginBottom: 14, lineHeight: 20 },
  optionsList: { gap: 8 },
  optionCard: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderRadius: 12, padding: 12 },
  optionText: { fontSize: 14 },
  theoryInput: { borderWidth: 1, borderRadius: 14, padding: 12, fontSize: 14, textAlignVertical: 'top', minHeight: 80, marginBottom: 6 },
  submissionsList: { marginTop: 8 },
  submissionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderRadius: 18, padding: 14, marginBottom: 10, borderWidth: 1 },
  rowStudentName: { fontSize: 15, fontWeight: '700' },
  rowStudentEmail: { fontSize: 12, marginTop: 2 },
  rowStatus: { fontSize: 12, marginTop: 6 },
  gradeBtn: { borderRadius: 10, paddingVertical: 8, paddingHorizontal: 16 },
  gradeBtnText: { fontSize: 12, fontWeight: '700' },
  gradingContainer: { marginTop: 8 },
  gradingHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  cancelGradingBtn: { padding: 4 },
  cancelGradingText: { fontWeight: '700' },
  studentName: { fontSize: 16, fontWeight: '800' },
  studentEmail: { fontSize: 13, marginBottom: 12 },
  gradingForm: { borderRadius: 20, padding: 16, marginTop: 14, borderWidth: 1 },
  inputLabel: { fontSize: 13, fontWeight: '600', marginBottom: 6, marginTop: 8 },
  emptyText: { fontSize: 14, fontStyle: 'italic', marginTop: 4 },
});
