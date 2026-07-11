import React, { useState, useRef } from 'react';
import { View, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import { useTheme } from '../../context/ThemeContext';
import api from '../../api/api';

export default function PaystackWebViewScreen({ route, navigation }) {
  const { theme } = useTheme();
  const { authorizationUrl, reference, classroomId, type } = route.params || {};
  const [loading, setLoading] = useState(true);
  const verifyingRef = useRef(false);

  const shouldInterceptUrl = (url = '') => {
    const lowerUrl = url.toLowerCase();
    return (
      lowerUrl.includes('/api/payments/paystack/initiate') ||
      lowerUrl.includes('/api/payments/paystack/verify') ||
      lowerUrl.includes('/payments/paystack/initiate') ||
      lowerUrl.includes('/payments/paystack/verify') ||
      lowerUrl.includes('callback') ||
      lowerUrl.includes('return')
    );
  };

  const verifyPayment = async (url) => {
    if (verifyingRef.current) return;
    verifyingRef.current = true;
    setLoading(true);

    let ref = reference;
    const refMatch = url.match(/reference=([^&]+)/);
    if (refMatch && refMatch[1]) {
      ref = refMatch[1];
    }

    try {
      console.log(`Verifying payment on backend with reference: ${ref}...`);
      const response = await api.get('/payments/paystack/verify', {
        params: { reference: ref }
      });

      if (response.status === 200) {
        Alert.alert('Payment Successful', type === 'lecture_access' ? 'Lecture access confirmed. You can now join the lecture.' : 'You have been enrolled in this classroom!');

        if (classroomId && type !== 'lecture_access') {
          try {
            await api.post(`/classrooms/${classroomId}/enroll`);
          } catch (enrollErr) {
            console.log('User already enrolled or enrollment updated by webhook:', enrollErr.message);
          }
        }
      } else {
        Alert.alert('Payment Status', 'Verification response received, but payment could not be confirmed.');
      }
    } catch (error) {
      Alert.alert('Verification Failed', error?.response?.data?.message || 'Unable to verify payment with backend.');
    } finally {
      setLoading(false);
      verifyingRef.current = false;
      navigation.goBack();
    }
  };

  const handleNavigationStateChange = (navState) => {
    const url = navState.url;
    console.log('Navigated to WebView URL:', url);

    if (shouldInterceptUrl(url)) {
      verifyPayment(url);
    }
  };

  const handleShouldStartLoadWithRequest = (request) => {
    const url = request.url;
    if (shouldInterceptUrl(url)) {
      verifyPayment(url);
      return false;
    }
    return true;
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <WebView
        source={{ uri: authorizationUrl }}
        onNavigationStateChange={handleNavigationStateChange}
        onShouldStartLoadWithRequest={handleShouldStartLoadWithRequest}
        onLoadStart={() => setLoading(true)}
        onLoadEnd={() => setLoading(false)}
        style={{ flex: 1 }}
      />
      {loading && (
        <View style={[styles.loadingOverlay, { backgroundColor: theme.overlay }]}>
          <ActivityIndicator size="large" color={theme.primary} />
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
