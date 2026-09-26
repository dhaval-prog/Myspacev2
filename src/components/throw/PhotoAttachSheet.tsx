import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { throwColor, throwFont, throwGlass, throwRadius } from '../../theme/throwTokens';
import { GlassSurface } from '../friends/GlassSurface';
import { BottomSheet } from '../expenses/BottomSheet';

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

/** "Take Photo" / "Record Video" / "Photo Library" chooser for attaching media to a letter — same
 * three-option shape as ChatThreadScreen's attach sheet, restyled for Throw's paper aesthetic with
 * a frosted-glass treatment (matching the rest of Throw's chrome) instead of flat fills. Each
 * option requests its own permission right before use and fails gracefully (an inline message,
 * not a crash) if denied. The library option allows picking several photos or videos at once;
 * cropping (`allowsEditing`) only applies to the single-photo camera capture, since multi-select
 * is mutually exclusive with it on both platforms, and doesn't apply to video at all. */
export function PhotoAttachSheet({ visible, onClose, onPicked }: PhotoAttachSheetProps) {
  const [error, setError] = useState<string | null>(null);

  const takePhoto = async () => {
    setError(null);
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      setError('Camera access is needed to take a photo.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ mediaTypes: 'images', quality: 0.7, allowsEditing: true });
    if (result.canceled || !result.assets[0]) return;
    onClose();
    onPicked([{ uri: result.assets[0].uri, isVideo: false }]);
  };

  const recordVideo = async () => {
    setError(null);
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      setError('Camera access is needed to record a video.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ mediaTypes: 'videos', videoMaxDuration: VIDEO_MAX_DURATION_SECONDS });
    if (result.canceled || !result.assets[0]) return;
    onClose();
    onPicked([{ uri: result.assets[0].uri, isVideo: true }]);
  };

  const pickFromLibrary = async () => {
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
      <Text style={styles.title}>Add a photo or video</Text>
      <View style={styles.options}>
        <Pressable onPress={takePhoto} style={({ pressed }) => [pressed && styles.optionPressed]}>
          <GlassSurface tint="light" tintColor={throwGlass.tint} style={styles.option}>
            <Text style={styles.optionLabel}>Take Photo</Text>
          </GlassSurface>
        </Pressable>
        <Pressable onPress={recordVideo} style={({ pressed }) => [pressed && styles.optionPressed]}>
          <GlassSurface tint="light" tintColor={throwGlass.tint} style={styles.option}>
            <Text style={styles.optionLabel}>Record Video</Text>
          </GlassSurface>
        </Pressable>
        <Pressable onPress={pickFromLibrary} style={({ pressed }) => [pressed && styles.optionPressed]}>
          <GlassSurface tint="light" tintColor={throwGlass.tint} style={styles.option}>
            <Text style={styles.optionLabel}>Photo & Video Library</Text>
          </GlassSurface>
        </Pressable>
      </View>
      {error && <Text style={styles.error}>{error}</Text>}
      <Pressable onPress={onClose} style={({ pressed }) => [pressed && styles.optionPressed]}>
        <GlassSurface tint="light" tintColor={throwGlass.tintStrong} style={styles.cancelButton}>
          <Text style={styles.cancelLabel}>Cancel</Text>
        </GlassSurface>
      </Pressable>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  title: { fontFamily: throwFont.hand700, fontSize: 22, color: throwColor.ink, marginBottom: 4 },
  options: { gap: 10 },
  option: {
    borderRadius: throwRadius.card,
    borderWidth: 1,
    borderColor: throwGlass.border,
    paddingVertical: 16,
    paddingHorizontal: 18,
  },
  optionPressed: { opacity: 0.7 },
  optionLabel: { fontFamily: throwFont.ui600, fontSize: 15, color: throwColor.ink },
  error: { fontFamily: throwFont.ui400, fontSize: 12.5, color: '#B3413A', marginTop: 4 },
  cancelButton: {
    borderRadius: throwRadius.pill,
    borderWidth: 1,
    borderColor: throwGlass.border,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 6,
  },
  cancelLabel: { fontFamily: throwFont.ui600, fontSize: 15, color: throwColor.inkSoft },
});
