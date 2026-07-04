import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import api from '../../api/api';

export default function ClassroomsScreen({ navigation }) {
  const [classrooms, setClassrooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const loadClassrooms = async () => {
      try {
        const response = await api.get('/classrooms');
        setClassrooms(response.data || []);
      } catch (err) {
        setError(err?.response?.data?.message || 'Unable to load classrooms.');
      } finally {
        setLoading(false);
      }
    };

    loadClassrooms();
  }, []);

  const renderItem = ({ item }) => (
    <TouchableOpacity style={styles.card} onPress={() => navigation.navigate('ClassroomDetail', { classroomId: item._id })}>
      <Text style={styles.cardTitle}>{item.name || 'Untitled classroom'}</Text>
      <Text style={styles.cardText}>{item.description || 'No description provided'}</Text>
      <Text style={styles.cardMeta}>{item.students?.length ?? 0} students • {item.topics?.length ?? 0} topics</Text>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Learning Spaces</Text>
        <Text style={styles.subtitle}>Browse your classrooms and upcoming lessons in a focused mobile view.</Text>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#8B5CF6" style={{ marginTop: 40 }} />
      ) : error ? (
        <Text style={styles.error}>{error}</Text>
      ) : classrooms.length === 0 ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>No classrooms yet</Text>
          <Text style={styles.cardText}>Your available classes will appear here once your account is connected.</Text>
        </View>
      ) : (
        <FlatList
          data={classrooms}
          keyExtractor={(item) => item._id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#020617' },
  content: { padding: 20 },
  title: { fontSize: 24, fontWeight: '800', color: '#F8FAFC' },
  subtitle: { color: '#94A3B8', marginTop: 8, marginBottom: 16 },
  card: { backgroundColor: '#111827', borderRadius: 20, padding: 18 },
  cardTitle: { fontSize: 16, fontWeight: '700', color: '#F8FAFC', marginBottom: 6 },
  cardText: { color: '#CBD5E1' },
});
