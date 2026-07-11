import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, Pressable, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import api from '../../api/api';

const normalizeListResponse = (payload) => {
  if (Array.isArray(payload)) return payload;

  if (payload && typeof payload === 'object') {
    if (Array.isArray(payload.assignments)) return payload.assignments;
    if (Array.isArray(payload.data)) return payload.data;
    if (Array.isArray(payload.items)) return payload.items;
  }

  return [];
};

const formatScore = (score) => {
  if (typeof score !== 'number' || Number.isNaN(score)) return '0.0';
  return score.toFixed(1);
};

const formatPercentage = (score, maxScore) => {
  if (typeof score !== 'number' || typeof maxScore !== 'number' || maxScore <= 0) return '0.0%';
  return `${((score / maxScore) * 100).toFixed(1)}%`;
};

export default function AssignmentsScreen({ navigation }) {
  const { theme } = useTheme();
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState('all'); // 'all', 'pending', 'submitted', 'graded'
  const [error, setError] = useState(null);

  const loadAssignments = async (showLoading = true) => {
    if (showLoading) setLoading(true);
    setError(null);
    try {
      const response = await api.get('/assignments');
      setAssignments(normalizeListResponse(response.data));
    } catch (err) {
      setError(err?.response?.data?.message || 'Unable to load assignments.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadAssignments();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    loadAssignments(false);
  };

  const getFilteredAssignments = () => {
    const list = Array.isArray(assignments) ? assignments : [];

    // If the student's submission exists on assignment, we determine status.
    // In backend response, a student's submission may be nested or returned on the object.
    // We will list all, or check specific fields.
    if (filter === 'all') return list;
    return list.filter(item => {
      // In backend, submissions may be checked by looking at item.submissions
      const hasSubmission = item.submissions && item.submissions.length > 0;
      const isGraded = hasSubmission && item.submissions[0].status === 'graded';
      
      if (filter === 'submitted') return hasSubmission && !isGraded;
      if (filter === 'graded') return isGraded;
      if (filter === 'pending') return !hasSubmission;
      return true;
    });
  };

  const getStatusBadge = (item) => {
    const hasSubmission = item.submissions && item.submissions.length > 0;
    const submission = hasSubmission ? item.submissions[0] : null;
    
    if (!hasSubmission) {
      const isOverdue = item.dueDate && new Date(item.dueDate) < new Date();
      return (
        <View style={[styles.badge, { backgroundColor: isOverdue ? theme.danger : theme.neutral }]}>
          <Text style={[styles.badgeText, { color: theme.onPrimary }]}>{isOverdue ? 'OVERDUE' : 'PENDING'}</Text>
        </View>
      );
    }

    if (submission.status === 'graded') {
      return (
        <View style={[styles.badge, { backgroundColor: theme.success }]}>
          <Text style={[styles.badgeText, { color: theme.onPrimary }]}>
            GRADED • {formatScore(submission.score)}/{formatScore(item.totalPoints || 100)} • {formatPercentage(submission.score, item.totalPoints || 100)}
          </Text>
        </View>
      );
    }

    return (
      <View style={[styles.badge, { backgroundColor: theme.info }]}>
        <Text style={[styles.badgeText, { color: theme.onPrimary }]}>SUBMITTED</Text>
      </View>
    );
  };

  const renderItem = ({ item }) => {
    const hasDueDate = !!item.dueDate;
    const formattedDate = hasDueDate
      ? new Date(item.dueDate).toLocaleDateString() + ' ' + new Date(item.dueDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      : 'No due date';

    return (
      <Pressable
        style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}
        onPress={() => navigation.navigate('AssignmentDetail', { assignmentId: item._id })}
      >
        <View style={styles.cardHeader}>
          <Text style={[styles.classroomName, { color: theme.muted }]} numberOfLines={1}>
            {item.classroomId?.name || 'LMS Classroom'}
          </Text>
          {getStatusBadge(item)}
        </View>

        <Text style={[styles.title, { color: theme.text }]}>{item.title}</Text>
        <Text style={[styles.description, { color: theme.muted }]} numberOfLines={2}>
          {item.description || 'No description provided.'}
        </Text>

        <View style={[styles.footer, { borderTopColor: theme.border }]}>
          <View style={styles.infoRow}>
            <Ionicons name="calendar-outline" size={14} color={theme.muted} />
            <Text style={[styles.footerText, { color: theme.muted }]}>{formattedDate}</Text>
          </View>
          <View style={[styles.infoRow, { marginLeft: 16 }]}>
            <Ionicons name="document-text-outline" size={14} color={theme.muted} />
            <Text style={[styles.footerText, { color: theme.muted }]}>{item.assignmentType?.toUpperCase() || 'THEORY'}</Text>
          </View>
        </View>
      </Pressable>
    );
  };

  const filtered = getFilteredAssignments();

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={[styles.header, { borderBottomColor: theme.border }]}>
        <Pressable onPress={() => navigation.goBack()} style={styles.iconButton}>
          <Ionicons name="arrow-back-outline" size={24} color={theme.text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: theme.text }]}>Assignments</Text>
        <Pressable onPress={() => loadAssignments(true)} style={styles.iconButton}>
          <Ionicons name="refresh-outline" size={22} color={theme.text} />
        </Pressable>
      </View>

      {/* Tabs / Filters */}
      <View style={styles.filterBar}>
        {['all', 'pending', 'submitted', 'graded'].map(f => (
          <Pressable
            key={f}
            style={[
              styles.filterBtn,
              { backgroundColor: theme.surface },
              filter === f && { backgroundColor: theme.primary },
            ]}
            onPress={() => setFilter(f)}
          >
            <Text style={[
              styles.filterBtnText,
              { color: theme.muted },
              filter === f && { color: theme.onPrimary, fontWeight: '700' },
            ]}>
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </Text>
          </Pressable>
        ))}
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={theme.primary} style={{ marginTop: 40 }} />
      ) : error ? (
        <View style={styles.errorCard}>
          <Text style={[styles.errorText, { color: theme.danger }]}>{error}</Text>
          <Pressable style={[styles.retryBtn, { backgroundColor: theme.primary }]} onPress={() => loadAssignments()}>
            <Text style={[styles.retryBtnText, { color: theme.onPrimary }]}>Retry</Text>
          </Pressable>
        </View>
      ) : filtered.length === 0 ? (
        <View style={styles.emptyCard}>
          <Ionicons name="clipboard-outline" size={48} color={theme.muted} />
          <Text style={[styles.emptyTitle, { color: theme.text }]}>No assignments found</Text>
          <Text style={[styles.emptyText, { color: theme.muted }]}>Any tasks assigned to your enrolled classrooms will appear here.</Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
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
  headerTitle: { fontSize: 18, fontWeight: '800' },
  filterBar: { flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 10, gap: 8 },
  filterBtn: { flex: 1, paddingVertical: 8, borderRadius: 10, alignItems: 'center' },
  filterBtnText: { fontSize: 13, fontWeight: '600' },
  list: { padding: 16, paddingBottom: 30 },
  card: { borderRadius: 20, padding: 16, marginBottom: 12, borderWidth: 1 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  classroomName: { fontSize: 12, fontWeight: '700', flex: 1, marginRight: 8 },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  badgeText: { fontSize: 10, fontWeight: '800' },
  title: { fontSize: 16, fontWeight: '700', marginBottom: 6 },
  description: { fontSize: 13, lineHeight: 18, marginBottom: 14 },
  footer: { flexDirection: 'row', borderTopWidth: 1, paddingTop: 12, alignItems: 'center' },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  footerText: { fontSize: 11, fontWeight: '500' },
  errorCard: { padding: 24, alignItems: 'center', marginTop: 40 },
  errorText: { fontSize: 15, textAlign: 'center', marginBottom: 16 },
  retryBtn: { borderRadius: 12, paddingVertical: 10, paddingHorizontal: 20 },
  retryBtnText: { fontWeight: '700' },
  emptyCard: { padding: 40, alignItems: 'center', marginTop: 60 },
  emptyTitle: { fontSize: 16, fontWeight: '700', marginTop: 16 },
  emptyText: { fontSize: 13, textAlign: 'center', marginTop: 6, lineHeight: 18 },
});
