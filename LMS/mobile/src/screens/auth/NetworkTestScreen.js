import React, { useState } from 'react';
import { View, Text, StyleSheet, Alert, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import axios from 'axios';

export default function NetworkTestScreen({ navigation }) {
  const [status, setStatus] = useState('Not tested');
  const [details, setDetails] = useState('Tap below to test the backend connection from your phone.');

  const runTest = async () => {
    const baseUrl = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:5000/api';
    setStatus('Testing...');
    setDetails(`Trying ${baseUrl}`);

    try {
      const response = await axios.get(`${baseUrl}/auth/me`, {
        timeout: 10000,
      });
      setStatus('Success');
      setDetails(`Connected. Server responded with status ${response.status}.`);
    } catch (error) {
      const message = error?.message || 'Unknown error';
      setStatus('Failed');
      setDetails(`Unable to reach backend. ${message}`);
      Alert.alert('Connection failed', `Check your backend host and port.\n\n${message}`);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>Network test</Text>
        <Text style={styles.subtitle}>Verify your Expo Go device can reach the LMS backend.</Text>

        <View style={styles.statusBox}>
          <Text style={styles.statusLabel}>Status</Text>
          <Text style={styles.statusValue}>{status}</Text>
          <Text style={styles.details}>{details}</Text>
        </View>

        <Pressable style={styles.button} onPress={runTest}>
          <Text style={styles.buttonText}>Test backend connection</Text>
        </Pressable>

        <Pressable style={styles.secondaryButton} onPress={() => navigation.goBack()}>
          <Text style={styles.secondaryButtonText}>Back</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#020617', padding: 20 },
  card: { backgroundColor: '#111827', borderRadius: 24, padding: 20, marginTop: 24 },
  title: { fontSize: 24, fontWeight: '800', color: '#F8FAFC' },
  subtitle: { color: '#94A3B8', marginTop: 8, marginBottom: 18 },
  statusBox: { backgroundColor: '#0F172A', borderRadius: 16, padding: 16, marginBottom: 16 },
  statusLabel: { color: '#8B5CF6', fontWeight: '700', marginBottom: 4 },
  statusValue: { color: '#F8FAFC', fontSize: 18, fontWeight: '700' },
  details: { color: '#CBD5E1', marginTop: 8 },
  button: { backgroundColor: '#4F46E5', borderRadius: 14, paddingVertical: 12, alignItems: 'center' },
  buttonText: { color: '#FFFFFF', fontWeight: '700' },
  secondaryButton: { marginTop: 10, alignItems: 'center', paddingVertical: 10 },
  secondaryButtonText: { color: '#93C5FD', fontWeight: '600' },
});
