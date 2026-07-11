import React from 'react';
import { Pressable, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../context/ThemeContext';

export default function Button({ title, onPress, variant = 'primary' }) {
  const { theme } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        variant === 'secondary' ? { backgroundColor: theme.border } : { backgroundColor: theme.primary },
        pressed && styles.pressed,
      ]}
    >
      <Text style={[styles.text, { color: variant === 'secondary' ? theme.text : theme.onPrimary }]}>{title}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
  },
  pressed: {
    opacity: 0.85,
  },
  text: {
    fontWeight: '700',
    fontSize: 15,
  },
});
