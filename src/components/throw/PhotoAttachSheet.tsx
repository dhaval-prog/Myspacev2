import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { throwColor, throwFont, throwRadius } from '../../theme/throwTokens';
import { Icon } from '../Icon';
import { BottomSheet } from '../expenses/BottomSheet';

const GALLERY_ICON = 'M4 5h16v14H4zM4 16l4.5-4.5 4 4L15 13l5 5';
const CAMERA_ICON = 'M4 8h3l1.5-2h7L17 8h3v12H4z M12 11.4a3.4 3.4 0 1 0 0 6.8 3.4 3.4 0 0 0 0-6.8';

// Highest number of photos/videos the library picker lets someone select in one go — a sane
// ceiling rather than a hard product requirement.
const LIBRARY_SELECTION_LIMIT = 10;
// A phone-recorded video attached to a letter is meant to be a short clip, not a full movie —
// keeps upload size/time reasonable. 0 would mean "no limit".
const VIDEO_MAX_DURATION_SECONDS = 60;

export interface PickedMedia {
  uri: string;
  isVideo: boolean;
}

interface PhotoAttachSheetProps {
  visible: boolean;
  onClose: () => void;
  /** One or more picked photos/videos — the camera always hands back exactly one, the library
   * may hand back several at once (multi-select). Callers append these to their own media list. */
  onPicked: (items: PickedMedia[]) => void;
}

/** "Photos" / "Camera" chooser for attaching media to a letter — two plain icon buttons side by
 * side (matching the OS's own native photo/camera picker pattern), no title text and no
 * glassmorphism, just a flat icon on a plain circle. "Photos" opens the library (multi-select,
 * photos and videos both, in one picker); "Camera" opens the device camera with both capture
 * modes available at once — the OS's own camera UI supplies the still/video toggle once both
 * media types are permitted, rather than this sheet offering two separate camera actions. Each
 * requests its own permission right before use and fails gracefully (an inline message, not a
 * crash) if denied. */
export function PhotoAttachSheet({ visible, onClose, onPicked }: PhotoAttachSheetProps) {
  const [error, setError] = useState<string | null>(null);

  const openCamera = async () => {
    setError(null);
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      setError('Camera access is needed to take a photo or video.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images', 'videos'],
      quality: 0.7,
      videoMaxDuration: VIDEO_MAX_DURATION_SECONDS,
    });
    if (result.canceled || !result.assets[0]) return;
    onClose();
    onPicked([{ uri: result.assets[0].uri, isVideo: result.assets[0].type === 'video' }]);
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
    onPicked(result.assets.map((a) => ({ uri: a.uri, isVideo: a.type === 'video' })));
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
