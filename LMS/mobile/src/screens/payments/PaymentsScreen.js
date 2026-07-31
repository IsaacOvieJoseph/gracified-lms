import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, Pressable, RefreshControl, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import api from '../../api/api';

const normalizePaymentsResponse = (payload) => {
  if (Array.isArray(payload)) return payload;
  if (payload && typeof payload === 'object') {
    if (Array.isArray(payload.payments)) return payload.payments;
    if (Array.isArray(payload.data)) return payload.data;
    if (Array.isArray(payload.items)) return payload.items;
  }
  return [];
};

const formatPaymentDate = (payment) => {
  // Payment records use paymentDate (createdAt is not part of the Payment schema).
  // Keep the UI readable if older or partially populated records are returned.
  const value = payment?.paymentDate || payment?.createdAt || payment?.updatedAt;
  if (!value) return 'Date unavailable';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Date unavailable';

  return `${date.toLocaleDateString()} ${date.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  })}`;
};

const getPaymentReference = (payment) => payment?.paystackReference || payment?.stripePaymentId || payment?._id || 'N/A';
const getPayerName = (payment) => payment?.userId?.name || payment?.userId?.email || 'Unknown payer';
const getPaymentPurpose = (payment) => {
  const type = String(payment?.type || 'transaction').replace(/_/g, ' ');
  return type.replace(/\b\w/g, (letter) => letter.toUpperCase());
};
const getPaymentResourceName = (payment) => (
  [payment?.classroomId?.name, payment?.topicId?.name, payment?.planId?.name]
    .filter(Boolean)
    .join(' · ')
  || 'Platform transaction'
);

export default function PaymentsScreen({ navigation }) {
  const { theme } = useTheme();
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');

  const loadHistory = async (showLoading = true) => {
    if (showLoading) setLoading(true);
    setError(null);
    try {
      const response = await api.get('/payments/history');
      setHistory(normalizePaymentsResponse(response.data));
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
    const formattedDate = formatPaymentDate(item);
    const reference = getPaymentReference(item);
    const resourceName = getPaymentResourceName(item);

    return (
      <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <View style={styles.cardHeader}>
          <Text style={[styles.refText, { color: theme.muted }]} numberOfLines={1}>REF: {reference}</Text>
          <Text style={[styles.statusText, { color: getStatusColor(item.status) }]}>
            {item.status?.toUpperCase() || 'SUCCESS'}
          </Text>
        </View>

        <Text style={[styles.amount, { color: theme.text }]}>
          {item.currency || 'NGN'} {Number(item.amount || 0).toLocaleString()}
        </Text>

        <View style={styles.detailRow}>
          <Ionicons name="person-outline" size={14} color={theme.muted} />
          <Text style={[styles.detailLabel, { color: theme.muted }]}>Paid by</Text>
          <Text style={[styles.detailValue, { color: theme.text }]} numberOfLines={1}>{getPayerName(item)}</Text>
        </View>
        <View style={styles.detailRow}>
          <Ionicons name="pricetag-outline" size={14} color={theme.muted} />
          <Text style={[styles.detailLabel, { color: theme.muted }]}>Purpose</Text>
          <Text style={[styles.detailValue, { color: theme.text }]} numberOfLines={1}>{getPaymentPurpose(item)}</Text>
        </View>
        <View style={styles.detailRow}>
          <Ionicons name="school-outline" size={14} color={theme.muted} />
          <Text style={[styles.detailLabel, { color: theme.muted }]}>For</Text>
          <Text style={[styles.detailValue, { color: theme.text }]} numberOfLines={1}>{resourceName}</Text>
        </View>

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
        <>
          <View style={[styles.searchBox, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Ionicons name="search-outline" size={19} color={theme.muted} />
            <TextInput
              style={[styles.searchInput, { color: theme.text }]}
              placeholder="Search by payment reference"
              placeholderTextColor={theme.muted}
              value={search}
              onChangeText={setSearch}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="search"
            />
            {search.length > 0 && (
              <Pressable onPress={() => setSearch('')} hitSlop={8}>
                <Ionicons name="close-circle" size={18} color={theme.muted} />
              </Pressable>
            )}
          </View>
          {(() => {
            const query = search.trim().toLowerCase();
            const filteredHistory = query
              ? history.filter((payment) => [
                getPaymentReference(payment),
                getPayerName(payment),
                getPaymentPurpose(payment),
                getPaymentResourceName(payment),
              ].some((value) => String(value).toLowerCase().includes(query)))
              : history;

            if (filteredHistory.length === 0) {
              return (
                <View style={styles.noResults}>
                  <Ionicons name="search-outline" size={38} color={theme.muted} />
                  <Text style={[styles.emptyTitle, { color: theme.text }]}>No matching payments</Text>
                  <Text style={[styles.emptyText, { color: theme.muted }]}>Try another reference code.</Text>
                </View>
              );
            }

            return (
              <FlatList
                data={filteredHistory}
                keyExtractor={(item, index) => item._id || `${getPaymentReference(item)}-${index}`}
                renderItem={renderItem}
                contentContainerStyle={styles.list}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />}
              />
            );
          })()}
        </>
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
  detailRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 7, gap: 7 },
  detailLabel: { fontSize: 11, fontWeight: '700', width: 54 },
  detailValue: { flex: 1, fontSize: 12, fontWeight: '700' },
  cardFooter: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dateText: { fontSize: 11, fontWeight: '600' },
  errorCard: { padding: 24, alignItems: 'center', marginTop: 40 },
  errorText: { fontSize: 15, textAlign: 'center', marginBottom: 16 },
  retryBtn: { borderRadius: 12, paddingVertical: 10, paddingHorizontal: 20 },
  retryBtnText: { fontWeight: '700' },
  emptyCard: { padding: 40, alignItems: 'center', marginTop: 60 },
  emptyTitle: { fontSize: 16, fontWeight: '700', marginTop: 16 },
  emptyText: { fontSize: 13, textAlign: 'center', marginTop: 6, lineHeight: 18 },
  searchBox: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 16, marginTop: 16, paddingHorizontal: 14, borderRadius: 14, borderWidth: 1 },
  searchInput: { flex: 1, paddingVertical: 12, paddingHorizontal: 10, fontSize: 14 },
  noResults: { alignItems: 'center', padding: 40 },
});
