import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { CameraView, scanFromURLAsync, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { colors, fontFamily, noOutline, spacing } from '../../theme';
import { Icon } from '../Icon';
import { BottomSheet } from './BottomSheet';
import { useExpenses } from '../../context/ExpensesContext';

const CAMERA_ICON = 'M4 8h3l1.5-2h7L17 8h3v12H4z M12 11.4a3.4 3.4 0 1 0 0 6.8 3.4 3.4 0 0 0 0-6.8';
const GALLERY_ICON = 'M4 5h16v14H4zM4 16l4.5-4.5 4 4L15 13l5 5';

type Mode = 'form' | 'scan';

/** Digits only, capped at 11 — the same shape whether typed, scanned, or read off a photo. */
function extractCode(raw: string): string {
  return raw.replace(/\D/g, '').slice(0, 11);
}

/** Redeem an owner's 11-digit join code — typed, scanned live, or read from a QR photo — to gain view + add-spend access to their card. */
export function JoinCardSheet() {
  const { joinOpen, closeJoin, joinCard } = useExpenses();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [mode, setMode] = useState<Mode>('form');
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);

  useEffect(() => {
    if (joinOpen) {
      setCode('');
      setError(null);
      setSubmitting(false);
      setMode('form');
      setScanned(false);
    }
  }, [joinOpen]);

  const valid = code.length === 11;

  const submit = async () => {
    if (!valid || submitting) return;
    setSubmitting(true);
    setError(null);
    const result = await joinCard(code);
    setSubmitting(false);
    if (result.error) setError(result.error);
  };

  const handleBarcodeScanned = ({ data }: { data: string }) => {
    if (scanned) return;
    const found = extractCode(data);
    if (found.length !== 11) return;
    setScanned(true);
    setCode(found);
    setMode('form');
    setError(null);
  };

  const openScanner = async () => {
    setError(null);
    if (!permission?.granted) {
      const res = await requestPermission();
      if (!res.granted) {
        setError('Camera access is needed to scan a code.');
        return;
      }
    }
    setScanned(false);
    setMode('scan');
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
      const found = scans.map((s) => extractCode(s.data)).find((d) => d.length === 11);
      if (found) {
        setCode(found);
      } else {
        setError('No join code found in that photo.');
      }
    } catch {
      setError('Could not read that photo.');
    }
  };

  return (
    <BottomSheet visible={joinOpen} onClose={closeJoin}>
      <Text style={styles.title}>Join a budget card</Text>

      {mode === 'scan' ? (
        <View style={styles.scanWrap}>
          <View style={styles.cameraBox}>
            <CameraView
              style={styles.camera}
              facing="back"
              barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
              onBarcodeScanned={handleBarcodeScanned}
            />
          </View>
          <Text style={styles.hint}>Point your camera at the card owner's QR code.</Text>
          <Pressable onPress={() => setMode('form')} style={styles.cancelButton}>
            <Text style={styles.cancelLabel}>Cancel</Text>
          </Pressable>
        </View>
      ) : (
        <>
          <Text style={styles.hint}>Enter the 11-digit code the card owner shared with you.</Text>

          <TextInput
            value={code}
            onChangeText={(v) => {
              setCode(extractCode(v));
              setError(null);
            }}
            placeholder="000 0000 0000"
            placeholderTextColor={colors.walletSheetTextFaint}
            keyboardType="number-pad"
            style={[styles.input, noOutline]}
          />

          <View style={styles.scanRow}>
            <Pressable onPress={openScanner} style={styles.scanOption} accessibilityRole="button" accessibilityLabel="Scan QR code">
              <View style={styles.scanIcon}>
                <Icon path={CAMERA_ICON} color={colors.walletSheetTextPrimary} size={17} />
              </View>
              <Text style={styles.scanOptionLabel}>Scan QR</Text>
            </Pressable>
            <Pressable onPress={pickFromPhotos} style={styles.scanOption} accessibilityRole="button" accessibilityLabel="Choose QR code from photos">
              <View style={styles.scanIcon}>
                <Icon path={GALLERY_ICON} color={colors.walletSheetTextPrimary} size={17} />
              </View>
              <Text style={styles.scanOptionLabel}>From Photos</Text>
            </Pressable>
          </View>

          {error && <Text style={styles.error}>{error}</Text>}

          <View style={styles.actionsRow}>
            <Pressable onPress={closeJoin} style={styles.cancelButton}>
              <Text style={styles.cancelLabel}>Cancel</Text>
            </Pressable>
            <Pressable
              onPress={submit}
              style={[styles.saveButton, { backgroundColor: valid ? colors.walletAccentBlue : 'rgba(22,104,232,.4)' }]}
            >
              <Text style={styles.saveLabel}>{submitting ? 'Joining…' : 'Join card'}</Text>
            </Pressable>
          </View>
        </>
      )}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  title: {
    fontFamily: fontFamily.sans700,
    fontSize: 21,
    color: colors.walletSheetTextPrimary,
  },
  hint: {
    fontFamily: fontFamily.sans400,
    fontSize: 13.5,
    lineHeight: 21,
    color: colors.walletSheetTextSecondary,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.walletSheetBorder,
    backgroundColor: colors.walletSheetFaint,
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 16,
    fontFamily: fontFamily.mono500,
    fontSize: 17,
    letterSpacing: 1.7,
    color: colors.walletSheetTextPrimary,
  },
  scanRow: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  scanOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    borderRadius: 16,
    paddingVertical: 13,
    backgroundColor: colors.walletSheetMuted,
  },
  scanIcon: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scanOptionLabel: {
    fontFamily: fontFamily.sans600,
    fontSize: 13.5,
    color: colors.walletSheetTextPrimary,
  },
  error: {
    fontFamily: fontFamily.sans500,
    fontSize: 12.5,
    color: colors.walletAccentRed,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginTop: spacing.xxs,
  },
  cancelButton: {
    flex: 1,
    borderRadius: 999,
    paddingVertical: 16,
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,.06)',
  },
  cancelLabel: {
    fontFamily: fontFamily.sans600,
    fontSize: 15.5,
    color: colors.walletSheetTextPrimary,
  },
  saveButton: {
    flex: 1.4,
    borderRadius: 999,
    paddingVertical: 16,
    alignItems: 'center',
  },
  saveLabel: {
    fontFamily: fontFamily.sans600,
    fontSize: 15.5,
    color: '#fff',
  },
  scanWrap: {
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
});
