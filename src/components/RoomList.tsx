import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing, typography } from '../theme';
import { Icon } from './Icon';
import { ROOM_MONO } from '../data/rooms';

const EDIT_PATH = 'M4 20h4L20 8l-4-4L4 16zM14.5 5.5l4 4';
const DELETE_PATH = 'M4 7h16M9.5 7V4.5h5V7M6.5 7l1 13h9l1-13M10.5 10.5v6.5M13.5 10.5v6.5';

interface RoomListProps {
  rooms: string[];
  mode: 'view' | 'edit' | 'delete';
  onEdit?: (label: string) => void;
  onDelete?: (label: string) => void;
}

/** The room list — plain, or with an edit/delete action per row. */
export function RoomList({ rooms, mode, onEdit, onDelete }: RoomListProps) {
  return (
    <View style={styles.wrap}>
      {rooms.map((label) => (
        <View key={label} style={styles.row}>
          <View style={styles.mono}>
            <Text style={styles.monoLabel}>{ROOM_MONO[label] || '⌂'}</Text>
          </View>
          <Text style={[typography.roomLabel, styles.label]}>{label}</Text>
          {mode === 'edit' && (
            <Pressable
              onPress={() => onEdit?.(label)}
              accessibilityRole="button"
              accessibilityLabel={`Rename ${label}`}
              style={[styles.action, { backgroundColor: colors.pressWash }]}
            >
              <Icon path={EDIT_PATH} color={colors.textPrimary} size={17} />
            </Pressable>
          )}
          {mode === 'delete' && (
            <Pressable
              onPress={() => onDelete?.(label)}
              accessibilityRole="button"
              accessibilityLabel={`Delete ${label}`}
              style={[styles.action, { backgroundColor: 'rgba(211,50,67,0.12)' }]}
            >
              <Icon path={DELETE_PATH} color="#D33243" size={17} />
            </Pressable>
          )}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: spacing.sm + 1,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.ms,
    backgroundColor: colors.white,
    borderRadius: radius.md - 10,
    padding: spacing.sm,
  },
  mono: {
    width: 66,
    height: 63,
    borderRadius: 8,
    backgroundColor: '#3A3A3A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  monoLabel: {
    fontFamily: typography.monoBadge.fontFamily,
    fontSize: 24,
    color: colors.pale,
  },
  label: {
    flex: 1,
  },
  action: {
    width: 41,
    height: 41,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
