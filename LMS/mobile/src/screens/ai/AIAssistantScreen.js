import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import api from '../../api/api';
import { useTheme } from '../../context/ThemeContext';

const MODES = [
  ['topic', 'Topic', 'book-outline', '/ai/generate-topic', 'topic'],
  ['assignment', 'Assignment', 'clipboard-outline', '/ai/generate-assignment', 'assignment'],
  ['exam', 'Exam', 'document-text-outline', '/ai/generate-exam', 'exam'],
  ['classroom', 'Class', 'school-outline', '/ai/generate-classroom', 'classroom'],
  ['powerpoint', 'Slides', 'easel-outline', '/ai/generate-powerpoint', 'presentation'],
  ['qna', 'Q&A', 'help-circle-outline', '/ai/qna-assistant', 'qna'],
  ['syllabus', 'Syllabus', 'list-outline', '/ai/generate-syllabus', 'syllabus'],
];

const initialForm = { subject: '', topicName: '', className: '', level: '', teacherHint: '', question: '', assignmentType: 'mcq', examType: 'mcq', questionCount: '5', slideCount: '8', duration: '60' };

export default function AIAssistantScreen({ navigation }) {
  const { theme } = useTheme();
  const generateButtonBackground = theme.mode === 'light' ? '#1E293B' : theme.primary;
  const generateButtonText = '#FFFFFF';
  const [mode, setMode] = useState('topic');
  const [form, setForm] = useState(initialForm);
  const [result, setResult] = useState(null);
  const [provider, setProvider] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [destinationClassrooms, setDestinationClassrooms] = useState([]);
  const config = useMemo(() => MODES.find((item) => item[0] === mode), [mode]);

  React.useEffect(() => { api.get('/ai/provider').then((res) => setProvider(res.data?.provider)).catch(() => {}); }, []);
  const setField = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  const generate = async () => {
    if (!form.subject.trim() && !form.topicName.trim() && !form.question.trim()) { setError('Enter a subject, topic, or question first.'); return; }
    setLoading(true); setError(''); setResult(null);
    try {
      const payload = { ...form, questionCount: Number(form.questionCount) || 5, slideCount: Number(form.slideCount) || 8, duration: Number(form.duration) || 60, context: `${form.subject} ${form.topicName}` };
      const res = await api.post(config[3], payload);
      setResult(res.data?.[config[4]] || res.data);
      if (['topic', 'assignment', 'exam', 'syllabus'].includes(mode)) {
        try {
          const classroomsRes = await api.get('/classrooms');
          const data = classroomsRes.data;
          setDestinationClassrooms(Array.isArray(data) ? data : data?.classrooms || data?.items || data?.data || []);
        } catch (_) {
          setDestinationClassrooms([]);
        }
      }
    } catch (err) { setError(err.response?.data?.message || 'AI generation failed. Please try again.'); }
    finally { setLoading(false); }
  };
  const renderFields = () => (
    <>
      {mode !== 'qna' && <Field label="Subject" value={form.subject} onChangeText={(v) => setField('subject', v)} placeholder="e.g. Mathematics" theme={theme} />}
      {mode === 'qna' ? <Field label="Question" value={form.question} onChangeText={(v) => setField('question', v)} placeholder="Ask an academic question..." multiline theme={theme} /> : <Field label="Topic or focus" value={form.topicName} onChangeText={(v) => setField('topicName', v)} placeholder="e.g. Quadratic equations" theme={theme} />}
      {['topic', 'assignment', 'exam', 'classroom', 'powerpoint', 'syllabus'].includes(mode) && <Field label="Class / level (optional)" value={form.className} onChangeText={(v) => setField('className', v)} placeholder="e.g. Senior Secondary 2" theme={theme} />}
      {['assignment', 'exam', 'powerpoint'].includes(mode) && <View style={styles.row}><Field label="Questions / slides" value={mode === 'powerpoint' ? form.slideCount : form.questionCount} onChangeText={(v) => setField(mode === 'powerpoint' ? 'slideCount' : 'questionCount', v.replace(/[^0-9]/g, ''))} keyboardType="number-pad" theme={theme} compact /></View>}
      {mode === 'assignment' && <ChoiceField label="Assignment type" value={form.assignmentType} options={['mcq', 'theory']} onChange={(value) => setField('assignmentType', value)} theme={theme} />}
      {mode === 'exam' && <ChoiceField label="Exam type" value={form.examType} options={['mcq', 'theory']} onChange={(value) => setField('examType', value)} theme={theme} />}
      {mode !== 'qna' && <Field label="Extra instructions (optional)" value={form.teacherHint} onChangeText={(v) => setField('teacherHint', v)} placeholder="Learning goals, tone, or constraints" multiline theme={theme} />}
    </>
  );
  return <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
    <View style={[styles.header, { borderBottomColor: theme.border }]}><Pressable onPress={() => navigation.goBack()}><Ionicons name="arrow-back-outline" size={24} color={theme.text} /></Pressable><Text style={[styles.title, { color: theme.text }]}>AI Assistant</Text><View style={{ width: 24 }} /></View>
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Text style={[styles.subtitle, { color: theme.muted }]}>Create lessons, assessments, slides, and get academic help.</Text>
      {provider && <Text style={[styles.provider, { color: theme.primary }]}>Powered by {provider === 'gemini' ? 'Google Gemini' : 'Groq'}</Text>}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.modeList}>{MODES.map(([key, label, icon]) => <Pressable key={key} onPress={() => { setMode(key); setResult(null); setError(''); }} style={[styles.mode, { borderColor: mode === key ? theme.primary : theme.border, backgroundColor: mode === key ? theme.surfaceElevated : theme.surface }]}><Ionicons name={icon} size={18} color={mode === key ? theme.primary : theme.muted} /><Text style={[styles.modeText, { color: mode === key ? theme.text : theme.muted }]}>{label}</Text></Pressable>)}</ScrollView>
      <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>{renderFields()}<Pressable onPress={generate} disabled={loading} style={[styles.generate, { backgroundColor: generateButtonBackground }]}>{loading ? <ActivityIndicator color={generateButtonText} /> : <><Ionicons name="sparkles-outline" size={19} color={generateButtonText} /><Text allowFontScaling={false} numberOfLines={1} style={[styles.generateText, { color: generateButtonText }]}>Generate with AI</Text></>}</Pressable>{error ? <Text style={[styles.error, { color: theme.danger }]}>{error}</Text> : null}</View>
      {result && <Result result={result} mode={mode} theme={theme} classrooms={destinationClassrooms} onUseResult={(action, classroom) => {
        if (action === 'classroom') navigation.navigate('Classes', { aiAction: 'classroom', aiResult: result });
        else if (classroom?._id) navigation.navigate('ClassroomDetail', { classroomId: classroom._id, aiAction: action, aiResult: result });
      }} />}
    </ScrollView>
  </SafeAreaView>;
}

function Field({ label, value, onChangeText, placeholder, multiline, keyboardType, theme, compact }) { return <View style={[styles.field, compact && { flex: 1 }]}><Text style={[styles.label, { color: theme.muted }]}>{label}</Text><TextInput value={String(value || '')} onChangeText={onChangeText} placeholder={placeholder} placeholderTextColor={theme.muted} multiline={multiline} keyboardType={keyboardType} style={[styles.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.background }, multiline && styles.multiline]} /></View>; }
function ChoiceField({ label, value, options, onChange, theme }) { return <View style={styles.field}><Text style={[styles.label, { color: theme.muted }]}>{label}</Text><View style={styles.choiceRow}>{options.map((option) => <Pressable key={option} onPress={() => onChange(option)} style={[styles.choice, { borderColor: value === option ? theme.primary : theme.border, backgroundColor: value === option ? theme.surfaceElevated : theme.surface }]}><Text style={[styles.choiceText, { color: value === option ? theme.text : theme.muted }]}>{option.toUpperCase()}</Text></Pressable>)}</View></View>; }
function Result({ result, mode, theme, classrooms, onUseResult }) {
  const title = mode === 'qna' ? 'AI Answer' : 'Generated Content';
  const text = typeof result === 'string' ? result : result?.answer || result?.description || result?.title || result?.name || result?.presentationTitle || '';
  const questions = result?.questions || [];
  const topics = result?.topics || [];
  const slides = result?.slides || [];
  const canCreateClass = mode === 'classroom';
  const canAttachToClass = ['topic', 'assignment', 'exam', 'syllabus'].includes(mode);
  return <View style={[styles.result, { backgroundColor: theme.surface, borderColor: theme.border }]}>
    <Text style={[styles.resultTitle, { color: theme.text }]}>{title}</Text>
    {text ? <Text style={[styles.resultText, { color: theme.text }]}>{String(text)}</Text> : null}
    {(canCreateClass || canAttachToClass) && <View style={[styles.actionPanel, { backgroundColor: theme.surfaceElevated, borderColor: theme.border }]}>
      <Text style={[styles.actionTitle, { color: theme.text }]}>{canCreateClass ? 'Ready to use' : 'Add to a classroom'}</Text>
      <Text style={[styles.actionHint, { color: theme.muted }]}>{canCreateClass ? 'Open the class form with this AI content already filled in.' : 'Choose the classroom where this generated content should be created.'}</Text>
      {canCreateClass ? <Pressable style={[styles.useButton, { backgroundColor: theme.primary }]} onPress={() => onUseResult('classroom')}><Ionicons name="add-circle-outline" size={16} color={theme.onPrimary} /><Text style={[styles.useButtonText, { color: theme.onPrimary }]}>Create classroom</Text></Pressable> : classrooms?.length ? classrooms.map((classroom) => <Pressable key={classroom._id} style={[styles.destination, { borderColor: theme.border }]} onPress={() => onUseResult(mode, classroom)}><View style={{ flex: 1 }}><Text style={[styles.destinationName, { color: theme.text }]} numberOfLines={1}>{classroom.name}</Text><Text style={[styles.destinationMeta, { color: theme.muted }]} numberOfLines={1}>{classroom.subject || classroom.level || 'Classroom'}</Text></View><Ionicons name="arrow-forward-circle-outline" size={21} color={theme.primary} /></Pressable>) : <Text style={[styles.actionHint, { color: theme.muted }]}>No classrooms available yet.</Text>}
    </View>}
    {topics.map((item, index) => <View key={`topic-${index}`} style={[styles.resultItem, { borderColor: theme.border }]}><Text style={[styles.itemTitle, { color: theme.text }]}>{index + 1}. {item.name}</Text><Text style={[styles.itemText, { color: theme.muted }]}>{item.description}</Text></View>)}
    {questions.map((item, index) => <View key={`question-${index}`} style={[styles.resultItem, { borderColor: theme.border }]}><Text style={[styles.itemTitle, { color: theme.text }]}>Q{index + 1}. {item.questionText}</Text>{item.options?.length ? <Text style={[styles.itemText, { color: theme.muted }]}>{item.options.join('  •  ')}</Text> : null}</View>)}
    {slides.map((item, index) => <View key={`slide-${index}`} style={[styles.resultItem, { borderColor: theme.border }]}><Text style={[styles.itemTitle, { color: theme.text }]}>{item.slideNumber || index + 1}. {item.title}</Text><Text style={[styles.itemText, { color: theme.muted }]}>{(item.bulletPoints || []).join(' • ')}</Text></View>)}
    {!text && !topics.length && !questions.length && !slides.length ? <Text style={[styles.json, { color: theme.muted }]}>{JSON.stringify(result, null, 2)}</Text> : null}
  </View>;
}

const styles = StyleSheet.create({ container: { flex: 1 }, header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1 }, title: { fontSize: 18, fontWeight: '800' }, content: { padding: 16, paddingBottom: 40 }, subtitle: { fontSize: 14, lineHeight: 20 }, provider: { fontSize: 11, fontWeight: '700', marginTop: 6 }, modeList: { gap: 8, paddingVertical: 18 }, mode: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 9 }, modeText: { fontSize: 12, fontWeight: '700' }, card: { borderWidth: 1, borderRadius: 16, padding: 16 }, field: { marginBottom: 13 }, row: { flexDirection: 'row' }, label: { fontSize: 11, fontWeight: '800', textTransform: 'uppercase', marginBottom: 6 }, input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 11, fontSize: 14 }, multiline: { minHeight: 76, textAlignVertical: 'top' }, choiceRow: { flexDirection: 'row', gap: 8 }, choice: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10 }, choiceText: { fontSize: 11, fontWeight: '800' }, generate: { borderRadius: 11, padding: 14, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8, marginTop: 4 }, generateText: { fontSize: 14, fontWeight: '800' }, error: { marginTop: 12, fontSize: 13 }, result: { borderWidth: 1, borderRadius: 16, padding: 16, marginTop: 16 }, resultTitle: { fontSize: 16, fontWeight: '800', marginBottom: 10 }, resultText: { fontSize: 15, lineHeight: 23, marginBottom: 12 }, actionPanel: { borderWidth: 1, borderRadius: 12, padding: 12, marginBottom: 12 }, actionTitle: { fontSize: 13, fontWeight: '800' }, actionHint: { fontSize: 11, lineHeight: 16, marginTop: 3, marginBottom: 9 }, useButton: { borderRadius: 10, paddingVertical: 10, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6 }, useButtonText: { fontSize: 12, fontWeight: '800' }, destination: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 10, padding: 9, marginTop: 7 }, destinationName: { fontSize: 12, fontWeight: '800' }, destinationMeta: { fontSize: 10, marginTop: 2 }, resultItem: { borderTopWidth: 1, paddingVertical: 10 }, itemTitle: { fontSize: 13, fontWeight: '800', lineHeight: 19 }, itemText: { fontSize: 12, lineHeight: 18, marginTop: 3 }, json: { fontFamily: 'monospace', fontSize: 11, lineHeight: 16 }, });
