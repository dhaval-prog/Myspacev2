import React, { useEffect, useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text } from 'react-native';
import { scColor, scFont, scMotion } from '../../theme/spaceCardsTokens';

interface PrimaryCtaProps {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  reduceMotion?: boolean;
}

/** The lime primary action — breathing glow per §10 (cta-glow, 3.4s loop). Shared by every screen that shows it. */
export function PrimaryCta({ label, onPress, disabled, reduceMotion }: PrimaryCtaProps) {
  const glow = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (reduceMotion || disabled) {
      glow.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(glow, { toValue: 1, duration: scMotion.ctaGlowMs / 2, useNativeDriver: false }),
        Animated.timing(glow, { toValue: 0, duration: scMotion.ctaGlowMs / 2, useNativeDriver: false }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [reduceMotion, disabled, glow]);

  const shadowRadius = glow.interpolate({ inputRange: [0, 1], outputRange: [26, 38] });
  const shadowOpacity = glow.interpolate({ inputRange: [0, 1], outputRange: [0.4, 0.66] });

  return (
    <Animated.View style={[styles.wrap, { shadowRadius, shadowOpacity: disabled ? 0 : shadowOpacity }]}>
      <Pressable disabled={disabled} onPress={onPress} style={[styles.cta, disabled && styles.ctaDisabled]} accessibilityRole="button" accessibilityLabel={label}>
        <Text style={styles.label}>{label}</Text>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderRadius: 999,
    shadowColor: scColor.lime,
    shadowOffset: { width: 0, height: 12 },
  },
  cta: {
    paddingVertical: 19,
    borderRadius: 999,
    alignItems: 'center',
    backgroundColor: scColor.lime,
  },
  ctaDisabled: {
    backgroundColor: 'rgba(195,234,79,.35)',
  },
  label: {
    fontFamily: scFont.sans700,
    fontSize: 16.5,
    color: scColor.ink,
  },
});
