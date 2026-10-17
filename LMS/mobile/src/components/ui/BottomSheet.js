import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import {
  Animated,
  Modal,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';

const DISMISS_DISTANCE = 120;
const DISMISS_VELOCITY = 0.5;

export default function BottomSheet({
  visible = false,
  onClose,
  title,
  children,
  headerContent,
  footer,
  maxHeight = '86%',
  scrollEnabled = true,
  enableDragToDismiss = true,
}) {
  const { theme } = useTheme();

  const translateY = useRef(new Animated.Value(0)).current;
  const dragOffset = useRef(0);
  const sheetHeight = useRef(0);

  const animateOut = useCallback(
    (velocity = 0) => {
      Animated.timing(translateY, {
        toValue: sheetHeight.current || 400,
        duration: 200,
        useNativeDriver: true,
        velocity,
      }).start(() => {
        dragOffset.current = 0;
        if (onClose) onClose();
      });
    },
    [onClose, translateY]
  );

  // Reset position whenever the sheet is reopened, otherwise it inherits
  // whatever offset the previous dismiss animation left behind.
  useEffect(() => {
    if (!visible) return;
    dragOffset.current = 0;
    translateY.setValue(0);
  }, [visible, translateY]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_evt, gesture) =>
          enableDragToDismiss && gesture.dy > 6 && Math.abs(gesture.dy) > Math.abs(gesture.dx),
        onPanResponderMove: (_evt, gesture) => {
          // Rubber-band upward drags so the sheet cannot be pulled off-screen.
          const next = gesture.dy > 0 ? gesture.dy : gesture.dy * 0.25;
          dragOffset.current = next;
          translateY.setValue(next);
        },
        onPanResponderRelease: (_evt, gesture) => {
          const shouldDismiss =
            dragOffset.current > DISMISS_DISTANCE || gesture.vy > DISMISS_VELOCITY;
          if (shouldDismiss) {
            animateOut(gesture.vy);
            return;
          }
          dragOffset.current = 0;
          Animated.spring(translateY, {
            toValue: 0,
            useNativeDriver: true,
            bounciness: 4,
          }).start();
        },
        onPanResponderTerminate: () => {
          dragOffset.current = 0;
          Animated.spring(translateY, { toValue: 0, useNativeDriver: true }).start();
        },
      }),
    [animateOut, enableDragToDismiss, translateY]
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.root}>
        <Animated.View style={[styles.backdrop, { opacity: translateY.interpolate({
          inputRange: [0, 1],
          outputRange: [1, 0],
          extrapolate: 'clamp',
        }) }]}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Close bottom sheet"
          />
        </Animated.View>

        <Animated.View
          style={[
            styles.sheet,
            {
              backgroundColor: theme.background,
              maxHeight,
              transform: [{ translateY }],
            },
          ]}
          onLayout={(e) => {
            sheetHeight.current = e.nativeEvent.layout.height;
          }}
        >
          {/* Drag handle is the drag surface. Keeping panHandlers here (rather than on
              the sheet body) leaves the inner ScrollView free to scroll normally. */}
          <View
            style={styles.dragArea}
            {...(enableDragToDismiss ? panResponder.panHandlers : {})}
            accessibilityRole="adjustable"
            accessibilityLabel="Drag down to close"
          >
            <View style={[styles.handle, { backgroundColor: theme.border }]} />

            {(title || onClose) && (
              <View style={styles.header}>
                <Text style={[styles.title, { color: theme.text }]} numberOfLines={1}>
                  {title}
                </Text>
                {onClose ? (
                  <Pressable onPress={onClose} hitSlop={10} style={styles.closeBtn}>
                    <Ionicons name="close" size={22} color={theme.muted} />
                  </Pressable>
                ) : null}
              </View>
            )}
          </View>

          {headerContent}

          <SafeAreaView edges={['bottom']} style={styles.flex}>
            <ScrollView
              contentContainerStyle={styles.content}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              scrollEnabled={scrollEnabled}
            >
              {children}
            </ScrollView>
            {footer}
          </SafeAreaView>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: 'hidden',
  },
  dragArea: {
    paddingTop: 10,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    marginBottom: 4,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: 12,
  },
  title: { fontSize: 17, fontWeight: '800', flex: 1, paddingRight: 12 },
  closeBtn: { padding: 4 },
  content: { padding: 16 },
});