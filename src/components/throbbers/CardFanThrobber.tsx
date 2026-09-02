import React from 'react';
import LottieView from 'lottie-react-native';
import { StyleSheet, Text, View } from 'react-native';
import { colors, fontFamily } from '../../theme';
import { useReducedMotion } from '../../hooks/useReducedMotion';

interface CardFanThrobberProps {
  size?: number;
  /** Uppercase caption below the animation — pass null/'' to omit it entirely. */
  label?: string | null;
}

/**
 * 1B · Card fan — full-surface cold-load throbber for Pocket (Expenses) and
 * Split. Three deck cards cycling through the shipped 1.35s loop, on its own
 * #060606 canvas regardless of the host screen's own background.
 */
export function CardFanThrobber({ size = 120, label = 'One sec' }: CardFanThrobberProps) {
  const reduceMotion = useReducedMotion();
  return (
    <View style={styles.wrap} accessibilityRole="progressbar" accessibilityLabel={label || 'Loading'}>
      <LottieView
        source={require('../../../assets/throbbers/throbber-card-fan.json')}
        autoPlay={!reduceMotion}
        loop={!reduceMotion}
        progress={reduceMotion ? 0 : undefined}
        style={[{ width: size, height: size * 0.75 }, reduceMotion && styles.frozen]}
      />
      {label ? <Text style={styles.label}>{label.toUpperCase()}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 18,
    backgroundColor: colors.walletBg,
  },
  frozen: {
    opacity: 0.75,
  },
  label: {
    fontFamily: fontFamily.mono500,
    fontSize: 11,
    letterSpacing: 1.54,
    color: 'rgba(255,255,255,.38)',
  },
});
