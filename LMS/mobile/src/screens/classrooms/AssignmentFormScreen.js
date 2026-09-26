import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TextInput, Pressable, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import api from '../../api/api';
import DateTimePicker from '../../components/ui/DateTimePicker';
import KeyboardAwareScrollView from '../../components/ui/KeyboardAwareScrollView';

const EMPTY_QUESTION = () => ({ questionText: '', options: ['', '', '', ''], correctOption: '', maxScore: '1' });

const EMPTY_FORM = {
  title: '',
  description: '',
  assignmentType: 'mcq',
  dueDate: '',
  publishResultsAt: '',
  maxScore: '100',
  published: true,
  questions: [EMPTY_QUESTION()],
};

export default function AssignmentFormScreen({ navigation, route }) {
  const { classroomId, assignment, aiResult } = route.params || {};
  const { theme } = useTheme();

  const [form, setForm] = useState({ ...EMPTY_FORM, questions: [EMPTY_QUESTION()] });
  const [editingAssignment, setEditingAssignment] = useState(assignment || null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (assignment) {
      setForm({
        title: assignment.title || '',
        description: assignment.description || '',
        assignmentType: assignment.assignmentType || 'mcq',
        dueDate: assignment.dueDate ? new Date(assignment.dueDate).toISOString().slice(0, 10) : '',
        publishResultsAt: assignment.publishResultsAt || '',
        maxScore: String(assignment.maxScore || 100),
        published: assignment.published !== false,
        questions: (assignment.questions || []).map((q) => ({
          questionText: q.questionText || '',
          options: q.options?.length ? q.options : ['', '', '', ''],
          correctOption: q.correctOption || '',
          maxScore: String(q.maxScore || 1),
        })),
      });
      return;
    }
    if (aiResult) {
      setForm((prev) => ({
        ...prev,
        title: aiResult.title || prev.title,
        description: aiResult.description || prev.description,
        maxScore: String(aiResult.maxScore || prev.maxScore),
        assignmentType: aiResult.questions?.[0]?.options?.length ? 'mcq' : 'theory',
        questions: aiResult.questions?.length ? aiResult.questions.map((q) => ({
          questionText: q.questionText || '',
          options: q.options || ['', '', '', ''],
          correctOption: q.correctOption || (typeof q.correctOptionIndex === 'number' ? q.options?.[q.correctOptionIndex] || '' : ''),
          maxScore: String(q.maxScore || '1'),
        })) : prev.questions,
      }));
    }
  }, [assignment, aiResult]);

  const updateQuestion = (idx, field, value) => {
    setForm(prev => ({ ...prev, questions: prev.questions.map((q, i) => i === idx ? { ...q, [field]: value } : q) }));
  };

  const updateOption = (qIdx, oIdx, value) => {
    setForm(prev => ({
      ...prev,
      questions: prev.questions.map((q, i) => {
        if (i !== qIdx) return q;
        const opts = [...q.options];
        const wasCorrect = q.correctOption === opts[oIdx];
        opts[oIdx] = value;
        return { ...q, options: opts, correctOption: wasCorrect ? value : q.correctOption };
      })
    }));
  };

  const addQuestion = () => setForm(prev => ({ ...prev, questions: [...prev.questions, EMPTY_QUESTION()] }));
  const removeQuestion = (idx) => setForm(prev => ({ ...prev, questions: prev.questions.filter((_, i) => i !== idx) }));

  const handleSubmit = async () => {
    if (!form.title.trim()) { Alert.alert('Missing title', 'Please enter assignment title.'); return; }
    if (form.questions.length === 0) { Alert.alert('No Questions', 'Add at least one question.'); return; }
    for (let i = 0; i < form.questions.length; i++) {
      const q = form.questions[i];
      if (!q.questionText.trim()) { Alert.alert('Error', `Question ${i + 1} has no text.`); return; }
      if (form.assignmentType === 'mcq') {
        const opts = q.options.filter(o => o.trim());
        if (opts.length < 2) { Alert.alert('Error', `Question ${i + 1} needs at least 2 options.`); return; }
        if (!opts.includes(q.correctOption)) { Alert.alert('Error', `Question ${i + 1} correct option must match one of the options.`); return; }
      }
    }

    const isEditing = Boolean(editingAssignment);
    setSaving(true);
    try {
      const payload = {
        title: form.title,
        description: form.description,
        assignmentType: form.assignmentType,
        classroomId,
        maxScore: Number(form.maxScore) || 100,
        dueDate: form.dueDate || undefined,
        publishResultsAt: form.assignmentType === 'mcq' ? (form.publishResultsAt || undefined) : undefined,
        questions: form.questions.map(q => ({
          questionText: q.questionText,
          options: form.assignmentType === 'mcq' ? q.options.filter(o => o.trim()) : [],
          correctOption: form.assignmentType === 'mcq' ? q.correctOption : undefined,
          maxScore: Number(q.maxScore) || 1,
        })),
      };
      payload.published = form.published;
      if (isEditing) {
        await api.put(`/assignments/${editingAssignment._id}`, payload);
        Alert.alert('Updated!', 'Assignment updated.');
      } else {
        await api.post('/assignments', payload);
        Alert.alert('Created!', 'Assignment posted to classroom.');
      }
      navigation.goBack();
    } catch (err) {
      Alert.alert('Error', err?.response?.data?.message || 'Failed to save assignment.');
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
        <Text style={[styles.headerTitle, { color: theme.text }]}>{editingAssignment ? 'Edit Assignment' : 'New Assignment'}</Text>
        <View style={{ width: 24 }} />
      </View>

      <KeyboardAwareScrollView contentContainerStyle={styles.content}>
        <TextInput
          style={[styles.input, { backgroundColor: theme.surface, borderColor: theme.border, color: theme.text }]}
          placeholder="Title *"
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
          placeholder="Max Score (default 100)"
          placeholderTextColor={theme.muted}
          keyboardType="numeric"
          value={form.maxScore}
          onChangeText={t => setForm({ ...form, maxScore: t })}
        />
        <DateTimePicker
          label="Due Date"
          value={form.dueDate}
          onChange={t => setForm({ ...form, dueDate: t })}
          mode="date"
          placeholder="Select due date (optional)"
        />
        <View style={styles.inlineRow}>
          {['mcq', 'theory'].map(type => (
            <Pressable
              key={type}
              style={[styles.chip, { borderColor: theme.border }, form.assignmentType === type && { backgroundColor: theme.primary, borderColor: theme.primary }]}
              onPress={() => setForm({ ...form, assignmentType: type, publishResultsAt: type === 'theory' ? '' : form.publishResultsAt })}
            >
              <Text style={[styles.chipText, { color: theme.muted }, form.assignmentType === type && { color: theme.onPrimary }]}>{type.toUpperCase()}</Text>
            </Pressable>
          ))}
        </View>
        {form.assignmentType === 'mcq' && (
          <DateTimePicker
            label="Release Results At (optional)"
            value={form.publishResultsAt}
            onChange={t => setForm({ ...form, publishResultsAt: t })}
            mode="datetime"
            placeholder="Release results immediately"
          />
        )}
        <View style={styles.questionSectionHeader}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Questions</Text>
          <Pressable style={[styles.addQBtn, { backgroundColor: `${theme.primary}20` }]} onPress={addQuestion}>
            <Ionicons name="add-outline" size={16} color={theme.primary} />
            <Text style={[styles.addQBtnText, { color: theme.primary }]}>Add</Text>
          </Pressable>
        </View>
        {form.questions.map((q, qIdx) => (
          <View key={qIdx} style={[styles.questionBlock, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <View style={styles.questionBlockHeader}>
              <Text style={[styles.questionBlockNum, { color: theme.text }]}>Q{qIdx + 1}</Text>
              <Pressable onPress={() => removeQuestion(qIdx)} disabled={form.questions.length === 1}>
                <Ionicons name="trash-outline" size={16} color={form.questions.length === 1 ? theme.border : theme.danger} />
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
            {form.assignmentType === 'mcq' && (
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
        <Pressable style={[styles.submitBtn, { backgroundColor: theme.primary }, saving && { opacity: 0.7 }]} onPress={handleSubmit} disabled={saving}>
          {saving ? (
            <ActivityIndicator color={theme.onPrimary} />
          ) : (
            <Text style={[styles.submitBtnText, { color: theme.onPrimary }]}>
              {editingAssignment ? 'Save Assignment' : 'Create Assignment'}
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
  inlineRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 12 },
  chip: { paddingHorizontal: 14, paddingVertical: 10, borderWidth: 1, borderRadius: 16 },
  chipText: { fontSize: 13, fontWeight: '700' },
  questionSectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sectionTitle: { fontSize: 16, fontWeight: '700', marginBottom: 14 },
  addQBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 6, paddingHorizontal: 12, borderRadius: 10 },
  addQBtnText: { fontSize: 12, fontWeight: '700' },
  questionBlock: { borderRadius: 18, borderWidth: 1, padding: 14, marginBottom: 16 },
  questionBlockHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  questionBlockNum: { fontSize: 14, fontWeight: '800' },
  optionEditor: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 10, marginBottom: 8, paddingLeft: 10, paddingRight: 12 },
  optionInput: { flex: 1, paddingVertical: 10, paddingHorizontal: 0, fontSize: 14 },
  helperText: { fontSize: 12 },
  scoreRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 6 },
  fieldLabel: { fontSize: 13, fontWeight: '700', marginBottom: 3 },
  scoreInput: { borderWidth: 1, borderRadius: 10, width: 60, paddingVertical: 6, paddingHorizontal: 10, textAlign: 'center', fontSize: 14, fontWeight: '700' },
  submitBtn: { borderRadius: 18, paddingVertical: 16, alignItems: 'center', marginTop: 8 },
  submitBtnText: { fontWeight: '800', fontSize: 14 },
});