import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Image, LayoutChangeEvent, PanResponder, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { throwColor, throwFont, throwRadius } from '../../theme/throwTokens';
import type { StrokePath } from '../../types/throw';

const paperTextureAsset = require('../../../assets/throw/paper-texture.jpg');

const PEN_COLORS = [throwColor.ink, throwColor.clayDeep, '#3E5C4E', '#3A4C6E'];
const PEN_WIDTHS = [2.5, 4, 6];

interface LetterCanvasContent {
  messageText: string | null;
  strokes: StrokePath[] | null;
  penColor: string;
}

interface LetterCanvasProps {
  /** Fires on every content edit, live — lets a parent (FoldingLetter) read the current draft. */
  onContentChange?: (content: LetterCanvasContent) => void;
}

function strokeToPathD(points: { x: number; y: number }[]): string {
  if (points.length === 0) return '';
  return points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
}

/**
 * The letter's actual writing surface — real paper (the same grain texture the folded plane
 * uses), a freehand handwriting canvas or typed fallback, and a minimal floating toolbar rather
 * than a stacked control bar, so the drawable area fills the whole paper. That matters beyond
 * looks: FoldingLetter measures this same box to scale strokes onto the plane's baked texture,
 * so the writing surface and the measured surface need to be the same rectangle.
 */
export function LetterCanvas({ onContentChange }: LetterCanvasProps) {
  const [mode, setMode] = useState<'write' | 'type'>('write');
  const [strokes, setStrokes] = useState<StrokePath[]>([]);
  const [redoStack, setRedoStack] = useState<StrokePath[]>([]);
  const [currentPoints, setCurrentPoints] = useState<{ x: number; y: number }[] | null>(null);
  const [penColor, setPenColor] = useState(PEN_COLORS[0]);
  const [penWidth, setPenWidth] = useState(PEN_WIDTHS[1]);
  const [eraseMode, setEraseMode] = useState(false);
  const [typedText, setTypedText] = useState('');
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });

  const eraseAt = useCallback((x: number, y: number) => {
    setStrokes((prev) => prev.filter((s) => !s.points.some((p) => Math.hypot(p.x - x, p.y - y) < 16)));
  }, []);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => mode === 'write',
        onMoveShouldSetPanResponder: () => mode === 'write',
        onPanResponderGrant: (e) => {
          const { locationX, locationY } = e.nativeEvent;
          if (eraseMode) {
            eraseAt(locationX, locationY);
            return;
          }
          setCurrentPoints([{ x: locationX, y: locationY }]);
        },
        onPanResponderMove: (e) => {
          const { locationX, locationY } = e.nativeEvent;
          if (eraseMode) {
            eraseAt(locationX, locationY);
            return;
          }
          setCurrentPoints((prev) => (prev ? [...prev, { x: locationX, y: locationY }] : [{ x: locationX, y: locationY }]));
        },
        onPanResponderRelease: () => {
          if (eraseMode) return;
          setCurrentPoints((prev) => {
            if (prev && prev.length > 1) {
              setStrokes((s) => [...s, { points: prev, color: penColor, width: penWidth }]);
              setRedoStack([]);
            }
            return null;
          });
        },
        onPanResponderTerminate: () => {
          // The fold-drag on the paper (see FoldingLetter) stole the gesture mid-stroke — discard
          // the in-progress stroke rather than leaving an orphaned, never-committed path around.
          setCurrentPoints(null);
        },
      }),
    [mode, eraseMode, penColor, penWidth, eraseAt],
  );

  const undo = () => {
    setStrokes((prev) => {
      if (prev.length === 0) return prev;
      setRedoStack((r) => [...r, prev[prev.length - 1]]);
      return prev.slice(0, -1);
    });
  };
  const redo = () => {
    setRedoStack((prev) => {
      if (prev.length === 0) return prev;
      const last = prev[prev.length - 1];
      setStrokes((s) => [...s, last]);
      return prev.slice(0, -1);
    });
  };
  const clear = () => {
    setStrokes([]);
    setRedoStack([]);
  };

  const onCanvasLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setCanvasSize({ width, height });
  };

  const currentContent = useCallback(
    (): LetterCanvasContent =>
      mode === 'write'
        ? { messageText: null, strokes: strokes.length > 0 ? strokes : null, penColor }
        : { messageText: typedText.trim() || null, strokes: null, penColor },
    [mode, strokes, typedText, penColor],
  );

  useEffect(() => {
    onContentChange?.(currentContent());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, strokes, typedText, penColor]);

  return (
    <View style={styles.wrap} onLayout={onCanvasLayout}>
      <Image source={paperTextureAsset} style={StyleSheet.absoluteFill} resizeMode="cover" />

      <View style={StyleSheet.absoluteFill} {...(mode === 'write' ? panResponder.panHandlers : {})}>
        {mode === 'write' ? (
          <>
            {canvasSize.width > 0 && (
              <Svg width={canvasSize.width} height={canvasSize.height}>
                {strokes.map((s, i) => (
                  <Path key={i} d={strokeToPathD(s.points)} stroke={s.color} strokeWidth={s.width} fill="none" strokeLinecap="round" strokeLinejoin="round" />
                ))}
                {currentPoints && (
                  <Path d={strokeToPathD(currentPoints)} stroke={penColor} strokeWidth={penWidth} fill="none" strokeLinecap="round" strokeLinejoin="round" />
                )}
              </Svg>
            )}
            {strokes.length === 0 && !currentPoints && <Text style={styles.placeholder}>Write something...</Text>}
          </>
        ) : (
          <TextInput
            style={styles.typedInput}
            multiline
            placeholder="Write something..."
            placeholderTextColor={throwColor.inkFaint}
            value={typedText}
            onChangeText={setTypedText}
            textAlignVertical="top"
          />
        )}
      </View>

      <View style={styles.toolbar} pointerEvents="box-none">
        <View style={styles.toolRow}>
          <View style={styles.modeTabs}>
            <Pressable onPress={() => setMode('write')} style={[styles.modeTab, mode === 'write' && styles.modeTabActive]}>
              <Text style={[styles.modeTabLabel, mode === 'write' && styles.modeTabLabelActive]}>Handwrite</Text>
            </Pressable>
            <Pressable onPress={() => setMode('type')} style={[styles.modeTab, mode === 'type' && styles.modeTabActive]}>
              <Text style={[styles.modeTabLabel, mode === 'type' && styles.modeTabLabelActive]}>Type</Text>
            </Pressable>
          </View>

          {mode === 'write' && (
            <View style={styles.swatchPill}>
              {PEN_COLORS.map((c) => (
                <Pressable key={c} onPress={() => setPenColor(c)} style={[styles.swatch, { backgroundColor: c }, penColor === c && styles.swatchActive]} />
              ))}
            </View>
          )}
        </View>

        {mode === 'write' && (
          <View style={[styles.toolRow, styles.toolRowSecondary]}>
            <View style={styles.actionPill}>
              <Pressable onPress={undo} disabled={strokes.length === 0} hitSlop={6}>
                <Text style={[styles.toolLabel, strokes.length === 0 && styles.toolLabelDisabled]}>Undo</Text>
              </Pressable>
              <Pressable onPress={redo} disabled={redoStack.length === 0} hitSlop={6}>
                <Text style={[styles.toolLabel, redoStack.length === 0 && styles.toolLabelDisabled]}>Redo</Text>
              </Pressable>
              <Pressable onPress={() => setEraseMode((v) => !v)} hitSlop={6}>
                <Text style={[styles.toolLabel, eraseMode && styles.toolLabelActive]}>Erase</Text>
              </Pressable>
              <Pressable onPress={clear} disabled={strokes.length === 0} hitSlop={6}>
                <Text style={[styles.toolLabel, strokes.length === 0 && styles.toolLabelDisabled]}>Clear</Text>
              </Pressable>
            </View>

            <View style={styles.widthPill}>
              {PEN_WIDTHS.map((w) => (
                <Pressable key={w} onPress={() => setPenWidth(w)} style={styles.widthBtn} hitSlop={6}>
                  <View style={[styles.widthDot, { width: w + 4, height: w + 4, borderRadius: (w + 4) / 2 }, penWidth === w && styles.widthDotActive]} />
                </Pressable>
              ))}
            </View>
          </View>
        )}
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
  placeholder: {
    position: 'absolute',
    top: 60,
    left: 20,
    fontFamily: throwFont.hand500,
    fontSize: 22,
    color: throwColor.inkFaint,
  },
  typedInput: {
    flex: 1,
    padding: 20,
    paddingTop: 60,
    fontFamily: throwFont.hand500,
    fontSize: 22,
    color: throwColor.ink,
    lineHeight: 30,
  },
  toolbar: { position: 'absolute', top: 8, left: 8, right: 8, gap: 6 },
  toolRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  toolRowSecondary: { justifyContent: 'space-between' },
  modeTabs: { flexDirection: 'row', gap: 4, backgroundColor: 'rgba(251,246,236,.88)', borderRadius: throwRadius.pill, padding: 3 },
  modeTab: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: throwRadius.pill },
  modeTabActive: { backgroundColor: throwColor.claySoft },
  modeTabLabel: { fontFamily: throwFont.ui600, fontSize: 11.5, color: throwColor.inkSoft },
  modeTabLabelActive: { color: throwColor.clayDeep },
  swatchPill: { flexDirection: 'row', gap: 6, backgroundColor: 'rgba(251,246,236,.88)', borderRadius: throwRadius.pill, paddingHorizontal: 8, paddingVertical: 6 },
  swatch: { width: 15, height: 15, borderRadius: 8, borderWidth: 2, borderColor: 'transparent' },
  swatchActive: { borderColor: throwColor.ink },
  actionPill: {
    flexDirection: 'row',
    gap: 10,
    backgroundColor: 'rgba(251,246,236,.88)',
    borderRadius: throwRadius.pill,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  toolLabel: { fontFamily: throwFont.ui600, fontSize: 11, color: throwColor.inkSoft },
  toolLabelDisabled: { color: throwColor.inkFaint },
  toolLabelActive: { color: throwColor.clayDeep },
  widthPill: { flexDirection: 'row', gap: 4, backgroundColor: 'rgba(251,246,236,.88)', borderRadius: throwRadius.pill, paddingHorizontal: 8, paddingVertical: 6 },
  widthBtn: { width: 20, height: 20, alignItems: 'center', justifyContent: 'center' },
  widthDot: { backgroundColor: throwColor.inkMute },
  widthDotActive: { backgroundColor: throwColor.clayDeep },
});
