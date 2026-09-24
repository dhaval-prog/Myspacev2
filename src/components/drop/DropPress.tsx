import React, { useRef } from 'react';
import { Animated, Pressable, PressableProps, StyleProp, ViewStyle } from 'react-native';

interface DropPressProps extends Omit<PressableProps, 'style'> {
  scale?: boolean;
  style?: StyleProp<ViewStyle>;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/** Generic pressable wrapper — scales to 0.975 over 140ms on press, matching Parallax's Press.tsx exactly. */
export function DropPress({ scale = true, style, onPressIn, onPressOut, accessibilityRole, onPress, ...rest }: DropPressProps) {
  const anim = useRef(new Animated.Value(1)).current;

  return (
    <AnimatedPressable
      accessibilityRole={accessibilityRole ?? (onPress ? 'button' : undefined)}
      onPress={onPress}
      onPressIn={(e) => {
        if (scale) Animated.timing(anim, { toValue: 0.975, duration: 140, useNativeDriver: true }).start();
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        if (scale) Animated.timing(anim, { toValue: 1, duration: 140, useNativeDriver: true }).start();
        onPressOut?.(e);
      }}
      style={[scale ? { transform: [{ scale: anim }] } : null, style]}
      {...rest}
    />
  );
}
