import React, { useState } from 'react';
import { Pressable, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { OnboardingBackButton } from '../../components/onboarding/StickerKit';
import { useAuth } from '../../context/AuthContext';
import { obColor, obFont } from '../../theme/onboardingTokens';

interface LoginIntercomScreenProps {
  onBack: () => void;
  onGoSignup: () => void;
}

/** 05 Log in — the intercom/buzzer panel: an LCD readout that echoes the email as it's typed, a
 * UNIT plate + status LED, and a round BUZZ button that submits, wired to real signIn()/
 * resetPassword(). "Remember me" is a local-only preference — Supabase already persists the
 * session via AsyncStorage regardless, so there's no separate backend toggle for it to drive. */
export function LoginIntercomScreen({ onBack, onGoSignup }: LoginIntercomScreenProps) {
  const insets = useSafeAreaInsets();
  const { signIn, resetPassword } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(true);
  const [loading, setLoading] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [emailFocused, setEmailFocused] = useState(false);

  const buzz = async () => {
    setError(null);
    setNotice(null);
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return setError('Enter a valid email address.');
    if (!password) return setError('Enter your password.');
    setLoading(true);
    const { error: signInError } = await signIn(email, password);
    setLoading(false);
    if (signInError) setError(signInError);
  };

  const forgot = async () => {
    setError(null);
    setNotice(null);
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      setError('Enter your email above first, then tap Forgot password.');
      return;
    }
    setResetting(true);
    const { error: resetError } = await resetPassword(email);
    setResetting(false);
    if (resetError) setError(resetError);
    else setNotice(`Password reset link sent to ${email.trim()}.`);
  };

  const lcdText = emailFocused || email ? email || 'type your email…' : 'ready when you are';

  return (
    <View style={[styles.screen, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 22 }]}>
      <View style={styles.header}>
        <OnboardingBackButton onPress={onBack} />
        <Text style={styles.knock}>knock knock…</Text>
      </View>

      <Text style={styles.title}>
        Buzz yourself{'\n'}
        <Text style={styles.titleHighlight}> back in. </Text>
      </Text>

      <View style={styles.panel}>
        <View style={[styles.screw, { left: 9, top: 9 }]} />
        <View style={[styles.screw, { right: 9, top: 9 }]} />
        <View style={[styles.screw, { left: 9, bottom: 9 }]} />
        <View style={[styles.screw, { right: 9, bottom: 9 }]} />

        <View style={styles.panelTopRow}>
          <View style={styles.speakerGrille} />
          <Text style={styles.unitLabel}>UNIT 214</Text>
          <View style={[styles.led, { backgroundColor: loading ? obColor.sunflower : '#5BC46A' }]} />
        </View>

        <View style={styles.lcd}>
          <Text style={styles.lcdText} numberOfLines={1}>{lcdText}</Text>
        </View>

        <View style={styles.fields}>
          <View>
            <Text style={styles.fieldLabel}>EMAIL</Text>
            <TextInput
              value={email}
              onChangeText={setEmail}
              onFocus={() => setEmailFocused(true)}
              onBlur={() => setEmailFocused(false)}
              placeholder="you@example.com"
              placeholderTextColor="rgba(17,17,17,.35)"
              keyboardType="email-address"
              autoComplete="email"
              textContentType="emailAddress"
              autoCapitalize="none"
              returnKeyType="next"
              style={styles.fieldInput}
              accessibilityLabel="Email address"
            />
          </View>
          <View>
            <Text style={styles.fieldLabel}>PASSWORD</Text>
            <TextInput
              value={password}
              onChangeText={setPassword}
              placeholder="••••••••"
              placeholderTextColor="rgba(17,17,17,.35)"
              secureTextEntry
              autoComplete="password"
              textContentType="password"
              returnKeyType="done"
              onSubmitEditing={buzz}
              style={styles.fieldInput}
              accessibilityLabel="Password"
            />
          </View>
        </View>

        <View style={styles.bottomRow}>
          <View style={{ gap: 10 }}>
            <View style={styles.rememberRow}>
              <Switch value={remember} onValueChange={setRemember} trackColor={{ true: obColor.cobalt, false: '#9a9ea7' }} thumbColor="#fff" />
              <Text style={styles.rememberText}>Remember me</Text>
            </View>
            <Pressable onPress={forgot} disabled={resetting} accessibilityRole="button" accessibilityLabel="Forgot password">
              <Text style={[styles.forgotText, resetting && { opacity: 0.6 }]}>{resetting ? 'Sending…' : 'Forgot password?'}</Text>
            </Pressable>
          </View>

          <Pressable
            onPress={buzz}
            disabled={loading}
            accessibilityRole="button"
            accessibilityLabel="Buzz in"
            style={({ pressed }) => [styles.buzzButton, pressed && styles.buzzButtonPressed]}
          >
            <Text style={styles.buzzButtonText}>{loading ? '…' : 'BUZZ'}</Text>
          </Pressable>
        </View>
      </View>

      {error && <Text style={styles.error}>{error}</Text>}
      {notice && <Text style={styles.notice}>{notice}</Text>}

      <View style={{ flex: 1 }} />

      <Text style={styles.footer}>
        New here?{' '}
        <Text onPress={onGoSignup} style={styles.footerLink}>
          Make a space
        </Text>
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: obColor.sunflower, paddingHorizontal: 22 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  knock: { fontFamily: obFont.hand700, fontSize: 22, color: obColor.ink, transform: [{ rotate: '-4deg' }] },
  title: { marginTop: 18, fontFamily: obFont.display800, fontSize: 44, lineHeight: 42, letterSpacing: -2, color: obColor.ink },
  titleHighlight: { backgroundColor: obColor.ink, color: obColor.sunflower, borderRadius: 14, overflow: 'hidden' },
  panel: {
    marginTop: 22,
    borderRadius: 26,
    borderWidth: 3,
    borderColor: obColor.ink,
    backgroundColor: '#dde0e6',
    padding: 18,
    shadowColor: '#111',
    shadowOffset: { width: 6, height: 6 },
    shadowOpacity: 1,
    shadowRadius: 0,
  },
  screw: { position: 'absolute', width: 12, height: 12, borderRadius: 6, backgroundColor: '#a9adb6', borderWidth: 1.5, borderColor: '#111' },
  panelTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 10 },
  speakerGrille: { width: 86, height: 26, borderRadius: 8, backgroundColor: '#2a2c31' },
  unitLabel: { fontFamily: obFont.mono700, fontSize: 11, letterSpacing: 2, color: '#6a6e77' },
  led: { width: 16, height: 16, borderRadius: 8, borderWidth: 2, borderColor: obColor.ink },
  lcd: { marginTop: 12, height: 52, borderRadius: 12, borderWidth: 2, borderColor: obColor.ink, backgroundColor: '#0f1d11', alignItems: 'flex-start', justifyContent: 'center', paddingHorizontal: 14, overflow: 'hidden' },
  lcdText: { fontFamily: obFont.mono700, fontSize: 15, color: '#A6FFA8' },
  fields: { marginTop: 14, gap: 10 },
  fieldLabel: { fontFamily: obFont.mono700, fontSize: 10, letterSpacing: 1.5, color: '#5d616a', paddingLeft: 4 },
  fieldInput: {
    marginTop: 4,
    borderWidth: 2,
    borderColor: obColor.ink,
    borderRadius: 12,
    backgroundColor: '#fff',
    fontFamily: obFont.display700,
    fontSize: 17,
    color: obColor.ink,
    paddingVertical: 9,
    paddingHorizontal: 12,
  },
  bottomRow: { marginTop: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  rememberRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rememberText: { fontFamily: obFont.ui700, fontSize: 13 },
  forgotText: { fontFamily: obFont.ui700, fontSize: 13, textDecorationLine: 'underline' },
  buzzButton: {
    width: 78,
    height: 78,
    borderRadius: 39,
    backgroundColor: obColor.tomato,
    borderWidth: 2.5,
    borderColor: obColor.ink,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#7d1a07',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 1,
    shadowRadius: 0,
  },
  buzzButtonPressed: { transform: [{ translateY: 5 }], shadowOffset: { width: 0, height: 0 } },
  buzzButtonText: { fontFamily: obFont.display800, fontSize: 17, color: '#fff' },
  error: { marginTop: 14, fontFamily: obFont.ui600, fontSize: 13, color: obColor.tomato, textAlign: 'center' },
  notice: { marginTop: 14, fontFamily: obFont.ui600, fontSize: 13, color: obColor.ink, textAlign: 'center' },
  footer: { textAlign: 'center', fontFamily: obFont.ui600, fontSize: 14, color: obColor.ink },
  footerLink: { fontFamily: obFont.ui700, textDecorationLine: 'underline' },
});
