import React, { useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Pressable, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { getVideoEmbedInfo } from '../../utils/video';

export default function VideoPlayerScreen({ route, navigation }) {
  const { theme } = useTheme();
  const { videoUrl, title } = route.params || {};
  const [loading, setLoading] = useState(true);

  if (!videoUrl) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: '#000' }]}>
        <View style={styles.header}>
          <Pressable onPress={() => navigation.goBack()} style={styles.iconButton}>
            <Ionicons name="arrow-back-outline" size={24} color="#FFF" />
          </Pressable>
          <Text style={styles.headerTitle} numberOfLines={1}>Error</Text>
          <View style={{ width: 24 }} />
        </View>
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle-outline" size={60} color={theme.danger} />
          <Text style={styles.errorText}>No video URL provided.</Text>
          <Pressable style={[styles.backBtn, { backgroundColor: theme.primary }]} onPress={() => navigation.goBack()}>
            <Text style={styles.backBtnText}>Go Back</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const embedInfo = getVideoEmbedInfo(videoUrl);

  // Source configuration
  let webViewSource = {};
  if (embedInfo) {
    if (embedInfo.isDirect) {
      // Use HTML5 video wrapper for direct stream links (e.g. .mp4, dropbox raw streams)
      webViewSource = {
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
            <style>
              body, html {
                margin: 0;
                padding: 0;
                width: 100%;
                height: 100%;
                background-color: #000;
                display: flex;
                justify-content: center;
                align-items: center;
                overflow: hidden;
              }
              video {
                width: 100%;
                height: 100%;
                object-fit: contain;
              }
            </style>
          </head>
          <body>
            <video src="${embedInfo.embedUrl}" controls autoplay playsinline></video>
          </body>
          </html>
        `
      };
    } else {
      // Use direct embed URL (e.g. YouTube, Vimeo)
      webViewSource = { uri: embedInfo.embedUrl };
    }
  } else {
    // Unrecognized URL - fall back to loading the raw URL directly
    webViewSource = { uri: videoUrl };
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: '#000' }]} edges={['top', 'left', 'right']}>
      {/* Cinematic Dark Header */}
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.iconButton}>
          <Ionicons name="arrow-back-outline" size={24} color="#FFF" />
        </Pressable>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {title || 'Video Player'}
        </Text>
        {embedInfo?.type && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{embedInfo.type.toUpperCase()}</Text>
          </View>
        )}
        {!embedInfo?.type && <View style={{ width: 24 }} />}
      </View>

      {/* Video Webview Area */}
      <View style={styles.videoWrapper}>
        <WebView
          source={webViewSource}
          allowsFullscreenVideo={true}
          allowsInlineMediaPlayback={true}
          mediaPlaybackRequiresUserAction={false}
          onLoadStart={() => setLoading(true)}
          onLoadEnd={() => setLoading(false)}
          style={styles.webview}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          // Fixes for background audio and scaling
          originWhitelist={['*']}
          mixedContentMode="always"
        />
        
        {loading && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color={theme.primary} />
            <Text style={styles.loadingText}>Preparing Cinema Mode...</Text>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#000',
    borderBottomWidth: 1,
    borderBottomColor: '#1A1A1A',
  },
  iconButton: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: '#111',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFF',
    flex: 1,
    textAlign: 'center',
    marginHorizontal: 12,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: '#333',
    justifyContent: 'center',
    alignItems: 'center',
  },
  badgeText: {
    color: '#FFF',
    fontSize: 9,
    fontWeight: '900',
  },
  videoWrapper: {
    flex: 1,
    position: 'relative',
    backgroundColor: '#000',
  },
  webview: {
    flex: 1,
    backgroundColor: '#000',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  loadingText: {
    color: '#FFF',
    marginTop: 12,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#000',
  },
  errorText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 24,
    textAlign: 'center',
  },
  backBtn: {
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backBtnText: {
    color: '#FFF',
    fontWeight: '800',
    fontSize: 14,
  },
});
