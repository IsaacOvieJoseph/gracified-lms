import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, Pressable, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import api from '../../api/api';

export default function PaymentsScreen({ navigation }) {
  const { theme } = useTheme();
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const loadHistory = async (showLoading = true) => {
    if (showLoading) setLoading(true);
    setError(null);
    try {
      const response = await api.get('/payments/history');
      setHistory(response.data || []);
    } catch (err) {
      setError(err?.response?.data?.message || 'Unable to load payment history.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadHistory();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    loadHistory(false);
  };

  const getStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case 'completed':
      case 'success':
        return theme.success;
      case 'pending':
        return theme.warning;
      case 'failed':
        return theme.danger;
      default:
        return theme.muted;
    }
  };

  const renderItem = ({ item }) => {
    const formattedDate = new Date(item.createdAt).toLocaleDateString() + ' ' + new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    return (
      <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <View style={styles.cardHeader}>
          <Text style={[styles.refText, { color: theme.muted }]} numberOfLines={1}>REF: {item.paystackReference || item._id}</Text>
          <Text style={[styles.statusText, { color: getStatusColor(item.status) }]}>
            {item.status?.toUpperCase() || 'SUCCESS'}
          </Text>
        </View>

        <Text style={[styles.amount, { color: theme.text }]}>
          NGN {item.amount ? item.amount.toLocaleString() : '0.00'}
        </Text>

        <Text style={[styles.description, { color: theme.neutral }]}>
          {item.classroomId?.name ? `Classroom Enrollment: ${item.classroomId.name}` : item.type || 'LMS Platform Transaction'}
        </Text>

        <View style={styles.cardFooter}>
          <Ionicons name="calendar-outline" size={13} color={theme.muted} />
          <Text style={[styles.dateText, { color: theme.muted }]}>{formattedDate}</Text>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={[styles.header, { borderBottomColor: theme.border }]}>
        <Pressable onPress={() => navigation.goBack()} style={styles.iconButton}>
          <Ionicons name="arrow-back-outline" size={24} color={theme.text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: theme.text }]}>Billing & History</Text>
        <View style={{ width: 24 }} />
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={theme.primary} style={{ marginTop: 40 }} />
      ) : error ? (
        <View style={styles.errorCard}>
          <Text style={[styles.errorText, { color: theme.danger }]}>{error}</Text>
          <Pressable style={[styles.retryBtn, { backgroundColor: theme.primary }]} onPress={() => loadHistory()}>
            <Text style={[styles.retryBtnText, { color: theme.onPrimary }]}>Retry</Text>
          </Pressable>
        </View>
      ) : history.length === 0 ? (
        <View style={styles.emptyCard}>
          <Ionicons name="receipt-outline" size={48} color={theme.muted} />
          <Text style={[styles.emptyTitle, { color: theme.text }]}>No transaction history</Text>
          <Text style={[styles.emptyText, { color: theme.muted }]}>Any course payments or platform disbursements will appear here.</Text>
        </View>
      ) : (
        <FlatList
          data={history}
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
  headerTitle: { fontSize: 18, fontWeight: '800', flex: 1, textAlign: 'center' },
  list: { padding: 16, paddingBottom: 30 },
  card: { borderRadius: 18, padding: 16, marginBottom: 12, borderWidth: 1 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  refText: { fontSize: 11, fontFamily: 'monospace', flex: 1, marginRight: 12 },
  statusText: { fontSize: 11, fontWeight: '800' },
  amount: { fontSize: 20, fontWeight: '800', marginBottom: 6 },
  description: { fontSize: 13, lineHeight: 18, marginBottom: 12 },
  cardFooter: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dateText: { fontSize: 11, fontWeight: '600' },
  errorCard: { padding: 24, alignItems: 'center', marginTop: 40 },
  errorText: { fontSize: 15, textAlign: 'center', marginBottom: 16 },
  retryBtn: { borderRadius: 12, paddingVertical: 10, paddingHorizontal: 20 },
  retryBtnText: { fontWeight: '700' },
  emptyCard: { padding: 40, alignItems: 'center', marginTop: 60 },
  emptyTitle: { fontSize: 16, fontWeight: '700', marginTop: 16 },
  emptyText: { fontSize: 13, textAlign: 'center', marginTop: 6, lineHeight: 18 },
});
