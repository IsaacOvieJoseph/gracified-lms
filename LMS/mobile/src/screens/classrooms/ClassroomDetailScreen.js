import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import api from '../../api/api';

export default function ClassroomDetailScreen({ route, navigation }) {
  const { classroomId } = route.params || {};
  const [classroom, setClassroom] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const loadClassroom = async () => {
      try {
        const response = await api.get(`/classrooms/${classroomId}`);
        setClassroom(response.data);
      } catch (err) {
        setError(err?.response?.data?.message || 'Unable to load classroom.');
      } finally {
        setLoading(false);
      }
    };

    if (classroomId) {
      loadClassroom();
    }
  }, [classroomId]);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        {loading ? (
          <ActivityIndicator size="large" color="#8B5CF6" />
        ) : error ? (
          <Text style={styles.error}>{error}</Text>
        ) : (
          <>
            <View style={styles.header}>
              <Text style={styles.title}>{classroom?.name || 'Classroom'}</Text>
              <Text style={styles.subtitle}>{classroom?.description || 'Classroom details and progress.'}</Text>
            </View>

            <View style={styles.card}>
              <Text style={styles.cardLabel}>Teacher</Text>
              <Text style={styles.cardValue}>{classroom?.teacher?.name || 'N/A'}</Text>
            </View>

            <View style={styles.card}>
              <Text style={styles.cardLabel}>Students</Text>
              <Text style={styles.cardValue}>{classroom?.students?.length ?? 0}</Text>
            </View>

            <View style={styles.card}>
              <Text style={styles.cardLabel}>Topics</Text>
              <Text style={styles.cardValue}>{classroom?.topics?.length ?? 0}</Text>
            </View>

            <Pressable style={styles.button} onPress={() => navigation.goBack()}>
              <Text style={styles.buttonText}>Back to classes</Text>
            </Pressable>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#020617' },
  content: { padding: 20 },
  header: { marginBottom: 20 },
  title: { fontSize: 28, fontWeight: '800', color: '#F8FAFC' },
  subtitle: { color: '#94A3B8', marginTop: 8, fontSize: 15 },
  card: { backgroundColor: '#111827', borderRadius: 18, padding: 16, marginBottom: 12 },
  cardLabel: { color: '#94A3B8', marginBottom: 6, fontSize: 13 },
  cardValue: { color: '#F8FAFC', fontSize: 18, fontWeight: '700' },
  button: { marginTop: 12, backgroundColor: '#4F46E5', borderRadius: 14, padding: 14, alignItems: 'center' },
  buttonText: { color: '#FFFFFF', fontWeight: '700' },
  error: { color: '#F87171', textAlign: 'center', marginTop: 20 },
});
