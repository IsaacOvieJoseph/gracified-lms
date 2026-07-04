import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function ClassroomsScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Learning Spaces</Text>
        <Text style={styles.subtitle}>Browse your classrooms and upcoming lessons in a focused mobile view.</Text>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>No classrooms yet</Text>
          <Text style={styles.cardText}>Your available classes will appear here once your account is connected.</Text>
        </View>
      </ScrollView>
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
