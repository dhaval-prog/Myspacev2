import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing, typography } from '../theme';

interface SearchBarProps {
  onPress: () => void;
}

/**
 * Search integrated into the header composition — a hairline field, not a
 * generic Material search bar. Tapping it doesn't focus an inline input;
 * it launches the full search popup (spanning Home, Expenses, and Split),
 * so this is a static trigger rather than a live TextInput.
 */
export function SearchBar({ onPress }: SearchBarProps) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.field, pressed && styles.fieldPressed]}
      accessibilityRole="button"
      accessibilityLabel="Search Home, Expenses, and Split"
    >
      <Text style={styles.icon} accessibilityElementsHidden importantForAccessibility="no">
        ⌕
      </Text>
      <Text style={styles.placeholder} numberOfLines={1}>
        Things, spends, splits…
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  field: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    height: 44,
  },
  fieldPressed: {
    borderColor: colors.ink,
  },
  icon: {
    fontSize: 14,
    color: colors.textPrimary,
    opacity: 0.5,
  },
  placeholder: {
    flex: 1,
    ...typography.searchPlaceholder,
    color: colors.placeholder,
  },
});
