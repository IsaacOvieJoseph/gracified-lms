import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import api from '../../api/api';
import { useTheme } from '../../context/ThemeContext';

export default function AITutorGrowthScreen({ navigation }) {
  const { theme } = useTheme();
  const [loading, setLoading] = useState(true);
  const [growth, setGrowth] = useState(null);
  const [access, setAccess] = useState(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const accessRes = await api.get('/ai/tutor/access');
      setAccess(accessRes.data);
      if (accessRes.data?.enabled) {
        const res = await api.get('/ai/tutor/progress');
        setGrowth(res.data);
      } else {
        setError('Gracy is not enabled for your account.');
      }
    } catch (err) {
      setError(err?.response?.data?.message || 'Could not load your growth report.');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const metricCards = growth?.metrics ? [
    ['Topics studied', growth.metrics.topicsStudied ?? 0],
    ['Topics completed', growth.metrics.topicsCompleted ?? 0],
    ['Video completion', growth.metrics.averageVideoCompletion ?? null],
    ['Assignments avg', growth.metrics.assignmentAverage ?? null],
    ['Exams avg', growth.metrics.examAverage ?? null],
    ['AI quizzes avg', growth.metrics.aiQuizAverage ?? null],
  ] : [];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={[styles.header, { borderBottomColor: theme.border }]}>
        <Pressable onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back-outline" size={24} color={theme.text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: theme.text }]}>My Growth</Text>
        <Pressable onPress={load} disabled={loading}>
          <Ionicons name="refresh" size={22} color={loading ? theme.muted : theme.primary} />
        </Pressable>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={theme.primary} />
          <Text style={[styles.centerText, { color: theme.muted }]}>Analyzing your progress...</Text>
        </View>
      ) : error && !growth ? (
        <View style={styles.center}>
          <Ionicons name="trending-up-outline" size={34} color={theme.muted} />
          <Text style={[styles.centerText, { color: theme.muted, marginTop: 10 }]}>{error}</Text>
          <Pressable style={[styles.retryBtn, { backgroundColor: theme.primary }]} onPress={load}>
            <Text style={[styles.retryBtnText, { color: theme.onPrimary }]}>Try again</Text>
          </Pressable>
        </View>
      ) : growth ? (
        <ScrollView contentContainerStyle={styles.content}>
          {access ? (
            <Text style={[styles.quota, { color: theme.muted }]}>
              Daily Gracy quota: {access.remaining} of {access.dailyLimit} remaining
            </Text>
          ) : null}

          <View style={styles.metricGrid}>
            {metricCards.map(([label, value]) => (
              <View key={label} style={[styles.metricChip, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                <Text style={[styles.metricValue, { color: theme.text }]}>
                  {typeof value === 'number' && label.includes('avg') ? `${value}%` : value}
                </Text>
                <Text style={[styles.metricLabel, { color: theme.muted }]}>{label}</Text>
              </View>
            ))}
          </View>

          {growth.summary ? (
            <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <Text style={[styles.cardTitle, { color: theme.text }]}>Your growth</Text>
              <Text style={[styles.growthText, { color: theme.text }]}>{growth.summary}</Text>
            </View>
          ) : null}

          {growth.nextStep ? (
            <View style={[styles.nextStep, { backgroundColor: `${theme.success}1A`, borderColor: theme.success }]}>
              <Ionicons name="sparkles-outline" size={18} color={theme.success} />
              <Text style={[styles.nextStepText, { color: theme.text }]}>{growth.nextStep}</Text>
            </View>
          ) : null}
        </ScrollView>
      ) : null}
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
  headerTitle: { fontSize: 18, fontWeight: '800' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  centerText: { fontSize: 14, textAlign: 'center', lineHeight: 20 },
  retryBtn: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 12, marginTop: 14 },
  retryBtnText: { fontWeight: '800', fontSize: 13 },
  content: { padding: 16, paddingBottom: 40 },
  quota: { fontSize: 11, fontWeight: '600', marginBottom: 14 },
  metricGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 16 },
  metricChip: { borderRadius: 12, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 12, minWidth: '30%', flexGrow: 1 },
  metricValue: { fontSize: 17, fontWeight: '900' },
  metricLabel: { fontSize: 10, fontWeight: '600', marginTop: 3 },
  card: { borderWidth: 1, borderRadius: 16, padding: 16, marginBottom: 16 },
  cardTitle: { fontSize: 15, fontWeight: '800', marginBottom: 8 },
  growthText: { fontSize: 14, lineHeight: 21 },
  nextStep: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
  },
  nextStepText: { flex: 1, fontSize: 13, lineHeight: 19, fontWeight: '600' },
});
