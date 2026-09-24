import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { throwColor, throwFont } from '../../theme/throwTokens';

interface LocationPinProps {
  x: number;
  y: number;
  label: string;
  isSelf?: boolean;
  onPress?: () => void;
}

/** A pin absolutely positioned over the world map SVG — own location vs. a friend's read differently. */
export function LocationPin({ x, y, label, isSelf, onPress }: LocationPinProps) {
  const content = (
    <View style={styles.stack}>
      <View style={[styles.ring, isSelf && styles.ringSelf]} />
      <View style={[styles.dot, isSelf ? styles.dotSelf : styles.dotFriend]} />
      <Text style={[styles.label, isSelf && styles.labelSelf]} numberOfLines={1}>
        {isSelf ? 'You' : label}
      </Text>
    </View>
  );

  return (
    <View style={[styles.wrap, { left: x - 34, top: y - 14 }]} pointerEvents={onPress ? 'box-none' : 'none'}>
      {onPress ? (
        <Pressable onPress={onPress} hitSlop={10}>
          {content}
        </Pressable>
      ) : (
        content
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', width: 68, alignItems: 'center' },
  stack: { alignItems: 'center' },
  ring: { position: 'absolute', top: -3, width: 20, height: 20, borderRadius: 10, backgroundColor: throwColor.pinRing },
  ringSelf: { backgroundColor: 'rgba(43,35,28,.14)' },
  dot: { width: 12, height: 12, borderRadius: 6, borderWidth: 2, borderColor: throwColor.paper },
  dotSelf: { backgroundColor: throwColor.pinSelf },
  dotFriend: { backgroundColor: throwColor.pinFriend },
  label: {
    marginTop: 4,
    fontFamily: throwFont.ui600,
    fontSize: 10.5,
    color: throwColor.ink,
    backgroundColor: 'rgba(251,246,236,.88)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    overflow: 'hidden',
  },
  labelSelf: { color: throwColor.clayDeep, fontFamily: throwFont.ui700 },
});
