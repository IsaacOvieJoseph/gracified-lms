import React, { useEffect, useState } from 'react';
import { BackHandler, View, StyleSheet, ActivityIndicator, Pressable, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';

export default function QnACenterScreen({ route, navigation }) {
  const { theme } = useTheme();
  const { token: authToken, user } = useAuth();
  const { token, isPresenter } = route.params || {};
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      navigation.goBack();
      return true;
    });
    return () => subscription.remove();
  }, [navigation]);

  // Prefer dedicated frontend URL; fall back to API host with Vite port.
  const webBaseUrl = (process.env.EXPO_PUBLIC_FRONTEND_URL || process.env.EXPO_PUBLIC_API_URL || 'http://localhost:5000/api')
    .replace(/\/api$/i, '')
    .replace(':5000', ':5173');

  const qnaUrl = isPresenter
    ? `${webBaseUrl}/qna/${token}/present`
    : `${webBaseUrl}/qna/${token}`;

  const authInjection = `(function(){
    try{
      var t = ${JSON.stringify(authToken || '')};
      if(t){localStorage.setItem('token', t);}
      var u = ${JSON.stringify(user || null)};
      if(u){localStorage.setItem('user', JSON.stringify(u));}
    }catch(e){console.error(e)}
  })();true;`;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={[styles.header, { borderBottomColor: theme.border }]}>
        <Pressable onPress={() => navigation.goBack()} style={styles.iconButton}>
          <Ionicons name="arrow-back-outline" size={24} color={theme.text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: theme.text }]}>
          {isPresenter ? 'Q&A Presenter' : 'Q&A Board'}
        </Text>
        <Pressable onPress={() => navigation.goBack()} style={styles.doneButton} accessibilityRole="button" accessibilityLabel="Return to classroom">
          <Text style={[styles.doneText, { color: theme.primary }]}>Done</Text>
        </Pressable>
      </View>

      <WebView
        source={{ uri: qnaUrl }}
        injectedJavaScriptBeforeContentLoaded={authInjection}
        onLoadStart={() => setLoading(true)}
        onLoadEnd={() => setLoading(false)}
        startInLoadingState
        originWhitelist={['*']}
        style={{ flex: 1 }}
        javaScriptEnabled
        domStorageEnabled
        allowFileAccess
        onShouldStartLoadWithRequest={(request) => {
          // Presenter mode's web Exit button navigates from /present back to
          // the board route. In mobile, both should return to the native UI.
          const boardRoute = `/qna/${token}`;
          if (isPresenter && request.url.includes(boardRoute) && !request.url.includes(`${boardRoute}/present`)) {
            navigation.goBack();
            return false;
          }
          return true;
        }}
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
  doneButton: { paddingHorizontal: 4, paddingVertical: 6 },
  doneText: { fontSize: 13, fontWeight: '800' },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    top: 60,
  },
});
