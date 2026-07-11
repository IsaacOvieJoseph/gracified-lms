import React, { useState } from 'react';
import { View, StyleSheet, ActivityIndicator, Pressable, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';

export default function QnACenterScreen({ route, navigation }) {
  const { theme } = useTheme();
  const { token, isPresenter } = route.params || {};
  const [loading, setLoading] = useState(true);

  // Construct Web URL for Q&A page
  const webBaseUrl = (process.env.EXPO_PUBLIC_API_URL || 'http://10.235.70.171:5000/api')
    .replace(/\/api$/i, '')
    .replace(':5000', ':5173'); // Default Vite port is 5173

  const qnaUrl = isPresenter
    ? `${webBaseUrl}/qna/${token}/present`
    : `${webBaseUrl}/qna/${token}`;

  console.log('Loading Q&A WebView URL:', qnaUrl);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={[styles.header, { borderBottomColor: theme.border }]}>
        <Pressable onPress={() => navigation.goBack()} style={styles.iconButton}>
          <Ionicons name="arrow-back-outline" size={24} color={theme.text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: theme.text }]}>Q&A Board</Text>
        <View style={{ width: 24 }} />
      </View>

      <WebView
        source={{ uri: qnaUrl }}
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  iconButton: { padding: 4 },
  headerTitle: { fontSize: 18, fontWeight: '800', flex: 1, textAlign: 'center' },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    top: 60, // Keep header visible
  },
});
