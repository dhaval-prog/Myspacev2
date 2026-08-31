import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { colors, fontFamily, spacing } from '../../theme';
import { Icon } from '../../components/Icon';
import { useFriends } from '../../context/FriendsContext';

const BACK_ICON = 'M15 5l-7 7 7 7';
const FLASH_ICON = 'M13 3 4 14h6l-1 7 9-11h-6z';

const RETICLE_SIZE = 250;
const BRACKET_SIZE = 52;
const BRACKET_THICKNESS = 4;
const SCAN_TRAVEL = 196;
const LOOP_DURATION = 2600;

function extractCode(raw: string): string {
  return raw.trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
}

const BRACKET_POSITION: Record<'tl' | 'tr' | 'bl' | 'br', ViewStyle> = {
  tl: { top: 0, left: 0, borderTopWidth: BRACKET_THICKNESS, borderLeftWidth: BRACKET_THICKNESS },
  tr: { top: 0, right: 0, borderTopWidth: BRACKET_THICKNESS, borderRightWidth: BRACKET_THICKNESS },
  bl: { bottom: 0, left: 0, borderBottomWidth: BRACKET_THICKNESS, borderLeftWidth: BRACKET_THICKNESS },
  br: { bottom: 0, right: 0, borderBottomWidth: BRACKET_THICKNESS, borderRightWidth: BRACKET_THICKNESS },
};

function Bracket({ corner }: { corner: 'tl' | 'tr' | 'bl' | 'br' }) {
  return <View style={[styles.bracket, BRACKET_POSITION[corner]]} />;
}

/** Full-screen QR scanner (6p-3) for another account's friend code. */
export function FriendsScannerScreen() {
  const insets = useSafeAreaInsets();
  const { goAdd, lookupCode } = useFriends();
  const [permission, requestPermission] = useCameraPermissions();
  const [torch, setTorch] = useState(false);
  const [scanned, setScanned] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const scanLine = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!permission?.granted) requestPermission();
    // Runs once on mount — permission/requestPermission would retrigger every render otherwise.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(scanLine, { toValue: 1, duration: LOOP_DURATION / 2, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(scanLine, { toValue: 0, duration: LOOP_DURATION / 2, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ]),
    );
    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: LOOP_DURATION / 2, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: LOOP_DURATION / 2, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ]),
    );
    loop.start();
    pulseLoop.start();
    return () => {
      loop.stop();
      pulseLoop.stop();
    };
  }, [scanLine, pulse]);

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

  return (
    <View style={styles.screen}>
      <LinearGradient colors={colors.friendsScannerCanvas as [string, string, string]} style={StyleSheet.absoluteFill} />
      <View style={styles.cameraWrap}>
        {permission?.granted ? (
          <CameraView
            style={StyleSheet.absoluteFill}
            facing="back"
            enableTorch={torch}
            barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
            onBarcodeScanned={handleBarcodeScanned}
          />
        ) : null}

        <View style={styles.copyBlock}>
          <Text style={styles.title}>Point at their code</Text>
          <Text style={styles.sub}>Hold steady — we'll catch it automatically.</Text>
        </View>

        {permission?.granted ? (
          <View style={styles.reticle}>
            <Bracket corner="tl" />
            <Bracket corner="tr" />
            <Bracket corner="bl" />
            <Bracket corner="br" />
            <Animated.View
              style={[
                styles.pulseCircle,
                {
                  opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.5, 0.12] }),
                  transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.5] }) }],
                },
              ]}
            />
            <Animated.View
              style={[
                styles.scanLine,
                {
                  transform: [{ translateY: scanLine.interpolate({ inputRange: [0, 1], outputRange: [0, SCAN_TRAVEL] }) }],
                },
              ]}
            />
          </View>
        ) : (
          <View style={styles.permissionWrap}>
            <Text style={styles.permissionText}>Camera access is needed to scan a code.</Text>
          </View>
        )}
      </View>

      <View style={[styles.topBar, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable onPress={goAdd} style={styles.iconButton} accessibilityRole="button" accessibilityLabel="Back">
          <Icon path={BACK_ICON} color="#fff" size={19} strokeWidth={2} />
        </Pressable>
        <Pressable
          onPress={() => setTorch((v) => !v)}
          style={[styles.iconButton, torch && styles.iconButtonOn]}
          accessibilityRole="button"
          accessibilityLabel="Toggle flash"
        >
          <Icon path={FLASH_ICON} color="#fff" size={18} strokeWidth={1.8} />
        </Pressable>
      </View>

      <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}>
        {error && <Text style={styles.errorText}>{error}</Text>}
        <Pressable onPress={goAdd} style={styles.enterCodePill} accessibilityRole="button" accessibilityLabel="Enter code instead">
          <Text style={styles.enterCodeLabel}>Enter code instead</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#101709',
  },
  cameraWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  copyBlock: {
    position: 'absolute',
    top: '18%',
    paddingHorizontal: spacing.xxl,
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontFamily: fontFamily.sans700,
    fontSize: 26,
    lineHeight: 30,
    color: '#fff',
    textAlign: 'center',
  },
  sub: {
    fontFamily: fontFamily.sans400,
    fontSize: 13.5,
    color: 'rgba(255,255,255,.6)',
    textAlign: 'center',
  },
  permissionWrap: {
    paddingHorizontal: spacing.xxl,
    alignItems: 'center',
  },
  permissionText: {
    fontFamily: fontFamily.sans500,
    fontSize: 14,
    color: 'rgba(255,255,255,.7)',
    textAlign: 'center',
  },
  reticle: {
    width: RETICLE_SIZE,
    height: RETICLE_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderRadius: 22,
  },
  bracket: {
    position: 'absolute',
    width: BRACKET_SIZE,
    height: BRACKET_SIZE,
    borderColor: colors.lime,
    borderRadius: 22,
  },
  pulseCircle: {
    position: 'absolute',
    width: 104,
    height: 104,
    borderRadius: 52,
    backgroundColor: 'rgba(195,234,79,.16)',
  },
  scanLine: {
    position: 'absolute',
    top: 26,
    left: 26,
    right: 26,
    height: 3,
    borderRadius: 2,
    backgroundColor: colors.lime,
    shadowColor: colors.lime,
    shadowOpacity: 0.45,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 0 },
  },
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xxl,
  },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconButtonOn: {
    backgroundColor: colors.lime,
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
  errorText: {
    fontFamily: fontFamily.sans500,
    fontSize: 13,
    color: '#FF8A6B',
    textAlign: 'center',
  },
  enterCodePill: {
    borderRadius: 999,
    paddingVertical: 13,
    paddingHorizontal: 22,
    backgroundColor: 'rgba(255,255,255,.12)',
  },
  enterCodeLabel: {
    fontFamily: fontFamily.sans600,
    fontSize: 13.5,
    color: '#fff',
  },
});
