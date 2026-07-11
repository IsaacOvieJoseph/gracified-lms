import React, { useState } from 'react';
import { View, Text, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import api from '../../api/api';
import Input from '../../components/ui/Input';
import Button from '../../components/ui/Button';

export default function VerifyEmailScreen({ route, navigation }) {
  const { user, setUser, setToken, logout } = useAuth();
  const email = user?.email || route?.params?.email;
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);

  const { theme } = useTheme();

  const handleVerify = async () => {
    if (!otp || otp.length < 4) {
      Alert.alert('Invalid OTP', 'Please enter the complete verification code sent to your email.');
      return;
    }
    setLoading(true);
    try {
      const response = await api.post('/auth/verify-otp', {
        email,
        otp: otp.trim()
      });

      const nextToken = response.data.token;
      const nextUser = response.data.user;

      if (nextToken) {
        await AsyncStorage.setItem('token', nextToken);
        setToken(nextToken);
      }
      
      if (nextUser) {
        setUser(nextUser);
      } else {
        // Fallback: update local user status manually
        setUser(prev => ({ ...prev, isVerified: true }));
      }
      
      Alert.alert('Success', 'Email verified successfully!');
      if (!nextToken && navigation?.replace) {
        navigation.replace('Login');
      }
    } catch (error) {
      Alert.alert('Verification failed', error?.response?.data?.message || 'OTP verification failed. Please check the code and try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setResending(true);
    try {
      const response = await api.post('/auth/resend-otp', { email });
      Alert.alert('Success', response.data.message || 'Verification code resent successfully.');
    } catch (error) {
      Alert.alert('Error', error?.response?.data?.message || 'Failed to resend verification code.');
    } finally {
      setResending(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }] }>
      <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }] }>
        <View style={styles.header}>
          <Text style={[styles.title, { color: theme.text }]}>Verify your email</Text>
          <Text style={[styles.subtitle, { color: theme.muted }] }>
            A 6-digit verification code was sent to <Text style={[styles.emailHighlight, { color: theme.info }]}>{email}</Text>.
          </Text>
        </View>

        <Input
          placeholder="Enter 6-digit OTP"
          value={otp}
          onChangeText={setOtp}
          keyboardType="number-pad"
        />

        <Button
          title={loading ? 'Verifying...' : 'Verify email'}
          onPress={handleVerify}
          disabled={loading}
        />

        <View style={styles.options}>
          {resending ? (
            <ActivityIndicator color={theme.primary} />
          ) : (
            <Button
              title="Resend code"
              onPress={handleResend}
              variant="secondary"
            />
          )}

          <Button
            title={user ? 'Sign out' : 'Back to login'}
            onPress={user ? logout : () => navigation?.replace('Login')}
            variant="secondary"
          />
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, justifyContent: 'center' },
  card: { borderRadius: 24, padding: 24 },
  header: { marginBottom: 20 },
  title: { fontSize: 24, fontWeight: '800', textAlign: 'center' },
  subtitle: { marginTop: 8, fontSize: 15, textAlign: 'center', lineHeight: 22 },
  emailHighlight: { fontWeight: '700' },
  options: { marginTop: 12 },
});
