import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { fmColor, fmFont, fmLayout } from '../../../theme/friendsMapTokens';
import type { MapFilter } from '../../../utils/friendsMapMath';

interface FriendsMapFilterChipsProps {
  filter: MapFilter;
  onSelect: (f: MapFilter) => void;
  totalCount: number;
  liveCount: number;
  nearbyCount: number;
}

/** All / Live / Nearby filter chips (§4 of the handoff). */
export function FriendsMapFilterChips({ filter, onSelect, totalCount, liveCount, nearbyCount }: FriendsMapFilterChipsProps) {
  const chips: { key: MapFilter; label: string; count: number; dot?: boolean }[] = [
    { key: 'all', label: 'All', count: totalCount },
    { key: 'live', label: 'Live', count: liveCount, dot: true },
    { key: 'nearby', label: 'Nearby', count: nearbyCount },
  ];
  return (
    <View style={styles.row}>
      {chips.map((c) => {
        const active = filter === c.key;
        return (
          <Pressable key={c.key} onPress={() => onSelect(c.key)} style={[styles.chip, { backgroundColor: active ? fmColor.ink : fmColor.white }]}>
            {c.dot && <View style={styles.dot} />}
            <Text style={[styles.label, { color: active ? fmColor.white : fmColor.ink }]}>{c.label}</Text>
            <Text style={[styles.count, { color: active ? fmColor.white : fmColor.ink }]}>{c.count}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 8 },
  chip: {
    height: fmLayout.chipH,
    paddingHorizontal: 13,
    borderRadius: fmLayout.chipH / 2,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    shadowColor: fmColor.ink,
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 10,
  },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: fmColor.lime, borderWidth: 1.5, borderColor: fmColor.ink },
  label: { fontFamily: fmFont.ui600, fontSize: 13 },
  count: { fontFamily: fmFont.mono500, fontSize: 11, opacity: 0.65 },
});
