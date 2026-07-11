import React, { useState } from 'react';
import { View, Text, StyleSheet, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';

export default function RegisterScreen({ navigation }) {
  const { register } = useAuth();
  const { theme } = useTheme();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('student');
  const [loading, setLoading] = useState(false);

  const handleRegister = async () => {
    if (!name || !email || !password) {
      Alert.alert('Please fill in all the fields');
      return;
    }
    setLoading(true);
    try {
      await register({ name, email, password, role });
      Alert.alert('Account created', 'Please verify your email with the OTP sent to your inbox.');
      navigation.goBack();
    } catch (error) {
      Alert.alert('Registration failed', error?.response?.data?.message || 'Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }] }>
      <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }] }>
        <Text style={[styles.title, { color: theme.text }]}>Create your account</Text>
        <Text style={[styles.subtitle, { color: theme.muted }]}>Professional student and teacher onboarding for modern learning.</Text>
        <Input placeholder="Full name" value={name} onChangeText={setName} />
        <Input placeholder="Email" value={email} onChangeText={setEmail} />
        <Input placeholder="Password" value={password} onChangeText={setPassword} secureTextEntry />
        <Button title={loading ? 'Creating account...' : 'Continue'} onPress={handleRegister} />
        <Button title="Back to login" onPress={() => navigation.goBack()} variant="secondary" />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24 },
  card: { borderRadius: 24, padding: 18, marginTop: 24 },
  title: { fontSize: 25, fontWeight: '800' },
  subtitle: { marginBottom: 16, marginTop: 8 },
});
