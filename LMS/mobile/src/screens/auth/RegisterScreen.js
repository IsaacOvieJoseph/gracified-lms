import React, { useState } from 'react';
import { View, Text, StyleSheet, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../context/AuthContext';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';

export default function RegisterScreen({ navigation }) {
  const { register } = useAuth();
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
    <SafeAreaView style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>Create your account</Text>
        <Text style={styles.subtitle}>Professional student and teacher onboarding for modern learning.</Text>
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
  container: { flex: 1, backgroundColor: '#020617', padding: 24 },
  card: { backgroundColor: '#111827', borderRadius: 24, padding: 18, marginTop: 24 },
  title: { fontSize: 25, fontWeight: '800', color: '#F8FAFC' },
  subtitle: { color: '#94A3B8', marginBottom: 16, marginTop: 8 },
});
