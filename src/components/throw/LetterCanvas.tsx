import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useState } from 'react';
import { Image, StyleSheet, TextInput, View } from 'react-native';
import { throwColor, throwFont, throwNightColor, throwRadius } from '../../theme/throwTokens';
import type { StrokePath } from '../../types/throw';

const paperTextureAsset = require('../../../assets/throw/paper-texture.jpg');

// A light-blue ballpoint-ink shade, matching the reference design's "handwritten in blue pen"
// look — no longer user-selectable, so this is the only pen color a letter is ever written in.
const INK_BLUE = '#4A90D9';
// The placeholder's own ink — a distinct blue-violet, so it always reads as a prompt rather than
// something the user could mistake for typed text.
const PLACEHOLDER_COLOR = '#4A55B0';

interface LetterCanvasContent {
  messageText: string | null;
  strokes: StrokePath[] | null;
  penColor: string;
}

interface LetterCanvasProps {
  /** Fires on every content edit, live — lets a parent (FoldingLetter) read the current draft. */
  onContentChange?: (content: LetterCanvasContent) => void;
  /** One or more photos are pasted in a strip near the top (see FoldingLetter's photoStripWrap)
   * — reserves extra top padding so the writing area doesn't start underneath it. */
  hasPhoto?: boolean;
  /** Swaps the cream paper texture and blue ink for the dark "night" skin (see throwNightColor)
   * — driven by the destination's local day/night, same signal ThrowMap's own palette follows. */
  isNight?: boolean;
}

export interface LetterCanvasHandle {
  /** Appends a chunk of text (a finalized voice-to-text segment) onto whatever's already
   * written, as if the user had just typed it — used by the voice input button, which lives
   * outside this component and has no other way to reach its internal text state. */
  appendText: (text: string) => void;
  /** Live not-yet-final voice transcript, shown appended after the committed text so dictation
   * writes onto the paper as it's spoken rather than only once each phrase finalizes. Pass '' to
   * clear it (recognition ended, a phrase just finalized, or the user stopped recording). */
  setInterimText: (text: string) => void;
}

/**
 * The letter's actual writing surface — real paper (the same grain texture the folded plane
 * uses) with a typed message, always in blue ballpoint ink, so the writing area fills the whole
 * paper. That matters beyond looks: FoldingLetter measures this same box to scale the text onto
 * the plane's baked texture, so the writing surface and the measured surface need to be the same
 * rectangle.
 */
export const LetterCanvas = forwardRef<LetterCanvasHandle, LetterCanvasProps>(function LetterCanvas({ onContentChange, hasPhoto, isNight }, ref) {
  const [typedText, setTypedText] = useState('');
  // The current phrase's not-yet-final transcript — shown live appended after typedText (see
  // displayText below) so dictated words appear on the paper as they're spoken, not only once
  // each phrase is recognized as finished. Never itself committed to typedText directly; a final
  // result replaces it via appendText, which is what actually persists the words.
  const [interimText, setInterimTextState] = useState('');
  const penColor = isNight ? throwNightColor.ink : INK_BLUE;

  useImperativeHandle(
    ref,
    () => ({
      appendText: (text: string) => {
        setInterimTextState('');
        setTypedText((prev) => {
          const trimmed = prev.replace(/\s+$/, '');
          return trimmed ? `${trimmed} ${text}` : text;
        });
      },
      setInterimText: (text: string) => setInterimTextState(text),
    }),
    [],
  );

  // What's actually rendered: committed text plus the live interim transcript, if any. Only
  // `typedText` is ever treated as real content (see currentContent below) — the interim overlay
  // is purely visual and disappears (replaced by the committed words) the moment it finalizes.
  const displayText = interimText ? `${typedText}${typedText && !/\s$/.test(typedText) ? ' ' : ''}${interimText}` : typedText;

  const currentContent = useCallback(
    (): LetterCanvasContent => ({ messageText: typedText.trim() || null, strokes: null, penColor }),
    [typedText, penColor],
  );

  useEffect(() => {
    onContentChange?.(currentContent());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [typedText, penColor]);

  return (
    <View style={[styles.wrap, isNight && { backgroundColor: throwNightColor.paper }]}>
      {isNight ? null : <Image source={paperTextureAsset} style={StyleSheet.absoluteFill} resizeMode="cover" />}

      <TextInput
        style={[StyleSheet.absoluteFill, styles.typedInput, hasPhoto && styles.typedInputWithPhoto, { color: penColor }]}
        multiline
        placeholder="Write something for your loved one"
        placeholderTextColor={isNight ? throwNightColor.placeholder : PLACEHOLDER_COLOR}
        value={displayText}
        // Ignores edits while a live interim transcript is showing — the box is displaying
        // dictated-but-not-yet-final words the user isn't meant to be typing over at that exact
        // instant; it's editable again the moment interimText clears (each phrase finalizes in a
        // second or two, or recording stops), so this only ever blocks typing very briefly.
        onChangeText={(text) => {
          if (!interimText) setTypedText(text);
        }}
        editable={!interimText}
        textAlignVertical="center"
      />
    </View>
  );
});

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    minHeight: 208,
    borderRadius: throwRadius.paper,
    overflow: 'hidden',
    ...throwColor.shadowSoft,
  },
  typedInput: {
    padding: 20,
    // More clearance above the streak/points badges (FoldingLetter's paperBadges, absolutely
    // positioned in this same paper's top-right corner) — 44 left typed text starting almost
    // directly under them.
    paddingTop: 66,
    // Reserves room above FoldingLetter's bottom-controls row (photo/chat/voice/add-friend/
    // inbox), which now sits pinned to this same paper's bottom edge — without this, typed text
    // can run underneath those buttons instead of stopping short of them.
    paddingBottom: 110,
    fontFamily: throwFont.hand500,
    fontSize: 22,
    lineHeight: 30,
    textAlign: 'center',
  },
  // Reserves room under the photo strip pasted near the top (see FoldingLetter's
  // photoStripWrap) so the writing area starts below it instead of running underneath.
  typedInputWithPhoto: { paddingTop: 100 },
});
