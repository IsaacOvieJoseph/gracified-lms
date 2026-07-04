import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../context/AuthContext';
import api from '../../api/api';

export default function DashboardScreen() {
  const { user } = useAuth();
  const [classroomsCount, setClassroomsCount] = useState(0);
  const [assignmentsCount, setAssignmentsCount] = useState(0);
  const [meetingsCount, setMeetingsCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const loadStats = async () => {
      try {
        const [classroomsRes, assignmentsRes, meetingsRes] = await Promise.all([
          api.get('/classrooms'),
          api.get('/assignments'),
          api.get('/classrooms/active-meetings'),
        ]);

        setClassroomsCount(classroomsRes.data?.length ?? 0);
        setAssignmentsCount(assignmentsRes.data?.length ?? 0);
        setMeetingsCount(meetingsRes.data?.length ?? 0);
      } catch (err) {
        setError(err?.response?.data?.message || 'Unable to load dashboard data.');
      } finally {
        setLoading(false);
      }
    };

    loadStats();
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.hero}>
          <Text style={styles.eyebrow}>Gracified LMS</Text>
          <Text style={styles.title}>Hello, {user?.name || 'Learner'}</Text>
          <Text style={styles.subtitle}>Track your classes, assignments, and live sessions.</Text>
        </View>

        {loading ? (
          <ActivityIndicator size="large" color="#8B5CF6" style={{ marginTop: 40 }} />
        ) : (
          <>
            <View style={styles.grid}>
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Classes</Text>
                <Text style={styles.cardValue}>{classroomsCount}</Text>
              </View>
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Assignments</Text>
                <Text style={styles.cardValue}>{assignmentsCount}</Text>
              </View>
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Live meetings</Text>
                <Text style={styles.cardValue}>{meetingsCount}</Text>
              </View>
            </View>

            <View style={styles.panel}>
              <Text style={styles.panelTitle}>What’s included</Text>
              <Text style={styles.panelText}>• Secure sign in and account onboarding</Text>
              <Text style={styles.panelText}>• Class discovery and profile access</Text>
              <Text style={styles.panelText}>• Live session visibility and assignment tracking</Text>
            </View>

            {error ? <Text style={styles.error}>{error}</Text> : null}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#020617' },
  content: { padding: 20, paddingBottom: 40 },
  hero: { marginBottom: 18 },
  eyebrow: { color: '#8B5CF6', fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1.2 },
  title: { fontSize: 28, fontWeight: '800', color: '#F8FAFC', marginTop: 6 },
  subtitle: { color: '#94A3B8', marginTop: 8, fontSize: 15 },
  grid: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  card: { flex: 1, backgroundColor: '#111827', borderRadius: 18, padding: 16 },
  cardTitle: { color: '#94A3B8', marginBottom: 8 },
  cardValue: { color: '#F8FAFC', fontSize: 24, fontWeight: '800' },
  panel: { backgroundColor: '#111827', borderRadius: 20, padding: 16 },
  panelTitle: { color: '#F8FAFC', fontWeight: '700', fontSize: 16, marginBottom: 8 },
  panelText: { color: '#CBD5E1', marginBottom: 6 },
});
