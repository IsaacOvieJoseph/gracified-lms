import React from 'react';
import { Pressable, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../context/ThemeContext';

export default function Button({ title, onPress, variant = 'primary', disabled = false }) {
  const { theme } = useTheme();

  const isPrimary = variant === 'primary';

  const bgColor = isPrimary ? theme.primary : theme.border;
  const textColor = isPrimary
    ? theme.onPrimary
    : (theme.secondaryText || theme.text);

  // In light mode the primary button is white — give it a visible border so it
  // doesn't dissolve into white backgrounds. In dark mode the border is subtle.
  const borderColor = isPrimary ? theme.onPrimary : (theme.secondaryText || theme.border);

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.base,
        {
          backgroundColor: bgColor,
          borderColor: borderColor,
          borderWidth: 1.5,
        },
        disabled && styles.disabled,
        pressed && styles.pressed,
      ]}
    >
      <Text style={[styles.text, { color: textColor }]}>{title}</Text>
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
  disabled: {
    opacity: 0.55,
  },
  text: {
    fontWeight: '700',
    fontSize: 15,
  },
});
