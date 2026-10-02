import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TextInput, Pressable, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import api from '../../api/api';
import DateTimePicker from '../../components/ui/DateTimePicker';
import KeyboardAwareScrollView from '../../components/ui/KeyboardAwareScrollView';

const EMPTY_QUESTION = () => ({ questionText: '', questionType: 'mcq', options: ['', '', '', ''], correctOption: '', maxScore: '1' });

const EMPTY_FORM = {
  title: '',
  description: '',
  duration: '60',
  accessMode: 'registered',
  dueDate: '',
  resultPublishTime: '',
};

export default function ExamFormScreen({ navigation, route }) {
  const { classId, exam, aiResult } = route.params || {};
  const { theme } = useTheme();

  const isClassScoped = Boolean(classId);

  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [questions, setQuestions] = useState([EMPTY_QUESTION()]);
  const [editingExam, setEditingExam] = useState(exam || null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (exam) {
      setForm({
        title: exam.title || '',
        description: exam.description || '',
        duration: String(exam.duration || 60),
        accessMode: exam.accessMode || 'registered',
        dueDate: exam.dueDate ? new Date(exam.dueDate).toISOString().slice(0, 16) : '',
        resultPublishTime: exam.resultPublishTime ? new Date(exam.resultPublishTime).toISOString().slice(0, 16) : '',
      });
      setQuestions((exam.questions || []).map((q) => ({
        questionText: q.questionText || '',
        questionType: q.questionType || 'mcq',
        options: q.options?.length ? q.options : ['', '', '', ''],
        correctOption: q.correctOption || '',
        maxScore: String(q.maxScore || 1),
      })));
      return;
    }
    if (aiResult) {
      setForm((prev) => ({
        ...prev,
        title: aiResult.title || prev.title,
        description: aiResult.description || prev.description,
        duration: String(aiResult.duration || prev.duration),
      }));
      setQuestions(prev => aiResult.questions?.length ? aiResult.questions.map((q) => ({
        questionText: q.questionText || '',
        questionType: q.questionType || (q.options?.length ? 'mcq' : 'theory'),
        options: q.options || ['', '', '', ''],
        correctOption: q.correctOption || (typeof q.correctOptionIndex === 'number' ? q.options?.[q.correctOptionIndex] || '' : ''),
        maxScore: String(q.maxScore || '1'),
      })) : prev);
    }
  }, [exam, aiResult]);

  const updateQuestion = (idx, field, value) => setQuestions(prev => prev.map((q, i) => i === idx ? { ...q, [field]: value } : q));
  const updateOption = (qIdx, oIdx, value) => setQuestions(prev => prev.map((q, i) => {
    if (i !== qIdx) return q;
    const opts = [...q.options];
    const wasCorrect = q.correctOption === opts[oIdx];
    opts[oIdx] = value;
    return { ...q, options: opts, correctOption: wasCorrect ? value : q.correctOption };
  }));
  const addQuestion = () => setQuestions(prev => [...prev, EMPTY_QUESTION()]);
  const removeQuestion = (idx) => setQuestions(prev => prev.filter((_, i) => i !== idx));

  const handleSubmit = async () => {
    if (!form.title.trim()) { Alert.alert('Missing title', 'Enter exam title.'); return; }
    if (!form.duration || isNaN(Number(form.duration)) || Number(form.duration) <= 0) { Alert.alert('Invalid duration', 'Enter a valid duration in minutes.'); return; }
    if (questions.length === 0) { Alert.alert('No Questions', 'Add at least one question.'); return; }
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      if (!q.questionText.trim()) { Alert.alert('Error', `Question ${i + 1} has no text.`); return; }
      if (q.questionType === 'mcq') {
        const opts = q.options.filter(o => o.trim());
        if (opts.length < 2) { Alert.alert('Invalid Options', `Question ${i + 1} needs at least 2 options.`); return; }
        if (!opts.includes(q.correctOption)) { Alert.alert('Invalid Correct Option', `Question ${i + 1}: correct option must match one of the options.`); return; }
      }
    }

    const isEditing = Boolean(editingExam);
    setSaving(true);
    try {
      const payload = {
        title: form.title,
        description: form.description,
        duration: Number(form.duration),
        accessMode: form.accessMode,
        questions: questions.map(q => ({
          questionText: q.questionText,
          questionType: q.questionType,
          options: q.questionType === 'mcq' ? q.options.filter(o => o.trim()) : [],
          correctOption: q.questionType === 'mcq' ? q.correctOption : undefined,
          maxScore: Number(q.maxScore) || 1,
        })),
      };
      if (isClassScoped) {
        payload.classId = classId;
        payload.dueDate = form.dueDate || undefined;
        payload.resultPublishTime = form.resultPublishTime || undefined;
      }
      if (isEditing) {
        await api.put(`/exams/${editingExam._id}`, payload);
        Alert.alert(isClassScoped ? 'Updated!' : 'Updated!', 'Exam updated.');
      } else {
        await api.post('/exams', payload);
        Alert.alert('Created!', isClassScoped ? 'Exam scheduled.' : 'Exam has been created successfully.');
      }
      navigation.goBack();
    } catch (err) {
      Alert.alert('Error', err?.response?.data?.message || 'Failed to save exam.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={[styles.header, { borderBottomColor: theme.border }]}>
        <Pressable onPress={() => navigation.goBack()} style={styles.iconButton}>
          <Ionicons name="arrow-back-outline" size={24} color={theme.text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: theme.text }]}>{editingExam ? 'Edit Exam' : isClassScoped ? 'Schedule Exam' : 'Create Exam'}</Text>
        <View style={{ width: 24 }} />
      </View>

      <KeyboardAwareScrollView contentContainerStyle={styles.content}>
        <TextInput
          style={[styles.input, { backgroundColor: theme.surface, borderColor: theme.border, color: theme.text }]}
          placeholder="Exam Title *"
          placeholderTextColor={theme.muted}
          value={form.title}
          onChangeText={t => setForm({ ...form, title: t })}
        />
        <TextInput
          style={[styles.input, styles.textArea, { backgroundColor: theme.surface, borderColor: theme.border, color: theme.text }]}
          placeholder="Description (optional)"
          placeholderTextColor={theme.muted}
          value={form.description}
          onChangeText={t => setForm({ ...form, description: t })}
          multiline
        />
        <TextInput
          style={[styles.input, { backgroundColor: theme.surface, borderColor: theme.border, color: theme.text }]}
          placeholder="Duration (minutes) *"
          placeholderTextColor={theme.muted}
          keyboardType="numeric"
          value={form.duration}
          onChangeText={t => setForm({ ...form, duration: t })}
        />

        {isClassScoped && (
          <>
            <DateTimePicker
              label="Due Date (optional)"
              value={form.dueDate}
              onChange={t => setForm({ ...form, dueDate: t })}
              mode="datetime"
              placeholder="Select exam due date"
            />
            <DateTimePicker
              label="Release Results At (optional)"
              value={form.resultPublishTime}
              onChange={t => setForm({ ...form, resultPublishTime: t })}
              mode="datetime"
              placeholder="Release results immediately"
            />
          </>
        )}

        <Text style={[styles.fieldLabel, { color: theme.muted }]}>Access Mode</Text>
        <View style={styles.toggleRow}>
          {['registered', 'open'].map(mode => (
            <Pressable
              key={mode}
              style={[styles.toggleChip, { borderColor: theme.border }, form.accessMode === mode && { backgroundColor: theme.primary, borderColor: theme.primary }]}
              onPress={() => setForm({ ...form, accessMode: mode })}
            >
              <Text style={[styles.toggleChipText, { color: theme.muted }, form.accessMode === mode && { color: theme.onPrimary }]}>
                {mode.toUpperCase()}
              </Text>
            </Pressable>
          ))}
        </View>

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

            <View style={styles.questionTypeRow}>
              {['mcq', 'theory'].map(type => (
                <Pressable
                  key={type}
                  style={[styles.toggleChip, { borderColor: theme.border, marginBottom: 10 }, q.questionType === type && { backgroundColor: theme.primary, borderColor: theme.primary }]}
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
                  <View
                    key={oIdx}
                    style={[styles.optionEditor, { backgroundColor: theme.background, borderColor: q.correctOption === opt && opt.trim() ? theme.success : theme.border }]}
                  >
                    <TextInput style={[styles.optionInput, { color: theme.text }]} placeholder={`Option ${oIdx + 1}`} placeholderTextColor={theme.muted} value={opt} onChangeText={v => updateOption(qIdx, oIdx, v)} />
                    <Pressable onPress={() => opt.trim() && updateQuestion(qIdx, 'correctOption', opt)} hitSlop={8} accessibilityRole="radio" accessibilityState={{ selected: q.correctOption === opt && !!opt.trim() }}>
                      <Ionicons name={q.correctOption === opt && opt.trim() ? 'checkmark-circle' : 'ellipse-outline'} size={22} color={q.correctOption === opt && opt.trim() ? theme.success : theme.muted} />
                    </Pressable>
                  </View>
                ))}
                <Text style={[styles.helperText, { color: theme.muted }]}>Tap the check icon to mark the correct answer.</Text>
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
          style={[styles.submitBtn, { backgroundColor: theme.primary }, saving && { opacity: 0.7 }]}
          onPress={handleSubmit}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator color={theme.onPrimary} />
          ) : (
            <Text style={[styles.submitBtnText, { color: theme.onPrimary }]}>
              {editingExam ? 'Save Exam' : 'Create Exam'}
            </Text>
          )}
        </Pressable>
      </KeyboardAwareScrollView>
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
  headerTitle: { fontSize: 18, fontWeight: '800', flex: 1, textAlign: 'center' },
  content: { padding: 20, paddingBottom: 40 },
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
  questionTypeRow: { flexDirection: 'row', gap: 10 },
  optionEditor: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 10, marginBottom: 8, paddingLeft: 10, paddingRight: 12 },
  optionInput: { flex: 1, paddingVertical: 10, paddingHorizontal: 0, fontSize: 14 },
  helperText: { fontSize: 12 },
  scoreRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 6 },
  scoreInput: { borderWidth: 1, borderRadius: 10, width: 60, paddingVertical: 6, paddingHorizontal: 10, textAlign: 'center', fontSize: 14, fontWeight: '700' },
  submitBtn: { borderRadius: 18, paddingVertical: 16, alignItems: 'center', marginTop: 8 },
  submitBtnText: { fontWeight: '800', fontSize: 14 },
});