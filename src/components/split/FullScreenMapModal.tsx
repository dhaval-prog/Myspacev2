import React, { useEffect, useRef, useState } from 'react';
import { Dimensions, Modal, PanResponder, Pressable, StyleSheet, Text, View } from 'react-native';
import type { GestureResponderEvent, PanResponderGestureState } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fontFamily, spacing } from '../../theme';
import { Icon } from '../Icon';
import { initialsOf } from './MemberAvatar';
import type { LocationShare, PlannedSpot, SplitMember } from '../../types/split';
import { SPOT_ICON_DEFAULT, SPOT_ICON_MAP } from '../../data/spotIcons';

const CLOSE_ICON = 'M6 6l12 12M18 6L6 18';
const MIN_SCALE = 1;
const MAX_SCALE = 4;
const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

const GRADIENT_PROPS = {
  colors: colors.splitGradient as [string, string, ...string[]],
  start: { x: 0, y: 0 },
  end: { x: 1, y: 1 },
};

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

function touchDistance(touches: GestureResponderEvent['nativeEvent']['touches']): number {
  if (touches.length < 2) return 0;
  const [a, b] = touches;
  return Math.hypot(a.pageX - b.pageX, a.pageY - b.pageY);
}

/** Deterministic pseudo-position on the stylized map area, purely decorative (not a real projection). */
function pinPosition(userId: string): { left: `${number}%`; top: `${number}%` } {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) hash = (hash * 31 + userId.charCodeAt(i)) >>> 0;
  const left = 12 + (hash % 76);
  const top = 14 + ((hash >> 8) % 62);
  return { left: `${left}%`, top: `${top}%` };
}

interface FullScreenMapModalProps {
  visible: boolean;
  onClose: () => void;
  members: SplitMember[];
  locations: LocationShare[];
  spots: PlannedSpot[];
  userId: string | null;
}

/** Full-screen pinch-zoom + pan view of the trip's stylized map canvas — same pins as the dashboard card, just bigger. No real map tiles, by design. */
export function FullScreenMapModal({ visible, onClose, members, locations, spots, userId }: FullScreenMapModalProps) {
  const insets = useSafeAreaInsets();
  const [scale, setScale] = useState(1);
  const [translate, setTranslate] = useState({ x: 0, y: 0 });
  const gesture = useRef({ startScale: 1, startTranslate: { x: 0, y: 0 }, startDistance: 0 }).current;

  useEffect(() => {
    if (visible) {
      setScale(1);
      setTranslate({ x: 0, y: 0 });
    }
  }, [visible]);

  const responder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt) => {
        gesture.startScale = scale;
        gesture.startTranslate = translate;
        gesture.startDistance = touchDistance(evt.nativeEvent.touches);
      },
      onPanResponderMove: (evt, g: PanResponderGestureState) => {
        const touches = evt.nativeEvent.touches;
        if (touches.length >= 2) {
          const dist = touchDistance(touches);
          if (gesture.startDistance > 0) {
            const next = clamp(gesture.startScale * (dist / gesture.startDistance), MIN_SCALE, MAX_SCALE);
            setScale(next);
            const maxX = ((next - 1) * SCREEN_W) / 2 + 40;
            const maxY = ((next - 1) * SCREEN_H) / 2 + 40;
            setTranslate((prev) => ({ x: clamp(prev.x, -maxX, maxX), y: clamp(prev.y, -maxY, maxY) }));
          }
        } else {
          const maxX = ((gesture.startScale - 1) * SCREEN_W) / 2 + 40;
          const maxY = ((gesture.startScale - 1) * SCREEN_H) / 2 + 40;
          setTranslate({
            x: clamp(gesture.startTranslate.x + g.dx, -maxX, maxX),
            y: clamp(gesture.startTranslate.y + g.dy, -maxY, maxY),
          });
        }
      },
      onPanResponderRelease: () => {
        gesture.startDistance = 0;
      },
    }),
  ).current;

  if (!visible) return null;

  return (
    <Modal visible transparent={false} animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.wrap}>
        <View style={styles.canvasClip} {...responder.panHandlers}>
          <View style={[styles.canvas, { transform: [{ translateX: translate.x }, { translateY: translate.y }, { scale }] }]}>
            <View style={styles.roadA} />
            <View style={styles.roadB} />
            <View style={styles.roadC} />
            {locations
              .filter((l) => l.shared && l.lat !== null && l.lng !== null)
              .map((l) => {
                const member = members.find((m) => m.userId === l.userId);
                if (!member) return null;
                const isSelf = l.userId === userId;
                return (
                  <View key={l.userId} style={[styles.pin, pinPosition(l.userId)]}>
                    {isSelf ? (
                      <LinearGradient {...GRADIENT_PROPS} style={styles.pinTile}>
                        <Text style={styles.pinInitials}>{initialsOf(member.name)}</Text>
                      </LinearGradient>
                    ) : (
                      <View style={[styles.pinTile, styles.pinTileOff]}>
                        <Text style={styles.pinInitials}>{initialsOf(member.name)}</Text>
                      </View>
                    )}
                  </View>
                );
              })}
            {spots.map((s) => (
              <View key={s.id} style={[styles.spotPin, { left: `${s.posX}%`, top: `${s.posY}%` }]}>
                <View style={styles.spotPinTile}>
                  <Icon path={SPOT_ICON_MAP[s.icon] ?? SPOT_ICON_DEFAULT} color={colors.splitAccent} size={15} strokeWidth={1.8} />
                </View>
                <View style={styles.spotPinTail} />
              </View>
            ))}
          </View>
        </View>

        <Pressable
          onPress={onClose}
          style={[styles.closeButton, { top: insets.top + spacing.md }]}
          accessibilityRole="button"
          accessibilityLabel="Close map"
        >
          <Icon path={CLOSE_ICON} color="#fff" size={18} strokeWidth={2.2} />
        </Pressable>
        <Text style={[styles.hint, { bottom: insets.bottom + spacing.lg }]}>Pinch to zoom · Drag to pan</Text>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    backgroundColor: '#12142B',
    overflow: 'hidden',
  },
  canvasClip: {
    flex: 1,
    overflow: 'hidden',
  },
  canvas: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: '100%',
    height: '100%',
    backgroundColor: '#EDEEF6',
  },
  roadA: {
    position: 'absolute',
    left: '-15%',
    top: '42%',
    width: '130%',
    height: 46,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,.85)',
    transform: [{ rotate: '-14deg' }],
  },
  roadB: {
    position: 'absolute',
    left: '46%',
    top: '-15%',
    width: 34,
    height: '130%',
    backgroundColor: 'rgba(255,255,255,.7)',
    transform: [{ rotate: '9deg' }],
  },
  roadC: {
    position: 'absolute',
    left: '10%',
    top: '60%',
    width: '60%',
    height: 24,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,.6)',
    transform: [{ rotate: '32deg' }],
  },
  pin: {
    position: 'absolute',
  },
  pinTile: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#fff',
    shadowColor: colors.splitInk,
    shadowOpacity: 0.22,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 18,
    elevation: 4,
  },
  pinTileOff: {
    backgroundColor: colors.splitInk,
  },
  pinInitials: {
    fontFamily: fontFamily.sans700,
    fontSize: 13.5,
    color: '#fff',
  },
  spotPin: {
    position: 'absolute',
    alignItems: 'center',
  },
  spotPinTile: {
    width: 38,
    height: 38,
    borderRadius: 13,
    backgroundColor: colors.splitSurface,
    borderWidth: 2.5,
    borderColor: colors.splitAccent,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.splitInk,
    shadowOpacity: 0.2,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 14,
    elevation: 4,
  },
  spotPinTail: {
    width: 10,
    height: 10,
    borderRadius: 2,
    backgroundColor: colors.splitSurface,
    borderRightWidth: 2.5,
    borderBottomWidth: 2.5,
    borderColor: colors.splitAccent,
    transform: [{ rotate: '45deg' }],
    marginTop: -6,
  },
  closeButton: {
    position: 'absolute',
    right: spacing.xxxl,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  hint: {
    position: 'absolute',
    alignSelf: 'center',
    fontFamily: fontFamily.sans500,
    fontSize: 12.5,
    color: 'rgba(255,255,255,.6)',
  },
});
