import React, { useCallback, useMemo, useState } from 'react';
import { LayoutChangeEvent, PanResponder, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { throwColor, throwFont, throwRadius } from '../../theme/throwTokens';
import type { StrokePath } from '../../types/throw';

const PEN_COLORS = [throwColor.ink, throwColor.clayDeep, '#3E5C4E', '#3A4C6E'];
const PEN_WIDTHS = [2.5, 4, 6];

interface LetterCanvasContent {
  messageText: string | null;
  strokes: StrokePath[] | null;
  penColor: string;
}

interface LetterCanvasProps {
  onDone: (content: LetterCanvasContent) => void;
  doneLabel?: string;
  doneDisabledUntilContent?: boolean;
}

function strokeToPathD(points: { x: number; y: number }[]): string {
  if (points.length === 0) return '';
  return points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
}

/**
 * The digital notepad — a handwriting canvas (PanResponder + freehand SVG strokes) with an
 * optional typed fallback, styled with a handwriting font. Minimal controls; the focus stays
 * on writing, not on a toolbar.
 */
export function LetterCanvas({ onDone, doneLabel = 'Done', doneDisabledUntilContent = true }: LetterCanvasProps) {
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

  const hasContent = mode === 'write' ? strokes.length > 0 : typedText.trim().length > 0;

  const handleDone = () => {
    if (mode === 'write') {
      onDone({ messageText: null, strokes: strokes.length > 0 ? strokes : null, penColor });
    } else {
      onDone({ messageText: typedText.trim() || null, strokes: null, penColor });
    }
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.modeTabs}>
        <Pressable onPress={() => setMode('write')} style={[styles.modeTab, mode === 'write' && styles.modeTabActive]}>
          <Text style={[styles.modeTabLabel, mode === 'write' && styles.modeTabLabelActive]}>Handwrite</Text>
        </Pressable>
        <Pressable onPress={() => setMode('type')} style={[styles.modeTab, mode === 'type' && styles.modeTabActive]}>
          <Text style={[styles.modeTabLabel, mode === 'type' && styles.modeTabLabelActive]}>Type</Text>
        </Pressable>
      </View>

      <View style={styles.paper} onLayout={onCanvasLayout}>
        {mode === 'write' ? (
          <View style={StyleSheet.absoluteFill} {...panResponder.panHandlers}>
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
          </View>
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

      {mode === 'write' && (
        <View style={styles.controlsRow}>
          <Pressable onPress={undo} style={styles.iconBtn} disabled={strokes.length === 0}>
            <Text style={[styles.iconBtnLabel, strokes.length === 0 && styles.iconBtnLabelDisabled]}>Undo</Text>
          </Pressable>
          <Pressable onPress={redo} style={styles.iconBtn} disabled={redoStack.length === 0}>
            <Text style={[styles.iconBtnLabel, redoStack.length === 0 && styles.iconBtnLabelDisabled]}>Redo</Text>
          </Pressable>
          <Pressable onPress={() => setEraseMode((v) => !v)} style={styles.iconBtn}>
            <Text style={[styles.iconBtnLabel, eraseMode && styles.iconBtnLabelActive]}>Eraser</Text>
          </Pressable>
          <Pressable onPress={clear} style={styles.iconBtn} disabled={strokes.length === 0}>
            <Text style={[styles.iconBtnLabel, strokes.length === 0 && styles.iconBtnLabelDisabled]}>Clear</Text>
          </Pressable>
        </View>
      )}

      {mode === 'write' && (
        <View style={styles.penRow}>
          <View style={styles.swatchGroup}>
            {PEN_COLORS.map((c) => (
              <Pressable key={c} onPress={() => setPenColor(c)} style={[styles.swatch, { backgroundColor: c }, penColor === c && styles.swatchActive]} />
            ))}
          </View>
          <View style={styles.swatchGroup}>
            {PEN_WIDTHS.map((w) => (
              <Pressable key={w} onPress={() => setPenWidth(w)} style={styles.widthBtn}>
                <View style={[styles.widthDot, { width: w + 4, height: w + 4, borderRadius: (w + 4) / 2 }, penWidth === w && styles.widthDotActive]} />
              </Pressable>
            ))}
          </View>
        </View>
      )}

      <Pressable onPress={handleDone} disabled={doneDisabledUntilContent && !hasContent}>
        <View style={[styles.doneBtn, doneDisabledUntilContent && !hasContent && styles.doneBtnDisabled]}>
          <Text style={styles.doneLabel}>{doneLabel}</Text>
        </View>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1 },
  modeTabs: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  modeTab: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: throwRadius.pill, backgroundColor: throwColor.paperLine },
  modeTabActive: { backgroundColor: throwColor.claySoft },
  modeTabLabel: { fontFamily: throwFont.ui600, fontSize: 12.5, color: throwColor.inkSoft },
  modeTabLabelActive: { color: throwColor.clayDeep },
  paper: {
    flex: 1,
    minHeight: 260,
    backgroundColor: throwColor.paper,
    borderRadius: throwRadius.paper,
    borderWidth: 1,
    borderColor: throwColor.paperLine,
    padding: 4,
    overflow: 'hidden',
    ...throwColor.shadowSoft,
  },
  placeholder: {
    position: 'absolute',
    top: 20,
    left: 20,
    fontFamily: throwFont.hand500,
    fontSize: 22,
    color: throwColor.inkFaint,
  },
  typedInput: {
    flex: 1,
    padding: 18,
    fontFamily: throwFont.hand500,
    fontSize: 22,
    color: throwColor.ink,
    lineHeight: 30,
  },
  controlsRow: { flexDirection: 'row', gap: 6, marginTop: 12, justifyContent: 'center' },
  iconBtn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: throwRadius.pill, backgroundColor: throwColor.cardBg, borderWidth: 1, borderColor: throwColor.cardBorder },
  iconBtnLabel: { fontFamily: throwFont.ui600, fontSize: 12, color: throwColor.inkSoft },
  iconBtnLabelDisabled: { color: throwColor.inkFaint },
  iconBtnLabelActive: { color: throwColor.clayDeep },
  penRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 },
  swatchGroup: { flexDirection: 'row', gap: 10 },
  swatch: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: 'transparent' },
  swatchActive: { borderColor: throwColor.ink },
  widthBtn: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
  widthDot: { backgroundColor: throwColor.inkMute },
  widthDotActive: { backgroundColor: throwColor.clayDeep },
  doneBtn: {
    marginTop: 16,
    minHeight: 52,
    borderRadius: throwRadius.pill,
    backgroundColor: throwColor.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  doneBtnDisabled: { backgroundColor: throwColor.paperLine },
  doneLabel: { fontFamily: throwFont.ui700, fontSize: 15, color: throwColor.paper, letterSpacing: 0.5 },
});
