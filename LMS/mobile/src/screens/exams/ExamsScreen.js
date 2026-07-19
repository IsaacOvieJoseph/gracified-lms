import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, Pressable, RefreshControl, Alert, Modal, ScrollView, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import api from '../../api/api';
import { isStudent, canManageClassroom } from '../../utils/roles';

const normalizeListResponse = (payload) => {
  if (Array.isArray(payload)) return payload;
  if (payload && typeof payload === 'object') {
    if (Array.isArray(payload.exams)) return payload.exams;
    if (Array.isArray(payload.data)) return payload.data;
    if (Array.isArray(payload.items)) return payload.items;
  }
  return [];
};

const isTeacherOrAdmin = (user) =>
  user && ['root_admin', 'school_admin', 'teacher', 'personal_teacher'].includes(user.role);

// Initial state for create exam form
const EMPTY_EXAM_FORM = {
  title: '',
  description: '',
  duration: '60',
  accessMode: 'registered',
  questions: [],
};

const EMPTY_QUESTION = { questionText: '', questionType: 'mcq', options: ['', '', '', ''], correctOption: '', maxScore: '1' };

export default function ExamsScreen({ navigation }) {
  const { user } = useAuth();
  const { theme } = useTheme();
  const [exams, setExams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  // Create Exam Modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [examForm, setExamForm] = useState(EMPTY_EXAM_FORM);
  const [questions, setQuestions] = useState([{ ...EMPTY_QUESTION }]);
  const [createLoading, setCreateLoading] = useState(false);

  const loadExams = async (showLoading = true) => {
    if (showLoading) setLoading(true);
    setError(null);
    try {
      const response = await api.get('/exams');
      setExams(normalizeListResponse(response.data));
    } catch (err) {
      setError(err?.response?.data?.message || 'Unable to load exams.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadExams();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    loadExams(false);
  };

  const handleExamPress = (item) => {
    if (isTeacherOrAdmin(user)) {
      navigation.navigate('ExamDetail', { examId: item._id });
    } else {
      if (item.linkToken) {
        navigation.navigate('ExamCenter', { token: item.linkToken });
      } else {
        Alert.alert('Unavailable', 'This exam is not active or missing a shareable link token.');
      }
    }
  };

  const handleTogglePublish = async (exam) => {
    try {
      await api.put(`/exams/${exam._id}`, { isPublished: !exam.isPublished });
      setExams(prev => prev.map(e => e._id === exam._id ? { ...e, isPublished: !e.isPublished } : e));
    } catch (err) {
      Alert.alert('Error', err?.response?.data?.message || 'Failed to update exam status.');
    }
  };

  const handleDeleteExam = (exam) => {
    Alert.alert(
      'Delete Exam',
      `Are you sure you want to permanently delete "${exam.title}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.delete(`/exams/${exam._id}`);
              setExams(prev => prev.filter(e => e._id !== exam._id));
            } catch (err) {
              Alert.alert('Error', err?.response?.data?.message || 'Failed to delete exam.');
            }
          }
        }
      ]
    );
  };

  // Questions management
  const addQuestion = () => {
    setQuestions(prev => [...prev, { ...EMPTY_QUESTION, options: ['', '', '', ''] }]);
  };

  const removeQuestion = (idx) => {
    setQuestions(prev => prev.filter((_, i) => i !== idx));
  };

  const updateQuestion = (idx, field, value) => {
    setQuestions(prev => prev.map((q, i) => i === idx ? { ...q, [field]: value } : q));
  };

  const updateOption = (qIdx, oIdx, value) => {
    setQuestions(prev => prev.map((q, i) => {
      if (i !== qIdx) return q;
      const newOpts = [...q.options];
      newOpts[oIdx] = value;
      return { ...q, options: newOpts };
    }));
  };

  const handleCreateExam = async () => {
    if (!examForm.title.trim()) {
      Alert.alert('Missing title', 'Please enter an exam title.');
      return;
    }
    if (!examForm.duration || isNaN(Number(examForm.duration)) || Number(examForm.duration) <= 0) {
      Alert.alert('Invalid Duration', 'Please enter a valid duration in minutes.');
      return;
    }
    if (questions.length === 0) {
      Alert.alert('No Questions', 'Please add at least one question.');
      return;
    }

    // Validate questions
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      if (!q.questionText.trim()) {
        Alert.alert('Missing Question', `Question ${i + 1} has no text.`);
        return;
      }
      if (q.questionType === 'mcq') {
        const filteredOpts = q.options.filter(o => o.trim());
        if (filteredOpts.length < 2) {
          Alert.alert('Invalid Options', `Question ${i + 1} needs at least 2 options.`);
          return;
        }
        if (!q.correctOption.trim() || !filteredOpts.includes(q.correctOption)) {
          Alert.alert('Invalid Correct Option', `Question ${i + 1}: correct option must be one of the listed options.`);
          return;
        }
      }
    }

    setCreateLoading(true);
    try {
      const payload = {
        title: examForm.title,
        description: examForm.description,
        duration: Number(examForm.duration),
        accessMode: examForm.accessMode,
        questions: questions.map(q => ({
          questionText: q.questionText,
          questionType: q.questionType,
          options: q.questionType === 'mcq' ? q.options.filter(o => o.trim()) : [],
          correctOption: q.questionType === 'mcq' ? q.correctOption : undefined,
          maxScore: Number(q.maxScore) || 1,
        }))
      };
      await api.post('/exams', payload);
      Alert.alert('Created!', 'Exam has been created successfully.');
      setShowCreateModal(false);
      setExamForm(EMPTY_EXAM_FORM);
      setQuestions([{ ...EMPTY_QUESTION, options: ['', '', '', ''] }]);
      loadExams(false);
    } catch (err) {
      Alert.alert('Error', err?.response?.data?.message || 'Failed to create exam.');
    } finally {
      setCreateLoading(false);
    }
  };

  const renderItem = ({ item }) => {
    return (
      <Pressable
        style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}
        onPress={() => handleExamPress(item)}
      >
        <View style={styles.cardHeader}>
          <Text style={[styles.classroomName, { color: theme.muted }]} numberOfLines={1}>
            {item.classroomId?.name || 'Global Exam'}
          </Text>
          <View style={[styles.badge, item.isPublished ? { backgroundColor: theme.success } : { backgroundColor: theme.neutral }]}>
            <Text style={[styles.badgeText, { color: theme.onPrimary }]}>
              {item.isPublished ? (isStudent(user) ? 'TAKE EXAM' : 'PUBLISHED') : 'DRAFT'}
            </Text>
          </View>
        </View>

        <Text style={[styles.title, { color: theme.text }]}>{item.title}</Text>

        <View style={styles.detailsRow}>
          <View style={styles.infoRow}>
            <Ionicons name="time-outline" size={14} color={theme.muted} />
            <Text style={[styles.infoText, { color: theme.muted }]}>{item.duration || 60} mins</Text>
          </View>
          <View style={[styles.infoRow, { marginLeft: 16 }]}>
            <Ionicons name="list-outline" size={14} color={theme.muted} />
            <Text style={[styles.infoText, { color: theme.muted }]}>{item.questions?.length || 0} questions</Text>
          </View>
          <View style={[styles.infoRow, { marginLeft: 16 }]}>
            <Ionicons name="ribbon-outline" size={14} color={theme.muted} />
            <Text style={[styles.infoText, { color: theme.muted }]}>{item.accessMode?.toUpperCase() || 'REGISTERED'}</Text>
          </View>
        </View>

        {/* Admin/Teacher management actions */}
        {isTeacherOrAdmin(user) && (
          <View style={styles.cardActions}>
            <Pressable
              style={[styles.actionBtn, { backgroundColor: item.isPublished ? `${theme.warning}20` : `${theme.success}20` }]}
              onPress={() => handleTogglePublish(item)}
            >
              <Ionicons name={item.isPublished ? 'eye-off-outline' : 'eye-outline'} size={14} color={item.isPublished ? theme.warning : theme.success} />
              <Text style={[styles.actionBtnText, { color: item.isPublished ? theme.warning : theme.success }]}>
                {item.isPublished ? 'Unpublish' : 'Publish'}
              </Text>
            </Pressable>
            <Pressable
              style={[styles.actionBtn, { backgroundColor: `${theme.danger}20` }]}
              onPress={() => handleDeleteExam(item)}
            >
              <Ionicons name="trash-outline" size={14} color={theme.danger} />
              <Text style={[styles.actionBtnText, { color: theme.danger }]}>Delete</Text>
            </Pressable>
          </View>
        )}
      </Pressable>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={[styles.header, { borderBottomColor: theme.border }]}>
        <Pressable onPress={() => navigation.goBack()} style={styles.iconButton}>
          <Ionicons name="arrow-back-outline" size={24} color={theme.text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: theme.text }]}>Exams Portal</Text>
        <View style={styles.headerRight}>
          {isTeacherOrAdmin(user) && (
            <Pressable onPress={() => setShowCreateModal(true)} style={styles.iconButton}>
              <Ionicons name="add-circle-outline" size={26} color={theme.primary} />
            </Pressable>
          )}
          <Pressable onPress={() => loadExams(true)} style={styles.iconButton}>
            <Ionicons name="refresh-outline" size={22} color={theme.text} />
          </Pressable>
        </View>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={theme.primary} style={{ marginTop: 40 }} />
      ) : error ? (
        <View style={styles.errorCard}>
          <Text style={[styles.errorText, { color: theme.danger }]}>{error}</Text>
          <Pressable style={[styles.retryBtn, { backgroundColor: theme.primary }]} onPress={() => loadExams()}>
            <Text style={[styles.retryBtnText, { color: theme.onPrimary }]}>Retry</Text>
          </Pressable>
        </View>
      ) : exams.length === 0 ? (
        <View style={styles.emptyCard}>
          <Ionicons name="journal-outline" size={48} color={theme.muted} />
          <Text style={[styles.emptyTitle, { color: theme.text }]}>No exams scheduled</Text>
          <Text style={[styles.emptyText, { color: theme.muted }]}>Any upcoming exams for your classrooms will appear here.</Text>
          {isTeacherOrAdmin(user) && (
            <Pressable style={[styles.createEmptyBtn, { backgroundColor: theme.primary }]} onPress={() => setShowCreateModal(true)}>
              <Ionicons name="add-outline" size={20} color={theme.onPrimary} />
              <Text style={[styles.createEmptyBtnText, { color: theme.onPrimary }]}>Create Exam</Text>
            </Pressable>
          )}
        </View>
      ) : (
        <FlatList
          data={exams}
          keyExtractor={(item) => item._id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />}
        />
      )}

      {/* Create Exam Modal */}
      <Modal visible={showCreateModal} animationType="slide" transparent onRequestClose={() => setShowCreateModal(false)}>
        <View style={[styles.modalOverlay, { backgroundColor: theme.overlay || 'rgba(0,0,0,0.6)' }]}>
          <View style={[styles.modalContainer, { backgroundColor: theme.background, borderColor: theme.border }]}>
            <View style={[styles.modalHeaderRow, { borderBottomColor: theme.border }]}>
              <Text style={[styles.modalTitle, { color: theme.text }]}>Create New Exam</Text>
              <Pressable onPress={() => setShowCreateModal(false)}>
                <Ionicons name="close" size={24} color={theme.muted} />
              </Pressable>
            </View>
            <ScrollView contentContainerStyle={styles.modalContent} keyboardShouldPersistTaps="handled">
              <TextInput
                style={[styles.input, { backgroundColor: theme.surface, borderColor: theme.border, color: theme.text }]}
                placeholder="Exam Title *"
                placeholderTextColor={theme.muted}
                value={examForm.title}
                onChangeText={t => setExamForm({ ...examForm, title: t })}
              />
              <TextInput
                style={[styles.input, styles.textArea, { backgroundColor: theme.surface, borderColor: theme.border, color: theme.text }]}
                placeholder="Description (optional)"
                placeholderTextColor={theme.muted}
                value={examForm.description}
                onChangeText={t => setExamForm({ ...examForm, description: t })}
                multiline
              />
              <TextInput
                style={[styles.input, { backgroundColor: theme.surface, borderColor: theme.border, color: theme.text }]}
                placeholder="Duration (minutes) *"
                placeholderTextColor={theme.muted}
                keyboardType="numeric"
                value={examForm.duration}
                onChangeText={t => setExamForm({ ...examForm, duration: t })}
              />

              {/* Access mode toggle */}
              <Text style={[styles.fieldLabel, { color: theme.muted }]}>Access Mode</Text>
              <View style={styles.toggleRow}>
                {['registered', 'open'].map(mode => (
                  <Pressable
                    key={mode}
                    style={[styles.toggleChip, { borderColor: theme.border }, examForm.accessMode === mode && { backgroundColor: theme.primary, borderColor: theme.primary }]}
                    onPress={() => setExamForm({ ...examForm, accessMode: mode })}
                  >
                    <Text style={[styles.toggleChipText, { color: theme.muted }, examForm.accessMode === mode && { color: theme.onPrimary }]}>
                      {mode.toUpperCase()}
                    </Text>
                  </Pressable>
                ))}
              </View>

              {/* Questions */}
              <View style={styles.questionHeader}>
                <Text style={[styles.fieldLabel, { color: theme.text }]}>Questions ({questions.length})</Text>
                <Pressable style={[styles.addQBtn, { backgroundColor: `${theme.primary}20` }]} onPress={addQuestion}>
                  <Ionicons name="add-outline" size={18} color={theme.primary} />
                  <Text style={[styles.addQBtnText, { color: theme.primary }]}>Add</Text>
                </Pressable>
              </View>

              {questions.map((q, qIdx) => (
                <View key={qIdx} style={[styles.questionBlock, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                  <View style={styles.questionBlockHeader}>
                    <Text style={[styles.questionBlockNum, { color: theme.text }]}>Q{qIdx + 1}</Text>
                    <Pressable onPress={() => removeQuestion(qIdx)} disabled={questions.length === 1}>
                      <Ionicons name="trash-outline" size={16} color={questions.length === 1 ? theme.border : theme.danger} />
                    </Pressable>
                  </View>

                  <TextInput
                    style={[styles.input, styles.textArea, { backgroundColor: theme.background, borderColor: theme.border, color: theme.text, minHeight: 70 }]}
                    placeholder="Question text *"
                    placeholderTextColor={theme.muted}
                    value={q.questionText}
                    onChangeText={v => updateQuestion(qIdx, 'questionText', v)}
                    multiline
                  />

                  <View style={styles.toggleRow}>
                    {['mcq', 'theory'].map(type => (
                      <Pressable
                        key={type}
                        style={[styles.toggleChip, { borderColor: theme.border }, q.questionType === type && { backgroundColor: theme.primary, borderColor: theme.primary }]}
                        onPress={() => updateQuestion(qIdx, 'questionType', type)}
                      >
                        <Text style={[styles.toggleChipText, { color: theme.muted }, q.questionType === type && { color: theme.onPrimary }]}>
                          {type.toUpperCase()}
                        </Text>
                      </Pressable>
                    ))}
                  </View>

                  {q.questionType === 'mcq' && (
                    <>
                      {q.options.map((opt, oIdx) => (
                        <TextInput
                          key={oIdx}
                          style={[styles.input, { backgroundColor: theme.background, borderColor: theme.border, color: theme.text, marginBottom: 8 }]}
                          placeholder={`Option ${oIdx + 1}`}
                          placeholderTextColor={theme.muted}
                          value={opt}
                          onChangeText={v => updateOption(qIdx, oIdx, v)}
                        />
                      ))}
                      <TextInput
                        style={[styles.input, { backgroundColor: theme.background, borderColor: `${theme.success}60`, color: theme.text }]}
                        placeholder="Correct option (must match one above exactly)"
                        placeholderTextColor={theme.muted}
                        value={q.correctOption}
                        onChangeText={v => updateQuestion(qIdx, 'correctOption', v)}
                      />
                    </>
                  )}

                  <View style={styles.scoreRow}>
                    <Text style={[styles.fieldLabel, { color: theme.muted }]}>Max Score:</Text>
                    <TextInput
                      style={[styles.scoreInput, { backgroundColor: theme.background, borderColor: theme.border, color: theme.text }]}
                      keyboardType="numeric"
                      value={q.maxScore}
                      onChangeText={v => updateQuestion(qIdx, 'maxScore', v)}
                    />
                  </View>
                </View>
              ))}

              <Pressable
                style={[styles.submitBtn, { backgroundColor: theme.primary }, createLoading && { opacity: 0.7 }]}
                onPress={handleCreateExam}
                disabled={createLoading}
              >
                <Text style={[styles.submitBtnText, { color: theme.onPrimary }]}>
                  {createLoading ? 'Creating...' : 'Create Exam'}
                </Text>
              </Pressable>
            </ScrollView>
          </View>
        </View>
      </Modal>
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
  iconButton: { padding: 4 },
  headerTitle: { fontSize: 18, fontWeight: '800', flex: 1 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  list: { padding: 16, paddingBottom: 30 },
  card: { borderRadius: 20, padding: 16, marginBottom: 12, borderWidth: 1 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  classroomName: { fontSize: 12, fontWeight: '700', flex: 1, marginRight: 8 },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  badgeText: { fontSize: 10, fontWeight: '800' },
  title: { fontSize: 16, fontWeight: '700', marginBottom: 14 },
  detailsRow: { flexDirection: 'row', alignItems: 'center' },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  infoText: { fontSize: 11, fontWeight: '600' },
  cardActions: { flexDirection: 'row', gap: 10, marginTop: 14 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 6, paddingHorizontal: 12, borderRadius: 10 },
  actionBtnText: { fontSize: 12, fontWeight: '700' },
  errorCard: { padding: 24, alignItems: 'center', marginTop: 40 },
  errorText: { fontSize: 15, textAlign: 'center', marginBottom: 16 },
  retryBtn: { borderRadius: 12, paddingVertical: 10, paddingHorizontal: 20 },
  retryBtnText: { fontWeight: '700' },
  emptyCard: { padding: 40, alignItems: 'center', marginTop: 60, gap: 10 },
  emptyTitle: { fontSize: 16, fontWeight: '700', marginTop: 6 },
  emptyText: { fontSize: 13, textAlign: 'center', lineHeight: 18 },
  createEmptyBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 16, paddingVertical: 12, paddingHorizontal: 24, marginTop: 8 },
  createEmptyBtnText: { fontWeight: '800', fontSize: 13 },
  modalOverlay: { flex: 1, justifyContent: 'flex-end' },
  modalContainer: { borderTopLeftRadius: 28, borderTopRightRadius: 28, borderWidth: 1, maxHeight: '94%' },
  modalHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1 },
  modalTitle: { fontSize: 18, fontWeight: '800' },
  modalContent: { padding: 20, paddingBottom: 40 },
  input: { borderWidth: 1, borderRadius: 16, paddingHorizontal: 16, paddingVertical: 12, fontSize: 14, marginBottom: 12 },
  textArea: { minHeight: 80, textAlignVertical: 'top' },
  fieldLabel: { fontSize: 13, fontWeight: '700', marginBottom: 8 },
  toggleRow: { flexDirection: 'row', gap: 10, marginBottom: 14 },
  toggleChip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 12, borderWidth: 1 },
  toggleChipText: { fontSize: 12, fontWeight: '700' },
  questionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  addQBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 6, paddingHorizontal: 12, borderRadius: 10 },
  addQBtnText: { fontSize: 12, fontWeight: '700' },
  questionBlock: { borderRadius: 18, borderWidth: 1, padding: 14, marginBottom: 16 },
  questionBlockHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  questionBlockNum: { fontSize: 14, fontWeight: '800' },
  scoreRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  scoreInput: { borderWidth: 1, borderRadius: 10, width: 60, paddingVertical: 6, paddingHorizontal: 10, textAlign: 'center', fontSize: 14, fontWeight: '700' },
  submitBtn: { borderRadius: 18, paddingVertical: 16, alignItems: 'center', marginTop: 8 },
  submitBtnText: { fontWeight: '800', fontSize: 14 },
});
