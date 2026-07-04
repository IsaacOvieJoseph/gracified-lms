import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../context/AuthContext';

export default function ProfileScreen() {
  const { user, logout } = useAuth();

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>Profile</Text>
        <Text style={styles.name}>{user?.name || 'Student'}</Text>
        <Text style={styles.email}>{user?.email || 'student@example.com'}</Text>
        <Pressable style={styles.button} onPress={logout}>
          <Text style={styles.buttonText}>Sign out</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#020617', padding: 20 },
  card: { backgroundColor: '#111827', borderRadius: 24, padding: 20 },
  title: { fontSize: 24, fontWeight: '800', color: '#F8FAFC' },
  name: { color: '#F8FAFC', fontSize: 18, fontWeight: '700', marginTop: 12 },
  email: { color: '#94A3B8', marginTop: 6 },
  button: { backgroundColor: '#DC2626', borderRadius: 14, paddingVertical: 12, alignItems: 'center', marginTop: 18 },
  buttonText: { color: '#fff', fontWeight: '700' },
});
