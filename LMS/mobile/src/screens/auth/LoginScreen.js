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
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail || !password) {
      Alert.alert('Please enter your credentials');
      return;
    }
    setLoading(true);
    try {
      await login(normalizedEmail, password);
    } catch (error) {
      const responseData = error?.response?.data;
      if (responseData?.redirectToVerify && responseData?.email) {
        Alert.alert(
          'Email verification required',
          'This account has not completed email verification. We sent a new code to your email.',
          [{ text: 'Verify email', onPress: () => navigation.navigate('VerifyEmail', { email: responseData.email }) }]
        );
        return;
      }
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
        <Button title={loading ? 'Signing in...' : 'Sign in'} onPress={handleLogin} disabled={loading} />
        <Button title="Forgot password?" onPress={() => navigation.navigate('ForgotPassword')} variant="secondary" />
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
