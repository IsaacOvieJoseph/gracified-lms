import React, { useEffect, useRef, useState } from 'react';
import { View, StyleSheet, Animated, Easing, Dimensions, ImageBackground } from 'react-native';

const IMAGES = [
  require('../../assets/kid.jpg'),
  require('../../assets/youth.jpg'),
  require('../../assets/old.png'),
];

const CAROUSEL_INTERVAL = 7000; // 7 seconds per image — gives pan time to breathe
const PAN_AMOUNT = 300;         // total pixels swept right-to-left
const PAN_DURATION = 6500;      // slow, cinematic drift (ms)
const FADE_DURATION = 700;      // cross-fade duration (ms)

export default function AuthCarousel({ showDots = false }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const fadeAnim = useRef(new Animated.Value(1)).current;
  // translateX: 0 (flush left, no gap) → -PAN_AMOUNT (image drifts left, revealing right side)
  const panAnim = useRef(new Animated.Value(0)).current;
  const { width, height } = Dimensions.get('window');

  const startPan = () => {
    panAnim.setValue(0);
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
      // Fade out
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: FADE_DURATION,
        useNativeDriver: true,
      }).start(() => {
        // Swap image + reset pan flush to left
        setCurrentIndex((prev) => (prev + 1) % IMAGES.length);
        panAnim.setValue(0);

        // Fade in + begin slow pan simultaneously
        Animated.parallel([
          Animated.timing(fadeAnim, {
            toValue: 1,
            duration: FADE_DURATION,
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
          source={IMAGES[currentIndex]}
          style={styles.backgroundImage}
          resizeMode="cover"
        />
      </Animated.View>

      {showDots && (
        <View style={styles.dotsContainer}>
          {IMAGES.map((_, index) => (
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
    </View>
  );
}

const { width } = Dimensions.get('window');

const styles = StyleSheet.create({
  carouselContainer: {
    width: width,
    height: 280,
    borderRadius: 20,
    overflow: 'hidden',
    marginBottom: 24,
  },
  imageWrapper: {
    // position absolute removes flex interference — always anchored to top-left
    position: 'absolute',
    top: 0,
    left: 0,
    // width + PAN_AMOUNT guarantees:
    //   • at translateX=0: left edge flush, right overhang hidden by overflow
    //   • at translateX=-PAN_AMOUNT: right edge exactly meets container edge — no gap
    width: width + PAN_AMOUNT,
    height: '100%',
  },
  backgroundImage: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  dotsContainer: {
    position: 'absolute',
    bottom: 20,
    alignSelf: 'center',
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
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  inactiveDot: {
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
  },
});
