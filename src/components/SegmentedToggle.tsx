import React, { useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, EASE, radius, spacing, typography } from '../theme';

interface SegmentedToggleOption {
  label: string;
  value: string;
}

interface SegmentedToggleProps {
  options: [SegmentedToggleOption, SegmentedToggleOption];
  value: string;
  onChange: (value: string) => void;
}

/** Two-option pill toggle with a sliding highlight, e.g. ML vs Capsules. */
export function SegmentedToggle({ options, value, onChange }: SegmentedToggleProps) {
  const [width, setWidth] = useState(0);
  const selectedIndex = options[1].value === value ? 1 : 0;
  const slide = useRef(new Animated.Value(selectedIndex)).current;

  React.useEffect(() => {
    Animated.timing(slide, { toValue: selectedIndex, duration: 220, easing: EASE, useNativeDriver: true }).start();
  }, [selectedIndex, slide]);

  const halfWidth = Math.max(0, width - 8) / 2;

  return (
    <View style={styles.track} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      {width > 0 && (
        <Animated.View
          style={[
            styles.highlight,
            {
              width: halfWidth,
              transform: [{ translateX: slide.interpolate({ inputRange: [0, 1], outputRange: [0, halfWidth] }) }],
            },
          ]}
        />
      )}
      {options.map((opt) => {
        const on = opt.value === value;
        return (
          <Pressable
            key={opt.value}
            onPress={() => onChange(opt.value)}
            accessibilityRole="radio"
            accessibilityState={{ checked: on }}
            accessibilityLabel={opt.label}
            style={styles.option}
          >
            <Text style={[typography.chipLabel, { color: on ? colors.lime : colors.textPrimary }]}>{opt.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    flexDirection: 'row',
    backgroundColor: colors.pale,
    borderRadius: radius.md,
    padding: 4,
  },
  highlight: {
    position: 'absolute',
    top: 4,
    bottom: 4,
    left: 4,
    borderRadius: radius.md - 4,
    backgroundColor: colors.ink,
  },
  option: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.ms,
  },
});
