import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, fontFamily, radius, spacing, typography } from '../theme';
import { parseTime24, toTime24, type Period } from '../utils/time';

const HOURS = Array.from({ length: 12 }, (_, i) => i + 1);
const MINUTES = [0, 15, 30, 45];
const PERIODS: Period[] = ['AM', 'PM'];

interface TimePickerProps {
  /** "HH:MM" 24h, or undefined for no selection yet. */
  value?: string;
  onSelect: (hhmm: string) => void;
}

/** Inline hour / minute / AM-PM picker — the time-field equivalent of `Calendar`. */
export function TimePicker({ value, onSelect }: TimePickerProps) {
  const initial = value ? parseTime24(value) : { hour12: 9, minute: 0, period: 'AM' as Period };
  const [hour12, setHour12] = useState(initial.hour12);
  const [minute, setMinute] = useState(initial.minute);
  const [period, setPeriod] = useState<Period>(initial.period);

  return (
    <View style={styles.wrap}>
      <View style={styles.periodRow}>
        {PERIODS.map((p) => {
          const on = p === period;
          return (
            <Pressable
              key={p}
              onPress={() => setPeriod(p)}
              accessibilityRole="radio"
              accessibilityState={{ checked: on }}
              style={[styles.periodChip, { backgroundColor: on ? colors.ink : colors.pressWash }]}
            >
              <Text style={[typography.chipLabel, { color: on ? colors.lime : colors.textPrimary }]}>{p}</Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.columns}>
        <View style={styles.column}>
          <Text style={styles.columnLabel}>Hour</Text>
          <ScrollView style={styles.columnScroll} showsVerticalScrollIndicator={false}>
            {HOURS.map((h) => {
              const on = h === hour12;
              return (
                <Pressable key={h} onPress={() => setHour12(h)} style={[styles.cell, on && styles.cellOn]}>
                  <Text style={[typography.chipLabel, { color: on ? colors.lime : colors.textPrimary }]}>{h}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
        <View style={styles.column}>
          <Text style={styles.columnLabel}>Minute</Text>
          <ScrollView style={styles.columnScroll} showsVerticalScrollIndicator={false}>
            {MINUTES.map((m) => {
              const on = m === minute;
              return (
                <Pressable key={m} onPress={() => setMinute(m)} style={[styles.cell, on && styles.cellOn]}>
                  <Text style={[typography.chipLabel, { color: on ? colors.lime : colors.textPrimary }]}>{String(m).padStart(2, '0')}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      </View>

      <Pressable onPress={() => onSelect(toTime24(hour12, minute, period))} style={styles.setButton} accessibilityRole="button" accessibilityLabel="Set time">
        <Text style={styles.setLabel}>Set time</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: colors.white,
    borderRadius: radius.md,
    padding: spacing.ms,
    gap: spacing.sm,
  },
  periodRow: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  periodChip: {
    flex: 1,
    borderRadius: radius.sm - 2,
    paddingVertical: spacing.xs,
    alignItems: 'center',
  },
  columns: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  column: {
    flex: 1,
    gap: spacing.xs,
  },
  columnLabel: {
    fontFamily: fontFamily.mono500,
    fontSize: 9,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: colors.textMuted,
    textAlign: 'center',
  },
  columnScroll: {
    maxHeight: 132,
  },
  cell: {
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
  },
  cellOn: {
    backgroundColor: colors.ink,
  },
  setButton: {
    borderRadius: radius.sm - 2,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    backgroundColor: colors.pressWash,
  },
  setLabel: {
    fontFamily: fontFamily.sans600,
    fontSize: 13,
    color: colors.textPrimary,
  },
});
