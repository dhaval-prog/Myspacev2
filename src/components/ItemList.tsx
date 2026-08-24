import React, { useMemo, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { colors, radius, spacing, typography, noOutline } from '../theme';
import { useFocusBorder } from '../hooks/useFocusBorder';
import { Icon } from './Icon';
import { CategoryPicker } from './CategoryPicker';
import { Calendar } from './Calendar';
import { CATEGORY_ICON, EMPTY_CATEGORY_ICON } from '../data/itemCategories';
import { formatDate } from '../utils/attention';
import type { Item } from '../types/space';

const EDIT_PATH = 'M4 20h4L20 8l-4-4L4 16zM14.5 5.5l4 4';
const DELETE_PATH = 'M4 7h16M9.5 7V4.5h5V7M6.5 7l1 13h9l1-13M10.5 10.5v6.5M13.5 10.5v6.5';
const SEARCH_PATH = 'M11 4.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13ZM16 16l4 4';
const CLOSE_PATH = 'M6 6l12 12M18 6L6 18';

interface EditPatch {
  name?: string;
  category?: string;
  room?: string;
  expiry?: string;
}

interface ItemListProps {
  items: Item[];
  rooms: string[];
  mode: 'view' | 'delete' | 'edit';
  onDelete?: (index: number) => void;
  onEditSave?: (index: number, patch: EditPatch) => void;
}

/** Search + list of filed items, with an optional delete or inline-edit action. */
export function ItemList({ items, rooms, mode, onDelete, onEditSave }: ItemListProps) {
  const [query, setQuery] = useState('');
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const { borderColor: searchBorder, onFocus: onSearchFocus, onBlur: onSearchBlur } = useFocusBorder(
    'rgba(22,33,12,0)',
    colors.ink,
  );

  const q = query.trim().toLowerCase();
  const shown = useMemo(
    () =>
      items
        .map((it, index) => ({ it, index }))
        .filter(({ it }) => !q || [it.name, it.category, it.room].filter(Boolean).join(' ').toLowerCase().includes(q)),
    [items, q],
  );

  return (
    <View style={{ flex: 1, gap: spacing.sm + 1 }}>
      <Animated.View style={[styles.searchRow, { borderColor: searchBorder }]}>
        <Icon path={SEARCH_PATH} color="rgba(22,33,12,0.55)" size={15} strokeWidth={1.9} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          onFocus={onSearchFocus}
          onBlur={onSearchBlur}
          placeholder="Search items, categories, rooms"
          placeholderTextColor={colors.textFaint}
          style={[styles.searchInput, noOutline]}
        />
        {q.length > 0 && (
          <Pressable
            onPress={() => setQuery('')}
            accessibilityRole="button"
            accessibilityLabel="Clear search"
            style={styles.clearButton}
          >
            <Icon path={CLOSE_PATH} color={colors.textPrimary} size={11} strokeWidth={2.4} />
          </Pressable>
        )}
      </Animated.View>

      {shown.length === 0 && (
        <Text style={styles.emptyText}>
          {items.length === 0 ? 'Nothing filed yet.' : `No matches for “${query.trim()}”.`}
        </Text>
      )}

      {shown.map(({ it, index }) => (
        <ItemCard
          key={`${it.name}-${index}`}
          item={it}
          rooms={rooms}
          mode={mode}
          isEditing={mode === 'edit' && editingIndex === index}
          onToggleEdit={() => setEditingIndex((cur) => (cur === index ? null : index))}
          onDelete={() => onDelete?.(index)}
          onSave={(patch) => {
            onEditSave?.(index, patch);
            setEditingIndex(null);
          }}
          onCancel={() => setEditingIndex(null)}
        />
      ))}
    </View>
  );
}

function ItemCard({
  item,
  rooms,
  mode,
  isEditing,
  onToggleEdit,
  onDelete,
  onSave,
  onCancel,
}: {
  item: Item;
  rooms: string[];
  mode: 'view' | 'delete' | 'edit';
  isEditing: boolean;
  onToggleEdit: () => void;
  onDelete: () => void;
  onSave: (patch: EditPatch) => void;
  onCancel: () => void;
}) {
  const sub = [item.category, item.room].filter(Boolean).join(' · ') || 'Unfiled';
  const hasExpiry = Boolean(item.expiry) && mode !== 'delete';

  return (
    <View style={styles.card}>
      <View style={styles.cardRow}>
        <View style={styles.cardIcon}>
          <Icon path={CATEGORY_ICON[item.category] || EMPTY_CATEGORY_ICON} color={colors.pale} size={24} />
        </View>
        <View style={{ flex: 1, gap: 3 }}>
          <Text style={typography.itemTitle}>{item.name}</Text>
          <Text style={typography.itemSub}>{sub}</Text>
          {hasExpiry && <Text style={typography.itemExpiry}>{`exp ${formatDate(item.expiry)}`}</Text>}
        </View>
        {mode === 'edit' && (
          <Pressable
            onPress={onToggleEdit}
            accessibilityRole="button"
            accessibilityLabel={`Edit ${item.name}`}
            style={[styles.action, { backgroundColor: isEditing ? colors.ink : colors.pressWash }]}
          >
            <Icon path={EDIT_PATH} color={isEditing ? colors.lime : colors.textPrimary} size={15} />
          </Pressable>
        )}
        {mode === 'delete' && (
          <Pressable
            onPress={onDelete}
            accessibilityRole="button"
            accessibilityLabel={`Delete ${item.name}`}
            style={[styles.action, { width: 34, height: 34, backgroundColor: 'rgba(211,50,67,0.12)' }]}
          >
            <Icon path={DELETE_PATH} color="#D33243" size={15} />
          </Pressable>
        )}
      </View>
      {isEditing && <ItemEditForm item={item} rooms={rooms} onSave={onSave} onCancel={onCancel} />}
    </View>
  );
}

function ItemEditForm({
  item,
  rooms,
  onSave,
  onCancel,
}: {
  item: Item;
  rooms: string[];
  onSave: (patch: EditPatch) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(item.name);
  const [category, setCategory] = useState(item.category);
  const [room, setRoom] = useState(item.room);
  const [expiry, setExpiry] = useState(item.expiry);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const { borderColor: editNameBorder, onFocus: onEditNameFocus, onBlur: onEditNameBlur } = useFocusBorder(
    'rgba(22,33,12,0)',
    colors.ink,
  );

  return (
    <View style={styles.editWrap}>
      <View style={styles.divider} />

      <View style={styles.editSection}>
        <Text style={typography.formLabel}>Item name</Text>
        <Animated.View style={[styles.editInputWrap, { borderColor: editNameBorder }]}>
          <TextInput
            value={name}
            onChangeText={setName}
            onFocus={onEditNameFocus}
            onBlur={onEditNameBlur}
            style={[styles.editInput, noOutline]}
          />
        </Animated.View>
      </View>

      <View style={styles.editSection}>
        <Text style={typography.formLabel}>Category</Text>
        <CategoryPicker value={category} onChange={setCategory} />
      </View>

      <View style={styles.editSection}>
        <Text style={typography.formLabel}>Expiry date</Text>
        <Pressable onPress={() => setCalendarOpen((o) => !o)} style={styles.editField}>
          <Icon
            path="M4 6h16v14H4zM4 10h16M8.5 3.5v3M15.5 3.5v3"
            color={expiry ? colors.textPrimary : colors.textFaint}
            size={16}
          />
          <Text style={[typography.chipLabel, { flex: 1, color: expiry ? colors.textPrimary : colors.textFaint }]}>
            {expiry ? formatDate(expiry) : 'No expiry date'}
          </Text>
        </Pressable>
        {calendarOpen && (
          <Calendar
            selected={expiry}
            onSelect={(iso) => {
              setExpiry(iso);
              setCalendarOpen(false);
            }}
            onClear={() => {
              setExpiry('');
              setCalendarOpen(false);
            }}
          />
        )}
      </View>

      <View style={styles.editSection}>
        <Text style={typography.formLabel}>Where is it?</Text>
        <View style={styles.roomWrap}>
          {rooms.map((label) => {
            const on = room === label;
            return (
              <Pressable
                key={label}
                onPress={() => setRoom(label)}
                style={[styles.roomChip, { backgroundColor: on ? colors.ink : colors.pale }]}
              >
                <Text style={[typography.chipLabel, { fontSize: 12, color: on ? colors.lime : colors.textPrimary }]}>
                  {label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={styles.editActions}>
        <Pressable onPress={onCancel} style={[styles.editButton, { backgroundColor: colors.pressWash }]}>
          <Text style={[typography.buttonLabel, { fontSize: 13, color: colors.textPrimary }]}>Cancel</Text>
        </Pressable>
        <Pressable
          onPress={() => onSave({ name: name.trim() || item.name, category, room, expiry })}
          style={[styles.editButton, { backgroundColor: colors.ink }]}
        >
          <Text style={[typography.buttonLabel, { fontSize: 13, color: colors.lime }]}>Save</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm - 1,
    backgroundColor: colors.pale,
    borderRadius: radius.md - 8,
    borderWidth: 1.5,
    paddingVertical: spacing.ms - 1.5,
    paddingHorizontal: spacing.md - 1.5,
  },
  searchInput: {
    flex: 1,
    fontFamily: typography.chipLabel.fontFamily,
    fontSize: 12.5,
    color: colors.textPrimary,
    padding: 0,
  },
  clearButton: {
    width: 22,
    height: 22,
    borderRadius: radius.pill,
    backgroundColor: colors.pressWash,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontFamily: typography.body.fontFamily,
    fontSize: 12,
    color: colors.textSecondary,
  },
  card: {
    borderRadius: radius.md - 8,
    overflow: 'hidden',
    backgroundColor: '#A6C76EB6',
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.ms,
    padding: spacing.xs - 1,
  },
  cardIcon: {
    width: 62,
    height: 60,
    borderRadius: 10,
    backgroundColor: '#3A3A3A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  action: {
    width: 46,
    height: 45,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editWrap: {
    gap: spacing.md,
    padding: spacing.md,
    paddingTop: spacing.xxs,
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(22,33,12,0.09)',
  },
  editSection: {
    gap: spacing.xxs + 2,
  },
  editInputWrap: {
    backgroundColor: colors.pale,
    borderRadius: 12,
    borderWidth: 1.5,
  },
  editInput: {
    paddingVertical: 11 - 1.5,
    paddingHorizontal: spacing.ms - 1.5,
    fontFamily: typography.chipLabel.fontFamily,
    fontSize: 13.5,
    color: colors.textPrimary,
  },
  editField: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm - 1,
    backgroundColor: colors.pale,
    borderRadius: 12,
    paddingVertical: 11,
    paddingHorizontal: spacing.ms,
  },
  roomWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs - 1,
  },
  roomChip: {
    borderRadius: radius.pill,
    paddingVertical: spacing.xs + 1,
    paddingHorizontal: spacing.ms + 1,
  },
  editActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  editButton: {
    flex: 1,
    paddingVertical: spacing.ms,
    borderRadius: 13,
    alignItems: 'center',
  },
});
