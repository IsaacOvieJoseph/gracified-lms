import React, { useState } from 'react';
import { View, Alert, SafeAreaView, StyleSheet, Text } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import api from '../../api/api';
import Input from '../../components/ui/Input';
import Button from '../../components/ui/Button';
import KeyboardAwareScrollView from '../../components/ui/KeyboardAwareScrollView';

const isValidEmail = (value) => /\S+@\S+\.\S+/.test(value);

export default function ForgotPasswordScreen({ navigation }) {
  const { theme } = useTheme();
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [step, setStep] = useState(1); // 1: email, 2: OTP, 3: new password
  const [loading, setLoading] = useState(false);

  const normalizedEmail = email.trim().toLowerCase();

  const handleRequestOtp = async () => {
    if (!isValidEmail(normalizedEmail)) {
      Alert.alert('Invalid email', 'Please enter a valid email address.');
      return;
    }

    setLoading(true);
    try {
      const response = await api.post('/auth/forgot-password', { email: normalizedEmail });
      setEmail(response.data?.email || normalizedEmail);
      setStep(2);
      Alert.alert('Code sent', response.data?.message || 'If an account exists with this email, a reset code has been sent.');
    } catch (error) {
      Alert.alert('Request failed', error?.response?.data?.message || 'Failed to send reset code. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (otp.trim().length !== 6) {
      Alert.alert('Invalid code', 'Please enter the 6-digit code sent to your email.');
      return;
    }

    setLoading(true);
    try {
      await api.post('/auth/verify-reset-otp', { email: normalizedEmail, otp: otp.trim() });
      setStep(3);
    } catch (error) {
      Alert.alert('Verification failed', error?.response?.data?.message || 'Invalid or expired code.');
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    setLoading(true);
    try {
      const response = await api.post('/auth/resend-reset-otp', { email: normalizedEmail });
      Alert.alert('Code sent', response.data?.message || 'A new reset code has been sent.');
    } catch (error) {
      Alert.alert('Request failed', error?.response?.data?.message || 'Failed to resend the reset code.');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (newPassword.length < 6) {
      Alert.alert('Password too short', 'Password must be at least 6 characters long.');
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert('Passwords do not match', 'Enter the same password in both fields.');
      return;
    }

    setLoading(true);
    try {
      const response = await api.post('/auth/reset-password', {
        email: normalizedEmail,
        otp: otp.trim(),
        newPassword,
      });
      Alert.alert('Password reset', response.data?.message || 'Your password has been reset.', [
        { text: 'Go to login', onPress: () => navigation.replace('Login') },
      ]);
    } catch (error) {
      Alert.alert('Reset failed', error?.response?.data?.message || 'Failed to reset password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <KeyboardAwareScrollView contentContainerStyle={styles.content}>
        <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Text style={[styles.title, { color: theme.text }]}>Reset password</Text>
          <Text style={[styles.subtitle, { color: theme.muted }]}>
            {step === 1 && 'Enter your email to receive a password reset code.'}
            {step === 2 && `Enter the 6-digit code sent to ${normalizedEmail}.`}
            {step === 3 && 'Create a new password for your account.'}
          </Text>

        {step === 1 && (
          <>
            <Input placeholder="Email address" value={email} onChangeText={setEmail} keyboardType="email-address" />
            <Button title={loading ? 'Sending...' : 'Send reset code'} onPress={handleRequestOtp} disabled={loading} />
          </>
        )}

        {step === 2 && (
          <>
            <Input placeholder="6-digit code" value={otp} onChangeText={setOtp} keyboardType="number-pad" maxLength={6} />
            <Button title={loading ? 'Verifying...' : 'Verify code'} onPress={handleVerifyOtp} disabled={loading} />
            <Button title={loading ? 'Sending...' : 'Resend code'} onPress={handleResendOtp} variant="secondary" disabled={loading} />
            <Button title="Change email" onPress={() => setStep(1)} variant="secondary" disabled={loading} />
          </>
        )}

        {step === 3 && (
          <>
            <Input placeholder="New password (min 6 characters)" value={newPassword} onChangeText={setNewPassword} secureTextEntry />
            <Input placeholder="Confirm new password" value={confirmPassword} onChangeText={setConfirmPassword} secureTextEntry />
            <Button title={loading ? 'Resetting...' : 'Reset password'} onPress={handleResetPassword} disabled={loading} />
          </>
        )}

        <Button title="Back to login" onPress={() => navigation.replace('Login')} variant="secondary" />
        </View>
      </KeyboardAwareScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 24 },
  content: { flexGrow: 1, justifyContent: 'center', paddingVertical: 24 },
  card: { borderRadius: 24, padding: 24, borderWidth: 1 },
  title: { fontSize: 24, fontWeight: '800', textAlign: 'center' },
  subtitle: { marginTop: 8, marginBottom: 20, fontSize: 15, textAlign: 'center', lineHeight: 22 },
});
