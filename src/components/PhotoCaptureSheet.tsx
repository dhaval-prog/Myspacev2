import React, { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { colors, fontFamily, spacing } from '../theme';
import { BottomSheet } from './expenses/BottomSheet';

interface PhotoCaptureSheetProps {
  visible: boolean;
  onClose: () => void;
  onCapture: (uri: string) => void;
}

/** Full-camera sheet for taking an item's photo — same shape as JoinCardSheet's QR scanner. */
export function PhotoCaptureSheet({ visible, onClose, onCapture }: PhotoCaptureSheetProps) {
  const [permission, requestPermission] = useCameraPermissions();
  const [error, setError] = useState<string | null>(null);
  const [capturing, setCapturing] = useState(false);
  const cameraRef = useRef<CameraView>(null);

  useEffect(() => {
    if (!visible) return;
    setError(null);
    setCapturing(false);
    if (!permission?.granted) {
      requestPermission().then((res) => {
        if (!res.granted) setError('Camera access is needed to add a photo.');
      });
    }
    // requestPermission/permission intentionally excluded — only re-checked when the sheet opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const takePhoto = async () => {
    if (!cameraRef.current || capturing) return;
    setCapturing(true);
    setError(null);
    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.5 });
      if (photo?.uri) onCapture(photo.uri);
      else setError('Could not take that photo. Try again.');
    } catch {
      setError('Could not take that photo. Try again.');
    } finally {
      setCapturing(false);
    }
  };

  return (
    <BottomSheet visible={visible} onClose={onClose}>
      <Text style={styles.title}>Add a photo</Text>

      {permission?.granted ? (
        <View style={styles.wrap}>
          <View style={styles.cameraBox}>
            <CameraView ref={cameraRef} style={styles.camera} facing="back" />
          </View>
          <Text style={styles.hint}>Line up the item, then tap the shutter.</Text>
          {error && <Text style={styles.error}>{error}</Text>}
          <Pressable
            onPress={takePhoto}
            disabled={capturing}
            accessibilityRole="button"
            accessibilityLabel="Take photo"
            style={styles.shutterWrap}
          >
            <View style={[styles.shutter, capturing && styles.shutterBusy]} />
          </Pressable>
          <Pressable onPress={onClose} style={styles.cancelButton}>
            <Text style={styles.cancelLabel}>Cancel</Text>
          </Pressable>
        </View>
      ) : (
        <View style={styles.wrap}>
          <Text style={styles.hint}>{error ?? 'Requesting camera access…'}</Text>
          <Pressable onPress={onClose} style={styles.cancelButton}>
            <Text style={styles.cancelLabel}>Cancel</Text>
          </Pressable>
        </View>
      )}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  title: {
    fontFamily: fontFamily.sans700,
    fontSize: 21,
    color: colors.textPrimary,
  },
  wrap: {
    gap: spacing.ms,
  },
  cameraBox: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: '#000',
  },
  camera: {
    flex: 1,
  },
  hint: {
    fontFamily: fontFamily.sans400,
    fontSize: 13.5,
    lineHeight: 21,
    color: colors.textSecondary,
  },
  error: {
    fontFamily: fontFamily.sans500,
    fontSize: 12.5,
    color: colors.danger,
  },
  shutterWrap: {
    alignItems: 'center',
    paddingVertical: spacing.xs,
  },
  shutter: {
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: colors.white,
    borderWidth: 4,
    borderColor: colors.ink,
  },
  shutterBusy: {
    opacity: 0.5,
  },
  cancelButton: {
    borderRadius: 999,
    paddingVertical: 16,
    alignItems: 'center',
    backgroundColor: colors.pressWash,
  },
  cancelLabel: {
    fontFamily: fontFamily.sans600,
    fontSize: 15.5,
    color: colors.textPrimary,
  },
});
