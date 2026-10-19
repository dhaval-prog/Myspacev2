import React, { useEffect, useRef, useState } from 'react';
import { Animated, Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { OnboardingBackButton } from '../../components/onboarding/StickerKit';
import { useAuth } from '../../context/AuthContext';
import { obColor, obFont } from '../../theme/onboardingTokens';

type StepKey = 'name' | 'email' | 'password';

const STEPS: { key: StepKey; question: string; placeholder: string; keyboard?: 'email-address'; secure?: boolean }[] = [
  { key: 'name', question: "Hey! I'm the myspace bot 👋 What should your friends call you?", placeholder: 'Full name' },
  { key: 'email', question: 'Nice to meet you! What email do you want your space tied to?', placeholder: 'Email address', keyboard: 'email-address' },
  { key: 'password', question: 'Last one — pick a password (6+ characters).', placeholder: 'Password', secure: true },
];

interface ChatMessage {
  id: string;
  from: 'bot' | 'user';
  text: string;
}

export interface SignUpAnswers {
  fullName: string;
  email: string;
  password: string;
}

interface SignUpChatScreenProps {
  onBack: () => void;
  onGoLogin: () => void;
  /** Fires once name + email + password are all collected and validated — the avatar screen
   * actually calls signUp() with these once the user also picks a look. */
  onDone: (answers: SignUpAnswers) => void;
}

function isValidEmail(v: string) {
  return /^\S+@\S+\.\S+$/.test(v.trim());
}

/** 03 Sign up — one question at a time, chat-style, mirroring the handoff's "myspace bot"
 * conversation exactly (name → email → password) rather than a traditional stacked form. */
export function SignUpChatScreen({ onBack, onGoLogin, onDone }: SignUpChatScreenProps) {
  const insets = useSafeAreaInsets();
  const { signInWithOAuth } = useAuth();
  const [stepIdx, setStepIdx] = useState(0);
  const [messages, setMessages] = useState<ChatMessage[]>([{ id: 'q0', from: 'bot', text: STEPS[0].question }]);
  const [draft, setDraft] = useState('');
  const [typing, setTyping] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [oauthError, setOauthError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const answersRef = useRef<Partial<SignUpAnswers>>({});
  const ctaAnim = useRef(new Animated.Value(0)).current;

  const step = STEPS[stepIdx];

  const pushMessage = (m: ChatMessage) => setMessages((prev) => [...prev, m]);

  const advance = (value: string) => {
    const display = step.secure ? '•'.repeat(value.length) : value;
    pushMessage({ id: `a${stepIdx}`, from: 'user', text: display });
    if (step.key === 'name') answersRef.current.fullName = value.trim();
    if (step.key === 'email') answersRef.current.email = value.trim();
    if (step.key === 'password') answersRef.current.password = value;
    setDraft('');

    const next = stepIdx + 1;
    if (next < STEPS.length) {
      setTyping(true);
      setTimeout(() => {
        setTyping(false);
        pushMessage({ id: `q${next}`, from: 'bot', text: STEPS[next].question });
        setStepIdx(next);
      }, 650);
    } else {
      setTyping(true);
      setTimeout(() => {
        setTyping(false);
        setDone(true);
        Animated.spring(ctaAnim, { toValue: 1, friction: 6, tension: 90, useNativeDriver: true }).start();
      }, 650);
    }
  };

  useEffect(() => {
    scrollRef.current?.scrollToEnd({ animated: true });
  }, [messages, typing, done]);

  const submit = () => {
    setError(null);
    const value = draft.trim();
    if (step.key === 'name' && !value) return setError('Tell me your name first.');
    if (step.key === 'email' && !isValidEmail(value)) return setError('That doesn’t look like a valid email.');
    if (step.key === 'password' && draft.length < 6) return setError('6 characters minimum.');
    advance(step.key === 'password' ? draft : value);
  };

  const finish = () => {
    const a = answersRef.current;
    if (a.fullName && a.email && a.password) onDone({ fullName: a.fullName, email: a.email, password: a.password });
  };

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <OnboardingBackButton onPress={onBack} />
        <View style={styles.botBadge}>
          <Image source={require('../../../assets/icon.png')} style={styles.botBadgeImg} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.botName}>myspace</Text>
          <View style={styles.statusRow}>
            <View style={styles.statusDot} />
            <Text style={styles.statusText}>{done ? 'all set' : 'typing a question…'}</Text>
          </View>
        </View>
        <View style={styles.progressTag}>
          <Text style={styles.progressTagText}>{Math.min(stepIdx + 1, STEPS.length)}/{STEPS.length}</Text>
        </View>
      </View>

      <ScrollView ref={scrollRef} style={styles.thread} contentContainerStyle={styles.threadContent}>
        {messages.map((m) => (
          <View key={m.id} style={[styles.bubbleRow, { justifyContent: m.from === 'bot' ? 'flex-start' : 'flex-end' }]}>
            <View style={[styles.bubble, m.from === 'bot' ? styles.bubbleBot : styles.bubbleUser]}>
              <Text style={[styles.bubbleText, m.from === 'user' && styles.bubbleTextUser]}>{m.text}</Text>
            </View>
          </View>
        ))}
        {typing && (
          <View style={[styles.bubbleRow, { justifyContent: 'flex-start' }]}>
            <View style={[styles.bubble, styles.bubbleBot, styles.typingBubble]}>
              <Text style={styles.bubbleText}>•••</Text>
            </View>
          </View>
        )}
        {done && (
          <Animated.View style={{ marginTop: 6, opacity: ctaAnim, transform: [{ scale: ctaAnim }] }}>
            <Pressable onPress={finish} accessibilityRole="button" accessibilityLabel="Pick my look" style={styles.ctaButton}>
              <Text style={styles.ctaButtonLabel}>Pick my look</Text>
              <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
                <Path d="M5 12h14M13 6l6 6-6 6" stroke="#fff" strokeWidth={2.8} strokeLinecap="round" strokeLinejoin="round" />
              </Svg>
            </Pressable>
          </Animated.View>
        )}
      </ScrollView>

      {!done && (
        <View style={[styles.composerWrap, { paddingBottom: insets.bottom + 18 }]}>
          {(error || oauthError) && <Text style={styles.errorText}>{error ?? oauthError}</Text>}
          <View style={styles.quickRow}>
            <Pressable
              onPress={async () => {
                setOauthError(null);
                const { error: oerr } = await signInWithOAuth('google');
                if (oerr) setOauthError(oerr);
              }}
              accessibilityRole="button"
              accessibilityLabel="Use Google"
              style={styles.quickChip}
            >
              <Text style={styles.quickChipText}>Use Google</Text>
            </Pressable>
            <Pressable onPress={onGoLogin} accessibilityRole="button" accessibilityLabel="I have an account" style={styles.quickChip}>
              <Text style={styles.quickChipText}>I have an account</Text>
            </Pressable>
          </View>
          <View style={styles.composerRow}>
            <View style={styles.composerField}>
              <Text style={styles.composerLabel}>{step.key.toUpperCase()}</Text>
              <TextInput
                value={draft}
                onChangeText={setDraft}
                placeholder={step.placeholder}
                placeholderTextColor="rgba(17,17,17,.35)"
                keyboardType={step.keyboard}
                secureTextEntry={step.secure}
                autoCapitalize={step.key === 'name' ? 'words' : 'none'}
                autoComplete={step.key === 'email' ? 'email' : step.key === 'password' ? 'password-new' : 'name'}
                returnKeyType="done"
                onSubmitEditing={submit}
                style={styles.composerInput}
                accessibilityLabel={step.placeholder}
              />
            </View>
            <Pressable onPress={submit} accessibilityRole="button" accessibilityLabel="Send" style={styles.sendButton}>
              <Svg width={22} height={22} viewBox="0 0 64 64">
                <Path d="M4 30 L60 8 L38 58 L30 36 Z" fill="#fff" stroke="#111" strokeWidth={4} strokeLinejoin="round" />
                <Path d="M30 36 L60 8 L22 40 Z" fill={obColor.sunflower} stroke="#111" strokeWidth={4} strokeLinejoin="round" />
              </Svg>
            </Pressable>
          </View>
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: obColor.paper },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 22, paddingBottom: 12, borderBottomWidth: 2, borderColor: obColor.ink, backgroundColor: 'rgba(244,239,227,.92)' },
  botBadge: { width: 42, height: 42, borderRadius: 13, borderWidth: 2, borderColor: obColor.ink, backgroundColor: obColor.sunflower, overflow: 'hidden', transform: [{ rotate: '-6deg' }] },
  botBadgeImg: { width: '100%', height: '100%' },
  botName: { fontFamily: obFont.display800, fontSize: 18, color: obColor.ink },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 },
  statusDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#3FAE63' },
  statusText: { fontFamily: obFont.ui500, fontSize: 12.5, color: obColor.inkMute },
  progressTag: { backgroundColor: obColor.sunflower, borderWidth: 2, borderColor: obColor.ink, borderRadius: 999, paddingVertical: 4, paddingHorizontal: 9 },
  progressTagText: { fontFamily: obFont.mono700, fontSize: 11, color: obColor.ink },
  thread: { flex: 1 },
  threadContent: { padding: 18, paddingBottom: 24, flexGrow: 1, justifyContent: 'flex-end', gap: 8 },
  bubbleRow: { flexDirection: 'row' },
  bubble: { maxWidth: '78%', borderWidth: 2, borderColor: obColor.ink, borderRadius: 18, paddingVertical: 9, paddingHorizontal: 13 },
  bubbleBot: { backgroundColor: '#fff', borderBottomLeftRadius: 4 },
  bubbleUser: { backgroundColor: obColor.cobalt, borderBottomRightRadius: 4 },
  bubbleText: { fontFamily: obFont.ui600, fontSize: 15.5, lineHeight: 21, color: obColor.ink },
  bubbleTextUser: { color: '#fff' },
  typingBubble: { paddingVertical: 12 },
  ctaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 10,
    borderRadius: 18,
    backgroundColor: obColor.cobalt,
    borderWidth: 2,
    borderColor: obColor.ink,
    paddingVertical: 13,
    paddingHorizontal: 18,
    shadowColor: '#111',
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
  },
  ctaButtonLabel: { fontFamily: obFont.display800, fontSize: 18, color: '#fff' },
  composerWrap: { paddingHorizontal: 18, paddingTop: 10, borderTopWidth: 2, borderColor: obColor.ink, backgroundColor: '#fff' },
  errorText: { fontFamily: obFont.ui600, fontSize: 13, color: obColor.tomato, marginBottom: 8, textAlign: 'center' },
  quickRow: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  quickChip: { borderWidth: 2, borderColor: obColor.ink, borderRadius: 999, paddingVertical: 6, paddingHorizontal: 12, backgroundColor: obColor.paper },
  quickChipText: { fontFamily: obFont.ui700, fontSize: 13, color: obColor.ink },
  composerRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  composerField: { flex: 1, minWidth: 0, borderWidth: 2, borderColor: obColor.ink, borderRadius: 18, backgroundColor: obColor.cardBg, paddingHorizontal: 14, paddingTop: 6, paddingBottom: 8 },
  composerLabel: { fontFamily: obFont.mono700, fontSize: 10, letterSpacing: 1, color: obColor.inkMute },
  composerInput: { fontFamily: obFont.display700, fontSize: 18, color: obColor.ink, padding: 0, marginTop: 2 },
  sendButton: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: obColor.cobalt,
    borderWidth: 2,
    borderColor: obColor.ink,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#111',
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
  },
});
