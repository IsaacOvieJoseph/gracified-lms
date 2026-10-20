const rootGlobal = typeof globalThis !== 'undefined' ? globalThis : typeof global !== 'undefined' ? global : this;

if (typeof rootGlobal.DOMRect === 'undefined') {
  class DOMRect {
    constructor(x = 0, y = 0, width = 0, height = 0) {
      this.x = x;
      this.y = y;
      this.width = width;
      this.height = height;
      this.top = y;
      this.left = x;
      this.bottom = y + height;
      this.right = x + width;
    }

    toJSON() {
      return {
        x: this.x,
        y: this.y,
        width: this.width,
        height: this.height,
        top: this.top,
        left: this.left,
        bottom: this.bottom,
        right: this.right,
      };
    }

    static fromRect(rect) {
      return new DOMRect(rect.x, rect.y, rect.width, rect.height);
    }
  }

  rootGlobal.DOMRect = DOMRect;
  rootGlobal.DOMRectReadOnly = DOMRect;
  if (typeof rootGlobal.window !== 'undefined') {
    rootGlobal.window.DOMRect = DOMRect;
    rootGlobal.window.DOMRectReadOnly = DOMRect;
  }
}

import 'react-native-gesture-handler';
import React, { useCallback, useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import * as Device from 'expo-device';
import {
  AuthorizationStatus,
  getMessaging,
  getToken,
  onMessage,
  onTokenRefresh,
  requestPermission,
} from '@react-native-firebase/messaging';
import * as SplashScreen from 'expo-splash-screen';
import { PermissionsAndroid, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { NavigationContainer, createNavigationContainerRef } from '@react-navigation/native';
import * as Linking from 'expo-linking';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { ThemeProvider, useTheme } from './src/context/ThemeContext';
import api from './src/api/api';
import AppNavigator from './src/navigation/AppNavigator';
import GracifiedSplash from './components/GracifiedSplash';

export const navigationRef = createNavigationContainerRef();
const messagingInstance = getMessaging();

SplashScreen.preventAutoHideAsync();

const linking = {
  prefixes: [
    'gracifiedlms://',
    'https://gracified-lms.vercel.app',
    'https://www.gracified-lms.vercel.app',
  ],
  getInitialURL: async () => Linking.getInitialURL(),
  subscribe: (listener) => {
    const subscription = Linking.addEventListener('url', ({ url }) => listener(url));
    return () => subscription.remove();
  },
  config: {
    screens: {
      SharedResource: ':resourceType/:identifier',
    },
  },
};

// Foreground push handling: FCM delivers messages to onMessage() when the app
// is in the foreground. Unlike Expo, there is no built-in banner renderer here
// (notifications module was merged into messaging), so we surface foreground
// notifications via the in-app Notifications screen (fetched from the API).
// Background/closed-app banners are rendered automatically by the OS/FCM.

function AppContent() {
  const { user } = useAuth();
  const { theme } = useTheme();
  const [appReady, setAppReady] = useState(false);
  const [showCustomSplash, setShowCustomSplash] = useState(true);
  const [splashAnimationComplete, setSplashAnimationComplete] = useState(false);

  useEffect(() => {
    // Foreground messages. The OS shows banners automatically when the app is
    // backgrounded/closed; in the foreground we rely on the in-app list.
    const unsubscribeForeground = onMessage(messagingInstance, async (remoteMessage) => {
      // Intentionally lightweight — push content is also persisted to the
      // in-app notifications list via the API. Add an in-app banner here if
      // you want foreground popups.
    });

    const saveToken = async (token) => {
      const platform = Platform.OS === 'ios' ? 'ios' : 'android';
      await api.post('/users/push-token', { token, platform });
      await AsyncStorage.setItem('fcmToken', token);
    };

    const registerPushToken = async () => {
      if (!user || !Device.isDevice) return;

      try {
        let enabled = true;

        if (Platform.OS === 'ios') {
          const authStatus = await requestPermission(messagingInstance);
          enabled =
            authStatus === AuthorizationStatus.AUTHORIZED ||
            authStatus === AuthorizationStatus.PROVISIONAL;
        } else if (Platform.OS === 'android' && Platform.Version >= 33) {
          // Android 13+ requires the runtime POST_NOTIFICATIONS permission.
          const result = await PermissionsAndroid.request(
            PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS
          );
          enabled = result === PermissionsAndroid.RESULTS.GRANTED;
        }

        if (!enabled) return;

        const token = await getToken(messagingInstance);
        if (!token) return;

        const storedToken = await AsyncStorage.getItem('fcmToken');
        if (token !== storedToken) {
          await saveToken(token);
        }
      } catch (error) {
        console.log('FCM registration failed:', error.message);
      }
    };

    registerPushToken();

    // Keep the backend in sync when FCM rotates the token.
    const unsubscribeTokenRefresh = onTokenRefresh(messagingInstance, async (token) => {
      try {
        await saveToken(token);
      } catch (error) {
        console.log('FCM token refresh failed:', error.message);
      }
    });

    return () => {
      unsubscribeForeground();
      unsubscribeTokenRefresh();
    };
  }, [user]);

  useEffect(() => {
    let isMounted = true;

    const prepareApp = async () => {
      try {
        await new Promise((resolve) => setTimeout(resolve, 400));
        if (isMounted) {
          setAppReady(true);
        }
      } catch (error) {
        console.log('App bootstrap failed:', error.message);
        if (isMounted) {
          setAppReady(true);
        }
      }
    };

    prepareApp();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!appReady || !splashAnimationComplete) return;

    const transitionTimer = setTimeout(() => {
      setShowCustomSplash(false);
    }, 150);

    return () => clearTimeout(transitionTimer);
  }, [appReady, splashAnimationComplete]);

  const handleLayoutRootView = useCallback(async () => {
    if (!appReady) return;

    try {
      await SplashScreen.hideAsync();
    } catch (error) {
      console.log('Splash hide failed:', error.message);
    }
  }, [appReady]);

  useEffect(() => {
    if (appReady) {
      handleLayoutRootView();
    }
  }, [appReady, handleLayoutRootView]);

  useEffect(() => {
    if (!appReady || !showCustomSplash) return;

    const timer = setTimeout(() => {
      setShowCustomSplash(false);
    }, 900);

    return () => clearTimeout(timer);
  }, [appReady, showCustomSplash]);

  if (showCustomSplash) {
    return (
      <GracifiedSplash
        theme={theme.mode === 'dark' ? 'dark' : 'light'}
      />
    );
  }

  return (
    <>
      <StatusBar style={theme.mode === 'dark' ? 'light' : 'dark'} />
      <AppNavigator />
    </>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <SafeAreaProvider> 
          <NavigationContainer ref={navigationRef} linking={linking}>
            <AppContent />
          </NavigationContainer>
        </SafeAreaProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
