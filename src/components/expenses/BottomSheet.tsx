import React, { useEffect, useRef } from 'react';
import { Animated, Dimensions, Modal, PanResponder, Platform, Pressable, StyleSheet, View } from 'react-native';
import { colors, spacing } from '../../theme';
import { useReducedMotion } from '../../hooks/useReducedMotion';

const SCREEN_HEIGHT = Dimensions.get('window').height;
// How far the handle needs to be dragged down, or how fast it's flicked, before letting go counts
// as "dismiss" rather than springing back open — same threshold shape as FoldingLetter's own
// swipe gestures elsewhere in Throw.
const HANDLE_DISMISS_DISTANCE = 90;
const HANDLE_DISMISS_VELOCITY = 0.6;

interface BottomSheetProps {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
  /** Cap the sheet's height (e.g. History, which needs to scroll a long list). */
  maxHeightRatio?: number;
}

/** Scrim + white sheet that slides up from the bottom — shared by every Expenses modal. */
export function BottomSheet({ visible, onClose, children, maxHeightRatio }: BottomSheetProps) {
  const reduceMotion = useReducedMotion();
  const translateY = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const [mounted, setMounted] = React.useState(visible);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      translateY.setValue(reduceMotion ? 0 : SCREEN_HEIGHT);
      Animated.timing(translateY, {
        toValue: 0,
        duration: reduceMotion ? 0 : 420,
        easing: (t) => 1 - Math.pow(1 - t, 3),
        useNativeDriver: true,
      }).start();
    } else if (mounted) {
      Animated.timing(translateY, {
        toValue: SCREEN_HEIGHT,
        duration: reduceMotion ? 0 : 260,
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished) setMounted(false);
      });
    }
    // mounted intentionally excluded — driven by visible, not itself.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, reduceMotion, translateY]);

  // Always reads as the latest onClose regardless of when the web effect below's closure was
  // captured (see its own comment) — a plain prop reference there could otherwise call a stale
  // callback from whichever render happened to be current when `mounted` last flipped true.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  // Dragging the handle down dismisses the sheet, same convention as a native iOS sheet. Scoped to
  // just the handle (not the whole sheet) so it can never fight a scrollable/interactive child's
  // own gesture — e.g. AlertScheduleHeader's wheel pickers, for the "Remind me" self-reminder
  // sheet. The handle is always at rest (translateY === 0) whenever a drag can start here, so the
  // gesture just tracks raw `dy` directly rather than needing to read the Animated.Value first.
  const settleOrDismiss = (dy: number, velocityY: number) => {
    if (dy > HANDLE_DISMISS_DISTANCE || velocityY > HANDLE_DISMISS_VELOCITY) {
      onCloseRef.current();
    } else {
      Animated.timing(translateY, { toValue: 0, duration: 200, useNativeDriver: true }).start();
    }
  };
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderMove: (_, gesture) => {
        translateY.setValue(Math.max(0, gesture.dy));
      },
      onPanResponderRelease: (_, gesture) => settleOrDismiss(gesture.dy, gesture.vy),
    }),
  ).current;

  // react-native-web's PanResponder polyfill doesn't reliably track a drag started from a
  // simulated/real pointer sequence here either — the exact same dedupe bug FoldingLetter's own
  // fold-drag already works around (see its own onMoveShouldSetPanResponderCapture comment for the
  // full diagnosis). Skipped on native, where PanResponder's own tracking is reliable as-is.
  const handleRef = useRef<View>(null);
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const node = handleRef.current as any as HTMLElement | null;
    if (!node) return;
    const getY = (e: MouseEvent | TouchEvent): number | null => {
      if ('touches' in e) {
        const t = e.touches[0] ?? e.changedTouches[0];
        return t ? t.clientY : null;
      }
      return e.clientY;
    };
    let startY: number | null = null;
    let lastY = 0;
    let lastT = 0;
    let velocity = 0;
    const onDown = (e: MouseEvent | TouchEvent) => {
      const y = getY(e);
      if (y === null) return;
      startY = y;
      lastY = y;
      lastT = Date.now();
      velocity = 0;
    };
    const onMove = (e: MouseEvent | TouchEvent) => {
      if (startY === null) return;
      const y = getY(e);
      if (y === null) return;
      const now = Date.now();
      const dt = now - lastT;
      if (dt > 0) velocity = (y - lastY) / dt;
      lastY = y;
      lastT = now;
      translateY.setValue(Math.max(0, y - startY));
    };
    const onUp = () => {
      if (startY === null) return;
      settleOrDismiss(Math.max(0, lastY - startY), velocity);
      startY = null;
    };
    node.addEventListener('mousedown', onDown);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    node.addEventListener('touchstart', onDown, { passive: true });
    window.addEventListener('touchmove', onMove, { passive: true });
    window.addEventListener('touchend', onUp);
    return () => {
      node.removeEventListener('mousedown', onDown);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      node.removeEventListener('touchstart', onDown);
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('touchend', onUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted]);

  if (!mounted) return null;

  return (
    <Modal visible transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.wrap}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityRole="button" accessibilityLabel="Dismiss" />
        <Animated.View
          style={[
            styles.sheet,
            maxHeightRatio ? { maxHeight: SCREEN_HEIGHT * maxHeightRatio } : null,
            { transform: [{ translateY }] },
          ]}
        >
          <View
            ref={handleRef}
            style={styles.handleTouchArea}
            accessibilityLabel="Drag down to dismiss"
            {...(Platform.OS !== 'web' ? panResponder.panHandlers : null)}
          >
            <View style={styles.handle} />
          </View>
          {children}
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  sheet: {
    backgroundColor: colors.walletSheetBg,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingHorizontal: spacing.xxxl,
    paddingTop: spacing.lg,
    paddingBottom: spacing.huge,
    gap: spacing.ms,
  },
  // A bigger invisible touch target than the visual bar itself (below) — 44x4 alone is too thin
  // to reliably grab for the handle's own drag-to-dismiss gesture (see panResponder).
  handleTouchArea: {
    alignSelf: 'center',
    paddingVertical: 12,
    marginBottom: spacing.xs - 12,
  },
  handle: {
    width: 44,
    height: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(0,0,0,0.16)',
  },
});
