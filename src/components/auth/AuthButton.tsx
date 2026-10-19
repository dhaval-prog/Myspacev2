import React, { useRef } from 'react';
import { ActivityIndicator, Animated, Pressable, StyleSheet, Text } from 'react-native';
import { colors, radius, spacing, typography, EASE, duration } from '../../theme';

interface AuthButtonProps {
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
}

/** Full-width lime pill CTA — "Create Account" / "Log In". */
export function AuthButton({ label, onPress, loading, disabled }: AuthButtonProps) {
  const scale = useRef(new Animated.Value(1)).current;
  const isDisabled = disabled || loading;

  const animateTo = (v: number) =>
    Animated.timing(scale, { toValue: v, duration: duration.micro, easing: EASE, useNativeDriver: true }).start();

  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => !isDisabled && animateTo(0.97)}
      onPressOut={() => !isDisabled && animateTo(1)}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: isDisabled, busy: loading }}
    >
      <Animated.View
        style={[styles.button, { transform: [{ scale }] }, isDisabled && styles.buttonDisabled]}
      >
        {loading ? (
          <ActivityIndicator color={colors.textPrimary} />
        ) : (
          <Text style={typography.authButtonLabel}>{label}</Text>
        )}
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    borderRadius: radius.pill,
    backgroundColor: colors.lime,
    paddingVertical: spacing.xxxl,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.authCtaShadowColor,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: colors.authCtaShadowOpacity,
    shadowRadius: 24,
    elevation: 4,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
});
