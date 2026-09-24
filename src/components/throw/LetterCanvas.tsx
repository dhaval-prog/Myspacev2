import React, { useCallback, useEffect, useState } from 'react';
import { Image, StyleSheet, Pressable, Text, TextInput, View } from 'react-native';
import { throwColor, throwFont, throwRadius } from '../../theme/throwTokens';
import type { StrokePath } from '../../types/throw';

const paperTextureAsset = require('../../../assets/throw/paper-texture.jpg');

const PEN_COLORS = [throwColor.ink, throwColor.clayDeep, '#3E5C4E', '#3A4C6E'];

interface LetterCanvasContent {
  messageText: string | null;
  strokes: StrokePath[] | null;
  penColor: string;
}

interface LetterCanvasProps {
  /** Fires on every content edit, live — lets a parent (FoldingLetter) read the current draft. */
  onContentChange?: (content: LetterCanvasContent) => void;
}

/**
 * The letter's actual writing surface — real paper (the same grain texture the folded plane
 * uses) with a typed message and a minimal floating ink-color picker, so the writing area fills
 * the whole paper. That matters beyond looks: FoldingLetter measures this same box to scale the
 * text onto the plane's baked texture, so the writing surface and the measured surface need to be
 * the same rectangle.
 */
export function LetterCanvas({ onContentChange }: LetterCanvasProps) {
  const [typedText, setTypedText] = useState('');
  const [penColor, setPenColor] = useState(PEN_COLORS[0]);

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
        style={[StyleSheet.absoluteFill, styles.typedInput]}
        multiline
        placeholder="Write something..."
        placeholderTextColor={throwColor.inkFaint}
        value={typedText}
        onChangeText={setTypedText}
        textAlignVertical="top"
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
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    minHeight: 260,
    borderRadius: throwRadius.paper,
    overflow: 'hidden',
    ...throwColor.shadowSoft,
  },
  typedInput: {
    padding: 20,
    paddingTop: 60,
    fontFamily: throwFont.hand500,
    fontSize: 22,
    color: throwColor.ink,
    lineHeight: 30,
  },
  toolbar: { position: 'absolute', top: 8, right: 8 },
  swatchPill: { flexDirection: 'row', gap: 6, backgroundColor: 'rgba(251,246,236,.88)', borderRadius: throwRadius.pill, paddingHorizontal: 8, paddingVertical: 6 },
  swatch: { width: 15, height: 15, borderRadius: 8, borderWidth: 2, borderColor: 'transparent' },
  swatchActive: { borderColor: throwColor.ink },
});
