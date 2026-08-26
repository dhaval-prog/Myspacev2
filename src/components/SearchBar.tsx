import React, { useRef, useState } from 'react';
import { Animated, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { colors, radius, spacing, typography, EASE, duration, noOutline } from '../theme';

export interface SearchSuggestion {
  id: string;
  label: string;
  meta?: string;
}

interface SearchBarProps {
  value: string;
  onChangeText: (text: string) => void;
  suggestions?: SearchSuggestion[];
  onSelectSuggestion?: (suggestion: SearchSuggestion) => void;
}

/**
 * Search integrated into the header composition — a hairline field, not a
 * generic Material search bar. The border quietly deepens on focus, and a
 * short list of suggestions (quick shortcuts, or live room/item matches)
 * drops down below it — tapping one navigates straight there.
 */
export function SearchBar({ value, onChangeText, suggestions = [], onSelectSuggestion }: SearchBarProps) {
  const [focused, setFocused] = useState(false);
  const borderAnim = useRef(new Animated.Value(0)).current;
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleFocus = () => {
    if (blurTimer.current) clearTimeout(blurTimer.current);
    setFocused(true);
    Animated.timing(borderAnim, { toValue: 1, duration: duration.micro, easing: EASE, useNativeDriver: false }).start();
  };
  const handleBlur = () => {
    // The TextInput blurs the instant a suggestion press begins — delay
    // hiding the dropdown so that tap still lands before it unmounts.
    blurTimer.current = setTimeout(() => setFocused(false), 150);
    Animated.timing(borderAnim, { toValue: 0, duration: duration.state, easing: EASE, useNativeDriver: false }).start();
  };

  const borderColor = borderAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [colors.border, colors.ink],
  });

  const showDropdown = focused && suggestions.length > 0;

  return (
    <View style={styles.wrap}>
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
          style={[styles.input, noOutline]}
          accessibilityLabel="Search your space"
          accessibilityHint="Search items, categories, locations, rooms, or tags"
          returnKeyType="search"
        />
      </Animated.View>

      {showDropdown && (
        <View style={styles.dropdown}>
          <ScrollView
            keyboardShouldPersistTaps="handled"
            style={styles.dropdownScroll}
            showsVerticalScrollIndicator={false}
          >
            {suggestions.map((s) => (
              <Pressable
                key={s.id}
                onPress={() => onSelectSuggestion?.(s)}
                accessibilityRole="button"
                accessibilityLabel={s.label}
                style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
              >
                <Text style={typography.roomLabel} numberOfLines={1}>
                  {s.label}
                </Text>
                {!!s.meta && (
                  <Text style={[typography.itemSub, styles.meta]} numberOfLines={1}>
                    {s.meta}
                  </Text>
                )}
              </Pressable>
            ))}
          </ScrollView>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    position: 'relative',
  },
  field: {
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
  dropdown: {
    position: 'absolute',
    top: 50,
    left: 0,
    right: 0,
    backgroundColor: colors.white,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.xs,
    zIndex: 50,
    elevation: 8,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
  },
  dropdownScroll: {
    maxHeight: 260,
  },
  row: {
    paddingVertical: spacing.ms,
    paddingHorizontal: spacing.md,
  },
  rowPressed: {
    backgroundColor: colors.pressWash,
  },
  meta: {
    marginTop: 1,
  },
});
