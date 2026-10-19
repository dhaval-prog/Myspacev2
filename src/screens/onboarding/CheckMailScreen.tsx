import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StickerButton } from '../../components/onboarding/StickerKit';
import { useAuth } from '../../context/AuthContext';
import { obColor, obFont } from '../../theme/onboardingTokens';

const POLL_MS = 4000;

interface CheckMailScreenProps {
  email: string;
  password: string;
  /** Fires the moment signIn() actually succeeds (i.e. the confirmation link was clicked
   * somewhere, and this device now has a real session) — this is a real poll against Supabase,
   * not a timer, so it only ever advances once email confirmation genuinely went through. */
  onConfirmed: () => void;
}

/** 06 Check mail — a confirmation-required Supabase project has no session yet right after
 * signUp(), so this screen polls signIn() with the credentials already collected until the user
 * has actually clicked their confirmation link (wherever they read it), then auto-advances. */
export function CheckMailScreen({ email, password, onConfirmed }: CheckMailScreenProps) {
  const insets = useSafeAreaInsets();
  const { signIn, resendConfirmation } = useAuth();
  const [checking, setChecking] = useState(false);
  const [resent, setResent] = useState(false);
  const confirmedRef = useRef(false);

  const attempt = async () => {
    if (confirmedRef.current) return;
    setChecking(true);
    const { error } = await signIn(email, password);
    setChecking(false);
    if (!error) {
      confirmedRef.current = true;
      onConfirmed();
    }
  };

  useEffect(() => {
    const id = setInterval(attempt, POLL_MS);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <View style={[styles.screen, { paddingTop: insets.top + 58, paddingBottom: insets.bottom + 24 }]}>
      <View style={styles.envelope}>
        <View style={styles.letter}>
          <Text style={styles.letterLabel}>MYSPACE · CONFIRM</Text>
          <Text style={styles.letterGreeting}>hi there!</Text>
          <View style={styles.letterBar} />
        </View>
        <View style={styles.flap} />
      </View>

      <Text style={styles.title}>You&apos;ve got{'\n'}mail!</Text>
      <Text style={styles.sub}>
        We sent a confirmation link to{'\n'}
        <Text style={{ fontFamily: obFont.ui700 }}>{email}</Text>
      </Text>

      <View style={{ flex: 1 }} />

      <StickerButton label={checking ? '' : "I've confirmed — let me in"} onPress={attempt} bg="#fff" textColor={obColor.ink} loading={checking} icon="none" />
      <Text
        onPress={async () => {
          setResent(false);
          const { error } = await resendConfirmation(email);
          if (!error) setResent(true);
        }}
        style={styles.resendText}
      >
        {resent ? 'Sent again ✓' : 'Nothing yet? Send again'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: obColor.tomato, paddingHorizontal: 22, alignItems: 'center' },
  envelope: { marginTop: 40, width: 220, height: 160 },
  letter: {
    position: 'absolute',
    left: 14,
    right: 14,
    top: 10,
    height: 130,
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: obColor.ink,
    borderRadius: 8,
    padding: 12,
  },
  letterLabel: { fontFamily: obFont.mono700, fontSize: 9, color: obColor.ink },
  letterGreeting: { marginTop: 4, fontFamily: obFont.hand700, fontSize: 22, color: obColor.ink },
  letterBar: { marginTop: 8, width: 90, height: 18, borderRadius: 6, backgroundColor: obColor.cobalt, borderWidth: 2, borderColor: obColor.ink },
  flap: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 30,
    height: 90,
    backgroundColor: '#E9C893',
    borderWidth: 3,
    borderColor: obColor.ink,
    borderRadius: 10,
    transform: [{ scaleY: 0.72 }, { rotate: '0deg' }],
  },
  title: { marginTop: 40, fontFamily: obFont.display800, fontSize: 42, lineHeight: 42, letterSpacing: -1.6, color: '#fff', textAlign: 'center' },
  sub: { marginTop: 16, fontFamily: obFont.ui600, fontSize: 14.5, lineHeight: 21, color: 'rgba(17,17,17,.75)', textAlign: 'center' },
  resendText: { marginTop: 14, fontFamily: obFont.ui700, fontSize: 14, color: obColor.ink, textAlign: 'center' },
});
