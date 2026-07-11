import React, { useState } from 'react';
import { View, Text, StyleSheet, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../context/ThemeContext';
import api from '../../api/api';
import Input from '../../components/ui/Input';
import Button from '../../components/ui/Button';

export default function ForgotPasswordScreen({ navigation }) {
  const { theme } = useTheme();
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [step, setStep] = useState(1); // 1: Email request, 2: OTP + New Password
  const [loading, setLoading] = useState(false);

  const handleRequestOtp = async () => {
    if (!email) {
      Alert.alert('Email required', 'Please enter your email address to receive a password reset code.');
      return;
    }
    setLoading(true);
    try {
      await api.post('/auth/forgot-password', { email: email.trim() });
      Alert.alert('Code sent', 'If your email is registered, we have sent a password reset OTP.');
      setStep(2);
    } catch (error) {
      Alert.alert('Request failed', error?.response?.data?.message || 'Failed to request reset OTP. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (!otp || !newPassword) {
      Alert.alert('Inputs required', 'Please enter the verification code and your new password.');
      return;
    }
    if (newPassword.length < 6) {
      Alert.alert('Password too short', 'Password must be at least 6 characters long.');
      return;
    }
    setLoading(true);
    try {
      const response = await api.post('/auth/reset-password', {
        email: email.trim(),
        otp: otp.trim(),
        newPassword: newPassword
      });

      Alert.alert('Success', response.data.message || 'Password reset successfully! You can now log in.');
      navigation.navigate('Login');
    } catch (error) {
      Alert.alert('Reset failed', error?.response?.data?.message || 'Failed to reset password. Please check the code and try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }] }>
      <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }] }>
        <Text style={[styles.title, { color: theme.text }]}>Reset password</Text>
        <Text style={[styles.subtitle, { color: theme.muted }] }>
          {step === 1
            ? 'Enter your registered email address to receive a password reset OTP.'
            : 'Enter the 6-digit OTP code sent to your email and your new password.'}
        </Text>

        {step === 1 ? (
          <View>
            <Input
              placeholder="Email address"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
            />
            <Button
              title={loading ? 'Sending code...' : 'Send reset code'}
              onPress={handleRequestOtp}
              disabled={loading}
            />
          </View>
        ) : (
          <View>
            <Input
              placeholder="6-digit OTP"
              value={otp}
              onChangeText={setOtp}
              keyboardType="number-pad"
            />
            <Input
              placeholder="New password (min 6 characters)"
              value={newPassword}
              onChangeText={setNewPassword}
              secureTextEntry
            />
            <Button
              title={loading ? 'Resetting password...' : 'Reset password'}
              onPress={handleResetPassword}
              disabled={loading}
            />
            <Button
              title="Back"
              onPress={() => setStep(1)}
              variant="secondary"
            />
          </View>
        )}

        <Button
          title="Back to login"
          onPress={() => navigation.navigate('Login')}
          variant="secondary"
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, justifyContent: 'center' },
  card: { borderRadius: 24, padding: 24 },
  title: { fontSize: 24, fontWeight: '800', textAlign: 'center' },
  subtitle: { marginTop: 8, marginBottom: 20, fontSize: 15, textAlign: 'center', lineHeight: 22 },
});
