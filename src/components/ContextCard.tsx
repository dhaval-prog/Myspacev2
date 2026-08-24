import React, { useEffect, useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text } from 'react-native';
import { colors, radius, spacing, typography, EASE, duration } from '../theme';

interface ContextCardProps {
  label: string;
  title: string;
  onPress?: () => void;
  reduceMotion?: boolean;
}

/**
 * The lightweight lime panel that answers "where am I / what's selected /
 * what happens next" — never a conventional CTA. Content cross-fades
 * quietly whenever the selected category changes.
 */
export function ContextCard({ label, title, onPress, reduceMotion }: ContextCardProps) {
  const opacity = useRef(new Animated.Value(1)).current;
  const prevLabel = useRef(label);

  useEffect(() => {
    if (prevLabel.current !== label) {
      prevLabel.current = label;
      opacity.setValue(reduceMotion ? 1 : 0);
      Animated.timing(opacity, {
        toValue: 1,
        duration: reduceMotion ? 0 : duration.state,
        easing: EASE,
        useNativeDriver: true,
      }).start();
    }
  }, [label, opacity, reduceMotion]);

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Selected: ${label}, ${title}. Open on the right.`}
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
    >
      <Animated.View style={{ opacity }}>
        <Text style={typography.monoLabel}>{label}</Text>
        <Text style={[typography.heading, styles.title]}>{title}</Text>
        <Text style={[typography.caption, styles.supporting]}>Open on the right →</Text>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: spacing.xxl,
    marginBottom: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.lime,
    padding: spacing.lg,
  },
  cardPressed: {
    opacity: 0.92,
  },
  title: {
    marginTop: spacing.xs,
  },
  supporting: {
    marginTop: 5,
  },
});
