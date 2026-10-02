import React, { useState } from 'react';
import { TextInput, StyleSheet, View, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';

export default function Input({
  placeholder,
  value,
  onChangeText,
  secureTextEntry,
  keyboardType = 'default',
  style,
  ...rest
}) {
  const { theme } = useTheme();
  const [showPassword, setShowPassword] = useState(false);

  const isPassword = Boolean(secureTextEntry);

  return (
    <View style={styles.wrapper}>
      <View style={styles.inputContainer}>
        <TextInput
          style={[
            styles.input,
            { backgroundColor: theme.surface, borderColor: theme.border, color: theme.text },
            isPassword && styles.inputWithIcon,
            style,
          ]}
          placeholder={placeholder}
          placeholderTextColor={theme.muted}
          value={value}
          onChangeText={onChangeText}
          secureTextEntry={isPassword ? !showPassword : false}
          keyboardType={keyboardType}
          autoCapitalize="none"
          {...rest}
        />
        {isPassword && (
          <Pressable
            style={styles.iconButton}
            onPress={() => setShowPassword((prev) => !prev)}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons
              name={showPassword ? 'eye-off-outline' : 'eye-outline'}
              size={20}
              color={theme.muted}
            />
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginBottom: 12,
  },
  inputContainer: {
    position: 'relative',
    justifyContent: 'center',
  },
  input: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  inputWithIcon: {
    paddingRight: 44,
  },
  iconButton: {
    position: 'absolute',
    right: 14,
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
