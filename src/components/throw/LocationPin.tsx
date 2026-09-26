import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { throwColor, throwFont } from '../../theme/throwTokens';

interface LocationPinGlyphProps {
  label: string;
  isSelf?: boolean;
  /** The currently-selected recipient — emphasized with a glowing ring. */
  selected?: boolean;
  /** A friend who isn't the current selection — faded so the selected one reads clearly. */
  dimmed?: boolean;
  /** Swaps the selected pin's clay/brown glow-and-ring for a white glow instead, matching the
   * map's own night basemap/style (see ThrowMap's isDay) — same signal as FoldingLetter's own
   * isNight, not a whole-app dark mode. Only the *selected* pin's emphasis colour changes; the
   * base dot/ring colours are untouched. */
  isNight?: boolean;
}

/** The pin's visual (ring/dot/label) with no positioning of its own — used directly as a native
 * map Marker's child (the Marker itself owns lat/lng-driven placement) and internally by
 * `LocationPin` below (for the web map's DOM-overlay pins, positioned by pixel x/y). */
export function LocationPinGlyph({ label, isSelf, selected, dimmed, isNight }: LocationPinGlyphProps) {
  return (
    <View style={[styles.stack, dimmed && styles.dimmed]}>
      {selected && <View style={[styles.glow, isNight && styles.glowNight]} />}
      <View style={[styles.ring, isSelf && styles.ringSelf, selected && (isNight ? styles.ringSelectedNight : styles.ringSelected)]} />
      <View
        style={[
          styles.dot,
          isSelf ? styles.dotSelf : styles.dotFriend,
          selected && styles.dotSelected,
          selected && isNight && styles.dotSelectedNight,
        ]}
      />
      <Text style={[styles.label, isSelf && styles.labelSelf, selected && styles.labelSelected]} numberOfLines={1}>
        {isSelf ? 'You' : label}
      </Text>
    </View>
  );
}

interface LocationPinProps extends LocationPinGlyphProps {
  x: number;
  y: number;
  onPress?: () => void;
}

/** A pin absolutely positioned over the web map by pixel x/y (from Leaflet's own projection) —
 * own location vs. a friend's read differently. */
export function LocationPin({ x, y, label, isSelf, onPress, selected, dimmed, isNight }: LocationPinProps) {
  const content = <LocationPinGlyph label={label} isSelf={isSelf} selected={selected} dimmed={dimmed} isNight={isNight} />;

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
  dimmed: { opacity: 0.38 },
  glow: {
    position: 'absolute',
    top: -11,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(201,113,79,.22)',
  },
  // Night skin — a white glow instead of the day skin's clay-brown one, matching the map's own
  // dark night basemap.
  glowNight: { backgroundColor: 'rgba(255,255,255,.28)' },
  ring: { position: 'absolute', top: -3, width: 20, height: 20, borderRadius: 10, backgroundColor: throwColor.pinRing },
  ringSelf: { backgroundColor: 'rgba(43,35,28,.14)' },
  ringSelected: { backgroundColor: 'rgba(201,113,79,.4)' },
  ringSelectedNight: { backgroundColor: 'rgba(255,255,255,.45)' },
  dot: { width: 12, height: 12, borderRadius: 6, borderWidth: 2, borderColor: throwColor.paper },
  dotSelf: { backgroundColor: throwColor.pinSelf },
  dotFriend: { backgroundColor: throwColor.pinFriend },
  dotSelected: { width: 14, height: 14, borderRadius: 7 },
  dotSelectedNight: { backgroundColor: '#FFFFFF' },
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
  labelSelected: { color: throwColor.clayDeep, fontFamily: throwFont.ui700 },
});
