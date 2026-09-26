import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TextInput, Pressable, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import api from '../../api/api';
import KeyboardAwareScrollView from '../../components/ui/KeyboardAwareScrollView';

export default function TopicFormScreen({ navigation, route }) {
  const { classroomId, topic, aiResult, aiAction } = route.params || {};
  const { theme } = useTheme();

  const [form, setForm] = useState({ name: '', description: '' });
  const [editingTopic, setEditingTopic] = useState(null);
  const [pendingTopicBatch, setPendingTopicBatch] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (topic) {
      setEditingTopic(topic);
      setForm({ name: topic.name || '', description: topic.description || '' });
      return;
    }
    if (aiResult) {
      if (aiAction === 'syllabus' && Array.isArray(aiResult.topics)) {
        const batch = aiResult.topics.filter((item) => item?.name);
        const first = batch[0];
        if (first) {
          setPendingTopicBatch(batch);
          setForm({ name: first.name || '', description: first.description || '' });
        }
      } else if (aiAction === 'topic' || aiAction === 'syllabus') {
        setForm({ name: aiResult.name || '', description: aiResult.description || '' });
      }
    }
  }, [topic, aiResult, aiAction]);

  const handleSubmit = async () => {
    if (!form.name.trim()) {
      Alert.alert('Missing name', 'Please enter a topic name.');
      return;
    }
    setSaving(true);
    try {
      if (editingTopic) {
        await api.put(`/topics/${editingTopic._id}`, {
          name: form.name.trim(),
          description: form.description.trim(),
        });
        Alert.alert('Updated', 'Topic details saved.');
        navigation.goBack();
        return;
      }

      const batch = pendingTopicBatch?.length
        ? [{ name: form.name, description: form.description }, ...pendingTopicBatch.slice(1)]
        : [{ name: form.name, description: form.description }];

      const created = await Promise.all(batch.map((item, index) => api.post('/topics', {
        name: item.name,
        description: item.description || '',
        classroomId,
        order: (topic ? topic.order : 0) + index,
      })));
      Alert.alert('Created!', `${created.length} topic${created.length === 1 ? '' : 's'} added to curriculum.`);
      navigation.goBack();
    } catch (err) {
      Alert.alert('Error', err?.response?.data?.message || 'Failed to save topic.');
    } finally {
      setSaving(false);
    }
  };

  const isEditing = Boolean(editingTopic);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={[styles.header, { borderBottomColor: theme.border }]}>
        <Pressable onPress={() => navigation.goBack()} style={styles.iconButton}>
          <Ionicons name="arrow-back-outline" size={24} color={theme.text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: theme.text }]}>{isEditing ? 'Edit Topic' : 'Add Topic'}</Text>
        <View style={{ width: 24 }} />
      </View>

      <KeyboardAwareScrollView contentContainerStyle={styles.content}>
        {pendingTopicBatch?.length > 1 ? (
          <View style={[styles.batchNotice, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Ionicons name="layers-outline" size={18} color={theme.primary} />
            <Text style={[styles.batchNoticeText, { color: theme.muted }]}>
              This syllabus has {pendingTopicBatch.length} topics. The first one is shown below; the rest will be created together.
            </Text>
          </View>
        ) : null}

        <Text style={[styles.fieldLabel, { color: theme.text }]}>Topic name <Text style={{ color: theme.danger }}>*</Text></Text>
        <TextInput
          style={[styles.input, { backgroundColor: theme.surface, borderColor: theme.border, color: theme.text }]}
          placeholder="e.g. Introduction to Algebra"
          placeholderTextColor={theme.muted}
          value={form.name}
          onChangeText={(text) => setForm({ ...form, name: text })}
          autoCapitalize="words"
        />
        <Text style={[styles.fieldLabel, { color: theme.text }]}>Description <Text style={[styles.optionalLabel, { color: theme.muted }]}>(optional)</Text></Text>
        <TextInput
          style={[styles.input, styles.textArea, { backgroundColor: theme.surface, borderColor: theme.border, color: theme.text }]}
          placeholder="What will students cover in this topic?"
          placeholderTextColor={theme.muted}
          value={form.description}
          onChangeText={(text) => setForm({ ...form, description: text })}
          multiline
          textAlignVertical="top"
        />

        <Pressable style={[styles.submitBtn, { backgroundColor: theme.primary }, saving && { opacity: 0.7 }]} onPress={handleSubmit} disabled={saving}>
          {saving ? (
            <ActivityIndicator color={theme.onPrimary} />
          ) : (
            <Text style={[styles.submitBtnText, { color: theme.onPrimary }]}>
              {isEditing ? 'Save Topic' : 'Add Topic'}
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
  batchNotice: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 14, borderWidth: 1, padding: 12, marginBottom: 16 },
  batchNoticeText: { flex: 1, fontSize: 12, lineHeight: 17 },
  fieldLabel: { fontSize: 12, fontWeight: '800', marginBottom: 6 },
  optionalLabel: { fontSize: 11, fontWeight: '500' },
  input: { borderWidth: 1, borderRadius: 18, paddingHorizontal: 16, paddingVertical: 14, fontSize: 14, marginBottom: 12 },
  textArea: { minHeight: 100, textAlignVertical: 'top' },
  submitBtn: { borderRadius: 18, paddingVertical: 16, alignItems: 'center', marginTop: 8 },
  submitBtnText: { fontWeight: '800', fontSize: 14 },
});