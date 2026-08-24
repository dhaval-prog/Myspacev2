import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, fontFamily, radius, spacing, typography } from '../theme';
import { Icon } from './Icon';
import { buildMonth, DAY_INITIALS, QUICK_EXPIRY_OPTIONS } from '../utils/calendar';
import { isoDate } from '../utils/attention';

interface CalendarProps {
  selected?: string;
  onSelect: (iso: string) => void;
  onClear?: () => void;
}

/** Inline month picker used by every expiry-date field. */
export function Calendar({ selected, onSelect, onClear }: CalendarProps) {
  const [offset, setOffset] = useState(0);
  const month = useMemo(() => buildMonth(offset), [offset]);

  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <Pressable
          onPress={() => setOffset((o) => o - 1)}
          accessibilityRole="button"
          accessibilityLabel="Previous month"
          style={styles.navButton}
        >
          <Icon path="M14.5 6l-6 6 6 6" color={colors.textPrimary} size={13} strokeWidth={2.2} />
        </Pressable>
        <Text style={typography.calendarTitle}>{month.title}</Text>
        <Pressable
          onPress={() => setOffset((o) => o + 1)}
          accessibilityRole="button"
          accessibilityLabel="Next month"
          style={styles.navButton}
        >
          <Icon path="M9.5 6l6 6-6 6" color={colors.textPrimary} size={13} strokeWidth={2.2} />
        </Pressable>
      </View>

      <View style={styles.grid}>
        {DAY_INITIALS.map((d, i) => (
          <Text key={`dow-${i}`} style={[typography.calendarDow, styles.cell]}>
            {d}
          </Text>
        ))}
      </View>

      <View style={styles.grid}>
        {month.days.map((day) => {
          const isSelected = Boolean(day.iso) && day.iso === selected;
          return (
            <Pressable
              key={day.key}
              disabled={!day.iso}
              onPress={() => day.iso && onSelect(day.iso)}
              accessibilityRole={day.iso ? 'button' : undefined}
              accessibilityLabel={day.iso || undefined}
              style={[
                styles.day,
                day.isToday && !isSelected && styles.dayToday,
                isSelected && styles.daySelected,
              ]}
            >
              <Text
                style={[
                  typography.calendarDay,
                  {
                    color: isSelected
                      ? colors.lime
                      : day.isPast && !day.isToday
                        ? colors.textDisabled
                        : colors.textPrimary,
                  },
                  (day.isToday || isSelected) && { fontFamily: fontFamily.sans600 },
                ]}
              >
                {day.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.quickRow}>
        {QUICK_EXPIRY_OPTIONS.map((q) => (
          <Pressable
            key={q.label}
            onPress={() => {
              const d = new Date();
              d.setDate(d.getDate() + q.days);
              onSelect(isoDate(d));
            }}
            style={styles.quickChip}
          >
            <Text style={styles.quickLabel}>{q.label}</Text>
          </Pressable>
        ))}
      </View>

      {onClear && (
        <Pressable onPress={onClear} style={styles.clearButton}>
          <Text style={styles.clearLabel}>Clear date</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: colors.white,
    borderRadius: radius.md,
    padding: spacing.ms,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  navButton: {
    width: 26,
    height: 26,
    borderRadius: radius.pill,
    backgroundColor: colors.pressWash,
    alignItems: 'center',
    justifyContent: 'center',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  cell: {
    width: `${100 / 7}%`,
    textAlign: 'center',
    marginBottom: 4,
  },
  day: {
    width: `${100 / 7}%`,
    height: 26,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
  },
  dayToday: {
    backgroundColor: colors.pressWash,
  },
  daySelected: {
    backgroundColor: colors.ink,
  },
  quickRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginTop: spacing.ms,
  },
  quickChip: {
    flex: 1,
    paddingVertical: spacing.xs,
    borderRadius: radius.sm - 2,
    backgroundColor: colors.pressWash,
    alignItems: 'center',
  },
  quickLabel: {
    fontFamily: typography.chipLabel.fontFamily,
    fontSize: 10.5,
    color: colors.textPrimary,
  },
  clearButton: {
    marginTop: spacing.xs,
    paddingVertical: spacing.xs,
    borderRadius: radius.sm - 4,
    alignItems: 'center',
  },
  clearLabel: {
    fontFamily: typography.chipLabel.fontFamily,
    fontSize: 10.5,
    color: colors.textFaint,
  },
});
