import React, { createContext, useContext, useState, useEffect } from 'react';
import { Appearance } from 'react-native';

const defaultDark = {
  mode: 'dark',
  background: '#020617',
  surface: '#111827',
  surfaceElevated: '#1E293B',
  border: '#334155',
  muted: '#94A3B8',
  text: '#F8FAFC',
  // Invert light-mode slate primary so buttons stay on-brand without neon blue
  primary: '#E2E8F0',
  onPrimary: '#0F172A',
  success: '#34D399',
  // Rose instead of neon red — readable with white/onPrimary text
  // Muted semantic accents keep dark-mode buttons calm instead of saturated.
  danger: '#A45A6E',
  info: '#5D7894',
  warning: '#FBBF24',
  neutral: '#94A3B8',
  overlay: 'rgba(2, 6, 23, 0.8)',
};

const defaultLight = {
  mode: 'light',
  background: '#F8FAFC',
  surface: '#FFFFFF',
  surfaceElevated: '#F1F5F9',
  border: '#E2E8F0',
  muted: '#64748B',
  text: '#0F172A',
  primary: '#0F172A',
  onPrimary: '#FFFFFF',
  success: '#059669',
  danger: '#BE123C',
  info: '#0284C7',
  warning: '#D97706',
  neutral: '#94A3B8',
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
