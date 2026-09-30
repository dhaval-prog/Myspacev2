import React, { useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { throwColor, throwFont, throwRadius } from '../../theme/throwTokens';
import { Icon } from '../Icon';
import { BottomSheet } from '../expenses/BottomSheet';

const GALLERY_ICON = 'M4 5h16v14H4zM4 16l4.5-4.5 4 4L15 13l5 5';
const CAMERA_ICON = 'M4 8h3l1.5-2h7L17 8h3v12H4z M12 11.4a3.4 3.4 0 1 0 0 6.8 3.4 3.4 0 0 0 0-6.8';

// Highest number of photos/videos the library picker lets someone select in one go — a sane
// ceiling rather than a hard product requirement.
const LIBRARY_SELECTION_LIMIT = 10;

export interface PickedMedia {
  uri: string;
  isVideo: boolean;
  /** The library asset's own reported duration, ms — only meaningful for a video, and only ever
   * present for a library pick (the in-app capture screen already enforces its own 15s cap, so
   * anything it hands back never needs this). The caller (FoldingLetter) uses it to decide whether
   * a picked video needs the trim screen before it can be attached. */
  durationMs?: number;
  /** Set only once a video that needed trimming has gone through the trim screen — see
   * FoldingLetter's own trim-queue handling. Absent for anything that never needed one (a photo,
   * or a video already within the 15s cap). */
  trim?: { startMs: number; endMs: number };
}

interface PhotoAttachSheetProps {
  visible: boolean;
  onClose: () => void;
  /** One or more picked photos/videos from the library — may hand back several at once
   * (multi-select). The caller appends these to its own media list, after checking each video's
   * own durationMs against the 15s cap itself. */
  onPicked: (items: PickedMedia[]) => void;
  /** "Camera" closes this sheet and hands off to the caller's own in-app capture screen (the same
   * 15s-capped VIDEO/PHOTO toggle Status uses) instead of this component driving the OS's native
   * camera itself — per explicit request, so a letter's own recorded video gets the same visible
   * countdown guide and cap a status video already has, rather than the OS camera's own unguided
   * 60s allowance. */
  onOpenCamera: () => void;
}

/** "Photos" / "Camera" chooser for attaching media to a letter — two plain icon buttons side by
 * side (matching the OS's own native photo/camera picker pattern), no title text and no
 * glassmorphism, just a flat icon on a plain circle. "Photos" opens the library (multi-select,
 * photos and videos both, in one picker) directly; "Camera" hands off to the caller's own capture
 * screen (see onOpenCamera) rather than driving anything itself. Library access requests its own
 * permission right before use and fails gracefully (an inline message, not a crash) if denied. */
export function PhotoAttachSheet({ visible, onClose, onPicked, onOpenCamera }: PhotoAttachSheetProps) {
  const [error, setError] = useState<string | null>(null);

  const openCamera = () => {
    setError(null);
    onClose();
    onOpenCamera();
  };

  const openLibrary = async () => {
    setError(null);
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setError('Photo library access is needed to pick a photo or video.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images', 'videos'],
      quality: 0.7,
      allowsMultipleSelection: true,
      selectionLimit: LIBRARY_SELECTION_LIMIT,
    });
    if (result.canceled || result.assets.length === 0) return;
    onClose();
    onPicked(
      result.assets.map((a) => ({
        uri: a.uri,
        isVideo: a.type === 'video',
        // expo-image-picker documents `duration` as milliseconds (and native platforms honor
        // that), but its web shim hands back the raw HTMLVideoElement.duration, which is
        // seconds — without this platform-specific conversion, an over-15s gallery video would
        // silently never trip the trim-screen cap on web.
        durationMs: a.duration != null ? (Platform.OS === 'web' ? a.duration * 1000 : a.duration) : undefined,
      }))
    );
  };

  return (
    <BottomSheet visible={visible} onClose={onClose}>
      <View style={styles.row}>
        <Pressable onPress={openLibrary} style={({ pressed }) => [styles.item, pressed && styles.itemPressed]} accessibilityRole="button" accessibilityLabel="Choose from Photos">
          <View style={styles.iconCircle}>
            <Icon path={GALLERY_ICON} size={26} color={throwColor.ink} strokeWidth={1.8} />
          </View>
          <Text style={styles.itemLabel}>Photos</Text>
        </Pressable>
        <Pressable onPress={openCamera} style={({ pressed }) => [styles.item, pressed && styles.itemPressed]} accessibilityRole="button" accessibilityLabel="Take a photo or video">
          <View style={styles.iconCircle}>
            <Icon path={CAMERA_ICON} size={26} color={throwColor.ink} strokeWidth={1.8} />
          </View>
          <Text style={styles.itemLabel}>Camera</Text>
        </Pressable>
      </View>
      {error && <Text style={styles.error}>{error}</Text>}
      <Pressable onPress={onClose} style={({ pressed }) => [styles.cancelButton, pressed && styles.itemPressed]}>
        <Text style={styles.cancelLabel}>Cancel</Text>
      </Pressable>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'center', gap: 40, marginTop: 6, marginBottom: 8 },
  item: { alignItems: 'center', gap: 8 },
  itemPressed: { opacity: 0.7 },
  iconCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: throwColor.paper,
    alignItems: 'center',
    justifyContent: 'center',
    ...throwColor.shadowSoft,
  },
  itemLabel: { fontFamily: throwFont.ui600, fontSize: 13, color: throwColor.ink },
  error: { fontFamily: throwFont.ui400, fontSize: 12.5, color: '#B3413A', textAlign: 'center', marginTop: 8 },
  cancelButton: {
    borderRadius: throwRadius.pill,
    backgroundColor: throwColor.claySoft,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 16,
  },
  cancelLabel: { fontFamily: throwFont.ui600, fontSize: 15, color: throwColor.inkSoft },
});
