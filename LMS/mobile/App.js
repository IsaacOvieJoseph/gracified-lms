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
import React, { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { ThemeProvider, useTheme } from './src/context/ThemeContext';
import api from './src/api/api';
import AppNavigator from './src/navigation/AppNavigator';

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
          <NavigationContainer>
            <AppContent />
          </NavigationContainer>
        </SafeAreaProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
