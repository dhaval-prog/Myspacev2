import React, { useEffect, useRef, useState } from 'react';
import { Animated, Image, Pressable, Share, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as Clipboard from 'expo-clipboard';
import QRCode from 'react-native-qrcode-svg';
import { colors, fontFamily, radius, spacing } from '../../theme';
import { Icon } from '../../components/Icon';
import { CopyIcon } from '../../components/icons/CopyIcon';
import { useFriends } from '../../context/FriendsContext';

const BACK_ICON = 'M15 5l-7 7 7 7';
const SHARE_ICON = 'M12 15V4M8 7.5 12 3.5l4 4 M5 14v4.5a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V14';
const SCAN_ICON =
  'M3.5 8V5.5a2 2 0 0 1 2-2H8M16 3.5h2.5a2 2 0 0 1 2 2V8M20.5 16v2.5a2 2 0 0 1-2 2H16M8 20.5H5.5a2 2 0 0 1-2-2V16 M3.5 12h17';

const QR_BOX = 196;
const QR_PADDING = 14;
const CELL_COUNT = 6;

function formatDisplayCode(code: string): string {
  return code.length > 3 ? `${code.slice(0, 3)} · ${code.slice(3)}` : code;
}

/** Add a friend (6p-2): show your own code/QR, or enter theirs cell by cell. */
export function AddFriendScreen() {
  const insets = useSafeAreaInsets();
  const { friendCode, goHome, goScan, lookupCode } = useFriends();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [copied, setCopied] = useState(false);
  const inputRef = useRef<TextInput>(null);
  const shake = useRef(new Animated.Value(0)).current;

  const submit = async (value: string) => {
    if (value.length !== CELL_COUNT || submitting) return;
    setSubmitting(true);
    setError(null);
    const result = await lookupCode(value);
    setSubmitting(false);
    if (result.error) {
      setError(result.error);
      setCode('');
      Animated.sequence([
        Animated.timing(shake, { toValue: 1, duration: 55, useNativeDriver: true }),
        Animated.timing(shake, { toValue: -1, duration: 55, useNativeDriver: true }),
        Animated.timing(shake, { toValue: 1, duration: 55, useNativeDriver: true }),
        Animated.timing(shake, { toValue: 0, duration: 55, useNativeDriver: true }),
      ]).start();
    }
  };

  const onChangeCode = (raw: string) => {
    const next = raw.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, CELL_COUNT);
    setCode(next);
    setError(null);
    if (next.length === CELL_COUNT) submit(next);
  };

  const copyCode = async () => {
    if (!friendCode) return;
    await Clipboard.setStringAsync(friendCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  const shareCode = () => {
    if (!friendCode) return;
    Share.share({ message: `Add me on MySpace — my invite code is ${friendCode} (myspace://add/${friendCode})` }).catch(() => {});
  };

  return (
    <LinearGradient
      colors={colors.friendsCanvas as [string, string, ...string[]]}
      locations={colors.friendsCanvasStops as [number, number, ...number[]]}
      start={{ x: 0.5, y: 0 }}
      end={{ x: 0.5, y: 1 }}
      style={styles.screen}
    >
      <View style={[styles.topRow, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable onPress={goHome} style={styles.iconButton} accessibilityRole="button" accessibilityLabel="Back">
          <Icon path={BACK_ICON} color={colors.textPrimary} size={19} strokeWidth={2} />
        </Pressable>
        <Pressable onPress={shareCode} style={styles.sharePill} accessibilityRole="button" accessibilityLabel="Share your invite code">
          <Icon path={SHARE_ICON} color={colors.textPrimary} size={15} strokeWidth={2} />
          <Text style={styles.shareLabel}>Share</Text>
        </Pressable>
      </View>

      <View style={styles.body}>
        <Text style={styles.title}>Add a friend</Text>
        <Text style={styles.sub}>Let them scan your code, or type in the six characters they send you.</Text>

        <View style={styles.qrPanel}>
          <View style={styles.qrTile}>
            {friendCode ? (
              <QRCode value={`myspace://add/${friendCode}`} size={QR_BOX - QR_PADDING * 2} color={colors.ink} backgroundColor="transparent" />
            ) : null}
            <View style={styles.qrBadge}>
              <Image source={require('../../../assets/logos/logo-lime.png')} style={styles.qrBadgeImage} />
            </View>
          </View>
          <Text style={styles.qrEyebrow}>YOUR INVITE CODE</Text>
          <View style={styles.qrCodeRow}>
            <Text style={styles.qrCode}>{friendCode ? formatDisplayCode(friendCode) : '——— · ———'}</Text>
            <Pressable onPress={copyCode} style={styles.copyButton} accessibilityRole="button" accessibilityLabel="Copy your invite code">
              <CopyIcon color="#fff" size={14} strokeWidth={1.8} />
            </Pressable>
          </View>
          {copied && <Text style={styles.copiedNote}>Copied</Text>}
        </View>

        <View style={styles.dividerRow}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerLabel}>or add theirs</Text>
          <View style={styles.dividerLine} />
        </View>

        <Pressable onPress={() => inputRef.current?.focus()} accessibilityRole="button" accessibilityLabel="Enter a friend code" style={styles.cellsPress}>
          <Animated.View
            style={[
              styles.cellsRow,
              {
                transform: [
                  {
                    translateX: shake.interpolate({ inputRange: [-1, 1], outputRange: [-6, 6] }),
                  },
                ],
              },
            ]}
          >
            {Array.from({ length: CELL_COUNT }).map((_, i) => {
              const char = code[i];
              const isFocusCell = i === code.length;
              return (
                <View key={i} style={[styles.cell, char ? styles.cellFilled : styles.cellEmpty, isFocusCell && styles.cellFocused]}>
                  {char ? <Text style={styles.cellText}>{char}</Text> : isFocusCell ? <View style={styles.caret} /> : null}
                </View>
              );
            })}
          </Animated.View>
        </Pressable>
        <TextInput
          ref={inputRef}
          value={code}
          onChangeText={onChangeCode}
          autoCapitalize="characters"
          autoCorrect={false}
          maxLength={CELL_COUNT}
          style={styles.hiddenInput}
          autoFocus
        />
        {error && <Text style={styles.error}>{error}</Text>}
      </View>

      <View style={[styles.pinned, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}>
        <Pressable onPress={goScan} style={({ pressed }) => [styles.scanButton, pressed && styles.scanButtonPressed]}>
          <Icon path={SCAN_ICON} color={colors.ink} size={18} strokeWidth={1.9} />
          <Text style={styles.scanLabel}>Scan their code</Text>
        </Pressable>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 26,
  },
  iconButton: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.ink,
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 14,
    elevation: 2,
  },
  sharePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#fff',
    borderRadius: radius.pill,
    paddingVertical: 12,
    paddingHorizontal: 18,
  },
  shareLabel: {
    fontFamily: fontFamily.sans600,
    fontSize: 13.5,
    color: colors.textPrimary,
  },
  body: {
    paddingHorizontal: 26,
    paddingTop: spacing.xl,
  },
  title: {
    fontFamily: fontFamily.sans700,
    fontSize: 31,
    lineHeight: 33.5,
    letterSpacing: -0.868,
    color: colors.textPrimary,
  },
  sub: {
    marginTop: 10,
    fontFamily: fontFamily.sans400,
    fontSize: 14,
    lineHeight: 20.3,
    color: colors.ink62,
  },
  qrPanel: {
    marginTop: 26,
    alignItems: 'center',
    gap: 9,
    backgroundColor: colors.ink,
    borderRadius: radius.organic,
    paddingTop: 26,
    paddingHorizontal: 26,
    paddingBottom: 22,
  },
  qrTile: {
    width: QR_BOX,
    height: QR_BOX,
    alignItems: 'center',
    justifyContent: 'center',
    padding: QR_PADDING,
    backgroundColor: '#fff',
    borderRadius: 24,
  },
  qrBadge: {
    position: 'absolute',
    width: 46,
    height: 46,
    borderRadius: 14,
    borderWidth: 5,
    borderColor: '#fff',
    backgroundColor: colors.lime,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  qrBadgeImage: {
    width: 46,
    height: 46,
  },
  qrEyebrow: {
    marginTop: spacing.sm,
    fontFamily: fontFamily.sans600,
    fontSize: 11.5,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    color: 'rgba(255,255,255,.5)',
  },
  qrCodeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  qrCode: {
    fontFamily: fontFamily.mono500,
    fontSize: 27,
    letterSpacing: 4.3,
    color: colors.lime,
  },
  copyButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(255,255,255,.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  copiedNote: {
    fontFamily: fontFamily.sans500,
    fontSize: 11.5,
    color: colors.lime,
  },
  dividerRow: {
    marginTop: 24,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.divider,
  },
  dividerLabel: {
    fontFamily: fontFamily.sans400,
    fontSize: 13,
    color: colors.ink55,
  },
  cellsPress: {
    marginTop: 20,
  },
  cellsRow: {
    flexDirection: 'row',
    gap: 9,
  },
  cell: {
    flex: 1,
    aspectRatio: 1 / 1.12,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cellFilled: {
    backgroundColor: '#fff',
    shadowColor: colors.ink,
    shadowOpacity: 0.07,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 12,
    elevation: 1,
  },
  cellEmpty: {
    backgroundColor: 'rgba(255,255,255,.6)',
  },
  cellFocused: {
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: colors.ink,
  },
  cellText: {
    fontFamily: fontFamily.mono500,
    fontSize: 24,
    color: colors.ink,
  },
  caret: {
    width: 2,
    height: 26,
    backgroundColor: colors.ink,
  },
  hiddenInput: {
    position: 'absolute',
    opacity: 0,
    height: 0,
    width: 0,
  },
  error: {
    fontFamily: fontFamily.sans500,
    fontSize: 12.5,
    color: colors.danger,
  },
  pinned: {
    paddingHorizontal: 26,
    paddingTop: spacing.ms,
  },
  scanButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    borderRadius: radius.pill,
    backgroundColor: colors.lime,
    paddingVertical: 19,
    shadowColor: '#7AA82C',
    shadowOpacity: 0.32,
    shadowOffset: { width: 0, height: 10 },
    shadowRadius: 24,
    elevation: 4,
  },
  scanButtonPressed: {
    opacity: 0.88,
  },
  scanLabel: {
    fontFamily: fontFamily.sans600,
    fontSize: 16,
    color: colors.ink,
  },
});
