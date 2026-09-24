import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { throwColor, throwFont, throwRadius } from '../../theme/throwTokens';
import { BottomSheet } from '../expenses/BottomSheet';

interface PhotoAttachSheetProps {
  visible: boolean;
  onClose: () => void;
  onPicked: (uri: string) => void;
}

/** "Take Photo" / "Photo Library" chooser for attaching a photo to a letter — same two-option
 * shape as ChatThreadScreen's attach sheet, restyled for Throw's paper aesthetic. Each option
 * requests its own permission right before use and fails gracefully (an inline message, not a
 * crash) if denied. */
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
    onPicked(result.assets[0].uri);
  };

  const pickFromLibrary = async () => {
    setError(null);
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setError('Photo library access is needed to pick a photo.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: 'images', quality: 0.7, allowsEditing: true });
    if (result.canceled || !result.assets[0]) return;
    onClose();
    onPicked(result.assets[0].uri);
  };

  return (
    <BottomSheet visible={visible} onClose={onClose}>
      <Text style={styles.title}>Add a photo</Text>
      <View style={styles.options}>
        <Pressable onPress={takePhoto} style={({ pressed }) => [styles.option, pressed && styles.optionPressed]}>
          <Text style={styles.optionLabel}>Take Photo</Text>
        </Pressable>
        <Pressable onPress={pickFromLibrary} style={({ pressed }) => [styles.option, pressed && styles.optionPressed]}>
          <Text style={styles.optionLabel}>Photo Library</Text>
        </Pressable>
      </View>
      {error && <Text style={styles.error}>{error}</Text>}
      <Pressable onPress={onClose} style={styles.cancelButton}>
        <Text style={styles.cancelLabel}>Cancel</Text>
      </Pressable>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  title: { fontFamily: throwFont.hand700, fontSize: 22, color: throwColor.ink, marginBottom: 4 },
  options: { gap: 10 },
  option: {
    borderRadius: throwRadius.card,
    paddingVertical: 16,
    paddingHorizontal: 18,
    backgroundColor: throwColor.claySoft,
  },
  optionPressed: { opacity: 0.7 },
  optionLabel: { fontFamily: throwFont.ui600, fontSize: 15, color: throwColor.ink },
  error: { fontFamily: throwFont.ui400, fontSize: 12.5, color: '#B3413A', marginTop: 4 },
  cancelButton: {
    borderRadius: throwRadius.pill,
    paddingVertical: 16,
    alignItems: 'center',
    backgroundColor: throwColor.paperLine,
    marginTop: 6,
  },
  cancelLabel: { fontFamily: throwFont.ui600, fontSize: 15, color: throwColor.inkSoft },
});
