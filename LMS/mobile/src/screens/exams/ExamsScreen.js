import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, Pressable, RefreshControl, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import api from '../../api/api';
import { isStudent } from '../../utils/roles';
import { shareExamLink } from '../../utils/links';

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

export default function ExamsScreen({ navigation }) {
  const { user } = useAuth();
  const { theme } = useTheme();
  const [exams, setExams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

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

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      loadExams(false);
    });
    return unsubscribe;
  }, [navigation]);

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
              style={[styles.actionBtn, { backgroundColor: `${theme.primary}20` }]}
              onPress={() => shareExamLink(item)}
            >
              <Ionicons name="share-outline" size={14} color={theme.primary} />
              <Text style={[styles.actionBtnText, { color: theme.primary }]}>Share</Text>
            </Pressable>
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
            <Pressable onPress={() => navigation.navigate('ExamForm', {})} style={styles.iconButton}>
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
            <Pressable style={[styles.createEmptyBtn, { backgroundColor: theme.primary }]} onPress={() => navigation.navigate('ExamForm', {})}>
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
});
