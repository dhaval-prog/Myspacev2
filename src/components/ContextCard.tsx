import React, { useEffect, useRef, useState } from 'react';
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
 * what happens next" — never a conventional CTA. It fades in the first
 * time it appears, and cross-fades quietly whenever the selected
 * category changes afterward.
 *
 * The displayed text is its own state, swapped only at the bottom of the
 * fade-out — never the raw props — so a change never flashes the new
 * label in at full opacity before the animation has a chance to hide it.
 */
export function ContextCard({ label, title, onPress, reduceMotion }: ContextCardProps) {
  const opacity = useRef(new Animated.Value(0)).current;
  const mounted = useRef(false);
  const [shown, setShown] = useState({ label, title });

  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      opacity.setValue(reduceMotion ? 1 : 0);
      Animated.timing(opacity, {
        toValue: 1,
        duration: reduceMotion ? 0 : duration.state,
        easing: EASE,
        useNativeDriver: true,
      }).start();
      return;
    }

    if (shown.label === label && shown.title === title) return;

    if (reduceMotion) {
      setShown({ label, title });
      return;
    }

    Animated.timing(opacity, {
      toValue: 0,
      duration: duration.micro,
      easing: EASE,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (!finished) return;
      setShown({ label, title });
      Animated.timing(opacity, {
        toValue: 1,
        duration: duration.state,
        easing: EASE,
        useNativeDriver: true,
      }).start();
    });
    // shown intentionally excluded — it's the effect's own output, not an input.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [label, title, opacity, reduceMotion]);

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Selected: ${shown.label}, ${shown.title}. Open on the right.`}
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
    >
      <Animated.View style={{ opacity }}>
        <Text style={typography.monoLabel}>{shown.label}</Text>
        <Text style={[typography.heading, styles.title]}>{shown.title}</Text>
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
