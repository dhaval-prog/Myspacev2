import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useState } from 'react';
import { Image, StyleSheet, Pressable, Text, TextInput, View } from 'react-native';
import { throwColor, throwFont, throwRadius } from '../../theme/throwTokens';
import type { StrokePath } from '../../types/throw';

const paperTextureAsset = require('../../../assets/throw/paper-texture.jpg');

// A blue ballpoint-ink shade leads the swatches (and is the default), matching the reference
// design's "handwritten in blue pen" look — black, clay and green stay selectable alternatives.
const INK_BLUE = '#3A4C6E';
const PEN_COLORS = [INK_BLUE, throwColor.ink, throwColor.clayDeep, '#3E5C4E'];
// The placeholder's own ink — a distinct blue-violet, not one of the selectable pen colors, so
// it always reads as a prompt rather than something the user could mistake for typed text.
const PLACEHOLDER_COLOR = '#4A55B0';

interface LetterCanvasContent {
  messageText: string | null;
  strokes: StrokePath[] | null;
  penColor: string;
}

interface LetterCanvasProps {
  /** Fires on every content edit, live — lets a parent (FoldingLetter) read the current draft. */
  onContentChange?: (content: LetterCanvasContent) => void;
  /** A photo is pasted in the top-right corner (see FoldingLetter's photoChip) — reserves extra
   * top padding so the writing area doesn't start underneath it. */
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
 * uses) with a typed message and a minimal floating ink-color picker, so the writing area fills
 * the whole paper. That matters beyond looks: FoldingLetter measures this same box to scale the
 * text onto the plane's baked texture, so the writing surface and the measured surface need to be
 * the same rectangle.
 */
export const LetterCanvas = forwardRef<LetterCanvasHandle, LetterCanvasProps>(function LetterCanvas({ onContentChange, hasPhoto }, ref) {
  const [typedText, setTypedText] = useState('');
  const [penColor, setPenColor] = useState(PEN_COLORS[0]);

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

      <View style={styles.toolbar} pointerEvents="box-none">
        <View style={styles.swatchPill}>
          {PEN_COLORS.map((c) => (
            <Pressable key={c} onPress={() => setPenColor(c)} style={[styles.swatch, { backgroundColor: c }, penColor === c && styles.swatchActive]} />
          ))}
        </View>
      </View>
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
    fontFamily: throwFont.hand500,
    fontSize: 22,
    lineHeight: 30,
    textAlign: 'center',
  },
  // Reserves room under the photo sticker pasted top-right (see FoldingLetter's photoChip) so
  // the writing area starts below it instead of running underneath.
  typedInputWithPhoto: { paddingTop: 156 },
  toolbar: { position: 'absolute', top: 8, right: 8 },
  swatchPill: { flexDirection: 'row', gap: 6, backgroundColor: 'rgba(251,246,236,.88)', borderRadius: throwRadius.pill, paddingHorizontal: 8, paddingVertical: 6 },
  swatch: { width: 15, height: 15, borderRadius: 8, borderWidth: 2, borderColor: 'transparent' },
  swatchActive: { borderColor: throwColor.ink },
});
