import React, { useState } from 'react';
import { Animated, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { colors, radius, spacing, typography, noOutline } from '../theme';
import { useFocusBorder } from '../hooks/useFocusBorder';
import { Icon } from './Icon';
import { CategoryPicker } from './CategoryPicker';
import { Calendar } from './Calendar';
import { CATEGORY_ICON, EMPTY_CATEGORY_ICON } from '../data/itemCategories';
import { formatDate } from '../utils/attention';

interface ItemFormProps {
  rooms: string[];
  onSubmit: (input: { name: string; category: string; room: string; expiry: string }) => void;
}

/** "What are you putting away?" — the add-item form. */
export function ItemForm({ rooms, onSubmit }: ItemFormProps) {
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [room, setRoom] = useState('');
  const [expiry, setExpiry] = useState('');
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);

  const { borderColor: nameBorder, onFocus: onNameFocus, onBlur: onNameBlur } = useFocusBorder(
    'rgba(22,33,12,0)',
    colors.ink,
  );

  const canSave = name.trim().length > 0;

  const handleSave = () => {
    if (!canSave) return;
    onSubmit({ name: name.trim(), category, room, expiry });
    setName('');
    setCategory('');
    setRoom('');
    setExpiry('');
    setCalendarOpen(false);
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
  saveButton: {
    borderRadius: radius.md - 6,
    paddingVertical: spacing.lg,
    alignItems: 'center',
  },
});
