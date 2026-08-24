import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { spacing, typography, EASE, duration } from '../theme';

interface HeroProps {
  line: string;
  reduceMotion?: boolean;
}

/**
 * Large, confident, editorial headline. This is the entrance to a personal
 * space, not a "welcome back" dashboard greeting.
 */
export function Hero({ line, reduceMotion }: HeroProps) {
  const opacity = useRef(new Animated.Value(1)).current;
  const prevLine = useRef(line);

  useEffect(() => {
    if (prevLine.current !== line) {
      prevLine.current = line;
      opacity.setValue(reduceMotion ? 1 : 0);
      Animated.timing(opacity, {
        toValue: 1,
        duration: reduceMotion ? 0 : duration.state,
        easing: EASE,
        useNativeDriver: true,
      }).start();
    }
  }, [line, opacity, reduceMotion]);

  return (
    <View style={styles.wrap}>
      <Text style={[typography.display, styles.headline]}>Everything in one place</Text>
      <Animated.Text style={[typography.body, styles.line, { opacity }]}>{line}</Animated.Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingTop: spacing.organic,
    paddingHorizontal: spacing.xxxl,
  },
  headline: {
    maxWidth: 290,
  },
  line: {
    marginTop: spacing.ms,
    maxWidth: 330,
  },
});
