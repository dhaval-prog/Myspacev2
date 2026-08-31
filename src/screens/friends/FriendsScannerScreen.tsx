import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CameraView, scanFromURLAsync, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { colors, fontFamily, spacing } from '../../theme';
import { Icon } from '../../components/Icon';
import { useFriends } from '../../context/FriendsContext';

const BACK_ICON = 'M15 5l-7 7 7 7';
const GALLERY_ICON = 'M4 5h16v14H4zM4 16l4.5-4.5 4 4L15 13l5 5';

function extractCode(raw: string): string {
  return raw.trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
}

/** Full-screen QR scanner for another account's friend code. */
export function FriendsScannerScreen() {
  const insets = useSafeAreaInsets();
  const { goAdd, lookupCode } = useFriends();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!permission?.granted) requestPermission();
    // Runs once on mount — permission/requestPermission would retrigger every render otherwise.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleBarcodeScanned = async ({ data }: { data: string }) => {
    if (scanned) return;
    const found = extractCode(data);
    if (found.length !== 6) return;
    setScanned(true);
    const result = await lookupCode(found);
    if (result.error) {
      setError(result.error);
      setScanned(false);
    }
  };

  const pickFromPhotos = async () => {
    setError(null);
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      setError('Photo library access is needed to pick a code image.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1 });
    if (result.canceled || !result.assets[0]) return;

    try {
      const scans = await scanFromURLAsync(result.assets[0].uri, ['qr']);
      const found = scans.map((s) => extractCode(s.data)).find((d) => d.length === 6);
      if (found) {
        const lookup = await lookupCode(found);
        if (lookup.error) setError(lookup.error);
      } else {
        setError("No friend code found in that photo.");
      }
    } catch {
      setError('Could not read that photo.');
    }
  };

  return (
    <View style={styles.screen}>
      <View style={styles.cameraWrap}>
        {permission?.granted ? (
          <CameraView
            style={StyleSheet.absoluteFill}
            facing="back"
            barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
            onBarcodeScanned={handleBarcodeScanned}
          />
        ) : (
          <View style={[StyleSheet.absoluteFill, styles.permissionWrap]}>
            <Text style={styles.permissionText}>Camera access is needed to scan a code.</Text>
          </View>
        )}
        <View style={styles.scanFrame} />
      </View>

      <View style={[styles.topBar, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable onPress={goAdd} style={styles.iconButton} accessibilityRole="button" accessibilityLabel="Back">
          <Icon path={BACK_ICON} color="#fff" size={19} strokeWidth={2} />
        </Pressable>
      </View>

      <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}>
        <Text style={styles.hint}>{error ?? "Point your camera at a friend's QR code."}</Text>
        <Pressable onPress={pickFromPhotos} style={styles.galleryOption} accessibilityRole="button" accessibilityLabel="Choose QR code from photos">
          <Icon path={GALLERY_ICON} color="#fff" size={17} />
          <Text style={styles.galleryLabel}>From Photos</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#000',
  },
  cameraWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  permissionWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xxl,
  },
  permissionText: {
    fontFamily: fontFamily.sans500,
    fontSize: 14,
    color: 'rgba(255,255,255,.7)',
    textAlign: 'center',
  },
  scanFrame: {
    width: 240,
    height: 240,
    borderRadius: 28,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,.85)',
  },
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: spacing.xxl,
  },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: spacing.xxl,
    paddingTop: spacing.xl,
    alignItems: 'center',
    gap: spacing.ms,
  },
  hint: {
    fontFamily: fontFamily.sans500,
    fontSize: 13.5,
    color: 'rgba(255,255,255,.85)',
    textAlign: 'center',
  },
  galleryOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    borderRadius: 999,
    paddingVertical: 13,
    paddingHorizontal: 22,
    backgroundColor: 'rgba(255,255,255,.14)',
  },
  galleryLabel: {
    fontFamily: fontFamily.sans600,
    fontSize: 13.5,
    color: '#fff',
  },
});
