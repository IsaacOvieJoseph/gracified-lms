import React from 'react';
import { TextInput, StyleSheet, View } from 'react-native';
import { useTheme } from '../../context/ThemeContext';

export default function Input({ placeholder, value, onChangeText, secureTextEntry, keyboardType = 'default' }) {
  const { theme } = useTheme();
  return (
    <View style={styles.wrapper}>
      <TextInput
        style={[styles.input, { backgroundColor: theme.surface, borderColor: theme.border, color: theme.text }]}
        placeholder={placeholder}
        placeholderTextColor={theme.muted}
        value={value}
        onChangeText={onChangeText}
        secureTextEntry={secureTextEntry}
        keyboardType={keyboardType}
        autoCapitalize="none"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginBottom: 12,
  },
  input: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
});
