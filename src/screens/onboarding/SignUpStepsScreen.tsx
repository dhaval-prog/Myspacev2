import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Path } from 'react-native-svg';
import { useAuth } from '../../context/AuthContext';
import { obColor, obFont } from '../../theme/onboardingTokens';

type StepKey = 'name' | 'email' | 'password';

const STEPS: { key: StepKey; chipLabel: string; kicker: string; question: string; placeholder: string; helper: string; keyboard?: 'email-address'; secure?: boolean }[] = [
  { key: 'name', chipLabel: 'NAME', kicker: 'STEP 1 · NAME', question: 'What should friends call you?', placeholder: 'Your name', helper: "This is how you'll show up in chats." },
  {
    key: 'email',
    chipLabel: 'EMAIL',
    kicker: 'STEP 2 · EMAIL',
    question: "What's your email?",
    placeholder: 'you@example.com',
    helper: "We'll send a magic link to check it's you.",
    keyboard: 'email-address',
  },
  {
    key: 'password',
    chipLabel: 'PASSWORD',
    kicker: 'STEP 3 · PASSWORD',
    question: 'Pick a password',
    placeholder: '8+ characters',
    helper: 'Make it sneaky. You can change it later.',
    secure: true,
  },
];

export interface SignUpAnswers {
  fullName: string;
  email: string;
  password: string;
}

interface SignUpStepsScreenProps {
  onBack: () => void;
  onGoLogin: () => void;
  onDone: (answers: SignUpAnswers) => void;
}

function isValidEmail(v: string) {
  return /^\S+@\S+\.\S+$/.test(v.trim());
}

function passwordStrength(pw: string): number {
  let score = 0;
  if (pw.length >= 8) score++;
  if (pw.length >= 12) score++;
  if (/[0-9]/.test(pw) && /[a-zA-Z]/.test(pw)) score++;
  if (/[^a-zA-Z0-9]/.test(pw)) score++;
  return score;
}

const STRENGTH_LABEL = ['TOO SHORT', 'WEAK', 'DECENT', 'SNEAKY', 'SNEAKY'];
const STRENGTH_COLOR = ['rgba(22,33,12,.12)', obColor.tomato, obColor.sunflower, '#8FBF5A', '#3FAE63'];

const PASSWORD_MIN_LENGTH = 8;

function isStepValid(key: StepKey, value: string): boolean {
  if (key === 'name') return value.trim().length > 0;
  if (key === 'email') return isValidEmail(value);
  return value.length >= PASSWORD_MIN_LENGTH;
}

function errorMessage(key: StepKey): string {
  if (key === 'name') return 'Tell us your name first.';
  if (key === 'email') return "That doesn't look like a valid email.";
  return `Needs at least ${PASSWORD_MIN_LENGTH} characters.`;
}

/** 03 Sign up — one question per screen (name → email → password), a 3-segment progress bar, a
 * big bold question with a single pill input + validation checkmark, matching the handoff's
 * "isSignupA" reference exactly (not the alternate chat-bot-conversation exploration also in that
 * same handoff file). */
export function SignUpStepsScreen({ onBack, onGoLogin, onDone }: SignUpStepsScreenProps) {
  const insets = useSafeAreaInsets();
  const { signInWithOAuth } = useAuth();
  const [stepIdx, setStepIdx] = useState(0);
  const [values, setValues] = useState<Record<StepKey, string>>({ name: '', email: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [oauthError, setOauthError] = useState<string | null>(null);

  const step = STEPS[stepIdx];
  const value = values[step.key];
  const valid = isStepValid(step.key, value);
  const liveError = value.length > 0 && !valid ? errorMessage(step.key) : null;

  const setValue = (v: string) => {
    setValues((prev) => ({ ...prev, [step.key]: v }));
  };

  const back = () => {
    if (stepIdx === 0) {
      onBack();
      return;
    }
    setStepIdx((i) => i - 1);
  };

  const next = () => {
    if (!valid) return;
    if (stepIdx < STEPS.length - 1) {
      setStepIdx((i) => i + 1);
      return;
    }
    onDone({ fullName: values.name.trim(), email: values.email.trim(), password: values.password });
  };

  const strength = step.key === 'password' ? passwordStrength(value) : 0;

  return (
    <View style={[styles.screen, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 22 }]}>
      <View style={styles.header}>
        <Pressable onPress={back} accessibilityRole="button" accessibilityLabel="Back" style={styles.backButton}>
          <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
            <Path d="M15 5l-7 7 7 7" stroke={obColor.deepInk} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
        </Pressable>
        <View style={styles.segments}>
          {STEPS.map((s, i) => (
            <View key={s.key} style={styles.segmentTrack}>
              <View style={[styles.segmentFill, { width: i <= stepIdx ? '100%' : '0%' }]} />
            </View>
          ))}
        </View>
        <Text style={styles.counter}>{stepIdx + 1} / {STEPS.length}</Text>
      </View>

      {stepIdx > 0 && (
        <View style={styles.answerChips}>
          {STEPS.slice(0, stepIdx).map((s, i) => (
            <Pressable key={s.key} onPress={() => setStepIdx(i)} accessibilityRole="button" accessibilityLabel={`Edit ${s.chipLabel.toLowerCase()}`} style={styles.answerChip}>
              <Text style={styles.answerChipLabel}>{s.chipLabel}</Text>
              <Text style={styles.answerChipValue} numberOfLines={1}>{values[s.key]}</Text>
              <Svg width={12} height={12} viewBox="0 0 24 24" fill="none">
                <Path d="M12 20h9 M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4L16.5 3.5z" stroke={obColor.deepInk} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
              </Svg>
            </Pressable>
          ))}
        </View>
      )}

      <Text style={styles.kicker}>{step.kicker}</Text>
      <Text style={styles.question}>{step.question}</Text>

      <View style={styles.inputRow}>
        <TextInput
          value={value}
          onChangeText={setValue}
          placeholder={step.placeholder}
          placeholderTextColor="rgba(22,33,12,.35)"
          keyboardType={step.keyboard}
          secureTextEntry={step.secure && !showPassword}
          autoCapitalize={step.key === 'name' ? 'words' : 'none'}
          autoComplete={step.key === 'email' ? 'email' : step.key === 'password' ? 'password-new' : 'name'}
          returnKeyType="next"
          onSubmitEditing={next}
          style={styles.input}
          accessibilityLabel={step.placeholder}
        />
        {step.secure && (
          <Pressable onPress={() => setShowPassword((s) => !s)} accessibilityRole="button" accessibilityLabel={showPassword ? 'Hide password' : 'Show password'} style={styles.eyeButton}>
            <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
              {showPassword ? (
                <Path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z M12 15a3 3 0 100-6 3 3 0 000 6z" stroke={obColor.deepInk} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
              ) : (
                <Path d="M3 3l18 18 M10.6 10.7a3 3 0 004.1 4.1 M7.4 7.3C4.7 8.8 3 11.5 3 12s3.5 7 10 7c1.8 0 3.3-.4 4.6-1.1M12 5c6.5 0 10 7 10 7a15 15 0 01-2.2 3" stroke={obColor.deepInk} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
              )}
            </Svg>
          </Pressable>
        )}
        {valid && (
          <View style={styles.checkCircle}>
            <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
              <Path d="M5 12.5 10 17.5 19 7" stroke={obColor.deepInk} strokeWidth={2.8} strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
          </View>
        )}
      </View>

      {step.key === 'password' && value.length > 0 && (
        <View style={styles.strengthRow}>
          <View style={styles.strengthBars}>
            {[0, 1, 2, 3].map((i) => (
              <View key={i} style={[styles.strengthBar, { backgroundColor: i < strength ? STRENGTH_COLOR[strength] : 'rgba(22,33,12,.12)' }]} />
            ))}
          </View>
          <Text style={styles.strengthLabel}>{STRENGTH_LABEL[strength]}</Text>
        </View>
      )}

      {liveError ? <Text style={styles.helperError}>{liveError}</Text> : <Text style={styles.helper}>{step.helper}</Text>}

      <View style={{ flex: 1 }} />

      {(() => {
        const label = stepIdx === STEPS.length - 1 ? 'Create my space' : 'Continue';
        return (
          <Pressable
            onPress={next}
            disabled={!valid}
            accessibilityRole="button"
            accessibilityLabel={label}
            style={({ pressed }) => [styles.continueButton, pressed && valid && styles.continueButtonPressed, !valid && styles.continueButtonDisabled]}
          >
            <Text style={[styles.continueLabel, !valid && styles.continueLabelDisabled]}>{label}</Text>
            <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
              <Path d="M5 12h14M13 6l6 6-6 6" stroke={valid ? obColor.deepInk : 'rgba(22,33,12,.35)'} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
          </Pressable>
        );
      })()}

      <View style={styles.dividerRow}>
        <View style={styles.dividerLine} />
        <Text style={styles.dividerText}>or</Text>
        <View style={styles.dividerLine} />
      </View>

      {(oauthError) && <Text style={styles.helperError}>{oauthError}</Text>}
      <View style={styles.socialRow}>
        <Pressable
          onPress={async () => {
            setOauthError(null);
            const { error: oerr } = await signInWithOAuth('google');
            if (oerr) setOauthError(oerr);
          }}
          accessibilityRole="button"
          accessibilityLabel="Use Google"
          style={styles.socialButton}
        >
          <Svg width={16} height={16} viewBox="0 0 48 48">
            <Path fill="#4285F4" d="M45.1 24.5c0-1.6-.1-2.8-.4-4.1H24v7.8h11.9c-.2 2-1.5 4.9-4.4 6.9l6.4 4.9c4.1-3.8 6.9-9.4 6.9-15.5z" />
            <Path fill="#34A853" d="M24 46c5.9 0 10.8-1.9 14.2-5.3l-6.8-5.2c-1.8 1.3-4.3 2.2-7.4 2.2-5.7 0-10.6-3.8-12.3-9l-6.9 5.4C8 41.3 15.4 46 24 46z" />
            <Path fill="#FBBC05" d="M11.7 28.7c-.5-1.4-.7-2.9-.7-4.7s.3-3.3.7-4.7l-6.9-5.4C3.1 16.9 2 20.3 2 24s1.1 7.1 2.8 10.1l6.9-5.4z" />
            <Path fill="#EA4335" d="M24 10.1c4 0 6.7 1.7 8.3 3.2l6-5.9C34.7 4 29.9 2 24 2 15.4 2 8 6.7 4.8 13.9l6.9 5.4C13.4 14 18.3 10.1 24 10.1z" />
          </Svg>
          <Text style={styles.socialButtonText}>Use Google</Text>
        </Pressable>
        <Pressable onPress={onGoLogin} accessibilityRole="button" accessibilityLabel="I have an account" style={styles.socialButton}>
          <Text style={styles.socialButtonText}>I have an account</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: obColor.sage, paddingHorizontal: 24 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  backButton: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,.7)', borderWidth: 1, borderColor: 'rgba(255,255,255,.8)', alignItems: 'center', justifyContent: 'center' },
  segments: { flex: 1, flexDirection: 'row', gap: 6 },
  segmentTrack: { flex: 1, height: 8, borderRadius: 4, backgroundColor: 'rgba(22,33,12,.1)', overflow: 'hidden' },
  segmentFill: { height: '100%', backgroundColor: obColor.deepInk, borderRadius: 4 },
  counter: { fontFamily: obFont.dm500, fontSize: 12, color: 'rgba(22,33,12,.6)' },
  answerChips: { marginTop: 18, flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  answerChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    maxWidth: 160,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,.6)',
    borderWidth: 1,
    borderColor: 'rgba(22,33,12,.1)',
  },
  answerChipLabel: { fontFamily: obFont.dm500, fontSize: 10, letterSpacing: 1, color: 'rgba(22,33,12,.45)' },
  answerChipValue: { flexShrink: 1, fontFamily: obFont.ui600, fontSize: 12.5, color: obColor.deepInk },
  kicker: { marginTop: 24, fontFamily: obFont.dm500, fontSize: 11, letterSpacing: 1.5, color: 'rgba(22,33,12,.5)' },
  question: { marginTop: 8, fontFamily: obFont.ui700, fontSize: 31, lineHeight: 34, letterSpacing: -0.9, color: obColor.deepInk },
  inputRow: { marginTop: 22, flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#fff', borderRadius: 24, paddingVertical: 6, paddingHorizontal: 8, paddingLeft: 20 },
  input: { flex: 1, minWidth: 0, height: 54, fontFamily: obFont.ui600, fontSize: 20, color: obColor.deepInk },
  eyeButton: { width: 42, height: 42, borderRadius: 21, backgroundColor: 'rgba(22,33,12,.06)', alignItems: 'center', justifyContent: 'center' },
  checkCircle: { width: 42, height: 42, borderRadius: 21, backgroundColor: obColor.lime, borderWidth: 1.5, borderColor: obColor.deepInk, alignItems: 'center', justifyContent: 'center' },
  strengthRow: { marginTop: 14, flexDirection: 'row', alignItems: 'center', gap: 10 },
  strengthBars: { flex: 1, flexDirection: 'row', gap: 5 },
  strengthBar: { flex: 1, height: 6, borderRadius: 3 },
  strengthLabel: { fontFamily: obFont.dm500, fontSize: 11, letterSpacing: 1, color: obColor.deepInk, minWidth: 62, textAlign: 'right' },
  helper: { marginTop: 12, fontSize: 13.5, lineHeight: 19, color: 'rgba(22,33,12,.6)' },
  helperError: { marginTop: 12, fontSize: 13.5, lineHeight: 19, color: obColor.tomato },
  continueButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    borderRadius: 999,
    backgroundColor: obColor.lime,
    paddingVertical: 18,
  },
  continueButtonPressed: { transform: [{ translateX: 3 }, { translateY: 3 }] },
  continueButtonDisabled: { backgroundColor: 'rgba(22,33,12,.08)' },
  continueLabel: { fontFamily: obFont.ui700, fontSize: 16.5, color: obColor.deepInk },
  continueLabelDisabled: { color: 'rgba(22,33,12,.35)' },
  dividerRow: { marginTop: 16, flexDirection: 'row', alignItems: 'center', gap: 12 },
  dividerLine: { flex: 1, height: 1, backgroundColor: 'rgba(22,33,12,.12)' },
  dividerText: { fontSize: 12.5, color: 'rgba(22,33,12,.5)' },
  socialRow: { marginTop: 12, flexDirection: 'row', gap: 10 },
  socialButton: {
    flex: 1,
    height: 50,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,.75)',
    borderWidth: 1.5,
    borderColor: obColor.deepInk,
  },
  socialButtonText: { fontFamily: obFont.ui600, fontSize: 14.5, color: obColor.deepInk },
});
