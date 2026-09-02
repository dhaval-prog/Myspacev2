import React, { useMemo, useRef, useState } from 'react';
import { Animated, Image, PanResponder, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { colors, radius, spacing, typography, noOutline } from '../theme';
import { useFocusBorder } from '../hooks/useFocusBorder';
import { useAuth } from '../context/AuthContext';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import { Icon } from './Icon';
import { CategoryPicker } from './CategoryPicker';
import { Calendar } from './Calendar';
import { TimePicker } from './TimePicker';
import { PhotoCaptureSheet } from './PhotoCaptureSheet';
import { ConfirmDialog } from './ConfirmDialog';
import { CATEGORY_ICON, EMPTY_CATEGORY_ICON } from '../data/itemCategories';
import { formatDate } from '../utils/attention';
import { formatTime12 } from '../utils/time';
import { ALERT_TYPES, ALERT_TYPE_LABEL, nextAlertDate } from '../utils/alerts';
import type { AlertType, Item } from '../types/space';

const CLOCK_PATH = 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18M12 7v5l3.5 2';

const EDIT_PATH = 'M4 20h4L20 8l-4-4L4 16zM14.5 5.5l4 4';
const DELETE_PATH = 'M4 7h16M9.5 7V4.5h5V7M6.5 7l1 13h9l1-13M10.5 10.5v6.5M13.5 10.5v6.5';
const SEARCH_PATH = 'M11 4.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13ZM16 16l4 4';
const CLOSE_PATH = 'M6 6l12 12M18 6L6 18';
const CAMERA_PATH = 'M4 8h3l1.5-2h7L17 8h3v12H4z M12 11.4a3.4 3.4 0 1 0 0 6.8 3.4 3.4 0 0 0 0-6.8';

/** How far a "View all" card slides left to swap its Edit action for Delete. */
const SWIPE_REVEAL_WIDTH = 64;

interface EditPatch {
  name?: string;
  category?: string;
  room?: string;
  expiry?: string;
  /** Omitted = unchanged; '' = removed; a URL = replaced with a new photo. */
  photoUrl?: string;
  alertType?: AlertType;
  reminderTimes?: string[];
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
          isEditing={(mode === 'edit' || mode === 'view') && editingIndex === index}
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

  // "View all" cards: a left swipe anywhere on the card swaps the Edit
  // action for Delete (and a right swipe swaps it back) — no separate
  // Edit/Delete tabs needed, unlike the 'edit'/'delete' rail modes below.
  const [swiped, setSwiped] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => mode === 'view' && Math.abs(g.dx) > 8 && Math.abs(g.dx) > Math.abs(g.dy),
      onPanResponderRelease: (_, g) => {
        if (g.dx < -SWIPE_REVEAL_WIDTH / 2) setSwiped(true);
        else if (g.dx > SWIPE_REVEAL_WIDTH / 2) setSwiped(false);
      },
    }),
  ).current;

  const confirmDelete = () => {
    setConfirmOpen(false);
    onDelete();
  };

  const cancelDelete = () => {
    setConfirmOpen(false);
    setSwiped(false);
  };

  return (
    <View style={styles.card}>
      <View style={styles.cardRow} {...(mode === 'view' ? panResponder.panHandlers : {})}>
        <View style={styles.cardIcon}>
          {item.photoUrl ? (
            <Image source={{ uri: item.photoUrl }} style={styles.cardPhoto} />
          ) : (
            <Icon path={CATEGORY_ICON[item.category] || EMPTY_CATEGORY_ICON} color={colors.pale} size={24} />
          )}
        </View>
        <View style={{ flex: 1, gap: 3 }}>
          <Text style={typography.itemTitle}>{item.name}</Text>
          <Text style={typography.itemSub}>{sub}</Text>
          {hasExpiry && <Text style={typography.itemExpiry}>{`exp ${formatDate(item.expiry)}`}</Text>}
        </View>
        {mode === 'view' && !swiped && (
          <Pressable
            onPress={onToggleEdit}
            accessibilityRole="button"
            accessibilityLabel={`Edit ${item.name}`}
            style={[styles.action, { backgroundColor: isEditing ? colors.ink : colors.pressWash }]}
          >
            <Icon path={EDIT_PATH} color={isEditing ? colors.lime : colors.textPrimary} size={15} />
          </Pressable>
        )}
        {mode === 'view' && swiped && (
          <Pressable
            onPress={() => setConfirmOpen(true)}
            accessibilityRole="button"
            accessibilityLabel={`Delete ${item.name}`}
            style={[styles.action, { backgroundColor: colors.danger }]}
          >
            <Icon path={DELETE_PATH} color="#fff" size={15} />
          </Pressable>
        )}
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
      {isEditing &&
        (item.category === 'Alert' ? (
          <AlertEditForm item={item} onSave={onSave} onCancel={onCancel} />
        ) : (
          <ItemEditForm item={item} rooms={rooms} onSave={onSave} onCancel={onCancel} />
        ))}
      {mode === 'view' && (
        <ConfirmDialog
          visible={confirmOpen}
          title={`Delete ${item.name}?`}
          message="This removes it permanently — it can't be undone."
          confirmLabel="Delete"
          destructive
          onConfirm={confirmDelete}
          onCancel={cancelDelete}
        />
      )}
    </View>
  );
}

/** Editing an "Alert" item: the same fields it was created with, not the generic item form. */
function AlertEditForm({
  item,
  onSave,
  onCancel,
}: {
  item: Item;
  onSave: (patch: EditPatch) => void;
  onCancel: () => void;
}) {
  const { user } = useAuth();
  const userId = user?.id ?? null;

  const [name, setName] = useState(item.name);
  const [alertType, setAlertType] = useState<AlertType>(item.alertType ?? 'daily');
  const [time, setTime] = useState<string | undefined>(item.reminderTimes?.[0]);
  const [timeOpen, setTimeOpen] = useState(false);
  const { borderColor: editNameBorder, onFocus: onEditNameFocus, onBlur: onEditNameBlur } = useFocusBorder(
    'rgba(22,33,12,0)',
    colors.ink,
  );

  const [cameraOpen, setCameraOpen] = useState(false);
  const [photoUri, setPhotoUri] = useState<string | null>(item.photoUrl ?? null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(item.photoUrl ?? null);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const photoChanged = photoUrl !== (item.photoUrl ?? null);

  const handleCapture = async (uri: string) => {
    setCameraOpen(false);
    setPhotoUri(uri);
    setPhotoError(null);

    if (!userId || !isSupabaseConfigured) {
      setPhotoUrl(uri);
      return;
    }

    setPhotoUploading(true);
    try {
      const response = await fetch(uri);
      const blob = await response.blob();
      const ext = (blob.type.split('/')[1] || 'jpg').split('+')[0];
      const path = `${userId}/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from('item-photos').upload(path, blob, { contentType: blob.type || 'image/jpeg' });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from('item-photos').getPublicUrl(path);
      setPhotoUrl(pub.publicUrl);
    } catch {
      setPhotoError('Could not upload that photo. Try again.');
      setPhotoUrl(item.photoUrl ?? null);
    } finally {
      setPhotoUploading(false);
    }
  };

  const removePhoto = () => {
    setPhotoUri(null);
    setPhotoUrl(null);
    setPhotoError(null);
  };

  return (
    <View style={styles.editWrap}>
      <View style={styles.divider} />

      <View style={styles.editSection}>
        <Text style={typography.formLabel}>Alert name</Text>
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
        <Text style={typography.formLabel}>Alert type</Text>
        <View style={styles.alertTypeRow}>
          {ALERT_TYPES.map((t) => {
            const on = alertType === t;
            return (
              <Pressable
                key={t}
                onPress={() => setAlertType(t)}
                accessibilityRole="radio"
                accessibilityState={{ checked: on }}
                style={[styles.alertTypeChip, { backgroundColor: on ? colors.ink : colors.pale }]}
              >
                <Text style={[typography.chipLabel, { color: on ? colors.lime : colors.textPrimary }]}>{ALERT_TYPE_LABEL[t]}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={styles.editSection}>
        <Text style={typography.formLabel}>Photo</Text>
        {photoUri ? (
          <View style={styles.photoRow}>
            <Image source={{ uri: photoUri }} style={styles.photoThumb} />
            <Text style={[typography.chipLabel, { flex: 1, color: photoError ? '#D33243' : colors.textPrimary }]}>
              {photoUploading ? 'Uploading…' : photoError ? photoError : 'Photo'}
            </Text>
            <Pressable
              onPress={() => setCameraOpen(true)}
              accessibilityRole="button"
              accessibilityLabel="Update photo"
              style={styles.photoIconButton}
              hitSlop={8}
            >
              <Icon path={CAMERA_PATH} color={colors.textPrimary} size={15} />
            </Pressable>
            <Pressable
              onPress={removePhoto}
              accessibilityRole="button"
              accessibilityLabel="Remove photo"
              style={styles.photoIconButton}
              hitSlop={8}
            >
              <Icon path={CLOSE_PATH} color={colors.textPrimary} size={14} />
            </Pressable>
          </View>
        ) : (
          <Pressable onPress={() => setCameraOpen(true)} accessibilityRole="button" accessibilityLabel="Add photo" style={styles.editField}>
            <Icon path={CAMERA_PATH} color={colors.textFaint} size={16} />
            <Text style={[typography.chipLabel, { flex: 1, color: colors.textFaint }]}>Take a photo</Text>
          </Pressable>
        )}
      </View>

      <View style={styles.editSection}>
        <Text style={typography.formLabel}>Select time for alert</Text>
        <Pressable onPress={() => setTimeOpen((o) => !o)} style={styles.editField}>
          <Icon path={CLOCK_PATH} color={time ? colors.textPrimary : colors.textFaint} size={16} />
          <Text style={[typography.chipLabel, { flex: 1, color: time ? colors.textPrimary : colors.textFaint }]}>
            {time ? formatTime12(time) : 'Set a time'}
          </Text>
        </Pressable>
        {timeOpen && (
          <TimePicker
            value={time}
            onSelect={(hhmm) => {
              setTime(hhmm);
              setTimeOpen(false);
            }}
          />
        )}
      </View>

      <View style={styles.editActions}>
        <Pressable onPress={onCancel} style={[styles.editButton, { backgroundColor: colors.pressWash }]}>
          <Text style={[typography.buttonLabel, { fontSize: 13, color: colors.textPrimary }]}>Cancel</Text>
        </Pressable>
        <Pressable
          disabled={photoUploading}
          onPress={() =>
            onSave({
              name: name.trim() || item.name,
              alertType,
              reminderTimes: [time ?? item.reminderTimes?.[0] ?? '09:00'],
              ...(alertType !== item.alertType ? { expiry: nextAlertDate(alertType) } : {}),
              ...(photoChanged ? { photoUrl: photoUrl ?? '' } : {}),
            })
          }
          style={[styles.editButton, { backgroundColor: photoUploading ? colors.pressWash : colors.ink }]}
        >
          <Text style={[typography.buttonLabel, { fontSize: 13, color: photoUploading ? colors.textFaint : colors.lime }]}>
            {photoUploading ? 'Uploading…' : 'Save'}
          </Text>
        </Pressable>
      </View>

      <PhotoCaptureSheet visible={cameraOpen} onClose={() => setCameraOpen(false)} onCapture={handleCapture} />
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
  const { user } = useAuth();
  const userId = user?.id ?? null;

  const [name, setName] = useState(item.name);
  const [category, setCategory] = useState(item.category);
  const [room, setRoom] = useState(item.room);
  const [expiry, setExpiry] = useState(item.expiry);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const { borderColor: editNameBorder, onFocus: onEditNameFocus, onBlur: onEditNameBlur } = useFocusBorder(
    'rgba(22,33,12,0)',
    colors.ink,
  );

  const [cameraOpen, setCameraOpen] = useState(false);
  const [photoUri, setPhotoUri] = useState<string | null>(item.photoUrl ?? null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(item.photoUrl ?? null);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const photoChanged = photoUrl !== (item.photoUrl ?? null);

  const handleCapture = async (uri: string) => {
    setCameraOpen(false);
    setPhotoUri(uri);
    setPhotoError(null);

    if (!userId || !isSupabaseConfigured) {
      setPhotoUrl(uri);
      return;
    }

    setPhotoUploading(true);
    try {
      const response = await fetch(uri);
      const blob = await response.blob();
      const ext = (blob.type.split('/')[1] || 'jpg').split('+')[0];
      const path = `${userId}/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from('item-photos').upload(path, blob, { contentType: blob.type || 'image/jpeg' });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from('item-photos').getPublicUrl(path);
      setPhotoUrl(pub.publicUrl);
    } catch {
      setPhotoError('Could not upload that photo. Try again.');
      setPhotoUrl(item.photoUrl ?? null);
    } finally {
      setPhotoUploading(false);
    }
  };

  const removePhoto = () => {
    setPhotoUri(null);
    setPhotoUrl(null);
    setPhotoError(null);
  };

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
        <Text style={typography.formLabel}>Photo</Text>
        {photoUri ? (
          <View style={styles.photoRow}>
            <Image source={{ uri: photoUri }} style={styles.photoThumb} />
            <Text style={[typography.chipLabel, { flex: 1, color: photoError ? '#D33243' : colors.textPrimary }]}>
              {photoUploading ? 'Uploading…' : photoError ? photoError : 'Photo'}
            </Text>
            <Pressable
              onPress={() => setCameraOpen(true)}
              accessibilityRole="button"
              accessibilityLabel="Update photo"
              style={styles.photoIconButton}
              hitSlop={8}
            >
              <Icon path={CAMERA_PATH} color={colors.textPrimary} size={15} />
            </Pressable>
            <Pressable
              onPress={removePhoto}
              accessibilityRole="button"
              accessibilityLabel="Remove photo"
              style={styles.photoIconButton}
              hitSlop={8}
            >
              <Icon path={CLOSE_PATH} color={colors.textPrimary} size={14} />
            </Pressable>
          </View>
        ) : (
          <Pressable onPress={() => setCameraOpen(true)} accessibilityRole="button" accessibilityLabel="Add photo" style={styles.editField}>
            <Icon path={CAMERA_PATH} color={colors.textFaint} size={16} />
            <Text style={[typography.chipLabel, { flex: 1, color: colors.textFaint }]}>Take a photo</Text>
          </Pressable>
        )}
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
          disabled={photoUploading}
          onPress={() =>
            onSave({
              name: name.trim() || item.name,
              category,
              room,
              expiry,
              ...(photoChanged ? { photoUrl: photoUrl ?? '' } : {}),
            })
          }
          style={[styles.editButton, { backgroundColor: photoUploading ? colors.pressWash : colors.ink }]}
        >
          <Text style={[typography.buttonLabel, { fontSize: 13, color: photoUploading ? colors.textFaint : colors.lime }]}>
            {photoUploading ? 'Uploading…' : 'Save'}
          </Text>
        </Pressable>
      </View>

      <PhotoCaptureSheet visible={cameraOpen} onClose={() => setCameraOpen(false)} onCapture={handleCapture} />
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
    overflow: 'hidden',
  },
  cardPhoto: {
    width: '100%',
    height: '100%',
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
  photoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm - 1,
    backgroundColor: colors.pale,
    borderRadius: 12,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.ms,
  },
  photoThumb: {
    width: 40,
    height: 40,
    borderRadius: 9,
  },
  photoIconButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.pressWash,
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
  alertTypeRow: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  alertTypeChip: {
    flex: 1,
    borderRadius: radius.md,
    paddingVertical: spacing.ms,
    alignItems: 'center',
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
