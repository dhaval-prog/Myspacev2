import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Icon } from '../Icon';
import { throwColor, throwFont, throwRadius } from '../../theme/throwTokens';
import { WEEKDAY_LABELS } from '../../utils/throwAlerts';
import { WheelPicker, WHEEL_HEIGHT, WHEEL_ITEM_HEIGHT } from './WheelPicker';
import type { AlertRecurrence, AlertSchedule } from '../../types/throw';

const CHEVRON_ICON = 'M9 6l6 6-6 6';

const RECURRENCE_OPTIONS: { id: AlertRecurrence; label: string }[] = [
  { id: 'once', label: 'Never' },
  { id: 'everyday', label: 'Every Day' },
  { id: 'weekly', label: 'Weekly' },
  { id: 'monthly', label: 'Monthly' },
];
const RECURRENCE_LABEL: Record<AlertRecurrence, string> = {
  once: 'Never',
  everyday: 'Every Day',
  weekly: 'Weekly',
  monthly: 'Monthly',
};

const HOUR_LABELS = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0'));
const MINUTE_LABELS = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0'));
const PERIOD_LABELS = ['AM', 'PM'];

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

/** A small "-"/value/"+" control for the day-of-month picker — the one remaining spot still
 * using a plain stepper rather than a wheel, since a 1-31 wheel would be all but unreadable at
 * this width. */
function Stepper({
  value,
  onDec,
  onInc,
  accessibilityLabel,
  isNight,
}: {
  value: string;
  onDec: () => void;
  onInc: () => void;
  accessibilityLabel: string;
  isNight?: boolean;
}) {
  return (
    <View style={styles.stepper}>
      <Pressable
        onPress={onDec}
        hitSlop={8}
        style={[styles.stepperBtn, isNight && styles.stepperBtnNight]}
        accessibilityRole="button"
        accessibilityLabel={`Decrease ${accessibilityLabel}`}
      >
        <Text style={[styles.stepperBtnLabel, isNight && styles.stepperBtnLabelNight]}>−</Text>
      </Pressable>
      <Text style={styles.stepperValue} accessibilityLabel={`${accessibilityLabel}: ${value}`}>
        {value}
      </Text>
      <Pressable
        onPress={onInc}
        hitSlop={8}
        style={[styles.stepperBtn, isNight && styles.stepperBtnNight]}
        accessibilityRole="button"
        accessibilityLabel={`Increase ${accessibilityLabel}`}
      >
        <Text style={[styles.stepperBtnLabel, isNight && styles.stepperBtnLabelNight]}>+</Text>
      </Pressable>
    </View>
  );
}

interface AlertScheduleHeaderProps {
  schedule: AlertSchedule;
  onChange: (schedule: AlertSchedule) => void;
  /** Swaps the wheel highlight, selected repeat option, and selected weekday chip from Throw's
   * clay/brown day accent to a black-and-white glow, matching FoldingLetter's own isNight skin. */
  isNight?: boolean;
}

/**
 * The paper's own time/day picker — rendered on the letter itself (see FoldingLetter's
 * scheduleHeader prop) only while writing a reminder to yourself. A three-column spinning wheel
 * (hour/minute/AM-PM, matching the reference screenshot's native-style time picker) sits above a
 * "Repeat" row that expands into an inline Never/Every Day/Weekly/Monthly list — a compact stand-in
 * for the reference's own push-to-a-new-screen Repeat picker, since this is embedded in the
 * compose card rather than a full settings screen. Weekly/Monthly reveal their own day picker
 * underneath, same as before.
 */
export function AlertScheduleHeader({ schedule, onChange, isNight }: AlertScheduleHeaderProps) {
  const [repeatOpen, setRepeatOpen] = useState(false);

  const hour12 = ((schedule.hour + 11) % 12) + 1;
  const hourIndex = hour12 - 1;
  const periodIndex = schedule.hour >= 12 ? 1 : 0;

  const setHourIndex = (index: number) => {
    const h12 = index + 1;
    const isPM = schedule.hour >= 12;
    onChange({ ...schedule, hour: (h12 % 12) + (isPM ? 12 : 0) });
  };
  const setMinuteIndex = (index: number) => onChange({ ...schedule, minute: index });
  const setPeriodIndex = (index: number) => {
    const isPM = index === 1;
    onChange({ ...schedule, hour: (hour12 % 12) + (isPM ? 12 : 0) });
  };
  const setRecurrence = (recurrence: AlertRecurrence) => {
    onChange({ ...schedule, recurrence });
    setRepeatOpen(false);
  };
  const toggleWeekday = (day: number) => {
    const has = schedule.daysOfWeek.includes(day);
    const next = has ? schedule.daysOfWeek.filter((d) => d !== day) : [...schedule.daysOfWeek, day];
    onChange({ ...schedule, daysOfWeek: next });
  };
  const setDayOfMonth = (next: number) => onChange({ ...schedule, dayOfMonth: clamp(next, 1, 31) });

  return (
    <View style={styles.wrap}>
      <View style={styles.wheelRow}>
        <View style={[styles.highlightBand, isNight && styles.highlightBandNight]} pointerEvents="none" />
        <WheelPicker items={HOUR_LABELS} selectedIndex={hourIndex} onChange={setHourIndex} width={44} accessibilityLabel="Hour" isNight={isNight} />
        <Text style={[styles.colon, isNight && styles.colonNight]}>:</Text>
        <WheelPicker items={MINUTE_LABELS} selectedIndex={schedule.minute} onChange={setMinuteIndex} width={44} accessibilityLabel="Minute" isNight={isNight} />
        <WheelPicker items={PERIOD_LABELS} selectedIndex={periodIndex} onChange={setPeriodIndex} width={50} accessibilityLabel="Period" isNight={isNight} />
      </View>

      <Pressable onPress={() => setRepeatOpen((o) => !o)} style={styles.repeatRow} accessibilityRole="button" accessibilityLabel="Repeat">
        <Text style={styles.repeatLabel}>Repeat</Text>
        <View style={styles.repeatRight}>
          <Text style={styles.repeatValue}>{RECURRENCE_LABEL[schedule.recurrence]}</Text>
          <Icon path={CHEVRON_ICON} size={13} color={throwColor.inkMute} strokeWidth={2} style={repeatOpen ? styles.chevronOpen : undefined} />
        </View>
      </Pressable>

      {repeatOpen && (
        <View style={styles.repeatOptions}>
          {RECURRENCE_OPTIONS.map((opt) => {
            const selected = schedule.recurrence === opt.id;
            return (
              <Pressable
                key={opt.id}
                onPress={() => setRecurrence(opt.id)}
                style={styles.repeatOptionRow}
                accessibilityRole="button"
                accessibilityLabel={opt.label}
              >
                <Text
                  style={[styles.repeatOptionLabel, selected && (isNight ? styles.repeatOptionLabelSelectedNight : styles.repeatOptionLabelSelected)]}
                >
                  {opt.label}
                </Text>
                {selected && <Text style={[styles.checkmark, isNight && styles.checkmarkNight]}>✓</Text>}
              </Pressable>
            );
          })}
        </View>
      )}

      {schedule.recurrence === 'weekly' && (
        <View style={styles.weekdayRow}>
          {WEEKDAY_LABELS.map((label, i) => {
            const selected = schedule.daysOfWeek.includes(i);
            return (
              <Pressable
                key={label}
                onPress={() => toggleWeekday(i)}
                style={[styles.weekdayChip, selected && (isNight ? styles.weekdayChipSelectedNight : styles.weekdayChipSelected)]}
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
            isNight={isNight}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', gap: 8 },
  wheelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', height: WHEEL_HEIGHT },
  // One continuous band behind all three wheels, matching the reference screenshot's single
  // selection pill spanning hour/minute/period rather than three separate ones per column.
  highlightBand: {
    position: 'absolute',
    top: (WHEEL_HEIGHT - WHEEL_ITEM_HEIGHT) / 2,
    left: 4,
    right: 4,
    height: WHEEL_ITEM_HEIGHT,
    borderRadius: throwRadius.card,
    backgroundColor: throwColor.claySoft,
  },
  // Night skin — a black band with a soft white glow instead of the day skin's clay-brown fill;
  // the wheel digits themselves switch to white too (see WheelPicker's own isNight).
  highlightBandNight: {
    backgroundColor: '#000000',
    shadowColor: '#FFFFFF',
    shadowOpacity: 0.4,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 0 },
    elevation: 6,
  },
  colon: { fontFamily: throwFont.ui700, fontSize: 20, color: throwColor.ink },
  colonNight: { color: '#FFFFFF' },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  stepperBtn: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: throwColor.claySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperBtnNight: { backgroundColor: '#000000' },
  stepperBtnLabel: { fontFamily: throwFont.ui700, fontSize: 15, color: throwColor.clayDeep, lineHeight: 16 },
  stepperBtnLabelNight: { color: '#FFFFFF' },
  stepperValue: { fontFamily: throwFont.ui700, fontSize: 18, color: throwColor.ink, minWidth: 26, textAlign: 'center' },
  repeatRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: throwRadius.card,
    backgroundColor: 'rgba(43,35,28,.05)',
  },
  repeatLabel: { fontFamily: throwFont.ui600, fontSize: 13, color: throwColor.ink },
  repeatRight: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  repeatValue: { fontFamily: throwFont.ui500, fontSize: 12.5, color: throwColor.inkSoft },
  chevronOpen: { transform: [{ rotate: '90deg' }] },
  repeatOptions: {
    width: '100%',
    borderRadius: throwRadius.card,
    backgroundColor: throwColor.paper,
    borderWidth: 1,
    borderColor: throwColor.cardBorder,
    overflow: 'hidden',
  },
  repeatOptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  repeatOptionLabel: { fontFamily: throwFont.ui500, fontSize: 13, color: throwColor.inkSoft },
  repeatOptionLabelSelected: { fontFamily: throwFont.ui700, color: throwColor.clayDeep },
  // Night skin — plain black instead of clay-brown; the dropdown itself stays on its normal
  // light chrome, so black keeps full contrast without needing a glow.
  repeatOptionLabelSelectedNight: { fontFamily: throwFont.ui700, color: '#000000' },
  checkmark: { fontFamily: throwFont.ui700, fontSize: 13, color: throwColor.clayDeep },
  checkmarkNight: { color: '#000000' },
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
  // Night skin — a black fill with a soft white glow instead of the day skin's clay-brown fill.
  weekdayChipSelectedNight: {
    backgroundColor: '#000000',
    shadowColor: '#FFFFFF',
    shadowOpacity: 0.5,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 },
    elevation: 6,
  },
  weekdayLabel: { fontFamily: throwFont.ui700, fontSize: 11, color: throwColor.inkSoft },
  weekdayLabelSelected: { color: '#fff' },
  monthlyRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  monthlyLabel: { fontFamily: throwFont.ui600, fontSize: 11.5, color: throwColor.inkSoft },
});
