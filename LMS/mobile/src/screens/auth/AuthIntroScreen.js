import React from 'react';
import { View, StyleSheet, Dimensions, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../context/ThemeContext';
import Button from '../../components/ui/Button';
import AuthCarousel from '../../components/AuthCarousel';

export default function AuthIntroScreen({ navigation }) {
  const { theme } = useTheme();
  const { width, height } = Dimensions.get('window');

  return (
    <SafeAreaView style={styles.container}>
      <View style={[styles.backgroundContainer, { width, height }]}>
        <AuthCarousel showDots={true} />
      </View>
      
      <View style={[styles.contentOverlay, { backgroundColor: 'rgba(0, 0, 0, 0.3)' }]}>
        <View style={styles.buttonContainer}>
          <Button 
            title="Sign in" 
            onPress={() => navigation.navigate('Login')}
          />
          <Button 
            title="Sign up" 
            onPress={() => navigation.navigate('Register')}
            variant="secondary"
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
});
