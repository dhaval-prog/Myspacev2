import React from 'react';
import LottieView from 'lottie-react-native';
import { StyleSheet, View } from 'react-native';
import { colors } from '../../theme';
import { useReducedMotion } from '../../hooks/useReducedMotion';

interface DotPairThrobberProps {
  size?: number;
  /** Full-surface, dead-centre on the #060606 canvas (Home's cold load). Off for an inline spinner (e.g. a button). */
  center?: boolean;
}

/**
 * 1C · Dot pair — the quiet, label-less loader for Home's cold load (1.1s
 * loop), and the shared inline spinner anywhere else in the app down to 20pt.
 */
export function DotPairThrobber({ size = 52, center = false }: DotPairThrobberProps) {
  const reduceMotion = useReducedMotion();
  return (
    <View style={center ? styles.center : undefined} accessibilityRole="progressbar" accessibilityLabel="Loading">
      <LottieView
        source={require('../../../assets/throbbers/throbber-dot-pair.json')}
        autoPlay={!reduceMotion}
        loop={!reduceMotion}
        progress={reduceMotion ? 0 : undefined}
        style={[{ width: size, height: size }, reduceMotion && styles.frozen]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.walletBg,
  },
  frozen: {
    opacity: 0.75,
  },
});
