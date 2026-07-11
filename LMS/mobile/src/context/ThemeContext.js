import React, { createContext, useContext, useState, useEffect } from 'react';
import { Appearance } from 'react-native';

const defaultDark = {
  mode: 'dark',
  background: '#020617',
  surface: '#111827',
  surfaceElevated: '#0F172A',
  border: '#1E293B',
  muted: '#64748B',
  text: '#F8FAFC',
  primary: '#3B82F6',
  onPrimary: '#FFFFFF',
  success: '#10B981',
  danger: '#EF4444',
  info: '#3B82F6',
  warning: '#F59E0B',
  neutral: '#334155',
  overlay: 'rgba(2, 6, 23, 0.8)',
};

const defaultLight = {
  mode: 'light',
  background: '#F8FAFC',
  surface: '#FFFFFF',
  surfaceElevated: '#F1F5F9',
  border: '#E6E9EE',
  muted: '#475569',
  text: '#0F172A',
  primary: '#0F172A',
  onPrimary: '#FFFFFF',
  success: '#059669',
  danger: '#DC2626',
  info: '#2563EB',
  warning: '#D97706',
  neutral: '#CBD5E1',
  overlay: 'rgba(15, 23, 42, 0.5)',
};

const ThemeContext = createContext();

export function ThemeProvider({ children }) {
  const colorScheme = Appearance.getColorScheme();
  const [theme, setTheme] = useState(colorScheme === 'light' ? defaultLight : defaultDark);

  useEffect(() => {
    const listener = ({ colorScheme: cs }) => {
      setTheme(cs === 'light' ? defaultLight : defaultDark);
    };
    const sub = Appearance.addChangeListener(listener);
    return () => {
      try { sub.remove(); } catch (e) { /* ignore */ }
    };
  }, []);

  const toggleTheme = () => {
    setTheme((t) => (t.mode === 'dark' ? defaultLight : defaultDark));
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
