import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing, typography } from '../theme';
import { ROOM_OPTIONS } from '../data/rooms';

interface RoomPickerProps {
  selected: string[];
  onToggle: (label: string) => void;
}

/** "Which room are you adding?" — a multi-select list of the fixed room set. */
export function RoomPicker({ selected, onToggle }: RoomPickerProps) {
  return (
    <View style={styles.wrap}>
      {ROOM_OPTIONS.map((label) => {
        const on = selected.includes(label);
        return (
          <Pressable
            key={label}
            onPress={() => onToggle(label)}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: on }}
            accessibilityLabel={label}
            style={[styles.row, { backgroundColor: on ? colors.ink : colors.pale }]}
          >
            <View style={[styles.mark, { backgroundColor: on ? colors.lime : colors.pressWash }]}>
              <Text style={[styles.markLabel, { color: on ? colors.ink : colors.textMuted }]}>
                {on ? '✓' : '＋'}
              </Text>
            </View>
            <Text style={[typography.pickerLabel, { color: on ? colors.lime : colors.textPrimary }]}>{label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: spacing.xs,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs + 1,
    borderRadius: radius.md - 8,
    paddingVertical: 11,
    paddingHorizontal: spacing.md,
    minHeight: 44,
  },
  mark: {
    width: 24,
    height: 24,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  markLabel: {
    fontFamily: typography.monoBadge.fontFamily,
    fontSize: 15,
  },
});
