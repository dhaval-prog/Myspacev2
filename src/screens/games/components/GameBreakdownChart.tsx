import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { colors, fontFamily, radius, spacing } from '../../../theme';
import type { GameBreakdownEntry } from '../../../types/gameStats';

const PALETTE = ['#3F8F4F', '#2C8FC9', '#E8543A', '#E8A93D', '#8F6FE8', '#4DBFAE'];

const SIZE = 168;
const STROKE = 22;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

interface GameBreakdownChartProps {
  entries: GameBreakdownEntry[];
  total: number;
  onSelectEntry: (entry: GameBreakdownEntry) => void;
}

/** "Game Breakdown" — a donut of the positive contributions, with a signed legend beneath it (net values can be negative). */
export function GameBreakdownChart({ entries, total, onSelectEntry }: GameBreakdownChartProps) {
  const positiveTotal = useMemo(() => entries.filter((e) => e.net > 0).reduce((sum, e) => sum + e.net, 0), [entries]);

  let offset = 0;
  const arcs = entries
    .filter((e) => e.net > 0)
    .map((entry, i) => {
      const fraction = positiveTotal > 0 ? entry.net / positiveTotal : 0;
      const dash = fraction * CIRCUMFERENCE;
      const arc = { entry, color: PALETTE[i % PALETTE.length], dash, offset };
      offset += dash;
      return arc;
    });

  if (entries.length === 0) {
    return (
      <View style={styles.emptyWrap}>
        <Text style={styles.emptyTitle}>No game data yet.</Text>
        <Text style={styles.emptySub}>Play your first game to see your breakdown.</Text>
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      <View style={styles.donutWrap}>
        <Svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
          <Circle cx={SIZE / 2} cy={SIZE / 2} r={RADIUS} stroke={colors.ink07} strokeWidth={STROKE} fill="none" />
          {arcs.length === 0 ? null : (
            <>
              {arcs.map((arc) => (
                <Circle
                  key={arc.entry.gameType}
                  cx={SIZE / 2}
                  cy={SIZE / 2}
                  r={RADIUS}
                  stroke={arc.color}
                  strokeWidth={STROKE}
                  fill="none"
                  strokeDasharray={`${CIRCUMFERENCE} ${CIRCUMFERENCE}`}
                  strokeDashoffset={-arc.offset}
                  strokeLinecap="butt"
                  transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
                />
              ))}
            </>
          )}
        </Svg>
        <View style={styles.donutCenter} pointerEvents="none">
          <Text style={[styles.centerValue, total < 0 && styles.negative]}>{total >= 0 ? total : `−${Math.abs(total)}`}</Text>
          <Text style={styles.centerLabel}>POINTS</Text>
        </View>
      </View>

      <View style={styles.legend}>
        {entries.map((entry) => {
          const arc = arcs.find((a) => a.entry.gameType === entry.gameType);
          const dotColor = arc ? arc.color : entry.net < 0 ? colors.danger : colors.ink30;
          return (
            <Pressable key={entry.gameType} onPress={() => onSelectEntry(entry)} style={styles.legendRow}>
              <View style={[styles.dot, { backgroundColor: dotColor }]} />
              <Text style={styles.legendLabel} numberOfLines={1}>{entry.label}</Text>
              <Text style={[styles.legendValue, entry.net < 0 && styles.negative]}>
                {entry.net > 0 ? `+${entry.net}` : entry.net}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', gap: spacing.lg },
  donutWrap: { width: SIZE, height: SIZE, alignItems: 'center', justifyContent: 'center' },
  donutCenter: { position: 'absolute', alignItems: 'center' },
  centerValue: { fontFamily: fontFamily.sans800, fontSize: 32, color: colors.textPrimary },
  negative: { color: colors.danger },
  centerLabel: { fontFamily: fontFamily.sans600, fontSize: 11, color: colors.textMuted, letterSpacing: 1 },
  legend: { width: '100%', gap: 6 },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, paddingHorizontal: 12, borderRadius: radius.md, backgroundColor: colors.surface60 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  legendLabel: { flex: 1, fontFamily: fontFamily.sans600, fontSize: 13.5, color: colors.textPrimary },
  legendValue: { fontFamily: fontFamily.sans700, fontSize: 14, color: colors.textPrimary },
  emptyWrap: { alignItems: 'center', paddingVertical: spacing.lg, gap: 4 },
  emptyTitle: { fontFamily: fontFamily.sans600, fontSize: 14.5, color: colors.textPrimary },
  emptySub: { fontFamily: fontFamily.sans400, fontSize: 12.5, color: colors.textMuted, textAlign: 'center' },
});
