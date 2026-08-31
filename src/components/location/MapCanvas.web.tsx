import React, { forwardRef, useImperativeHandle } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, fontFamily } from '../../theme';
import { Icon } from '../Icon';
import { FriendAvatar } from '../friends/FriendAvatar';
import type { MapCanvasHandle, MapCanvasProps } from './mapTypes';

const CLOCK_ICON = 'M12 7v5l3.5 2M12 21a9 9 0 100-18 9 9 0 000 18z';

// Fixed illustrative slots on the canvas — react-native-maps has no web
// support, so real coordinates can't be projected here. Only pins with a
// real coordinate (from a friend's own last-seen/share) are shown; the
// slot is just where they land visually, cycled by list order.
const PIN_SLOTS = [
  { x: 66, y: 176 },
  { x: 252, y: 148 },
  { x: 292, y: 300 },
  { x: 122, y: 344 },
  { x: 58, y: 430 },
  { x: 262, y: 410 },
];

/** Web fallback: an original abstract map illustration (not a real map provider) — Live Locations is a mobile-only feature. */
export const MapCanvas = forwardRef<MapCanvasHandle, MapCanvasProps>(function MapCanvas({ pins, amSharing, onSelectPin }, ref) {
  useImperativeHandle(ref, () => ({ recenter: () => {} }));
  const located = pins.filter((p) => p.latitude !== null && p.longitude !== null);

  return (
    <View style={styles.mapBg}>
      <View style={[styles.road, { top: 214, transform: [{ rotate: '-3deg' }] }]} />
      <View style={[styles.road, { top: 398, transform: [{ rotate: '2.5deg' }] }]} />
      <View style={[styles.road, { top: 560, transform: [{ rotate: '-1.5deg' }] }]} />
      <View style={[styles.roadV, { left: 118, transform: [{ rotate: '5deg' }] }]} />
      <View style={[styles.roadV, { left: 276, transform: [{ rotate: '-4deg' }] }]} />
      <View style={[styles.block, { left: 22, top: 118, width: 76, height: 52 }]} />
      <View style={[styles.block, { left: 168, top: 96, width: 92, height: 64 }]} />
      <View style={[styles.block, { left: 24, top: 262, width: 64, height: 44 }]} />
      <View style={[styles.block, { left: 300, top: 210, width: 60, height: 80 }]} />
      <View style={[styles.block, { left: 170, top: 420, width: 80, height: 52 }]} />
      <View style={styles.parkA} />
      <View style={styles.parkB} />

      {located.map((p, i) => {
        const slot = PIN_SLOTS[i % PIN_SLOTS.length];
        return (
          <Pressable key={p.userId} onPress={() => onSelectPin(p.userId)} style={[styles.pinWrap, { left: slot.x, top: slot.y }]} accessibilityRole="button" accessibilityLabel={p.name}>
            <FriendAvatar userId={p.userId} name={p.name} size={50} />
            {p.live ? (
              <View style={styles.liveBadge}>
                <View style={styles.liveDot} />
                <Text style={styles.liveBadgeText}>LIVE</Text>
              </View>
            ) : (
              <View style={styles.lastSeenBadge}>
                <Icon path={CLOCK_ICON} color={colors.lime} size={10} strokeWidth={2.4} />
              </View>
            )}
          </Pressable>
        );
      })}

      {amSharing ? (
        <View style={[styles.pinWrap, { left: 190, top: 236 }]}>
          <View style={styles.youTile}>
            <Text style={styles.youTileText}>You</Text>
          </View>
          <View style={styles.liveBadge}>
            <View style={styles.liveDot} />
            <Text style={styles.liveBadgeText}>LIVE</Text>
          </View>
        </View>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  mapBg: {
    flex: 1,
    backgroundColor: '#EDF2EA',
    overflow: 'hidden',
  },
  road: {
    position: 'absolute',
    left: -30,
    width: 450,
    height: 9,
    borderRadius: 5,
    backgroundColor: 'rgba(255,255,255,0.6)',
  },
  roadV: {
    position: 'absolute',
    top: -20,
    width: 9,
    height: 884,
    borderRadius: 5,
    backgroundColor: 'rgba(255,255,255,0.55)',
  },
  block: {
    position: 'absolute',
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.5)',
  },
  parkA: {
    position: 'absolute',
    left: 206,
    top: 246,
    width: 150,
    height: 118,
    borderRadius: 60,
    backgroundColor: 'rgba(195,234,79,0.38)',
  },
  parkB: {
    position: 'absolute',
    left: 14,
    top: 436,
    width: 130,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(195,234,79,0.3)',
  },
  pinWrap: {
    position: 'absolute',
  },
  liveBadge: {
    position: 'absolute',
    top: -8,
    right: -10,
    backgroundColor: colors.coral,
    borderRadius: 999,
    paddingHorizontal: 7,
    paddingVertical: 2,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    shadowColor: colors.ink,
    shadowOpacity: 0.2,
    shadowOffset: { width: 0, height: 3 },
    shadowRadius: 6,
    elevation: 2,
  },
  liveDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#fff',
  },
  liveBadgeText: {
    fontFamily: fontFamily.mono500,
    fontSize: 8.5,
    letterSpacing: 0.4,
    color: '#fff',
  },
  lastSeenBadge: {
    position: 'absolute',
    bottom: -3,
    right: -5,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.ink,
    borderWidth: 2,
    borderColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  youTile: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: colors.ink,
    borderWidth: 3,
    borderColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  youTileText: {
    fontFamily: fontFamily.sans700,
    fontSize: 14,
    color: colors.lime,
  },
});
