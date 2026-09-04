import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, TextInput, View } from 'react-native';
import { npColor, npFont } from '../../theme/npatTokens';

const CELL_COUNT = 6;

function Caret() {
  const opacity = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.12, duration: 550, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration: 550, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);
  return <Animated.View style={[styles.caret, { opacity }]} />;
}

interface RoomCodeCellsProps {
  value: string;
  /** Editable when provided — renders the hidden numeric input and focus/caret state. Omit for a read-only display (the waiting room's real code). */
  onChangeText?: (t: string) => void;
  autoFocus?: boolean;
}

/** The six room-code digit cells from the handoff — editable while joining, or a static real-code display once inside the room. */
export function RoomCodeCells({ value, onChangeText, autoFocus }: RoomCodeCellsProps) {
  const editable = !!onChangeText;
  const focusIndex = Math.min(value.length, CELL_COUNT - 1);
  const cells = Array.from({ length: CELL_COUNT }, (_, i) => value[i] ?? '');

  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        {cells.map((ch, i) => {
          const focused = editable && i === focusIndex && !ch;
          return (
            <View key={i} style={[styles.cell, focused && styles.cellFocused]}>
              {ch ? <Text style={styles.cellText}>{ch}</Text> : focused ? <Caret /> : null}
            </View>
          );
        })}
      </View>
      {editable && (
        <TextInput
          value={value}
          onChangeText={(t) => onChangeText?.(t.replace(/[^0-9]/g, '').slice(0, CELL_COUNT))}
          keyboardType="number-pad"
          maxLength={CELL_COUNT}
          autoFocus={autoFocus}
          style={styles.hiddenInput}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'relative' },
  row: { flexDirection: 'row', gap: 7 },
  cell: { flex: 1, aspectRatio: 1 / 1.05, borderRadius: 14, backgroundColor: npColor.ink, alignItems: 'center', justifyContent: 'center' },
  cellFocused: { backgroundColor: 'rgba(22,33,12,.07)', borderWidth: 1.6, borderColor: npColor.lime },
  cellText: { fontFamily: npFont.mono500, fontSize: 21, color: npColor.lime },
  caret: { width: 2, height: 21, backgroundColor: npColor.ink },
  hiddenInput: { position: 'absolute', opacity: 0, height: 0, width: 0 },
});
