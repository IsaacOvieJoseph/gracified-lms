import React, { useState } from 'react';
import { View, Text, StyleSheet, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../context/AuthContext';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';

export default function LoginScreen({ navigation }) {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Please enter your credentials');
      return;
    }
    setLoading(true);
    try {
      await login(email, password);
    } catch (error) {
      Alert.alert('Login failed', error?.response?.data?.message || 'Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.hero}>
        <View style={styles.logoBadge}>
          <Text style={styles.logoText}>GL</Text>
        </View>
        <Text style={styles.title}>Welcome back</Text>
        <Text style={styles.subtitle}>Sign in to continue your learning journey.</Text>
      </View>
      <View style={styles.card}>
        <Input placeholder="Email address" value={email} onChangeText={setEmail} />
        <Input placeholder="Password" value={password} onChangeText={setPassword} secureTextEntry />
        <Button title={loading ? 'Signing in...' : 'Sign in'} onPress={handleLogin} />
        <Button title="Test network" onPress={() => navigation.navigate('NetworkTest')} variant="secondary" />
        <Button title="Create account" onPress={() => navigation.navigate('Register')} variant="secondary" />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#020617', paddingHorizontal: 24 },
  hero: { marginTop: 28, marginBottom: 18 },
  logoBadge: {
    width: 72,
    height: 72,
    borderRadius: 18,
    marginBottom: 16,
    backgroundColor: '#4F46E5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoText: { color: '#fff', fontSize: 24, fontWeight: '800' },
  title: { fontSize: 28, fontWeight: '800', color: '#F8FAFC' },
  subtitle: { marginTop: 8, fontSize: 15, color: '#94A3B8' },
  card: { backgroundColor: '#111827', borderRadius: 24, padding: 18 },
});
