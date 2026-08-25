import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing, typography } from '../theme';
import { ROOM_OPTIONS } from '../data/rooms';
import { Icon } from './Icon';

const LOCK_PATH = 'M8.5 10V7a3.5 3.5 0 0 1 7 0v3M6 10h12v10H6z';

interface RoomPickerProps {
  /** Categories (ROOM_OPTIONS values) that already have an active room, however it's currently labeled. */
  lockedCategories: string[];
  onSelect: (category: string) => void;
}

/**
 * "Which room are you adding?" — a multi-select list of the fixed room set.
 * A selected room locks: tapping it again does nothing. The only way out is
 * deleting it (from the Edit rooms rail), which unlocks it here again — a
 * rename alone does not, since the lock tracks the room's original category,
 * not whatever it's currently displayed as.
 */
export function RoomPicker({ lockedCategories, onSelect }: RoomPickerProps) {
  return (
    <View style={styles.wrap}>
      {ROOM_OPTIONS.map((label) => {
        const on = lockedCategories.includes(label);
        return (
          <Pressable
            key={label}
            onPress={() => {
              if (!on) onSelect(label);
            }}
            disabled={on}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: on, disabled: on }}
            accessibilityLabel={on ? `${label}, locked — delete it to select a different room` : label}
            style={[styles.row, { backgroundColor: on ? colors.ink : colors.pale }]}
          >
            <View style={[styles.mark, { backgroundColor: on ? colors.lime : colors.pressWash }]}>
              {on ? (
                <Icon path={LOCK_PATH} color={colors.ink} size={13} strokeWidth={2} />
              ) : (
                <Text style={[styles.markLabel, { color: colors.textMuted }]}>＋</Text>
              )}
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
