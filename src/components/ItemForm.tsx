import React, { useState } from 'react';
import { Animated, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { colors, fontFamily, radius, spacing, typography, noOutline } from '../theme';
import { useFocusBorder } from '../hooks/useFocusBorder';
import { Icon } from './Icon';
import { CategoryPicker } from './CategoryPicker';
import { Calendar } from './Calendar';
import { SegmentedToggle } from './SegmentedToggle';
import { TimePicker } from './TimePicker';
import { ToggleRow } from './account/rows';
import { CATEGORY_ICON, EMPTY_CATEGORY_ICON } from '../data/itemCategories';
import { formatDate } from '../utils/attention';
import { formatTime12 } from '../utils/time';
import type { DosageType } from '../types/space';

const CLOCK_ICON = 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18M12 7v5l3.5 2';
const DOSE_FREQUENCIES = [1, 2, 3, 4];

interface MedicineFields {
  dosageType?: DosageType;
  dosageAmount?: number;
  remindersEnabled?: boolean;
  dosesPerDay?: number;
  reminderTimes?: string[];
}

interface ItemFormProps {
  rooms: string[];
  onSubmit: (input: { name: string; category: string; room: string; expiry: string } & MedicineFields) => void;
}

/** "What are you putting away?" — the add-item form. */
export function ItemForm({ rooms, onSubmit }: ItemFormProps) {
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [room, setRoom] = useState('');
  const [expiry, setExpiry] = useState('');
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);

  const [medOpen, setMedOpen] = useState(false);
  const [dosageType, setDosageType] = useState<DosageType>('ml');
  const [dosageAmount, setDosageAmount] = useState('');
  const [remindersEnabled, setRemindersEnabled] = useState(false);
  const [dosesPerDay, setDosesPerDay] = useState(1);
  const [reminderTimes, setReminderTimes] = useState<string[]>([]);
  const [openDoseIndex, setOpenDoseIndex] = useState<number | null>(null);

  const { borderColor: nameBorder, onFocus: onNameFocus, onBlur: onNameBlur } = useFocusBorder(
    'rgba(22,33,12,0)',
    colors.ink,
  );

  const isMedicine = category === 'Medicines';
  const remindersValid = !remindersEnabled || Array.from({ length: dosesPerDay }).every((_, i) => Boolean(reminderTimes[i]));
  const canSave = name.trim().length > 0 && remindersValid;

  const resetMedicineFields = () => {
    setMedOpen(false);
    setDosageType('ml');
    setDosageAmount('');
    setRemindersEnabled(false);
    setDosesPerDay(1);
    setReminderTimes([]);
    setOpenDoseIndex(null);
  };

  const handleSave = () => {
    if (!canSave) return;
    onSubmit({
      name: name.trim(),
      category,
      room,
      expiry,
      ...(isMedicine && dosageAmount.trim() ? { dosageType, dosageAmount: Number(dosageAmount) } : {}),
      ...(isMedicine && remindersEnabled ? { remindersEnabled: true, dosesPerDay, reminderTimes: reminderTimes.slice(0, dosesPerDay) } : {}),
    });
    setName('');
    setCategory('');
    setRoom('');
    setExpiry('');
    setCalendarOpen(false);
    resetMedicineFields();
    setSavedFlash(true);
    setTimeout(() => setSavedFlash(false), 1400);
  };

  return (
    <ScrollView style={styles.wrap} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <Animated.View style={[styles.nameRow, { borderColor: nameBorder }]}>
        <View style={styles.nameIcon}>
          <Icon path={CATEGORY_ICON[category] || EMPTY_CATEGORY_ICON} color={colors.pale} size={26} />
        </View>
        <TextInput
          value={name}
          onChangeText={setName}
          onFocus={onNameFocus}
          onBlur={onNameBlur}
          placeholder="Item name"
          placeholderTextColor={colors.textFaint}
          style={[typography.sheetInput, { fontSize: 15, flex: 1 }, noOutline]}
          accessibilityLabel="Item name"
        />
      </Animated.View>

      <View style={styles.section}>
        <Text style={typography.formLabel}>Category (optional)</Text>
        <CategoryPicker value={category} onChange={setCategory} />
      </View>

      {isMedicine && (
        <View style={styles.section}>
          <Pressable
            onPress={() => setMedOpen((o) => !o)}
            accessibilityRole="button"
            accessibilityLabel="Dosage and reminders"
            style={styles.field}
          >
            <Icon path={CLOCK_ICON} color={colors.textPrimary} size={17} />
            <Text style={[typography.chipLabel, { flex: 1, color: colors.textPrimary }]}>Dosage & Reminders (optional)</Text>
            <Text style={styles.caret}>{medOpen ? '⌃' : '⌄'}</Text>
          </Pressable>

          {medOpen && (
            <View style={styles.medicineBody}>
              <View style={{ gap: spacing.xs }}>
                <Text style={typography.formLabel}>Dosage type</Text>
                <SegmentedToggle
                  options={[
                    { label: 'ML', value: 'ml' },
                    { label: 'Capsules', value: 'capsules' },
                  ]}
                  value={dosageType}
                  onChange={(v) => {
                    const next = v as DosageType;
                    setDosageType(next);
                    // Capsules can't be fractional — drop any decimal carried over from ML.
                    if (next === 'capsules' && dosageAmount.includes('.')) {
                      const whole = Math.floor(Number(dosageAmount));
                      setDosageAmount(whole > 0 ? String(whole) : '');
                    }
                  }}
                />
              </View>

              <View style={{ gap: spacing.xs }}>
                <Text style={typography.formLabel}>{dosageType === 'ml' ? 'Dosage per intake' : 'Tab per intake'}</Text>
                <View style={styles.amountRow}>
                  <TextInput
                    value={dosageAmount}
                    onChangeText={(v) => setDosageAmount(dosageType === 'ml' ? v.replace(/[^0-9.]/g, '') : v.replace(/[^0-9]/g, ''))}
                    placeholder={dosageType === 'ml' ? '0.5' : '1'}
                    placeholderTextColor={colors.textFaint}
                    keyboardType="decimal-pad"
                    style={[styles.amountInput, noOutline]}
                    accessibilityLabel={dosageType === 'ml' ? 'Dosage amount in millilitres' : 'Number of capsules'}
                  />
                  <Text style={styles.amountUnit}>{dosageType === 'ml' ? 'ML' : 'Tab'}</Text>
                </View>
              </View>

              <ToggleRow
                label="Medication Reminders"
                sublabel={remindersEnabled ? 'On' : 'Off'}
                value={remindersEnabled}
                onValueChange={setRemindersEnabled}
              />

              {remindersEnabled && (
                <View style={{ gap: spacing.md }}>
                  <View style={{ gap: spacing.xs }}>
                    <Text style={typography.formLabel}>How many times a day?</Text>
                    <View style={{ flexDirection: 'row', gap: spacing.xs }}>
                      {DOSE_FREQUENCIES.map((n) => {
                        const on = dosesPerDay === n;
                        return (
                          <Pressable
                            key={n}
                            onPress={() => setDosesPerDay(n)}
                            accessibilityRole="radio"
                            accessibilityState={{ checked: on }}
                            style={[styles.freqChip, { backgroundColor: on ? colors.ink : colors.pale }]}
                          >
                            <Text style={[typography.chipLabel, { color: on ? colors.lime : colors.textPrimary }]}>{n}</Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  </View>

                  <View style={{ gap: spacing.md }}>
                    {Array.from({ length: dosesPerDay }).map((_, i) => (
                      <View key={i} style={{ gap: spacing.xs }}>
                        <Text style={typography.formLabel}>{`Dose ${i + 1}`}</Text>
                        <Pressable
                          onPress={() => setOpenDoseIndex((cur) => (cur === i ? null : i))}
                          accessibilityRole="button"
                          accessibilityLabel={`Dose ${i + 1} time`}
                          style={styles.field}
                        >
                          <Icon path={CLOCK_ICON} color={reminderTimes[i] ? colors.textPrimary : colors.textFaint} size={17} />
                          <Text style={[typography.chipLabel, { flex: 1, color: reminderTimes[i] ? colors.textPrimary : colors.textFaint }]}>
                            {reminderTimes[i] ? formatTime12(reminderTimes[i]) : 'Set time'}
                          </Text>
                          <Text style={styles.caret}>{openDoseIndex === i ? '⌃' : '⌄'}</Text>
                        </Pressable>
                        {openDoseIndex === i && (
                          <TimePicker
                            value={reminderTimes[i]}
                            onSelect={(hhmm) => {
                              setReminderTimes((prev) => {
                                const next = [...prev];
                                next[i] = hhmm;
                                return next;
                              });
                              setOpenDoseIndex(null);
                            }}
                          />
                        )}
                      </View>
                    ))}
                  </View>
                </View>
              )}
            </View>
          )}
        </View>
      )}

      <View style={styles.section}>
        <Text style={typography.formLabel}>Expiry date (optional)</Text>
        <Pressable
          onPress={() => setCalendarOpen((o) => !o)}
          accessibilityRole="button"
          accessibilityLabel="Expiry date"
          style={styles.field}
        >
          <Icon
            path="M4 6h16v14H4zM4 10h16M8.5 3.5v3M15.5 3.5v3"
            color={expiry ? colors.textPrimary : colors.textFaint}
            size={17}
          />
          <Text style={[typography.chipLabel, { flex: 1, color: expiry ? colors.textPrimary : colors.textFaint }]}>
            {expiry ? formatDate(expiry) : 'No expiry date'}
          </Text>
          <Text style={styles.caret}>{calendarOpen ? '⌃' : '⌄'}</Text>
        </Pressable>
        {calendarOpen && (
          <Calendar
            selected={expiry}
            onSelect={(iso) => {
              setExpiry(iso);
              setCalendarOpen(false);
            }}
          />
        )}
      </View>

      <View style={styles.section}>
        <Text style={typography.formLabel}>Where is it?</Text>
        <View style={{ gap: spacing.xs }}>
          {rooms.map((label) => {
            const on = room === label;
            return (
              <Pressable
                key={label}
                onPress={() => setRoom(label)}
                accessibilityRole="radio"
                accessibilityState={{ checked: on }}
                style={[styles.roomChip, { backgroundColor: on ? colors.ink : colors.pale }]}
              >
                <Text style={[typography.chipLabel, { color: on ? colors.lime : colors.textPrimary }]}>{label}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <Pressable
        onPress={handleSave}
        disabled={!canSave && !savedFlash}
        accessibilityRole="button"
        accessibilityLabel="Add item"
        style={[styles.saveButton, { backgroundColor: canSave || savedFlash ? colors.ink : colors.pressWash }]}
      >
        <Text
          style={[
            typography.buttonLabel,
            { color: canSave || savedFlash ? colors.lime : 'rgba(22,33,12,0.35)' },
          ]}
        >
          {savedFlash ? 'Added ✓' : 'Add item'}
        </Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
  },
  content: {
    gap: spacing.xxl,
    paddingBottom: spacing.md,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.ms,
    backgroundColor: colors.white,
    borderRadius: radius.md - 6,
    borderWidth: 1.5,
    padding: spacing.xs - 1.5,
  },
  nameIcon: {
    width: 62,
    height: 62,
    borderRadius: 12,
    backgroundColor: '#3A3A3A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  section: {
    gap: spacing.xs,
  },
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
  roomChip: {
    borderRadius: radius.md,
    paddingVertical: spacing.ms,
    paddingHorizontal: spacing.md,
  },
  medicineBody: {
    gap: spacing.md,
    marginTop: spacing.xs,
  },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.pale,
    borderRadius: radius.md,
    paddingVertical: spacing.ms,
    paddingHorizontal: spacing.md,
  },
  amountInput: {
    flex: 1,
    // Flex items default to a min-width equal to their content, which can
    // push a sibling (the unit label) outside the pill instead of actually
    // shrinking — this forces it to shrink like the rest of the row.
    minWidth: 0,
    fontFamily: fontFamily.mono500,
    fontSize: 16,
    color: colors.textPrimary,
  },
  amountUnit: {
    flexShrink: 0,
    fontFamily: fontFamily.mono500,
    fontSize: 13,
    color: colors.textMuted,
  },
  freqChip: {
    flex: 1,
    borderRadius: radius.md,
    paddingVertical: spacing.ms,
    alignItems: 'center',
  },
  saveButton: {
    borderRadius: radius.md - 6,
    paddingVertical: spacing.lg,
    alignItems: 'center',
  },
});
