import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, Pressable, Alert, TextInput, FlatList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import api from '../../api/api';
import Button from '../../components/ui/Button';

export default function ExamDetailScreen({ route, navigation }) {
  const { examId } = route.params || {};
  const { theme } = useTheme();
  const { user } = useAuth();

  const [exam, setExam] = useState(null);
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Grading states
  const [selectedSubmission, setSelectedSubmission] = useState(null);
  const [questionScores, setQuestionScores] = useState({}); // mapping of questionIndex -> score (string)
  const [gradeLoading, setGradeLoading] = useState(false);

  const loadExamAndSubmissions = async () => {
    setLoading(true);
    setError(null);
    try {
      const [examRes, subsRes] = await Promise.all([
        api.get(`/exams/${examId}`),
        api.get(`/exams/${examId}/submissions`)
      ]);
      setExam(examRes.data?.exam || examRes.data);
      setSubmissions(Array.isArray(subsRes.data) ? subsRes.data : []);
    } catch (err) {
      setError(err?.response?.data?.message || 'Unable to load exam details or submissions.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (examId) {
      loadExamAndSubmissions();
    }
  }, [examId]);

  const handleGradeSubmit = async () => {
    // Validate scores
    const questionGrades = [];
    for (let i = 0; i < exam.questions.length; i++) {
      const q = exam.questions[i];
      const val = questionScores[i];
      const parsed = parseFloat(val);
      if (isNaN(parsed) || parsed < 0 || parsed > (q.maxScore || 1)) {
        Alert.alert('Invalid Score', `Please enter a valid score between 0 and ${q.maxScore || 1} for Question ${i + 1}.`);
        return;
      }
      questionGrades.push({
        index: i,
        score: parsed
      });
    }

    setGradeLoading(true);
    try {
      await api.patch(`/exams/submissions/detail/${selectedSubmission._id}/grade`, {
        questionGrades
      });
      Alert.alert('Success', 'Exam submission graded successfully!');
      setSelectedSubmission(null);
      setQuestionScores({});
      loadExamAndSubmissions();
    } catch (err) {
      Alert.alert('Error', err?.response?.data?.message || 'Failed to save exam grades.');
    } finally {
      setGradeLoading(false);
    }
  };

  const selectSubmissionForGrading = (sub) => {
    setSelectedSubmission(sub);
    const initialScores = {};
    exam?.questions?.forEach((q, idx) => {
      const ansObj = sub.answers?.find(a => a.questionIndex === idx);
      initialScores[idx] = ansObj ? String(ansObj.score || 0) : '0';
    });
    setQuestionScores(initialScores);
  };

  const getCandidateDisplayName = (sub) => {
    if (sub.studentId?.name) return sub.studentId.name;
    if (sub.candidateName) return sub.candidateName;
    return 'Guest Candidate';
  };

  const getCandidateDisplayEmail = (sub) => {
    if (sub.studentId?.email) return sub.studentId.email;
    if (sub.candidateEmail) return sub.candidateEmail;
    return 'N/A';
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
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['top', 'left', 'right']}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: theme.border }]}>
        <Pressable onPress={() => navigation.goBack()} style={styles.iconButton}>
          <Ionicons name="arrow-back-outline" size={24} color={theme.text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: theme.text }]} numberOfLines={1}>
          {selectedSubmission ? 'Grading Exam' : exam?.title}
        </Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Exam Information Header */}
        {!selectedSubmission && (
          <View style={[styles.infoCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Text style={[styles.examTitle, { color: theme.text }]}>{exam?.title}</Text>
            <Text style={[styles.examDesc, { color: theme.muted }]}>{exam?.description || 'No description provided.'}</Text>
            <View style={styles.metaRow}>
              <View style={[styles.badge, { backgroundColor: theme.surfaceElevated }]}>
                <Ionicons name="time-outline" size={14} color={theme.muted} style={{ marginRight: 4 }} />
                <Text style={[styles.badgeText, { color: theme.muted }]}>{exam?.duration} mins</Text>
              </View>
              <View style={[styles.badge, { backgroundColor: theme.surfaceElevated }]}>
                <Ionicons name="list-outline" size={14} color={theme.muted} style={{ marginRight: 4 }} />
                <Text style={[styles.badgeText, { color: theme.muted }]}>{exam?.questions?.length || 0} questions</Text>
              </View>
              <View style={[styles.badge, { backgroundColor: theme.surfaceElevated }]}>
                <Text style={[styles.badgeText, { color: theme.muted }]}>{exam?.accessMode?.toUpperCase()}</Text>
              </View>
            </View>
          </View>
        )}

        {/* Selected Submission Grading View */}
        {selectedSubmission ? (
          <View style={styles.gradingWrapper}>
            <View style={styles.gradingHeader}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.studentName, { color: theme.text }]}>
                  {getCandidateDisplayName(selectedSubmission)}
                </Text>
                <Text style={[styles.studentEmail, { color: theme.muted }]}>
                  {getCandidateDisplayEmail(selectedSubmission)}
                </Text>
              </View>
              <Pressable onPress={() => setSelectedSubmission(null)} style={styles.cancelBtn}>
                <Text style={[styles.cancelBtnText, { color: theme.danger }]}>Cancel</Text>
              </Pressable>
            </View>

            {/* Questions list for grading */}
            {exam?.questions?.map((q, idx) => {
              const ansObj = selectedSubmission.answers?.find(a => a.questionIndex === idx);
              const answerVal = ansObj ? ansObj.answer : null;
              
              return (
                <View key={idx} style={[styles.questionCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                  <View style={styles.questionCardHeader}>
                    <Text style={[styles.questionNum, { color: theme.text }]}>Question {idx + 1} ({q.maxScore || 1} pts)</Text>
                    <View style={[styles.typeBadge, { backgroundColor: theme.surfaceElevated }]}>
                      <Text style={[styles.typeBadgeText, { color: theme.muted }]}>{q.questionType?.toUpperCase()}</Text>
                    </View>
                  </View>
                  
                  <Text style={[styles.questionText, { color: theme.text }]}>{q.questionText}</Text>
                  
                  {q.questionType === 'mcq' && q.options && (
                    <View style={styles.optionsList}>
                      {q.options.map((opt, oIdx) => {
                        const isCorrect = opt === q.correctOption;
                        const isChosen = opt === answerVal;
                        return (
                          <View 
                            key={oIdx} 
                            style={[
                              styles.optionRow, 
                              isCorrect && { borderColor: theme.success, borderWidth: 1, backgroundColor: `${theme.success}10` },
                              isChosen && !isCorrect && { borderColor: theme.danger, borderWidth: 1, backgroundColor: `${theme.danger}10` }
                            ]}
                          >
                            <Ionicons 
                              name={isCorrect ? 'checkmark-circle-outline' : isChosen ? 'close-circle-outline' : 'ellipse-outline'} 
                              size={18} 
                              color={isCorrect ? theme.success : isChosen ? theme.danger : theme.muted} 
                            />
                            <Text style={[styles.optionText, { color: theme.text }, isCorrect && { fontWeight: '700' }]}>
                              {opt} {isCorrect ? '(Correct)' : isChosen ? '(Chosen)' : ''}
                            </Text>
                          </View>
                        );
                      })}
                    </View>
                  )}

                  {q.questionType === 'theory' && (
                    <View style={[styles.theoryAnswerBox, { backgroundColor: theme.surfaceElevated }]}>
                      <Text style={[styles.theoryAnswerLabel, { color: theme.muted }]}>Student Answer:</Text>
                      <Text style={[styles.theoryAnswerText, { color: theme.text }]}>{answerVal || '[No Answer Submitted]'}</Text>
                    </View>
                  )}

                  <View style={styles.gradeInputRow}>
                    <Text style={[styles.gradeInputLabel, { color: theme.text }]}>Grade Score:</Text>
                    <TextInput
                      style={[styles.scoreInput, { backgroundColor: theme.surfaceElevated, borderColor: theme.border, color: theme.text }]}
                      keyboardType="numeric"
                      value={questionScores[idx] || '0'}
                      onChangeText={(val) => setQuestionScores({ ...questionScores, [idx]: val })}
                    />
                    <Text style={[styles.maxScoreLabel, { color: theme.muted }]}>/ {q.maxScore || 1}</Text>
                  </View>
                </View>
              );
            })}

            <Button
              title={gradeLoading ? 'Submitting Grade...' : 'Save and Submit Grade'}
              onPress={handleGradeSubmit}
              disabled={gradeLoading}
            />
          </View>
        ) : (
          /* Submissions List View */
          <View style={styles.submissionsWrapper}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Candidate Submissions</Text>
            {submissions.length === 0 ? (
              <View style={styles.emptySubmissions}>
                <Ionicons name="people-outline" size={40} color={theme.muted} />
                <Text style={[styles.emptySubmissionsText, { color: theme.muted }]}>No submissions yet for this exam.</Text>
              </View>
            ) : (
              submissions.map((sub, idx) => (
                <View key={sub._id || idx} style={[styles.submissionRow, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.candName, { color: theme.text }]}>
                      {getCandidateDisplayName(sub)}
                    </Text>
                    <Text style={[styles.candEmail, { color: theme.muted }]}>
                      {getCandidateDisplayEmail(sub)}
                    </Text>
                    <View style={styles.submissionMeta}>
                      <Text style={[styles.statusText, { color: sub.status === 'graded' ? theme.success : theme.info }]}>
                        {sub.status?.toUpperCase()}
                      </Text>
                      <Text style={[styles.metaDivider, { color: theme.border }]}>|</Text>
                      <Text style={[styles.scoreSummary, { color: theme.text }]}>
                        Score: {sub.totalScore || 0} pts
                      </Text>
                    </View>
                  </View>
                  <Pressable 
                    style={[styles.gradeBtn, { backgroundColor: theme.primary }]}
                    onPress={() => selectSubmissionForGrading(sub)}
                  >
                    <Text style={[styles.gradeBtnText, { color: theme.onPrimary }]}>
                      {sub.status === 'graded' ? 'Regrade' : 'Grade'}
                    </Text>
                  </Pressable>
                </View>
              ))
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
  infoCard: { padding: 16, borderRadius: 20, borderWidth: 1, marginBottom: 20 },
  examTitle: { fontSize: 18, fontWeight: '800', marginBottom: 6 },
  examDesc: { fontSize: 14, lineHeight: 20, marginBottom: 12 },
  metaRow: { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
  badge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  badgeText: { fontSize: 12, fontWeight: '700' },
  submissionsWrapper: { marginTop: 10 },
  sectionTitle: { fontSize: 16, fontWeight: '700', marginBottom: 12 },
  emptySubmissions: { padding: 40, alignItems: 'center', justifyContent: 'center', gap: 10 },
  emptySubmissionsText: { fontSize: 14, fontStyle: 'italic', textAlign: 'center' },
  submissionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderWidth: 1, borderRadius: 18, padding: 14, marginBottom: 10 },
  candName: { fontSize: 15, fontWeight: '700' },
  candEmail: { fontSize: 12, marginTop: 2 },
  submissionMeta: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
  statusText: { fontSize: 11, fontWeight: '800' },
  metaDivider: { fontSize: 12 },
  scoreSummary: { fontSize: 12, fontWeight: '600' },
  gradeBtn: { paddingVertical: 8, paddingHorizontal: 16, borderRadius: 10 },
  gradeBtnText: { fontSize: 12, fontWeight: '800' },
  gradingWrapper: { marginTop: 10 },
  gradingHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  studentName: { fontSize: 16, fontWeight: '800' },
  studentEmail: { fontSize: 13 },
  cancelBtn: { paddingVertical: 6, paddingHorizontal: 12 },
  cancelBtnText: { fontWeight: '700' },
  questionCard: { borderWidth: 1, borderRadius: 20, padding: 16, marginBottom: 16 },
  questionCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  questionNum: { fontSize: 14, fontWeight: '800' },
  typeBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  typeBadgeText: { fontSize: 10, fontWeight: '800' },
  questionText: { fontSize: 15, fontWeight: '600', marginBottom: 14, lineHeight: 22 },
  optionsList: { gap: 8, marginBottom: 14 },
  optionRow: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10, borderRadius: 12, borderWidth: 1, borderColor: 'transparent' },
  optionText: { fontSize: 14 },
  theoryAnswerBox: { padding: 12, borderRadius: 12, marginBottom: 14 },
  theoryAnswerLabel: { fontSize: 11, fontWeight: '700', marginBottom: 4 },
  theoryAnswerText: { fontSize: 14, lineHeight: 20 },
  gradeInputRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 8 },
  gradeInputLabel: { fontSize: 14, fontWeight: '750' },
  scoreInput: { borderWidth: 1, borderRadius: 10, width: 60, paddingVertical: 6, paddingHorizontal: 10, textAlign: 'center', fontSize: 14, fontWeight: '700' },
  maxScoreLabel: { fontSize: 14, fontWeight: '600' },
});
