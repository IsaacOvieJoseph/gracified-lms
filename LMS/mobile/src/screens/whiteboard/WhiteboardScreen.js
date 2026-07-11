import React, { useState } from 'react';
import { View, StyleSheet, ActivityIndicator, Pressable, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';

export default function WhiteboardScreen({ route, navigation }) {
  const { classroomId } = route.params || {};
  const { token, user } = useAuth();
  const { theme } = useTheme();
  const [loading, setLoading] = useState(true);

  const webBaseUrl = (process.env.EXPO_PUBLIC_FRONTEND_URL || process.env.EXPO_PUBLIC_API_URL || 'http://localhost:5000/api')
    .replace(/\/api$/i, '')
    .replace(':5000', ':5173');

  const whiteboardUrl = `${webBaseUrl}/classrooms/${classroomId}/whiteboard?token=${token}`;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={[styles.header, { borderBottomColor: theme.border }]}>
        <Pressable onPress={() => navigation.goBack()} style={styles.iconButton}>
          <Ionicons name="arrow-back-outline" size={24} color={theme.text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: theme.text }]}>Live Whiteboard</Text>
        <View style={{ width: 24 }} />
      </View>

      <WebView
        source={{ uri: whiteboardUrl }}
        injectedJavaScriptBeforeContentLoaded={
          `(function(){
              try{
                var t = ${JSON.stringify(token || '')};
                if(t){localStorage.setItem('token', t);}
                var u = ${JSON.stringify(user || null)};
                if(u){localStorage.setItem('user', JSON.stringify(u));}
              }catch(e){console.error(e)}
            })();true;`
        }
        onLoadStart={() => setLoading(true)}
        onLoadEnd={() => setLoading(false)}
        startInLoadingState={true}
        originWhitelist={["*"]}
        style={{ flex: 1 }}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        allowFileAccess={true}
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
    top: 60,
  },
});
