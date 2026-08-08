import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Animated, Easing, Dimensions, ImageBackground } from 'react-native';

const CAROUSEL_DATA = [
  {
    image: require('../../assets/kid.jpg'),
    title: 'Smart Classrooms for Kids',
    subtitle: 'Interactive lessons, engaging assignments, and real-time progress tracking for schools and young learners.',
  },
  {
    image: require('../../assets/youth.jpg'),
    title: 'AI-Powered Learning & Exams',
    subtitle: 'Master topics, join live sessions, and accelerate your study goals with smart AI assistance.',
  },
  {
    image: require('../../assets/Teacher.jpg'),
    title: 'Teach, Track, and Grow',
    subtitle: 'Create lessons, guide learners, review submissions, and monitor classroom progress from one simple workspace.',
  },
  {
    image: require('../../assets/old.png'),
    title: 'All-in-One Teaching Workspace',
    subtitle: 'Manage schools, classrooms, curricula, and student payments seamlessly under one roof.',
  },
];

const CAROUSEL_INTERVAL = 7000; // 7 seconds per image — gives pan time to breathe
const PAN_AMOUNT = 300;         // total pixels swept right-to-left
const PAN_DURATION = 6500;      // slow, cinematic drift (ms)
const FADE_DURATION = 700;      // cross-fade duration (ms)

export default function AuthCarousel({ showDots = false }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const textTranslateY = useRef(new Animated.Value(0)).current;
  // translateX: 0 (flush left, no gap) → -PAN_AMOUNT (image drifts left, revealing right side)
  const panAnim = useRef(new Animated.Value(0)).current;
  const { width, height } = Dimensions.get('window');

  const startPan = () => {
    panAnim.setValue(0);
    textTranslateY.setValue(0);
    Animated.timing(panAnim, {
      toValue: -PAN_AMOUNT,
      duration: PAN_DURATION,
      easing: Easing.out(Easing.quad), // starts smooth, eases to a gentle crawl
      useNativeDriver: true,
    }).start();
  };

  useEffect(() => {
    startPan();

    const interval = setInterval(() => {
      // Fade out image and text with subtle down slide
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: FADE_DURATION,
          useNativeDriver: true,
        }),
        Animated.timing(textTranslateY, {
          toValue: 10,
          duration: FADE_DURATION,
          useNativeDriver: true,
        }),
      ]).start(() => {
        // Swap image + reset pan flush to left
        setCurrentIndex((prev) => (prev + 1) % CAROUSEL_DATA.length);
        panAnim.setValue(0);
        textTranslateY.setValue(20); // Prepare slide-up starting position

        // Fade in + slide up + begin slow pan simultaneously
        Animated.parallel([
          Animated.timing(fadeAnim, {
            toValue: 1,
            duration: FADE_DURATION,
            useNativeDriver: true,
          }),
          Animated.timing(textTranslateY, {
            toValue: 0,
            duration: FADE_DURATION,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.timing(panAnim, {
            toValue: -PAN_AMOUNT,
            duration: PAN_DURATION,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
        ]).start();
      });
    }, CAROUSEL_INTERVAL);

    return () => clearInterval(interval);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const currentItem = CAROUSEL_DATA[currentIndex];

  return (
    <View style={[styles.carouselContainer, { width, height }]}>
      <Animated.View
        style={[
          styles.imageWrapper,
          {
            opacity: fadeAnim,
            transform: [{ translateX: panAnim }],
          },
        ]}
      >
        <ImageBackground
          source={currentItem.image}
          style={styles.backgroundImage}
          resizeMode="cover"
        />
      </Animated.View>

      {/* Dark overlay gradient for text legibility */}
      <View style={styles.darkGradientOverlay} pointerEvents="none" />

      {/* Animated Text Content Overlay */}
      <Animated.View
        style={[
          styles.textContentContainer,
          {
            opacity: fadeAnim,
            transform: [{ translateY: textTranslateY }],
          },
        ]}
      >
        <Text style={styles.title}>{currentItem.title}</Text>
        <Text style={styles.subtitle}>{currentItem.subtitle}</Text>
        {showDots && (
          <View style={styles.dotsContainer}>
            {CAROUSEL_DATA.map((_, index) => (
              <View
                key={index}
                style={[
                  styles.dot,
                  index === currentIndex ? styles.activeDot : styles.inactiveDot,
                ]}
              />
            ))}
          </View>
        )}
      </Animated.View>
    </View>
  );
}

const { width } = Dimensions.get('window');

const styles = StyleSheet.create({
  carouselContainer: {
    width: width,
    height: '100%',
    borderRadius: 0,
    overflow: 'hidden',
  },
  imageWrapper: {
    // position absolute removes flex interference — always anchored to top-left
    position: 'absolute',
    top: 0,
    left: 0,
    width: width + PAN_AMOUNT,
    height: '100%',
  },
  backgroundImage: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  darkGradientOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    top: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
  },
  textContentContainer: {
    position: 'absolute',
    left: 24,
    right: 24,
    top: '38%', // Positioned slightly above the middle of the screen
    zIndex: 10,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 8,
    letterSpacing: 0.2,
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '500',
    color: 'rgba(255, 255, 255, 0.9)',
    textShadowColor: 'rgba(0, 0, 0, 0.4)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  dotsContainer: {
    marginTop: 16,
    flexDirection: 'row',
    gap: 8,
    zIndex: 10,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  activeDot: {
    backgroundColor: '#ffffff',
    width: 24, // Expanded pill shape for active dot
    height: 8,
    borderRadius: 4,
  },
  inactiveDot: {
    backgroundColor: 'rgba(255, 255, 255, 0.4)',
  },
});
