import React, { useState } from 'react';
import { View, Text, StyleSheet, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';

export default function LoginScreen({ navigation }) {
  const { login } = useAuth();
  const { theme } = useTheme();
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
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }] }>
      <View style={styles.hero}>
        <View style={[styles.logoBadge, { backgroundColor: theme.text }] }>
          <Text style={[styles.logoText, { color: theme.background }]}>GL</Text>
        </View>
        <Text style={[styles.title, { color: theme.text }]}>Welcome back</Text>
        <Text style={[styles.subtitle, { color: theme.muted }]}>Sign in to continue your learning journey.</Text>
      </View>
      <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }] }>
        <Input placeholder="Email address" value={email} onChangeText={setEmail} />
        <Input placeholder="Password" value={password} onChangeText={setPassword} secureTextEntry />
        <Button title={loading ? 'Signing in...' : 'Sign in'} onPress={handleLogin} />
        {/* <Button title="Test network" onPress={() => navigation.navigate('NetworkTest')} variant="secondary" /> */}
        <Button title="Create account" onPress={() => navigation.navigate('Register')} variant="secondary" />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 24 },
  hero: { marginTop: 28, marginBottom: 18 },
  logoBadge: {
    width: 72,
    height: 72,
    borderRadius: 18,
    marginBottom: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoText: { fontSize: 24, fontWeight: '800' },
  title: { fontSize: 28, fontWeight: '800' },
  subtitle: { marginTop: 8, fontSize: 15 },
  card: { borderRadius: 24, padding: 18 },
});
