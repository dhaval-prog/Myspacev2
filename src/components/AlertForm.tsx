import React, { useState } from 'react';
import { Animated, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { colors, fontFamily, radius, spacing, typography, noOutline } from '../theme';
import { useFocusBorder } from '../hooks/useFocusBorder';
import { useAuth } from '../context/AuthContext';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import { Icon } from './Icon';
import { TimePicker } from './TimePicker';
import { PhotoCaptureSheet } from './PhotoCaptureSheet';
import { formatTime12 } from '../utils/time';
import { ALERT_TYPES, ALERT_TYPE_LABEL, nextAlertDate } from '../utils/alerts';
import type { AlertType } from '../types/space';

const BELL_ICON =
  'M12 3a4 4 0 0 0-4 4v3.2c0 .53-.21 1.04-.59 1.41L6 13v1h12v-1l-1.41-1.39A2 2 0 0 1 16 10.2V7a4 4 0 0 0-4-4z M10 17a2 2 0 0 0 4 0';
const CAMERA_ICON = 'M4 8h3l1.5-2h7L17 8h3v12H4z M12 11.4a3.4 3.4 0 1 0 0 6.8 3.4 3.4 0 0 0 0-6.8';
const CLOCK_ICON = 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18M12 7v5l3.5 2';
const CLOSE_ICON = 'M6 6l12 12M18 6L6 18';

interface AlertFormInput {
  name: string;
  category: string;
  room: string;
  expiry: string;
  alertType: AlertType;
  remindersEnabled: boolean;
  reminderTimes: string[];
  photoUrl?: string;
}

interface AlertFormProps {
  onSubmit: (input: AlertFormInput) => void;
}

/** "Alerts" tile of the Add Items & Alerts flow — a recurring reminder, stored as an item. */
export function AlertForm({ onSubmit }: AlertFormProps) {
  const { user } = useAuth();
  const userId = user?.id ?? null;

  const [name, setName] = useState('');
  const [alertType, setAlertType] = useState<AlertType>('daily');
  const [time, setTime] = useState<string | undefined>(undefined);
  const [timeOpen, setTimeOpen] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);

  const [cameraOpen, setCameraOpen] = useState(false);
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);

  const { borderColor: nameBorder, onFocus: onNameFocus, onBlur: onNameBlur } = useFocusBorder(
    'rgba(22,33,12,0)',
    colors.ink,
  );

  const canSave = name.trim().length > 0 && Boolean(time) && !photoUploading;

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
      setPhotoUrl(null);
    } finally {
      setPhotoUploading(false);
    }
  };

  const resetPhotoFields = () => {
    setCameraOpen(false);
    setPhotoUri(null);
    setPhotoUrl(null);
    setPhotoUploading(false);
    setPhotoError(null);
  };

  const handleSave = () => {
    if (!canSave || !time) return;
    onSubmit({
      name: name.trim(),
      category: 'Alert',
      room: '',
      expiry: nextAlertDate(alertType),
      alertType,
      remindersEnabled: true,
      reminderTimes: [time],
      ...(photoUrl ? { photoUrl } : {}),
    });
    setName('');
    setAlertType('daily');
    setTime(undefined);
    setTimeOpen(false);
    resetPhotoFields();
    setSavedFlash(true);
    setTimeout(() => setSavedFlash(false), 1400);
  };

  return (
    <ScrollView style={styles.wrap} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <Animated.View style={[styles.nameRow, { borderColor: nameBorder }]}>
        <View style={styles.nameIcon}>
          <Icon path={BELL_ICON} color={colors.pale} size={26} />
        </View>
        <TextInput
          value={name}
          onChangeText={setName}
          onFocus={onNameFocus}
          onBlur={onNameBlur}
          placeholder="Alert name"
          placeholderTextColor={colors.textFaint}
          style={[typography.sheetInput, { fontSize: 15, flex: 1 }, noOutline]}
          accessibilityLabel="Alert name"
        />
      </Animated.View>

      <View style={styles.section}>
        <Text style={typography.formLabel}>Alert Type</Text>
        <View style={styles.typeRow}>
          {ALERT_TYPES.map((t) => {
            const on = alertType === t;
            return (
              <Pressable
                key={t}
                onPress={() => setAlertType(t)}
                accessibilityRole="radio"
                accessibilityState={{ checked: on }}
                style={[styles.typeChip, { backgroundColor: on ? colors.ink : colors.pale }]}
              >
                <Text style={[typography.chipLabel, { color: on ? colors.lime : colors.textPrimary }]}>{ALERT_TYPE_LABEL[t]}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={typography.formLabel}>Add Photo (optional)</Text>
        {photoUri ? (
          <View style={styles.photoRow}>
            <Image source={{ uri: photoUri }} style={styles.photoThumb} />
            <Text style={[typography.chipLabel, { flex: 1, color: photoError ? colors.danger : colors.textPrimary }]}>
              {photoUploading ? 'Uploading…' : photoError ? photoError : 'Photo added'}
            </Text>
            <Pressable onPress={resetPhotoFields} accessibilityRole="button" accessibilityLabel="Remove photo" style={styles.photoRemove} hitSlop={8}>
              <Icon path={CLOSE_ICON} color={colors.textPrimary} size={14} />
            </Pressable>
          </View>
        ) : (
          <Pressable onPress={() => setCameraOpen(true)} accessibilityRole="button" accessibilityLabel="Add photo" style={styles.field}>
            <Icon path={CAMERA_ICON} color={colors.textFaint} size={17} />
            <Text style={[typography.chipLabel, { flex: 1, color: colors.textFaint }]}>Take a photo</Text>
          </Pressable>
        )}
      </View>

      <View style={styles.section}>
        <Text style={typography.formLabel}>Select the time for Alert</Text>
        <Pressable
          onPress={() => setTimeOpen((o) => !o)}
          accessibilityRole="button"
          accessibilityLabel="Alert time"
          style={styles.field}
        >
          <Icon path={CLOCK_ICON} color={time ? colors.textPrimary : colors.textFaint} size={17} />
          <Text style={[typography.chipLabel, { flex: 1, color: time ? colors.textPrimary : colors.textFaint }]}>
            {time ? formatTime12(time) : 'Set a time'}
          </Text>
          <Text style={styles.caret}>{timeOpen ? '⌃' : '⌄'}</Text>
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

      <Pressable
        onPress={handleSave}
        disabled={!canSave && !savedFlash}
        accessibilityRole="button"
        accessibilityLabel="Add alert"
        style={[styles.saveButton, { backgroundColor: canSave || savedFlash ? colors.ink : colors.pressWash }]}
      >
        <Text
          style={[
            typography.buttonLabel,
            { color: canSave || savedFlash ? colors.lime : 'rgba(22,33,12,0.35)' },
          ]}
        >
          {savedFlash ? 'Added ✓' : 'Add'}
        </Text>
      </Pressable>

      <PhotoCaptureSheet visible={cameraOpen} onClose={() => setCameraOpen(false)} onCapture={handleCapture} />
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
  typeRow: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  typeChip: {
    flex: 1,
    borderRadius: radius.md,
    paddingVertical: spacing.ms,
    alignItems: 'center',
  },
  photoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.pale,
    borderRadius: radius.md,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
  },
  photoThumb: {
    width: 44,
    height: 44,
    borderRadius: 10,
  },
  photoRemove: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.pressWash,
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
  saveButton: {
    borderRadius: radius.md - 6,
    paddingVertical: spacing.lg,
    alignItems: 'center',
  },
});
