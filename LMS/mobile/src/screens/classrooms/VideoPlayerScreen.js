import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Pressable, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { getVideoEmbedInfo } from '../../utils/video';
import AITutorChatOverlay from '../../components/ai/AITutorChatOverlay';

export default function VideoPlayerScreen({ route, navigation }) {
  const { theme } = useTheme();
  const { videoUrl, title, aiTutor } = route.params || {};
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const webViewRef = useRef(null);

  useEffect(() => {
    if (!chatOpen) return;
    const t = setTimeout(() => {
      webViewRef.current?.injectJavaScript(`
        (function(){
          try { var v = document.querySelector('video'); if (v) v.pause(); } catch(e){}
          try {
            var f = document.querySelector('iframe');
            if (f && f.contentWindow) {
              f.contentWindow.postMessage(JSON.stringify({event:'command', func:'pauseVideo', args:''}), '*');
            }
          } catch(e){}
          true;
        })();
      `);
    }, 250);
    return () => clearTimeout(t);
  }, [chatOpen]);

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

  const escapeHtml = (value) => String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  const openExternally = async () => {
    try {
      const fallbackUrl = embedInfo?.type === 'youtube' && embedInfo.watchUrl
        ? embedInfo.watchUrl
        : videoUrl;
      await Linking.openURL(fallbackUrl);
    } catch (err) {
      setLoadError(true);
    }
  };

  const buildDirectVideoHtml = (src) => `
    <!DOCTYPE html>
    <html>
    <head>
      <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
      <style>
        body, html { margin: 0; padding: 0; width: 100%; height: 100%; background: #000; overflow: hidden; }
        video { width: 100%; height: 100%; object-fit: contain; background: #000; }
      </style>
    </head>
    <body>
      <video src="${escapeHtml(src)}" controls autoplay playsinline webkit-playsinline></video>
    </body>
    </html>
  `;

  const buildIframeHtml = (src) => `
    <!DOCTYPE html>
    <html>
    <head>
      <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
      <meta name="referrer" content="origin-when-cross-origin">
      <style>
        body, html { margin: 0; padding: 0; width: 100%; height: 100%; background: #000; overflow: hidden; }
        iframe { position: fixed; inset: 0; width: 100%; height: 100%; border: 0; background: #000; }
      </style>
    </head>
    <body>
      <iframe
        src="${escapeHtml(src)}"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen"
        allowfullscreen
        webkitallowfullscreen
        mozallowfullscreen
        referrerpolicy="strict-origin-when-cross-origin">
      </iframe>
    </body>
    </html>
  `;

  // Source configuration
  let webViewSource = {};
  if (embedInfo) {
    if (embedInfo.isDirect) {
      // Use HTML5 video wrapper for direct stream links (e.g. .mp4, dropbox raw streams)
      webViewSource = { html: buildDirectVideoHtml(embedInfo.embedUrl), baseUrl: embedInfo.baseUrl || videoUrl };
    } else {
      // Use an iframe wrapper so providers receive a stable document context inside WebView.
      webViewSource = { html: buildIframeHtml(embedInfo.embedUrl), baseUrl: embedInfo.baseUrl || embedInfo.embedUrl };
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
          ref={webViewRef}
          source={webViewSource}
          allowsFullscreenVideo={true}
          allowsInlineMediaPlayback={true}
          mediaPlaybackRequiresUserAction={false}
          onLoadStart={() => setLoading(true)}
          onLoadEnd={() => setLoading(false)}
          onError={() => {
            setLoading(false);
            setLoadError(true);
          }}
          onHttpError={() => {
            setLoading(false);
            setLoadError(true);
          }}
          style={styles.webview}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          // Use a mobile browser UA and a no-cookie embed host to reduce YouTube playback restrictions in WebView.
          userAgent="Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36"
          // Fixes for background audio and scaling
          originWhitelist={['*']}
          mixedContentMode="always"
          thirdPartyCookiesEnabled={true}
          sharedCookiesEnabled={true}
          setSupportMultipleWindows={false}
          // Better mobile video experience
          scalesPageToFit={true}
          bounces={false}
          allowsProtectedMedia={true}
        />
        
        {loading && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color={theme.primary} />
            <Text style={styles.loadingText}>Preparing Cinema Mode...</Text>
          </View>
        )}

        {loadError && (
          <View style={styles.errorOverlay}>
            <Ionicons name="alert-circle-outline" size={48} color={theme.warning} />
            <Text style={styles.errorText}>This video could not play in-app.</Text>
            <Pressable style={[styles.backBtn, { backgroundColor: theme.primary }]} onPress={openExternally}>
              <Text style={styles.backBtnText}>Open Video</Text>
            </Pressable>
          </View>
        )}

        {aiTutor && (
          <Pressable
            style={[styles.aiTutorBtn, { backgroundColor: 'rgba(0,0,0,0.75)' }]}
            onPress={() => setChatOpen(true)}
          >
            <Ionicons name="sparkles-outline" size={16} color="#FFF" />
            <Text style={styles.aiTutorBtnText}>Ask Gracy</Text>
          </Pressable>
        )}
      </View>

      {aiTutor && (
        <AITutorChatOverlay
          visible={chatOpen}
          onClose={() => setChatOpen(false)}
          topicId={aiTutor.topicId}
          subject={aiTutor.subject}
          context={aiTutor.context}
        />
      )}
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
  errorOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 11,
    padding: 24,
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
  aiTutorBtn: {
    position: 'absolute',
    right: 14,
    bottom: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
    zIndex: 12,
  },
  aiTutorBtnText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '800',
  },
});
