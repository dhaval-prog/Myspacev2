import React, { useRef, useState } from 'react';
import { Animated, StyleSheet, TextInput, View } from 'react-native';
import { colors, radius, spacing, typography, EASE, duration } from '../theme';

interface SearchBarProps {
  value: string;
  onChangeText: (text: string) => void;
}

/**
 * Search integrated into the header composition — a hairline field, not a
 * generic Material search bar. The border quietly deepens on focus.
 */
export function SearchBar({ value, onChangeText }: SearchBarProps) {
  const [focused, setFocused] = useState(false);
  const borderAnim = useRef(new Animated.Value(0)).current;

  const handleFocus = () => {
    setFocused(true);
    Animated.timing(borderAnim, { toValue: 1, duration: duration.micro, easing: EASE, useNativeDriver: false }).start();
  };
  const handleBlur = () => {
    setFocused(false);
    Animated.timing(borderAnim, { toValue: 0, duration: duration.state, easing: EASE, useNativeDriver: false }).start();
  };

  const borderColor = borderAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [colors.border, colors.ink],
  });

  return (
    <Animated.View style={[styles.field, { borderColor }]}>
      <Animated.Text style={[styles.icon, { opacity: focused ? 1 : 0.5 }]} accessibilityElementsHidden importantForAccessibility="no">
        ⌕
      </Animated.Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        onFocus={handleFocus}
        onBlur={handleBlur}
        placeholder="Things, spends, people…"
        placeholderTextColor={colors.placeholder}
        style={styles.input}
        accessibilityLabel="Search your space"
        accessibilityHint="Search items, categories, locations, rooms, or tags"
        returnKeyType="search"
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  field: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    borderWidth: 1,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    height: 44,
  },
  icon: {
    fontSize: 14,
    color: colors.textPrimary,
  },
  input: {
    flex: 1,
    padding: 0,
    height: 20,
    ...typography.searchPlaceholder,
    color: colors.textPrimary,
  },
});
