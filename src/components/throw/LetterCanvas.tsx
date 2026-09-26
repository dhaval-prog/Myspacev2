import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useState } from 'react';
import { Image, StyleSheet, TextInput, View } from 'react-native';
import { throwColor, throwFont, throwRadius } from '../../theme/throwTokens';
import type { StrokePath } from '../../types/throw';

const paperTextureAsset = require('../../../assets/throw/paper-texture.jpg');

// A blue ballpoint-ink shade, matching the reference design's "handwritten in blue pen" look —
// no longer user-selectable, so this is the only pen color a letter is ever written in.
const INK_BLUE = '#3A4C6E';
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
}

export interface LetterCanvasHandle {
  /** Appends a chunk of text (a finalized voice-to-text segment) onto whatever's already
   * written, as if the user had just typed it — used by the voice input button, which lives
   * outside this component and has no other way to reach its internal text state. */
  appendText: (text: string) => void;
}

/**
 * The letter's actual writing surface — real paper (the same grain texture the folded plane
 * uses) with a typed message, always in blue ballpoint ink, so the writing area fills the whole
 * paper. That matters beyond looks: FoldingLetter measures this same box to scale the text onto
 * the plane's baked texture, so the writing surface and the measured surface need to be the same
 * rectangle.
 */
export const LetterCanvas = forwardRef<LetterCanvasHandle, LetterCanvasProps>(function LetterCanvas({ onContentChange, hasPhoto }, ref) {
  const [typedText, setTypedText] = useState('');
  const penColor = INK_BLUE;

  useImperativeHandle(
    ref,
    () => ({
      appendText: (text: string) => {
        setTypedText((prev) => {
          const trimmed = prev.replace(/\s+$/, '');
          return trimmed ? `${trimmed} ${text}` : text;
        });
      },
    }),
    [],
  );

  const currentContent = useCallback(
    (): LetterCanvasContent => ({ messageText: typedText.trim() || null, strokes: null, penColor }),
    [typedText, penColor],
  );

  useEffect(() => {
    onContentChange?.(currentContent());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [typedText, penColor]);

  return (
    <View style={styles.wrap}>
      <Image source={paperTextureAsset} style={StyleSheet.absoluteFill} resizeMode="cover" />

      <TextInput
        style={[StyleSheet.absoluteFill, styles.typedInput, hasPhoto && styles.typedInputWithPhoto, { color: penColor }]}
        multiline
        placeholder="Write something for your loved one"
        placeholderTextColor={PLACEHOLDER_COLOR}
        value={typedText}
        onChangeText={setTypedText}
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
    paddingTop: 44,
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
