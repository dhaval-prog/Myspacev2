import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';

// react-native-svg's web typings omit `children` on Defs (a typing gap, not a runtime issue) — cast once.
const DefsAny = Defs as unknown as React.ComponentType<{ children?: React.ReactNode }>;
import { CameraView, useCameraPermissions } from 'expo-camera';
import { colors, fontFamily, spacing } from '../../theme';
import { Icon } from '../../components/Icon';
import { useFriends } from '../../context/FriendsContext';

const BACK_ICON = 'M15 5l-7 7 7 7';
const TORCH_ICON = 'M13 2.5 5.5 13.5H11L10 21.5 18.5 10H13z';
const CHECK_ICON = 'M5 12.5 10 17.5 19 7';

const RETICLE_SIZE = 250;
const BRACKET_SIZE = 52;
const BRACKET_THICKNESS = 4;
const BRACKET_RADIUS = 22;
const SCAN_TRAVEL = 196;
const LOOP_DURATION = 2600;
const SCAN_BEAM_COLORS = ['rgba(195,234,79,0)', colors.lime, 'rgba(195,234,79,0)'] as [string, string, string];

/** A scanned QR can hold a bare code or a `myspace://add/CODE` deep link — pull just the code either way. */
function extractCode(raw: string): string {
  const trimmed = raw.trim();
  const afterSlash = trimmed.includes('/') ? trimmed.slice(trimmed.lastIndexOf('/') + 1) : trimmed;
  return afterSlash.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
}

function formatDisplayCode(code: string): string {
  return code.length > 3 ? `${code.slice(0, 3)}·${code.slice(3)}` : code;
}

const BRACKET_POSITION: Record<'tl' | 'tr' | 'bl' | 'br', ViewStyle> = {
  tl: { top: 0, left: 0, borderTopWidth: BRACKET_THICKNESS, borderLeftWidth: BRACKET_THICKNESS, borderTopLeftRadius: BRACKET_RADIUS },
  tr: { top: 0, right: 0, borderTopWidth: BRACKET_THICKNESS, borderRightWidth: BRACKET_THICKNESS, borderTopRightRadius: BRACKET_RADIUS },
  bl: { bottom: 0, left: 0, borderBottomWidth: BRACKET_THICKNESS, borderLeftWidth: BRACKET_THICKNESS, borderBottomLeftRadius: BRACKET_RADIUS },
  br: { bottom: 0, right: 0, borderBottomWidth: BRACKET_THICKNESS, borderRightWidth: BRACKET_THICKNESS, borderBottomRightRadius: BRACKET_RADIUS },
};

function Bracket({ corner }: { corner: 'tl' | 'tr' | 'bl' | 'br' }) {
  return <View style={[styles.bracket, BRACKET_POSITION[corner]]} />;
}

/** Full-screen QR scanner (6p-3) for another account's friend code. */
export function FriendsScannerScreen() {
  const insets = useSafeAreaInsets();
  const { goAdd, goMatch, lookupCode, matchFound, matchCode } = useFriends();
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
    setError(null);
    const result = await lookupCode(found, { navigate: false });
    if (result.error) {
      setError(result.error);
      setScanned(false);
    }
  };

  const showDetected = scanned && !error && !!matchFound && !!matchCode;

  return (
    <View style={styles.screen}>
      {permission?.granted ? (
        <CameraView
          style={StyleSheet.absoluteFill}
          facing="back"
          enableTorch={torch}
          barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
          onBarcodeScanned={handleBarcodeScanned}
        />
      ) : null}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <Svg width="100%" height="100%">
          <DefsAny>
            <RadialGradient id="scannerWash" cx="50%" cy="34%" rx="120%" ry="70%">
              <Stop offset={colors.friendsScannerCanvasStops[0]} stopColor={colors.friendsScannerCanvas[0]} />
              <Stop offset={colors.friendsScannerCanvasStops[1]} stopColor={colors.friendsScannerCanvas[1]} />
              <Stop offset={colors.friendsScannerCanvasStops[2]} stopColor={colors.friendsScannerCanvas[2]} />
            </RadialGradient>
          </DefsAny>
          <Rect x="0" y="0" width="100%" height="100%" fill="url(#scannerWash)" />
        </Svg>
      </View>

      <View style={[styles.content, { paddingTop: insets.top + spacing.sm, paddingBottom: Math.max(insets.bottom, spacing.md) }]}>
        <View style={styles.topBar}>
          <Pressable onPress={goAdd} style={styles.iconButton} accessibilityRole="button" accessibilityLabel="Back">
            <Icon path={BACK_ICON} color="#fff" size={19} strokeWidth={2} />
          </Pressable>
          <Pressable
            onPress={() => setTorch((v) => !v)}
            style={[styles.iconButton, torch && styles.iconButtonOn]}
            accessibilityRole="button"
            accessibilityLabel="Toggle flash"
          >
            <Icon path={TORCH_ICON} color="#fff" size={18} strokeWidth={1.8} />
          </Pressable>
        </View>

        {permission?.granted ? (
          <>
            <View style={styles.titleSpacer} />
            <Text style={styles.title}>Point at their code</Text>
            <Text style={styles.sub}>Hold steady — we'll catch it automatically.</Text>

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
                  styles.scanLineWrap,
                  {
                    transform: [{ translateY: scanLine.interpolate({ inputRange: [0, 1], outputRange: [0, SCAN_TRAVEL] }) }],
                  },
                ]}
              >
                <LinearGradient colors={SCAN_BEAM_COLORS} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={styles.scanLine} />
              </Animated.View>
            </View>
          </>
        ) : (
          <View style={styles.permissionWrap}>
            <Text style={styles.permissionText}>Camera access is needed to scan a code.</Text>
          </View>
        )}

        <View style={styles.flexSpacer} />

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        {showDetected ? (
          <Pressable
            onPress={goMatch}
            style={styles.detectedCard}
            accessibilityRole="button"
            accessibilityLabel={`Code found, ${matchFound?.name ?? ''}`}
          >
            <View style={styles.detectedIcon}>
              <Icon path={CHECK_ICON} color={colors.ink} size={20} strokeWidth={2.2} />
            </View>
            <View style={styles.detectedTextWrap}>
              <Text style={styles.detectedTitle}>Code found · {formatDisplayCode(matchCode ?? '')}</Text>
              <Text style={styles.detectedName}>{matchFound?.name}</Text>
            </View>
            <Text style={styles.detectedChevron}>›</Text>
          </Pressable>
        ) : null}

        <Pressable onPress={goAdd} style={styles.enterCodePill} accessibilityRole="button" accessibilityLabel="Enter code instead">
          <Text style={styles.enterCodeLabel}>Enter code instead</Text>
        </Pressable>

        <View style={styles.homeIndicator} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.scannerBase,
  },
  content: {
    flex: 1,
    paddingHorizontal: 26,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  iconButton: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.onInk14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconButtonOn: {
    backgroundColor: colors.lime,
  },
  titleSpacer: {
    height: 44,
  },
  title: {
    fontFamily: fontFamily.sans700,
    fontSize: 26,
    lineHeight: 29.9,
    letterSpacing: -0.52,
    color: '#fff',
    textAlign: 'center',
  },
  sub: {
    marginTop: 9,
    fontFamily: fontFamily.sans400,
    fontSize: 13.5,
    lineHeight: 19.6,
    color: 'rgba(255,255,255,.6)',
    textAlign: 'center',
  },
  permissionWrap: {
    marginTop: 34,
    alignItems: 'center',
  },
  permissionText: {
    fontFamily: fontFamily.sans500,
    fontSize: 14,
    color: 'rgba(255,255,255,.7)',
    textAlign: 'center',
  },
  reticle: {
    marginTop: 34,
    alignSelf: 'center',
    width: RETICLE_SIZE,
    height: RETICLE_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bracket: {
    position: 'absolute',
    width: BRACKET_SIZE,
    height: BRACKET_SIZE,
    borderColor: colors.lime,
  },
  pulseCircle: {
    position: 'absolute',
    width: 104,
    height: 104,
    borderRadius: 52,
    backgroundColor: 'rgba(195,234,79,.16)',
  },
  scanLineWrap: {
    position: 'absolute',
    top: 26,
    left: 26,
    right: 26,
    height: 3,
    shadowColor: colors.lime,
    shadowOpacity: 0.45,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 0 },
  },
  scanLine: {
    flex: 1,
    borderRadius: 999,
  },
  flexSpacer: {
    flex: 1,
  },
  errorText: {
    marginBottom: spacing.sm,
    fontFamily: fontFamily.sans500,
    fontSize: 13,
    color: colors.coral,
    textAlign: 'center',
  },
  detectedCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: colors.onInk10,
    borderWidth: 1,
    borderColor: colors.onInkChip,
    borderRadius: 26,
    paddingVertical: 16,
    paddingHorizontal: 18,
  },
  detectedIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.lime,
    alignItems: 'center',
    justifyContent: 'center',
  },
  detectedTextWrap: {
    flex: 1,
  },
  detectedTitle: {
    fontFamily: fontFamily.sans600,
    fontSize: 14.5,
    color: '#fff',
  },
  detectedName: {
    marginTop: 2,
    fontFamily: fontFamily.sans400,
    fontSize: 12.5,
    color: 'rgba(255,255,255,.55)',
  },
  detectedChevron: {
    fontSize: 18,
    color: colors.lime,
  },
  enterCodePill: {
    marginTop: 14,
    width: '100%',
    borderRadius: 999,
    paddingVertical: 17,
    alignItems: 'center',
    backgroundColor: colors.onInkBtnSoft,
  },
  enterCodeLabel: {
    fontFamily: fontFamily.sans600,
    fontSize: 15,
    color: '#fff',
  },
  homeIndicator: {
    marginTop: 16,
    alignSelf: 'center',
    width: 140,
    height: 5,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,.7)',
  },
});
