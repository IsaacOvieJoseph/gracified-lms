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
import * as Notifications from 'expo-notifications';
import * as SplashScreen from 'expo-splash-screen';
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

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

function AppContent() {
  const { user } = useAuth();
  const { theme } = useTheme();
  const [appReady, setAppReady] = useState(false);
  const [showCustomSplash, setShowCustomSplash] = useState(true);

  useEffect(() => {
    const registerPushToken = async () => {
      if (!user || !Device.isDevice) return;

      try {
        const storedToken = await AsyncStorage.getItem('pushToken');
        const { status: existingStatus } = await Notifications.getPermissionsAsync();
        let finalStatus = existingStatus;

        if (existingStatus !== 'granted') {
          const { status } = await Notifications.requestPermissionsAsync();
          finalStatus = status;
        }

        if (finalStatus !== 'granted') return;

        const tokenData = await Notifications.getExpoPushTokenAsync();
        const token = tokenData?.data;
        if (!token || token === storedToken) return;

        await api.post('/users/expo-token', { token });
        await AsyncStorage.setItem('pushToken', token);
      } catch (error) {
        console.log('Push registration failed:', error.message);
      }
    };

    registerPushToken();
  }, [user]);

  useEffect(() => {
    const prepareApp = async () => {
      try {
        await new Promise((resolve) => setTimeout(resolve, 400));
        setAppReady(true);
      } catch (error) {
        console.log('App bootstrap failed:', error.message);
        setAppReady(true);
      }
    };

    prepareApp();
  }, []);

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

  if (showCustomSplash && !appReady) {
    return (
      <GracifiedSplash
        theme={theme.mode === 'dark' ? 'dark' : 'light'}
        onFinish={() => {
          if (appReady) {
            setShowCustomSplash(false);
          }
        }}
      />
    );
  }

  if (showCustomSplash && appReady) {
    return (
      <GracifiedSplash
        theme={theme.mode === 'dark' ? 'dark' : 'light'}
        onFinish={() => {
          setShowCustomSplash(false);
        }}
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
