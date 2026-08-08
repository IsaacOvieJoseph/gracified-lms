import React, { useState } from 'react';
import { View, Text, StyleSheet, Alert, Image } from 'react-native';
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
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={styles.content}>
        <View style={styles.hero}>
          <Image
            source={theme.mode === 'dark' ? require('../../../assets/icon_dark.png') : require('../../../assets/icon_light.png')}
            style={styles.logoIcon}
            resizeMode="contain"
          />
          <Text style={[styles.title, { color: theme.text }]}>Welcome back</Text>
          <Text style={[styles.subtitle, { color: theme.muted }]}>Sign in to continue your learning journey.</Text>
        </View>
        <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Input placeholder="Email address" value={email} onChangeText={setEmail} />
          <Input placeholder="Password" value={password} onChangeText={setPassword} secureTextEntry />
          <Button title={loading ? 'Signing in...' : 'Sign in'} onPress={handleLogin} disabled={loading} />
          <Button title="Forgot password?" onPress={() => navigation.navigate('ForgotPassword')} variant="secondary" />
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 24 },
  content: { flex: 1, justifyContent: 'center' },
  hero: { marginBottom: 24 },
  logoIcon: {
    width: 150,
    height: 150,
    marginBottom: 20,
    borderRadius: 36,
    alignSelf: 'center',
  },
  title: { fontSize: 28, fontWeight: '800', textAlign: 'center' },
  subtitle: { marginTop: 8, fontSize: 15, textAlign: 'center' },
  card: { borderRadius: 24, padding: 18, borderWidth: 1 },
});
