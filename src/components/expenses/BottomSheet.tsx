import React, { useEffect, useRef } from 'react';
import { Animated, Dimensions, Modal, Pressable, StyleSheet, View } from 'react-native';
import { colors, spacing } from '../../theme';
import { useReducedMotion } from '../../hooks/useReducedMotion';

const SCREEN_HEIGHT = Dimensions.get('window').height;

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
          <View style={styles.handle} />
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
  handle: {
    alignSelf: 'center',
    width: 44,
    height: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(0,0,0,0.16)',
    marginBottom: spacing.xs,
  },
});
