import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { throwColor, throwFont, throwRadius } from '../../theme/throwTokens';
import { WEEKDAY_LABELS } from '../../utils/throwAlerts';
import type { AlertRecurrence, AlertSchedule } from '../../types/throw';

const RECURRENCE_OPTIONS: { id: AlertRecurrence; label: string }[] = [
  { id: 'once', label: 'Once' },
  { id: 'everyday', label: 'Everyday' },
  { id: 'weekly', label: 'Weekly' },
  { id: 'monthly', label: 'Monthly' },
];

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

/** A small "-"/value/"+" control, dependency-free like the rest of Throw's custom-styled pickers
 * (no native date/time-picker chrome anywhere in this app). */
function Stepper({ value, onDec, onInc, accessibilityLabel }: { value: string; onDec: () => void; onInc: () => void; accessibilityLabel: string }) {
  return (
    <View style={styles.stepper}>
      <Pressable onPress={onDec} hitSlop={8} style={styles.stepperBtn} accessibilityRole="button" accessibilityLabel={`Decrease ${accessibilityLabel}`}>
        <Text style={styles.stepperBtnLabel}>−</Text>
      </Pressable>
      <Text style={styles.stepperValue}>{value}</Text>
      <Pressable onPress={onInc} hitSlop={8} style={styles.stepperBtn} accessibilityRole="button" accessibilityLabel={`Increase ${accessibilityLabel}`}>
        <Text style={styles.stepperBtnLabel}>+</Text>
      </Pressable>
    </View>
  );
}

interface AlertScheduleHeaderProps {
  schedule: AlertSchedule;
  onChange: (schedule: AlertSchedule) => void;
}

/**
 * The paper's own time/day picker — rendered on the letter itself (see FoldingLetter's
 * scheduleHeader prop) only while writing a reminder to yourself. A time stepper (12-hour, 5-min
 * steps), a recurrence chip row (Once/Everyday/Weekly/Monthly), and a conditional weekday or
 * day-of-month picker underneath depending on which recurrence is picked.
 */
export function AlertScheduleHeader({ schedule, onChange }: AlertScheduleHeaderProps) {
  const hour12 = ((schedule.hour + 11) % 12) + 1;
  const period = schedule.hour >= 12 ? 'PM' : 'AM';

  // Stepping stays entirely in 24-hour space — converting a stepped 12-hour value back to 24
  // hours while trying to preserve "the same period" is exactly what gets an 11am -> 12pm
  // rollover wrong (12 is where AM/PM actually flips). Incrementing the 24-hour value directly
  // rolls through AM/PM naturally, same as any real clock.
  const stepHour = (delta: number) => onChange({ ...schedule, hour: (schedule.hour + delta + 24) % 24 });
  const stepMinute = (delta: number) => onChange({ ...schedule, minute: (schedule.minute + delta + 60) % 60 });
  const togglePeriod = () => onChange({ ...schedule, hour: (schedule.hour + 12) % 24 });
  const setRecurrence = (recurrence: AlertRecurrence) => onChange({ ...schedule, recurrence });
  const toggleWeekday = (day: number) => {
    const has = schedule.daysOfWeek.includes(day);
    const next = has ? schedule.daysOfWeek.filter((d) => d !== day) : [...schedule.daysOfWeek, day];
    onChange({ ...schedule, daysOfWeek: next });
  };
  const setDayOfMonth = (next: number) => onChange({ ...schedule, dayOfMonth: clamp(next, 1, 31) });

  return (
    <View style={styles.wrap}>
      <View style={styles.timeRow}>
        <Stepper value={String(hour12).padStart(2, '0')} onDec={() => stepHour(-1)} onInc={() => stepHour(1)} accessibilityLabel="hour" />
        <Text style={styles.colon}>:</Text>
        <Stepper value={String(schedule.minute).padStart(2, '0')} onDec={() => stepMinute(-5)} onInc={() => stepMinute(5)} accessibilityLabel="minute" />
        <Pressable onPress={togglePeriod} style={styles.periodBtn} accessibilityRole="button" accessibilityLabel="Toggle AM/PM">
          <Text style={styles.periodLabel}>{period}</Text>
        </Pressable>
      </View>

      <View style={styles.recurrenceRow}>
        {RECURRENCE_OPTIONS.map((opt) => {
          const selected = schedule.recurrence === opt.id;
          return (
            <Pressable
              key={opt.id}
              onPress={() => setRecurrence(opt.id)}
              style={[styles.recurrenceChip, selected && styles.recurrenceChipSelected]}
              accessibilityRole="button"
              accessibilityLabel={opt.label}
            >
              <Text style={[styles.recurrenceLabel, selected && styles.recurrenceLabelSelected]}>{opt.label}</Text>
            </Pressable>
          );
        })}
      </View>

      {schedule.recurrence === 'weekly' && (
        <View style={styles.weekdayRow}>
          {WEEKDAY_LABELS.map((label, i) => {
            const selected = schedule.daysOfWeek.includes(i);
            return (
              <Pressable
                key={label}
                onPress={() => toggleWeekday(i)}
                style={[styles.weekdayChip, selected && styles.weekdayChipSelected]}
                accessibilityRole="button"
                accessibilityLabel={label}
              >
                <Text style={[styles.weekdayLabel, selected && styles.weekdayLabelSelected]}>{label[0]}</Text>
              </Pressable>
            );
          })}
        </View>
      )}

      {schedule.recurrence === 'monthly' && (
        <View style={styles.monthlyRow}>
          <Text style={styles.monthlyLabel}>Day of month</Text>
          <Stepper
            value={String(schedule.dayOfMonth)}
            onDec={() => setDayOfMonth(schedule.dayOfMonth - 1)}
            onInc={() => setDayOfMonth(schedule.dayOfMonth + 1)}
            accessibilityLabel="day of month"
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', gap: 10 },
  timeRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  colon: { fontFamily: throwFont.ui700, fontSize: 20, color: throwColor.ink },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  stepperBtn: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: throwColor.claySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperBtnLabel: { fontFamily: throwFont.ui700, fontSize: 15, color: throwColor.clayDeep, lineHeight: 16 },
  stepperValue: { fontFamily: throwFont.ui700, fontSize: 18, color: throwColor.ink, minWidth: 26, textAlign: 'center' },
  periodBtn: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: throwRadius.pill, backgroundColor: throwColor.claySoft, marginLeft: 4 },
  periodLabel: { fontFamily: throwFont.ui700, fontSize: 12, color: throwColor.clayDeep },
  recurrenceRow: { flexDirection: 'row', gap: 6 },
  recurrenceChip: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: throwRadius.pill, backgroundColor: 'rgba(43,35,28,.06)' },
  recurrenceChipSelected: { backgroundColor: throwColor.clayDeep },
  recurrenceLabel: { fontFamily: throwFont.ui600, fontSize: 11.5, color: throwColor.inkSoft },
  recurrenceLabelSelected: { color: '#fff' },
  weekdayRow: { flexDirection: 'row', gap: 5 },
  weekdayChip: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(43,35,28,.06)',
  },
  weekdayChipSelected: { backgroundColor: throwColor.clayDeep },
  weekdayLabel: { fontFamily: throwFont.ui700, fontSize: 11, color: throwColor.inkSoft },
  weekdayLabelSelected: { color: '#fff' },
  monthlyRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  monthlyLabel: { fontFamily: throwFont.ui600, fontSize: 11.5, color: throwColor.inkSoft },
});
