import React, { useState } from 'react';
import { View, Text, StyleSheet, Alert, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../context/ThemeContext';
import axios from 'axios';

export default function NetworkTestScreen({ navigation }) {
  const { theme } = useTheme();
  const [status, setStatus] = useState('Not tested');
  const [details, setDetails] = useState('Tap below to test the backend connection from your phone.');

  const runTest = async () => {
    const baseUrl = (process.env.EXPO_PUBLIC_API_URL || 'http://localhost:5000/api').replace(/\/api$/i, '');
    setStatus('Testing...');
    setDetails(`Trying ${baseUrl}`);

    try {
      const response = await axios.get(`${baseUrl}/auth/me`, {
        timeout: 10000,
        validateStatus: (status) => status < 500,
      });

      if (response.status === 200) {
        setStatus('Success');
        setDetails(`Connected. Server responded with status ${response.status}.`);
        return;
      }

      if (response.status === 401 || response.status === 403) {
        setStatus('Reachable');
        setDetails(`The backend is reachable, but it rejected the request because authentication is required (status ${response.status}).`);
        return;
      }

      setStatus('Unexpected response');
      setDetails(`Received status ${response.status} from the backend.`);
    } catch (error) {
      const message = error?.message || 'Unknown error';
      setStatus('Failed');
      setDetails(`Unable to reach backend. ${message}`);
      Alert.alert('Connection failed', `Check your backend host and port.\n\n${message}`);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }] }>
      <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }] }>
        <Text style={[styles.title, { color: theme.text }]}>Network test</Text>
        <Text style={[styles.subtitle, { color: theme.muted }]}>Verify your Expo Go device can reach the LMS backend.</Text>

        <View style={[styles.statusBox, { backgroundColor: theme.surfaceElevated }]}>
          <Text style={[styles.statusLabel, { color: theme.text }]}>Status</Text>
          <Text style={[styles.statusValue, { color: theme.text }]}>{status}</Text>
          <Text style={[styles.details, { color: theme.muted }]}>{details}</Text>
        </View>

        <Pressable style={[styles.button, { backgroundColor: theme.primary }]} onPress={runTest}>
          <Text style={[styles.buttonText, { color: theme.onPrimary }]}>Test backend connection</Text>
        </Pressable>

        <Pressable style={styles.secondaryButton} onPress={() => navigation.goBack()}>
          <Text style={[styles.secondaryButtonText, { color: theme.info }]}>Back</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20 },
  card: { borderRadius: 24, padding: 20, marginTop: 24 },
  title: { fontSize: 24, fontWeight: '800' },
  subtitle: { marginTop: 8, marginBottom: 18 },
  statusBox: { borderRadius: 16, padding: 16, marginBottom: 16 },
  statusLabel: { fontWeight: '700', marginBottom: 4 },
  statusValue: { fontSize: 18, fontWeight: '700' },
  details: { marginTop: 8 },
  button: { borderRadius: 14, paddingVertical: 12, alignItems: 'center' },
  buttonText: { fontWeight: '700' },
  secondaryButton: { marginTop: 10, alignItems: 'center', paddingVertical: 10 },
  secondaryButtonText: { fontWeight: '600' },
});
