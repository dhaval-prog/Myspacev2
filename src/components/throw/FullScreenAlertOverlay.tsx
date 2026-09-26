import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, PanResponder, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { throwColor, throwFont, throwRadius } from '../../theme/throwTokens';
import type { ThrowAlert } from '../../types/throw';

// How far (px) or how fast (px/ms) a horizontal drag has to go before it reads as a committed
// "crumple and throw it away" rather than a hold that springs back.
const SWIPE_THROW_DISTANCE = 90;
const SWIPE_THROW_VELOCITY = 0.5;
const THROW_OUT_DURATION_MS = 420;
// Past this much horizontal drag, the paper is already fully crumpled (scaled down) even before
// release — the crumple reads as a direct function of how far it's been dragged, not something
// that only happens after the throw is committed.
const FULL_CRUMPLE_DRAG_PX = 260;

interface FullScreenAlertOverlayProps {
  alert: ThrowAlert;
  onSnooze: () => void;
  onDismiss: () => void;
}

/**
 * The full-screen paper appears out of nowhere (a quick scale/fade materialize) and covers the
 * whole screen with the alert's own written text. Scrolling it left or right crumples it — scaled
 * down and slightly rotated in proportion to the drag — and, past the throw threshold, flings it
 * the rest of the way off screen in that same direction before calling onDismiss. Short of that
 * threshold it springs back flat. Snooze re-arms the same alert 5 minutes out instead.
 */
export function FullScreenAlertOverlay({ alert, onSnooze, onDismiss }: FullScreenAlertOverlayProps) {
  const insets = useSafeAreaInsets();
  const materialize = useRef(new Animated.Value(0)).current;
  const translateX = useRef(new Animated.Value(0)).current;
  const crumple = useRef(new Animated.Value(0)).current;
  const [dismissing, setDismissing] = useState(false);

  useEffect(() => {
    Animated.spring(materialize, { toValue: 1, useNativeDriver: true, friction: 8, tension: 40 }).start();
  }, [materialize]);

  const throwAway = (direction: 1 | -1) => {
    if (dismissing) return;
    setDismissing(true);
    Animated.parallel([
      Animated.timing(translateX, { toValue: direction * 700, duration: THROW_OUT_DURATION_MS, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
      Animated.timing(crumple, { toValue: 1, duration: THROW_OUT_DURATION_MS, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start(() => onDismiss());
  };

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponderCapture: (_, g) => Math.abs(g.dx) > 8 && Math.abs(g.dx) > Math.abs(g.dy),
        onPanResponderMove: (_, g) => {
          translateX.setValue(g.dx);
          crumple.setValue(Math.min(1, Math.abs(g.dx) / FULL_CRUMPLE_DRAG_PX));
        },
        onPanResponderRelease: (_, g) => {
          if (Math.abs(g.dx) >= SWIPE_THROW_DISTANCE || Math.abs(g.vx) >= SWIPE_THROW_VELOCITY) {
            throwAway(g.dx >= 0 ? 1 : -1);
          } else {
            Animated.parallel([
              Animated.spring(translateX, { toValue: 0, useNativeDriver: true, friction: 7, tension: 60 }),
              Animated.spring(crumple, { toValue: 0, useNativeDriver: true, friction: 7, tension: 60 }),
            ]).start();
          }
        },
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const scale = materialize.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1] });
  const crumpleScale = crumple.interpolate({ inputRange: [0, 1], outputRange: [1, 0.45] });
  const rotate = translateX.interpolate({ inputRange: [-500, 0, 500], outputRange: ['-24deg', '0deg', '24deg'], extrapolate: 'clamp' });

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <Animated.View style={[StyleSheet.absoluteFill, styles.backdrop, { opacity: materialize }]} pointerEvents="none" />
      <Animated.View
        {...panResponder.panHandlers}
        style={[
          styles.paper,
          { opacity: materialize, transform: [{ translateX }, { scale: Animated.multiply(scale, crumpleScale) }, { rotate }] },
        ]}
      >
        <Text style={styles.message}>{alert.messageText}</Text>

        <View style={[styles.actions, { bottom: insets.bottom + 48 }]}>
          <Pressable onPress={onSnooze} style={styles.snoozeBtn} accessibilityRole="button" accessibilityLabel="Snooze 5 minutes">
            <Text style={styles.snoozeLabel}>Snooze 5 min</Text>
          </Pressable>
          <Text style={styles.hint}>Scroll left or right to crumple it away</Text>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: { backgroundColor: 'rgba(43,35,28,.6)' },
  paper: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: throwColor.paper,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 36,
    ...throwColor.shadowSoft,
  },
  message: { fontFamily: throwFont.hand600, fontSize: 30, color: throwColor.ink, textAlign: 'center', lineHeight: 40 },
  actions: { position: 'absolute', alignItems: 'center', gap: 14 },
  snoozeBtn: { paddingHorizontal: 26, paddingVertical: 14, borderRadius: throwRadius.pill, backgroundColor: throwColor.clayDeep },
  snoozeLabel: { fontFamily: throwFont.ui700, fontSize: 15, color: '#fff' },
  hint: { fontFamily: throwFont.ui500, fontSize: 12.5, color: throwColor.inkMute },
});
