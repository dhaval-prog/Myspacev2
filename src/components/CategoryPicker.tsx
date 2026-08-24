import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing, typography } from '../theme';
import { Icon } from './Icon';
import { CATEGORIES, CATEGORY_ICON, EMPTY_CATEGORY_ICON } from '../data/itemCategories';

interface CategoryPickerProps {
  value: string;
  onChange: (label: string) => void;
}

/** The category accordion: a field that expands into an icon list. */
export function CategoryPicker({ value, onChange }: CategoryPickerProps) {
  const [open, setOpen] = useState(false);
  const iconPath = CATEGORY_ICON[value] || EMPTY_CATEGORY_ICON;
  const fg = value ? colors.textPrimary : colors.textFaint;

  return (
    <View style={{ gap: spacing.xs }}>
      <Pressable
        onPress={() => setOpen((o) => !o)}
        accessibilityRole="button"
        accessibilityLabel="Category"
        accessibilityValue={{ text: value || 'No category' }}
        style={styles.field}
      >
        <Icon path={iconPath} color={fg} size={17} />
        <Text style={[typography.chipLabel, { flex: 1, color: fg }]}>{value || 'No category'}</Text>
        <Text style={styles.caret}>{open ? '⌃' : '⌄'}</Text>
      </Pressable>

      {open && (
        <ScrollView style={styles.dropdown} contentContainerStyle={styles.dropdownContent}>
          {CATEGORIES.map((c) => {
            const active = value === c.label;
            return (
              <Pressable
                key={c.label}
                onPress={() => {
                  onChange(c.label);
                  setOpen(false);
                }}
                style={[styles.row, active && styles.rowActive]}
              >
                <Icon path={c.icon} color={active ? colors.lime : colors.textPrimary} size={16} />
                <Text style={[typography.chipLabel, { fontSize: 12.5, color: active ? colors.lime : colors.textPrimary }]}>
                  {c.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.pale,
    borderRadius: radius.md,
    paddingVertical: spacing.ms,
    paddingHorizontal: spacing.md,
  },
  caret: {
    fontFamily: typography.formLabel.fontFamily,
    fontSize: 11,
    color: colors.textMuted,
  },
  dropdown: {
    backgroundColor: colors.white,
    borderRadius: radius.md,
    maxHeight: 196,
  },
  dropdownContent: {
    padding: spacing.xxs + 2,
    gap: 2,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderRadius: 11,
    paddingVertical: 9,
    paddingHorizontal: spacing.sm,
  },
  rowActive: {
    backgroundColor: colors.ink,
  },
});
