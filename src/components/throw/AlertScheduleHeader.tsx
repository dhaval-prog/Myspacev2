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
      <Text style={[styles.stepperValue, isNight && styles.stepperValueNight]} accessibilityLabel={`${accessibilityLabel}: ${value}`}>
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
  /** Inverts the whole picker to a black-ish background with white/light chrome — a literal
   * black↔white swap of the normal light day picker, per explicit request. Sits directly on the
   * night paper's own dark background (see FoldingLetter), not a separate black sheet. */
  isNight?: boolean;
}

/**
 * The paper's own time/day picker — rendered directly on the letter itself, above the writing
 * area (see FoldingLetter's alertSchedule/onAlertScheduleChange props), only while writing a
 * reminder to yourself, day and night alike. A three-column spinning wheel (hour/minute/AM-PM,
 * matching the reference screenshot's native-style time picker) sits above a "Repeat" row that
 * expands into an inline Never/Every Day/Weekly/Monthly list — a compact stand-in for the
 * reference's own push-to-a-new-screen Repeat picker, since this is embedded in the compose card
 * rather than a full settings screen. Weekly/Monthly reveal their own day picker underneath, same
 * as before.
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

      <Pressable
        onPress={() => setRepeatOpen((o) => !o)}
        style={[styles.repeatRow, isNight && styles.repeatRowNight]}
        accessibilityRole="button"
        accessibilityLabel="Repeat"
      >
        <Text style={[styles.repeatLabel, isNight && styles.repeatLabelNight]}>Repeat</Text>
        <View style={styles.repeatRight}>
          <Text style={[styles.repeatValue, isNight && styles.repeatValueNight]}>{RECURRENCE_LABEL[schedule.recurrence]}</Text>
          <Icon
            path={CHEVRON_ICON}
            size={13}
            color={isNight ? 'rgba(255,255,255,.6)' : throwColor.inkMute}
            strokeWidth={2}
            style={repeatOpen ? styles.chevronOpen : undefined}
          />
        </View>
      </Pressable>

      {repeatOpen && (
        <View style={[styles.repeatOptions, isNight && styles.repeatOptionsNight]}>
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
                  style={[
                    styles.repeatOptionLabel,
                    isNight && styles.repeatOptionLabelNight,
                    selected && (isNight ? styles.repeatOptionLabelSelectedNight : styles.repeatOptionLabelSelected),
                  ]}
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
                style={[
                  styles.weekdayChip,
                  isNight && styles.weekdayChipNight,
                  selected && (isNight ? styles.weekdayChipSelectedNight : styles.weekdayChipSelected),
                ]}
                accessibilityRole="button"
                accessibilityLabel={label}
              >
                <Text
                  style={[
                    styles.weekdayLabel,
                    isNight && styles.weekdayLabelNight,
                    selected && (isNight ? styles.weekdayLabelSelectedNight : styles.weekdayLabelSelected),
                  ]}
                >
                  {label[0]}
                </Text>
              </Pressable>
            );
          })}
        </View>
      )}

      {schedule.recurrence === 'monthly' && (
        <View style={styles.monthlyRow}>
          <Text style={[styles.monthlyLabel, isNight && styles.monthlyLabelNight]}>Day of month</Text>
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
  // Night skin — a literal invert of the day fill: white band instead of clay-brown/black, so it
  // reads clearly against the night paper's own dark background. The wheel digits invert to
  // black to stay legible on top of it (see WheelPicker's own isNight).
  highlightBandNight: { backgroundColor: '#FFFFFF' },
  colon: { fontFamily: throwFont.ui700, fontSize: 20, color: throwColor.ink },
  colonNight: { color: '#000000' },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  stepperBtn: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: throwColor.claySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperBtnNight: { backgroundColor: '#FFFFFF' },
  stepperBtnLabel: { fontFamily: throwFont.ui700, fontSize: 15, color: throwColor.clayDeep, lineHeight: 16 },
  stepperBtnLabelNight: { color: '#000000' },
  stepperValue: { fontFamily: throwFont.ui700, fontSize: 18, color: throwColor.ink, minWidth: 26, textAlign: 'center' },
  stepperValueNight: { color: '#FFFFFF' },
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
  // Night skin — a light-on-black tint instead of the day skin's dark-on-light one (a literal
  // invert), so the row still reads as a subtle surface against the night paper's own dark
  // background.
  repeatRowNight: { backgroundColor: 'rgba(255,255,255,.08)' },
  repeatLabel: { fontFamily: throwFont.ui600, fontSize: 13, color: throwColor.ink },
  repeatLabelNight: { color: '#FFFFFF' },
  repeatRight: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  repeatValue: { fontFamily: throwFont.ui500, fontSize: 12.5, color: throwColor.inkSoft },
  repeatValueNight: { color: 'rgba(255,255,255,.7)' },
  chevronOpen: { transform: [{ rotate: '90deg' }] },
  repeatOptions: {
    width: '100%',
    borderRadius: throwRadius.card,
    backgroundColor: throwColor.paper,
    borderWidth: 1,
    borderColor: throwColor.cardBorder,
    overflow: 'hidden',
  },
  // Night skin — a literal invert: black dropdown instead of cream, with a light (rather than
  // dark) border so its edge still reads against the night paper's own dark background.
  repeatOptionsNight: { backgroundColor: '#000000', borderColor: 'rgba(255,255,255,.15)' },
  repeatOptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  repeatOptionLabel: { fontFamily: throwFont.ui500, fontSize: 13, color: throwColor.inkSoft },
  repeatOptionLabelNight: { color: 'rgba(255,255,255,.7)' },
  repeatOptionLabelSelected: { fontFamily: throwFont.ui700, color: throwColor.clayDeep },
  // Night skin — white instead of clay-brown/black, since the dropdown itself is now black.
  repeatOptionLabelSelectedNight: { fontFamily: throwFont.ui700, color: '#FFFFFF' },
  checkmark: { fontFamily: throwFont.ui700, fontSize: 13, color: throwColor.clayDeep },
  checkmarkNight: { color: '#FFFFFF' },
  weekdayRow: { flexDirection: 'row', gap: 5 },
  weekdayChip: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(43,35,28,.06)',
  },
  // Night skin — a light-on-black tint instead of the day skin's dark-on-light one.
  weekdayChipNight: { backgroundColor: 'rgba(255,255,255,.08)' },
  weekdayChipSelected: { backgroundColor: throwColor.clayDeep },
  // Night skin — a literal invert: white fill instead of clay-brown/black.
  weekdayChipSelectedNight: { backgroundColor: '#FFFFFF' },
  weekdayLabel: { fontFamily: throwFont.ui700, fontSize: 11, color: throwColor.inkSoft },
  weekdayLabelNight: { color: 'rgba(255,255,255,.7)' },
  weekdayLabelSelected: { color: '#fff' },
  weekdayLabelSelectedNight: { color: '#000000' },
  monthlyRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  monthlyLabel: { fontFamily: throwFont.ui600, fontSize: 11.5, color: throwColor.inkSoft },
  monthlyLabelNight: { color: 'rgba(255,255,255,.7)' },
});
