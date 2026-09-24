import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Clipboard from 'expo-clipboard';
import * as ImagePicker from 'expo-image-picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DropBackdrop } from '../../components/drop/DropBackdrop';
import { DropCard } from '../../components/drop/DropCard';
import { DropPress } from '../../components/drop/DropPress';
import { DropBtn } from '../../components/drop/DropBtn';
import { DropTopBar } from '../../components/drop/DropTopBar';
import { Kick, Serif } from '../../components/drop/DropText';
import { useDrop } from '../../context/DropContext';
import type { RefocusOutcome } from '../../types/drop';
import { dpColor, dpFont, dpGradient, dpSpace } from '../../theme/dropTokens';

const STEMS = ['She said ', 'I let it go when ', 'The second time I ', 'I felt like the one who '];
const WORKING_STAGES = ['Hearing you', "Finding what's underneath", 'Looking for a bridge'];
const WORKING_CONSIDERED = 'A considered answer, not a fast one.';
const AI_DISCLOSURE = "Written by AI, and it reads like it cares, but it isn't a person.";
const THERAPY_DISCLAIMER = "Refocus helps you talk it through, it isn't therapy. For the heavy stuff, please reach for a real pro. 🤍";

type Step = 'capture' | 'working' | 'result' | 'error' | 'safety';

interface DropRefocusScreenProps {
  onBack: () => void;
  onOpenLoveMap: () => void;
}

/** Parallax's live "One Side" flow: one account, one read — reads what happened once and returns an editable bridge sentence, or an honest "let this one go." */
export function DropRefocusScreen({ onBack, onOpenLoveMap }: DropRefocusScreenProps) {
  const insets = useSafeAreaInsets();
  const { callRefocusRead, transcribeScreenshot, persistRefocus, addPrivateLearning } = useDrop();

  const [step, setStep] = useState<Step>('capture');
  const [text, setText] = useState('');
  const [pastedChat, setPastedChat] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<RefocusOutcome | null>(null);
  const [stage, setStage] = useState(0);
  const [showEscape, setShowEscape] = useState(false);
  const [editableBridge, setEditableBridge] = useState('');
  const [edited, setEdited] = useState(false);
  const [copied, setCopied] = useState(false);
  const [savedToLoveMap, setSavedToLoveMap] = useState(false);
  const [readingScreenshot, setReadingScreenshot] = useState(false);
  const [screenshotMiss, setScreenshotMiss] = useState(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const runRead = async (userText: string, chat: string | null) => {
    setStep('working');
    setStage(0);
    setShowEscape(false);
    timers.current.push(setTimeout(() => setStage(1), 8000));
    timers.current.push(setTimeout(() => setStage(2), 15000));
    timers.current.push(setTimeout(() => setShowEscape(true), 40000));

    const result = await callRefocusRead(userText, chat ?? undefined);
    timers.current.forEach(clearTimeout);

    if (!result) {
      setStep('error');
      return;
    }
    setOutcome(result);
    if ('safety' in result) {
      setStep('safety');
    } else {
      setEditableBridge(result.read.bridge);
      setEdited(false);
      setCopied(false);
      setSavedToLoveMap(false);
      setStep('result');
      await persistRefocus(userText.slice(0, 64) || 'a moment to untangle', userText, result);
    }
  };

  const handleReadIt = () => {
    if (!text.trim() && !pastedChat) return;
    runRead(text.trim(), pastedChat);
  };

  const handlePasteChat = async () => {
    const raw = await Clipboard.getStringAsync();
    if (!raw.trim()) return;
    const lineCount = raw.split('\n').filter((l) => l.trim()).length;
    if (lineCount >= 2) {
      setPastedChat(raw);
    } else {
      setText((prev) => (prev ? `${prev}\n${raw}` : raw));
    }
  };

  const handleAddScreenshot = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;
    const result = await ImagePicker.launchImageLibraryAsync({ base64: true, quality: 0.7 });
    if (result.canceled || !result.assets?.[0]?.base64) return;
    setReadingScreenshot(true);
    setScreenshotMiss(false);
    const mediaType = result.assets[0].mimeType ?? 'image/jpeg';
    const lines = await transcribeScreenshot(result.assets[0].base64, mediaType);
    setReadingScreenshot(false);
    if (!lines || lines.length === 0) {
      setScreenshotMiss(true);
      return;
    }
    setPastedChat(lines.map((l) => `${l.who === 'me' ? 'Me' : 'Them'}: ${l.text}`).join('\n'));
  };

  const handleSaveToLoveMap = async () => {
    if (!outcome || 'safety' in outcome) return;
    await addPrivateLearning(outcome.read.underneath);
    setSavedToLoveMap(true);
  };

  const reset = () => {
    setStep('capture');
    setText('');
    setPastedChat(null);
    setOutcome(null);
    setScreenshotMiss(false);
  };

  return (
    <LinearGradient colors={dpGradient.dawn.colors} locations={dpGradient.dawn.locations} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.screen}>
      <DropBackdrop />
      <DropTopBar title="refocus" onBack={onBack} />
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + 52 + 24, paddingBottom: insets.bottom + 60 }]} showsVerticalScrollIndicator={false}>
        {step === 'capture' && (
          <>
            <Serif s={text ? 26 : 34} style={{ marginBottom: text ? 8 : 4 }}>
              What happened?
            </Serif>
            {!text && !pastedChat && <Text style={styles.firstLine}>Say it or type it. It stays yours.</Text>}
            <TextInput
              value={text}
              onChangeText={setText}
              placeholder="Fragments are fine."
              placeholderTextColor={dpColor.inkMute}
              multiline
              style={styles.textInput}
            />

            {pastedChat && (
              <DropCard style={styles.chatCard}>
                <Kick>from your chat</Kick>
                {pastedChat
                  .split('\n')
                  .slice(0, 4)
                  .map((line, i) => (
                    <Text key={i} style={styles.chatLine}>
                      {line}
                    </Text>
                  ))}
                {pastedChat.split('\n').length > 4 && <Text style={styles.chatMore}>and {pastedChat.split('\n').length - 4} more</Text>}
                <Text style={styles.chatConsent}>Their words go with yours when you tap Read it. Only what you pasted, nothing else.</Text>
              </DropCard>
            )}

            {screenshotMiss && <Text style={styles.miss}>Couldn't read a chat in that screenshot. Try a clearer one, or paste the text.</Text>}
            {readingScreenshot && <Text style={styles.miss}>Reading the screenshot…</Text>}

            {!text && !pastedChat && (
              <View style={styles.stemsWrap}>
                {STEMS.map((stem) => (
                  <DropPress key={stem} onPress={() => setText((prev) => `${prev}${stem}`)}>
                    <View style={styles.stemChip}>
                      <Text style={styles.stemText}>{stem}…</Text>
                    </View>
                  </DropPress>
                ))}
              </View>
            )}

            <View style={styles.captureActionsRow}>
              <DropPress onPress={handlePasteChat}>
                <Text style={styles.captureLink}>Paste the chat</Text>
              </DropPress>
              <DropPress onPress={handleAddScreenshot}>
                <Text style={styles.captureLink}>Add a screenshot</Text>
              </DropPress>
            </View>

            <DropBtn kind="us" onPress={handleReadIt} disabled={!text.trim() && !pastedChat} style={{ marginTop: 20 }}>
              Read it
            </DropBtn>
          </>
        )}

        {step === 'working' && (
          <View style={styles.workingWrap}>
            <Kick>reading it once</Kick>
            <Text style={styles.workingQuote}>"{(text || pastedChat || '').slice(0, 110)}{(text || pastedChat || '').length > 110 ? '…' : ''}"</Text>
            <ActivityIndicator color={dpColor.p2Deep} style={{ marginVertical: 20 }} />
            <Text style={styles.workingStage}>{WORKING_STAGES[stage]}…</Text>
            {stage === 2 && <Text style={styles.workingConsidered}>{WORKING_CONSIDERED}</Text>}
            {showEscape && (
              <View style={styles.escapeRow}>
                <DropBtn kind="soft" onPress={() => setShowEscape(false)}>
                  Keep waiting
                </DropBtn>
                <DropBtn kind="soft" onPress={reset}>
                  Save what you wrote
                </DropBtn>
              </View>
            )}
          </View>
        )}

        {step === 'error' && (
          <View>
            <Serif s={28} italic style={{ marginBottom: 10 }}>
              Still a little blurry.
            </Serif>
            <Text style={styles.errorBody}>That didn't come through. Nothing was lost, and nothing was sent anywhere. It's here exactly as you left it.</Text>
            <DropCard style={styles.chatCard}>
              <Text style={styles.chatLine} numberOfLines={4}>
                {text || pastedChat}
              </Text>
            </DropCard>
            <DropBtn kind="us" onPress={() => runRead(text, pastedChat)} style={{ marginTop: 16 }}>
              Try again
            </DropBtn>
            <DropBtn kind="soft" onPress={() => setStep('capture')} style={{ marginTop: 10 }}>
              Back to what I wrote
            </DropBtn>
          </View>
        )}

        {step === 'safety' && outcome && 'safety' in outcome && (
          <View>
            <Serif s={26} style={{ marginBottom: 10 }}>
              {outcome.safety.title}
            </Serif>
            <Text style={styles.errorBody}>{outcome.safety.message}</Text>
            {outcome.safety.helplines.map((h, i) => (
              <DropCard key={i} style={styles.helplineCard}>
                <Text style={styles.helplineName}>{h.name}</Text>
                <Text style={styles.helplineContact}>{h.contact}</Text>
              </DropCard>
            ))}
            <Text style={styles.disclosure}>{AI_DISCLOSURE}</Text>
            <Text style={styles.disclosure}>{THERAPY_DISCLAIMER}</Text>
            <DropBtn kind="soft" onPress={reset} style={{ marginTop: 16 }}>
              Done
            </DropBtn>
          </View>
        )}

        {step === 'result' && outcome && 'read' in outcome && (
          <View>
            {outcome.read.bridge_decision === 'bridge' ? (
              <>
                <Kick>One sentence you could send</Kick>
                <TextInput
                  value={editableBridge}
                  onChangeText={(v) => {
                    setEditableBridge(v);
                    setEdited(v.trim() !== outcome.read.bridge.trim());
                  }}
                  multiline
                  style={styles.bridgeInput}
                />
                <Text style={styles.editHint}>{edited ? 'Yours now.' : 'Tap the sentence to make it yours.'}</Text>
                {!edited && (
                  <DropPress onPress={() => setEdited(true)}>
                    <Text style={styles.captureLink}>Use it as is</Text>
                  </DropPress>
                )}
                <DropBtn
                  kind={edited ? 'us' : 'soft'}
                  disabled={!edited}
                  onPress={async () => {
                    await Clipboard.setStringAsync(editableBridge.trim());
                    setCopied(true);
                  }}
                  style={{ marginTop: 14 }}
                >
                  {copied ? 'Copied' : 'Copy'}
                </DropBtn>
              </>
            ) : (
              <>
                <Kick>Tonight · read once</Kick>
                <Serif s={26} style={{ marginTop: 8, marginBottom: 12 }}>
                  There is no bridge here.
                </Serif>
                <Text style={styles.errorBody}>{outcome.read.no_bridge?.noticed}</Text>
              </>
            )}

            <DropCard style={styles.underCard}>
              <Kick>Underneath it for you</Kick>
              <Text style={styles.underBody}>{outcome.read.underneath}</Text>
            </DropCard>
            <DropCard style={styles.underCard}>
              <Kick>What they're probably not wrong about</Kick>
              <Text style={styles.underBody}>{outcome.read.not_wrong_about}</Text>
            </DropCard>

            {outcome.read.bridge_decision === 'no_bridge' && (
              <Text style={styles.errorBody}>
                {outcome.read.no_bridge?.let_go} Nothing to send.
              </Text>
            )}

            {outcome.read.screening_unavailable && (
              <Text style={styles.miss}>Our safety check couldn't run this time. If anything here touches on safety or crisis, please reach a human: SOS 1767 (SG) or findahelpline.com.</Text>
            )}
            <Text style={styles.disclosure}>{AI_DISCLOSURE}</Text>
            <Text style={styles.disclosure}>{THERAPY_DISCLAIMER}</Text>

            <DropPress onPress={savedToLoveMap ? onOpenLoveMap : handleSaveToLoveMap}>
              <DropCard style={[styles.chatCard, { marginTop: 8 }]}>
                <Text style={styles.saveLoveMapText}>{savedToLoveMap ? 'Added to Love Map 🗺️ — tap to view' : 'Add what you learned to your Love Map'}</Text>
              </DropCard>
            </DropPress>

            <DropBtn kind="soft" onPress={reset} style={{ marginTop: 14 }}>
              Done
            </DropBtn>
          </View>
        )}
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { paddingHorizontal: dpSpace.gutter },
  firstLine: { fontFamily: dpFont.ui400, fontSize: 15, color: dpColor.inkSoft, marginBottom: 16 },
  textInput: { minHeight: 120, fontFamily: dpFont.disp, fontSize: 20, color: dpColor.ink, textAlignVertical: 'top', paddingVertical: 8 },
  chatCard: { padding: 14, marginTop: 12, marginBottom: 12 },
  chatLine: { fontFamily: dpFont.ui400, fontSize: 13.5, color: dpColor.ink, marginTop: 6, lineHeight: 13.5 * 1.4 },
  chatMore: { fontFamily: dpFont.ui400, fontSize: 11.5, color: dpColor.inkMute, marginTop: 4 },
  chatConsent: { fontFamily: dpFont.ui400, fontSize: 11, color: dpColor.inkMute, marginTop: 10, fontStyle: 'italic' },
  miss: { fontFamily: dpFont.ui400, fontSize: 12.5, color: dpColor.inkSoft, marginBottom: 10, fontStyle: 'italic' },
  stemsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8, marginBottom: 8 },
  stemChip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, backgroundColor: dpColor.sunken },
  stemText: { fontFamily: dpFont.ui500, fontSize: 12.5, color: dpColor.ink },
  captureActionsRow: { flexDirection: 'row', gap: 20, marginTop: 12 },
  captureLink: { fontFamily: dpFont.ui600, fontSize: 12.5, color: dpColor.p2Deep, letterSpacing: 0.4 },
  workingWrap: { alignItems: 'center', paddingTop: 40 },
  workingQuote: { fontFamily: dpFont.dispItalic, fontSize: 18, color: dpColor.inkSoft, textAlign: 'center', marginTop: 12 },
  workingStage: { fontFamily: dpFont.ui500, fontSize: 14, color: dpColor.ink },
  workingConsidered: { fontFamily: dpFont.ui400, fontSize: 12, color: dpColor.inkMute, marginTop: 6, fontStyle: 'italic' },
  escapeRow: { flexDirection: 'row', gap: 10, marginTop: 24 },
  errorBody: { fontFamily: dpFont.ui400, fontSize: 14, color: dpColor.inkSoft, lineHeight: 14 * 1.5, marginBottom: 12 },
  helplineCard: { padding: 14, marginBottom: 10 },
  helplineName: { fontFamily: dpFont.ui600, fontSize: 13.5, color: dpColor.ink },
  helplineContact: { fontFamily: dpFont.mono, fontSize: 13, color: dpColor.p2Deep, marginTop: 4 },
  disclosure: { fontFamily: dpFont.ui400, fontSize: 11, color: dpColor.inkMute, lineHeight: 11 * 1.5, marginTop: 8 },
  bridgeInput: { fontFamily: dpFont.dispItalic, fontSize: 20, color: dpColor.ink, marginTop: 8, minHeight: 60 },
  editHint: { fontFamily: dpFont.ui400, fontSize: 11.5, color: dpColor.inkMute, marginTop: 6, marginBottom: 6 },
  underCard: { padding: 14, marginTop: 12 },
  underBody: { fontFamily: dpFont.ui400, fontSize: 13.5, color: dpColor.ink, marginTop: 8, lineHeight: 13.5 * 1.45 },
  saveLoveMapText: { fontFamily: dpFont.ui600, fontSize: 13, color: dpColor.p2Deep, textAlign: 'center' },
});
