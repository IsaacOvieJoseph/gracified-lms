import React from 'react';
import { View, StyleSheet, Dimensions, Pressable, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import AuthCarousel from '../../components/AuthCarousel';

function ArrowAction({ title, onPress, variant = 'primary', theme }) {
  const isPrimary = variant === 'primary';
  const backgroundColor = isPrimary ? '#FFFFFF' : 'rgba(15, 23, 42, 0.76)';
  const textColor = isPrimary ? '#0F172A' : '#FFFFFF';
  const borderColor = isPrimary ? 'rgba(255, 255, 255, 0.88)' : 'rgba(255, 255, 255, 0.34)';
  const iconBackground = isPrimary ? theme.primary : 'rgba(255, 255, 255, 0.16)';

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.arrowButton,
        pressed && styles.arrowButtonPressed,
      ]}
      accessibilityRole="button"
      accessibilityLabel={title}
    >
      <View style={[styles.arrowBody, { backgroundColor, borderColor }]}>
        <Text
          allowFontScaling={false}
          numberOfLines={1}
          style={[styles.arrowText, { color: textColor }]}
        >
          {title}
        </Text>
        <View style={[styles.arrowIconWrap, { backgroundColor: iconBackground }]}>
          <Ionicons
            name="arrow-forward"
            size={20}
            color={isPrimary ? theme.onPrimary : '#FFFFFF'}
          />
        </View>
      </View>
    </Pressable>
  );
}

export default function AuthIntroScreen({ navigation }) {
  const { theme } = useTheme();
  const { width, height } = Dimensions.get('window');

  return (
    <SafeAreaView style={styles.container}>
      <View style={[styles.backgroundContainer, { width, height }]}>
        <AuthCarousel showDots={true} />
      </View>
      
      <View style={[styles.contentOverlay, { backgroundColor: 'transparent' }]}>
        <View style={styles.buttonContainer}>
          <ArrowAction
            title="Sign in"
            onPress={() => navigation.navigate('Login')}
            theme={theme}
          />
          <ArrowAction
            title="Create an account"
            onPress={() => navigation.navigate('Register')}
            variant="secondary"
            theme={theme}
          />
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  backgroundContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
  contentOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  buttonContainer: {
    gap: 12,
  },
  arrowButton: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  arrowButtonPressed: {
    opacity: 0.86,
    transform: [{ scale: 0.985 }],
  },
  arrowBody: {
    flex: 1,
    minHeight: 56,
    borderTopLeftRadius: 28,
    borderBottomLeftRadius: 28,
    borderTopRightRadius: 28,
    borderBottomRightRadius: 28,
    borderWidth: 1,
    paddingLeft: 24,
    paddingRight: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 2,
    shadowColor: '#000000',
    shadowOpacity: 0.2,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 12,
    elevation: 4,
  },
  arrowText: {
    flex: 1,
    fontSize: 15,
    fontWeight: '800',
    marginRight: 12,
  },
  arrowIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
