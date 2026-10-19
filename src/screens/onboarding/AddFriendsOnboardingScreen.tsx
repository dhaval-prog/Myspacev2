import React, { useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';
import QRCode from 'react-native-qrcode-svg';
import { OnboardingBackButton, StickerButton } from '../../components/onboarding/StickerKit';
import { useFriends } from '../../context/FriendsContext';
import { FriendAvatar } from '../../components/friends/FriendAvatar';
import { obColor, obFont } from '../../theme/onboardingTokens';

const CELL_COUNT = 6;

interface AddFriendsOnboardingScreenProps {
  onBack: () => void;
  onDone: () => void;
}

/** 08 Add friends — own code + QR, and a 6-cell code entry for someone else's, both wired to the
 * app's real friend-request pipeline (FriendsContext's lookupCode/sendRequest — the same RPC the
 * live Add Friend screen already uses), not mock data. */
export function AddFriendsOnboardingScreen({ onBack, onDone }: AddFriendsOnboardingScreenProps) {
  const insets = useSafeAreaInsets();
  const { friendCode, matchFound, lookupCode, sendRequest } = useFriends();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [added, setAdded] = useState(false);
  const shake = useRef(new Animated.Value(0)).current;

  const submitCode = async (value: string) => {
    if (value.length !== CELL_COUNT || submitting) return;
    setSubmitting(true);
    setError(null);
    const result = await lookupCode(value, { navigate: false });
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
    setAdded(false);
    if (next.length === CELL_COUNT) submitCode(next);
  };

  const addMatch = async () => {
    const result = await sendRequest('');
    if (!result.error) setAdded(true);
  };

  const copyCode = async () => {
    if (!friendCode) return;
    await Clipboard.setStringAsync(friendCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <View style={[styles.screen, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 22 }]}>
      <View style={styles.header}>
        <OnboardingBackButton onPress={onBack} />
      </View>

      <Text style={styles.title}>Add a friend</Text>
      <Text style={styles.subtitle}>Let them scan your code, or type in the six characters they send you.</Text>

      <View style={styles.qrPanel}>
        <View style={styles.qrBox}>{friendCode ? <QRCode value={friendCode} size={140} /> : null}</View>
        <Text style={styles.qrLabel}>YOUR INVITE CODE</Text>
        <View style={styles.codeRow}>
          <Text style={styles.codeText}>{friendCode ? `${friendCode.slice(0, 3)} · ${friendCode.slice(3)}` : '— · —'}</Text>
          <Pressable onPress={copyCode} accessibilityRole="button" accessibilityLabel="Copy invite code" style={styles.copyButton}>
            <Text style={styles.copyButtonText}>{copied ? 'Copied' : 'Copy'}</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.dividerRow}>
        <View style={styles.dividerLine} />
        <Text style={styles.dividerText}>or add theirs</Text>
        <View style={styles.dividerLine} />
      </View>

      <Animated.View style={{ transform: [{ translateX: shake.interpolate({ inputRange: [-1, 1], outputRange: [-8, 8] }) }] }}>
        <View style={styles.cellsRow}>
          {Array.from({ length: CELL_COUNT }, (_, i) => (
            <View key={i} style={[styles.cell, code.length === i && styles.cellActive]}>
              <Text style={styles.cellText}>{code[i] ?? ''}</Text>
            </View>
          ))}
          <TextInput
            value={code}
            onChangeText={onChangeCode}
            maxLength={CELL_COUNT}
            autoCapitalize="characters"
            autoComplete="off"
            spellCheck={false}
            style={styles.hiddenInput}
            accessibilityLabel="Friend invite code"
          />
        </View>
      </Animated.View>
      {error && <Text style={styles.error}>{error}</Text>}

      {matchFound && !error && (
        <View style={styles.matchCard}>
          <FriendAvatar userId={matchFound.userId} name={matchFound.name} avatarUrl={matchFound.avatarUrl} size={46} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.matchName} numberOfLines={1}>{matchFound.name}</Text>
            {!!matchFound.username && <Text style={styles.matchHandle}>@{matchFound.username}</Text>}
          </View>
          {added ? (
            <View style={styles.addedPill}>
              <Text style={styles.addedPillText}>ADDED ✓</Text>
            </View>
          ) : (
            <Pressable onPress={addMatch} accessibilityRole="button" accessibilityLabel={`Add ${matchFound.name}`} style={styles.addPill}>
              <Text style={styles.addPillText}>Add</Text>
            </Pressable>
          )}
        </View>
      )}

      <View style={{ flex: 1 }} />

      <StickerButton label="Let's go" onPress={onDone} bg={obColor.ink} textColor={obColor.sunflower} shadowColor={obColor.tomato} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#C6E9A8', paddingHorizontal: 24 },
  header: { flexDirection: 'row' },
  title: { marginTop: 14, fontFamily: obFont.ui700, fontSize: 31, letterSpacing: -0.9, color: obColor.deepInk },
  subtitle: { marginTop: 8, fontFamily: obFont.ui500, fontSize: 14, lineHeight: 20, color: 'rgba(22,33,12,.62)' },
  qrPanel: { marginTop: 18, alignItems: 'center', gap: 8, borderRadius: 34, paddingVertical: 20, paddingHorizontal: 24, backgroundColor: 'rgba(22,33,12,.9)' },
  qrBox: { width: 164, height: 164, borderRadius: 22, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  qrLabel: { marginTop: 6, fontFamily: obFont.ui600, fontSize: 11.5, letterSpacing: 1.6, color: 'rgba(255,255,255,.5)' },
  codeRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  codeText: { fontFamily: obFont.dm500, fontSize: 24, letterSpacing: 3, color: obColor.lime },
  copyButton: { height: 32, paddingHorizontal: 12, borderRadius: 16, backgroundColor: 'rgba(255,255,255,.12)', alignItems: 'center', justifyContent: 'center' },
  copyButtonText: { fontFamily: obFont.ui600, fontSize: 12, color: obColor.lime },
  dividerRow: { marginTop: 20, flexDirection: 'row', alignItems: 'center', gap: 14 },
  dividerLine: { flex: 1, height: 1, backgroundColor: 'rgba(22,33,12,.1)' },
  dividerText: { fontSize: 13, color: 'rgba(22,33,12,.55)' },
  cellsRow: { marginTop: 14, flexDirection: 'row', gap: 9, position: 'relative' },
  cell: { flex: 1, height: 54, borderRadius: 18, backgroundColor: obColor.white, borderWidth: 1.5, borderColor: obColor.deepInk, alignItems: 'center', justifyContent: 'center' },
  cellActive: { borderWidth: 2, borderColor: obColor.cobalt },
  cellText: { fontFamily: obFont.dm500, fontSize: 24, color: obColor.deepInk },
  hiddenInput: { position: 'absolute', inset: 0, width: '100%', opacity: 0 },
  error: { marginTop: 10, fontFamily: obFont.ui600, fontSize: 13, color: obColor.tomato, textAlign: 'center' },
  matchCard: { marginTop: 14, flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 24, padding: 14, backgroundColor: 'rgba(255,255,255,.9)' },
  matchName: { fontFamily: obFont.ui600, fontSize: 15.5, color: obColor.deepInk },
  matchHandle: { fontFamily: obFont.ui500, fontSize: 12.5, color: 'rgba(22,33,12,.55)' },
  addPill: { borderRadius: 999, backgroundColor: obColor.lime, borderWidth: 1.5, borderColor: obColor.deepInk, paddingVertical: 8, paddingHorizontal: 16 },
  addPillText: { fontFamily: obFont.ui700, fontSize: 14, color: obColor.deepInk },
  addedPill: { borderRadius: 8, borderWidth: 2, borderColor: obColor.deepInk, backgroundColor: obColor.lime, paddingVertical: 4, paddingHorizontal: 9, transform: [{ rotate: '-8deg' }] },
  addedPillText: { fontFamily: obFont.dm500, fontSize: 11.5, letterSpacing: 1, color: obColor.deepInk },
});
