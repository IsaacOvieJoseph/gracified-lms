import React, { useEffect, useMemo, useRef } from 'react';
import {
  Animated,
  Easing,
  View,
  Image,
  StyleSheet,
  Dimensions,
  ImageSourcePropType,
} from 'react-native';

/**
 * Animated Gracified LMS splash / loading screen.
 *
 * Usage:
 *   <GracifiedSplash theme="dark" onFinish={() => setReady(true)} />
 *
 * Sequence (matches the web version):
 *   0.3s  book icon fades/scales in
 *   1.9s  "Gracified" slides up + fades in
 *   3.1s  "Learning Management System" slides up + fades in
 *   4.3s  loading bar fades in and starts looping
 *
 * onFinish fires once the reveal sequence completes (~4.3s), which is a
 * good moment to call SplashScreen.hideAsync() / navigate into the app.
 */

type Theme = 'light' | 'dark';

const ASSETS: Record<
  Theme,
  {
    icon: ImageSourcePropType;
    title: ImageSourcePropType;
    subtitle: ImageSourcePropType;
    background: string;
    loaderTrack: string;
  }
> = {
  light: {
    icon: require('../assets/gracified/icon-light.png'),
    title: require('../assets/gracified/title-light.png'),
    subtitle: require('../assets/gracified/subtitle-light.png'),
    background: '#fbfcff',
    loaderTrack: 'rgba(20,25,50,0.08)',
  },
  dark: {
    icon: require('../assets/gracified/icon-dark.png'),
    title: require('../assets/gracified/title-dark.png'),
    subtitle: require('../assets/gracified/subtitle-dark.png'),
    background: '#0a0d1f',
    loaderTrack: 'rgba(255,255,255,0.08)',
  },
};

// Exact layout of the three layers, as fractions of the overall lockup's
// bounding box (matches the source artwork's proportions 1:1).
const LAYOUT = {
  containerAspect: 343.15 / 906, // height / width
  icon:     { left: 0.00226, top: 0.00597, width: 0.40256, height: 0.98803 },
  title:    { left: 0.41148, top: 0.34879, width: 0.38784, height: 0.23055 },
  subtitle: { left: 0.41489, top: 0.58688, width: 0.58294, height: 0.15271 },
};

const ACCENT_INDIGO = '#5b4fd6';
const ACCENT_BLUE = '#3b6fe0';
const ACCENT_CYAN = '#4fd1ff';

const PARTICLES = [
  { top: 0.25, left: 0.14, size: 5, delay: 3200, color: ACCENT_CYAN },
  { top: 0.62, left: 0.7,  size: 4, delay: 4400, color: ACCENT_BLUE },
  { top: 0.72, left: 0.24, size: 5, delay: 5600, color: ACCENT_CYAN },
  { top: 0.34, left: 0.62, size: 3, delay: 6600, color: ACCENT_INDIGO },
  { top: 0.2,  left: 0.55, size: 4, delay: 5000, color: ACCENT_BLUE },
  { top: 0.8,  left: 0.45, size: 4, delay: 4000, color: ACCENT_INDIGO },
];

export interface GracifiedSplashProps {
  theme?: Theme;
  /** Called once the reveal sequence has completed and the splash has had a brief settle time. */
  onFinish?: () => void;
  /** Max width of the logo lockup, in dp. Defaults to 80% of screen width capped at 420. */
  maxWidth?: number;
}

export default function GracifiedSplash({
  theme = 'light',
  onFinish,
  maxWidth,
}: GracifiedSplashProps) {
  const palette = ASSETS[theme];

  const iconOpacity = useRef(new Animated.Value(0)).current;
  const iconScale = useRef(new Animated.Value(0.85)).current;
  const iconTranslateY = useRef(new Animated.Value(14)).current;

  const titleOpacity = useRef(new Animated.Value(0)).current;
  const titleTranslateY = useRef(new Animated.Value(14)).current;

  const subtitleOpacity = useRef(new Animated.Value(0)).current;
  const subtitleTranslateY = useRef(new Animated.Value(14)).current;

  const loaderOpacity = useRef(new Animated.Value(0)).current;
  const loaderX = useRef(new Animated.Value(0)).current;

  const iconGlow = useRef(new Animated.Value(0)).current;

  const particleAnims = useRef(PARTICLES.map(() => new Animated.Value(0))).current;

  useEffect(() => {
    // Icon: fade + scale + rise, with a slight overshoot for a lively pop.
    Animated.parallel([
      Animated.timing(iconOpacity, {
        toValue: 1,
        duration: 900,
        delay: 300,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(iconScale, {
        toValue: 1,
        duration: 1500,
        delay: 300,
        easing: Easing.out(Easing.back(1.1)),
        useNativeDriver: true,
      }),
      Animated.timing(iconTranslateY, {
        toValue: 0,
        duration: 1500,
        delay: 300,
        easing: Easing.out(Easing.back(1.1)),
        useNativeDriver: true,
      }),
    ]).start();

    // "Gracified"
    Animated.parallel([
      Animated.timing(titleOpacity, {
        toValue: 1,
        duration: 1100,
        delay: 1900,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(titleTranslateY, {
        toValue: 0,
        duration: 1100,
        delay: 1900,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();

    // "Learning Management System"
    Animated.parallel([
      Animated.timing(subtitleOpacity, {
        toValue: 1,
        duration: 1100,
        delay: 3100,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(subtitleTranslateY, {
        toValue: 0,
        duration: 1100,
        delay: 3100,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start(() => {
      const settleTimer = setTimeout(() => {
        onFinish?.();
      }, 700);

      return () => clearTimeout(settleTimer);
    });

    // Loading bar: fades in, then loops a sliding gradient sweep.
    Animated.timing(loaderOpacity, {
      toValue: 1,
      duration: 800,
      delay: 4300,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();

    Animated.loop(
      Animated.timing(loaderX, {
        toValue: 1,
        duration: 1600,
        delay: 4300,
        easing: Easing.inOut(Easing.cubic),
        useNativeDriver: true,
      })
    ).start();

    // Subtle glow pulse behind the icon, contained to its own bounds.
    Animated.loop(
      Animated.sequence([
        Animated.timing(iconGlow, {
          toValue: 1,
          duration: 2250,
          delay: 2400,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(iconGlow, {
          toValue: 0,
          duration: 2250,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    ).start();

    // Ambient drifting particles, each on its own staggered loop.
    particleAnims.forEach((val, i) => {
      const { delay } = PARTICLES[i];
      Animated.loop(
        Animated.timing(val, {
          toValue: 1,
          duration: 7500,
          delay,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        })
      ).start();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const screenWidth = Dimensions.get('window').width;
  const containerWidth = Math.min(maxWidth ?? 420, screenWidth * 0.8);
  const containerHeight = containerWidth * LAYOUT.containerAspect;

  const loaderTranslate = loaderX.interpolate({
    inputRange: [0, 1],
    outputRange: [-containerWidth * 0.42 * 0.5, containerWidth * 0.42 * 3.4],
  });

  const glowOpacity = iconGlow.interpolate({ inputRange: [0, 1], outputRange: [0.05, 0.16] });
  const glowScale = iconGlow.interpolate({ inputRange: [0, 1], outputRange: [1, 1.06] });

  return (
    <View style={[styles.stage, { backgroundColor: palette.background }]}>
      {PARTICLES.map((p, i) => {
        const translateY = particleAnims[i].interpolate({
          inputRange: [0, 0.12, 0.45, 0.8, 1],
          outputRange: [10, 10, -14, -26, -26],
        });
        const opacity = particleAnims[i].interpolate({
          inputRange: [0, 0.12, 0.45, 0.8, 1],
          outputRange: [0, 0.5, 0.3, 0, 0],
        });
        return (
          <Animated.View
            key={i}
            style={{
              position: 'absolute',
              top: `${p.top * 100}%`,
              left: `${p.left * 100}%`,
              width: p.size,
              height: p.size,
              borderRadius: 2,
              backgroundColor: p.color,
              opacity,
              transform: [{ translateY }],
            }}
          />
        );
      })}

      <View style={{ width: containerWidth, height: containerHeight }}>
        <View
          style={[
            styles.layerBase,
            {
              left: `${LAYOUT.icon.left * 100}%`,
              top: `${LAYOUT.icon.top * 100}%`,
              width: `${LAYOUT.icon.width * 100}%`,
              height: `${LAYOUT.icon.height * 100}%`,
              overflow: 'hidden',
            },
          ]}
        >
          {/* Soft contained glow pulse behind the icon */}
          <Animated.View
            pointerEvents="none"
            style={{
              position: 'absolute',
              left: '10%',
              top: '10%',
              width: '80%',
              height: '80%',
              borderRadius: 999,
              backgroundColor: ACCENT_CYAN,
              opacity: glowOpacity,
              transform: [{ scale: glowScale }],
            }}
          />
          <Animated.Image
            source={palette.icon}
            resizeMode="contain"
            style={{
              width: '100%',
              height: '100%',
              opacity: iconOpacity,
              transform: [
                { scale: iconScale },
                { translateY: iconTranslateY },
              ],
            }}
          />
        </View>

        <Animated.Image
          source={palette.title}
          resizeMode="contain"
          style={[
            styles.layerBase,
            {
              left: `${LAYOUT.title.left * 100}%`,
              top: `${LAYOUT.title.top * 100}%`,
              width: `${LAYOUT.title.width * 100}%`,
              height: `${LAYOUT.title.height * 100}%`,
              opacity: titleOpacity,
              transform: [{ translateY: titleTranslateY }],
            },
          ]}
        />

        <Animated.Image
          source={palette.subtitle}
          resizeMode="contain"
          style={[
            styles.layerBase,
            {
              left: `${LAYOUT.subtitle.left * 100}%`,
              top: `${LAYOUT.subtitle.top * 100}%`,
              width: `${LAYOUT.subtitle.width * 100}%`,
              height: `${LAYOUT.subtitle.height * 100}%`,
              opacity: subtitleOpacity,
              transform: [{ translateY: subtitleTranslateY }],
            },
          ]}
        />
      </View>

      <Animated.View
        style={[
          styles.loaderTrack,
          { backgroundColor: palette.loaderTrack, opacity: loaderOpacity },
        ]}
      >
        <Animated.View
          style={[
            styles.loaderFill,
            { transform: [{ translateX: loaderTranslate }] },
          ]}
        />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  stage: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  layerBase: {
    position: 'absolute',
  },
  loaderTrack: {
    marginTop: 48,
    width: 168,
    height: 3,
    borderRadius: 3,
    overflow: 'hidden',
  },
  loaderFill: {
    height: '100%',
    width: '40%',
    borderRadius: 3,
    backgroundColor: ACCENT_BLUE, // solid fallback; see README for gradient option
  },
});
