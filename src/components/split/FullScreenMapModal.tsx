import React, { useEffect, useRef, useState } from 'react';
import { Dimensions, Modal, PanResponder, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import type { GestureResponderEvent, PanResponderGestureState } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fontFamily, spacing } from '../../theme';
import { Icon } from '../Icon';
import { initialsOf } from './MemberAvatar';
import type { LocationShare, PlannedSpot, SplitMember } from '../../types/split';
import { SPOT_ICON_DEFAULT, SPOT_ICON_MAP } from '../../data/spotIcons';

const CLOSE_ICON = 'M6 6l12 12M18 6L6 18';
const PLUS_ICON = 'M12 5v14M5 12h14';
const MINUS_ICON = 'M5 12h14';
// Below 1, the canvas shrinks inside the frame with empty margin around it —
// that's what makes "zoom all the way out" actually show the whole map
// instead of bottoming out at the same edge-to-edge crop it opened with.
const MIN_SCALE = 0.5;
const DEFAULT_SCALE = 1;
const MAX_SCALE = 4;
const LONG_PRESS_MS = 480;
const TAP_SLOP = 10;
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

function maxOffsetFor(scale: number): { x: number; y: number } {
  // Clamp to 0 so a scale below 1 (shrinking the canvas to show the whole
  // map) never produces a negative bound, which would make clamp()'s
  // min > max and silently break panning.
  return { x: Math.max(0, ((scale - 1) * SCREEN_W) / 2) + 40, y: Math.max(0, ((scale - 1) * SCREEN_H) / 2) + 40 };
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
  /** Fired on a long-press over the canvas with the tapped position as a 0-100 percentage, for precise pre-spotting while zoomed in. */
  onAddSpotAt?: (posX: number, posY: number) => void;
}

/** Full-screen pinch-zoom + pan view of the trip's stylized map canvas — same pins as the dashboard card, just bigger. No real map tiles, by design. */
export function FullScreenMapModal({ visible, onClose, members, locations, spots, userId, onAddSpotAt }: FullScreenMapModalProps) {
  const insets = useSafeAreaInsets();
  const [scale, setScaleState] = useState(1);
  const [translate, setTranslateState] = useState({ x: 0, y: 0 });

  // Gesture handlers below read/write these refs (never the state above) so every
  // gesture always starts from the *current* zoom/pan — closing over the state
  // values directly would freeze them at whatever they were on the render that
  // first created the PanResponder, making pinch/pan appear to do nothing after
  // the very first touch.
  const scaleRef = useRef(1);
  const translateRef = useRef({ x: 0, y: 0 });
  const canvasRef = useRef<View>(null);
  const canvasClipRef = useRef<View>(null);
  const gesture = useRef({
    startScale: 1,
    startTranslate: { x: 0, y: 0 },
    startDistance: 0,
    startPage: { x: 0, y: 0 },
    moved: false,
    longPressFired: false,
  }).current;
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const applyScale = (next: number) => {
    scaleRef.current = next;
    setScaleState(next);
  };
  const applyTranslate = (next: { x: number; y: number }) => {
    translateRef.current = next;
    setTranslateState(next);
  };

  const zoomBy = (factor: number) => {
    const next = clamp(scaleRef.current * factor, MIN_SCALE, MAX_SCALE);
    applyScale(next);
    const bound = maxOffsetFor(next);
    applyTranslate({ x: clamp(translateRef.current.x, -bound.x, bound.x), y: clamp(translateRef.current.y, -bound.y, bound.y) });
  };

  const clearLongPressTimer = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  useEffect(() => {
    if (visible) {
      applyScale(DEFAULT_SCALE);
      applyTranslate({ x: 0, y: 0 });
    }
    return clearLongPressTimer;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  // Trackpad pinch and mouse-wheel zoom — desktop browsers never fire the
  // multi-touch events PanResponder needs for pinch, so web needs its own path.
  useEffect(() => {
    if (Platform.OS !== 'web' || !visible) return;
    const node = canvasClipRef.current as unknown as HTMLElement | null;
    if (!node) return;
    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      zoomBy(Math.exp(-e.deltaY * 0.01));
    };
    node.addEventListener('wheel', handleWheel, { passive: false });
    return () => node.removeEventListener('wheel', handleWheel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const dropSpotAt = (pageX: number, pageY: number) => {
    if (!onAddSpotAt) return;
    (canvasRef.current as unknown as { measure?: (cb: (x: number, y: number, w: number, h: number, px: number, py: number) => void) => void })?.measure?.(
      (_x, _y, width, height, canvasPageX, canvasPageY) => {
        if (!width || !height) return;
        const posX = clamp(((pageX - canvasPageX) / width) * 100, 0, 100);
        const posY = clamp(((pageY - canvasPageY) / height) * 100, 0, 100);
        onAddSpotAt(posX, posY);
      },
    );
  };

  const responderRef = useRef<ReturnType<typeof PanResponder.create> | null>(null);
  if (!responderRef.current) {
    responderRef.current = PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt) => {
        gesture.startScale = scaleRef.current;
        gesture.startTranslate = translateRef.current;
        gesture.startDistance = touchDistance(evt.nativeEvent.touches);
        gesture.moved = false;
        gesture.longPressFired = false;
        const touch = evt.nativeEvent.touches[0] ?? evt.nativeEvent;
        gesture.startPage = { x: touch.pageX, y: touch.pageY };

        clearLongPressTimer();
        if (onAddSpotAt && evt.nativeEvent.touches.length <= 1) {
          longPressTimer.current = setTimeout(() => {
            if (!gesture.moved) {
              gesture.longPressFired = true;
              dropSpotAt(gesture.startPage.x, gesture.startPage.y);
            }
          }, LONG_PRESS_MS);
        }
      },
      onPanResponderMove: (evt, g: PanResponderGestureState) => {
        const touches = evt.nativeEvent.touches;
        if (Math.abs(g.dx) > TAP_SLOP || Math.abs(g.dy) > TAP_SLOP) {
          gesture.moved = true;
          clearLongPressTimer();
        }

        if (touches.length >= 2) {
          clearLongPressTimer();
          const dist = touchDistance(touches);
          if (gesture.startDistance === 0) gesture.startDistance = dist;
          if (gesture.startDistance > 0) {
            const next = clamp(gesture.startScale * (dist / gesture.startDistance), MIN_SCALE, MAX_SCALE);
            applyScale(next);
            const bound = maxOffsetFor(next);
            applyTranslate({
              x: clamp(translateRef.current.x, -bound.x, bound.x),
              y: clamp(translateRef.current.y, -bound.y, bound.y),
            });
          }
        } else {
          const bound = maxOffsetFor(gesture.startScale);
          applyTranslate({
            x: clamp(gesture.startTranslate.x + g.dx, -bound.x, bound.x),
            y: clamp(gesture.startTranslate.y + g.dy, -bound.y, bound.y),
          });
        }
      },
      onPanResponderRelease: () => {
        clearLongPressTimer();
        gesture.startDistance = 0;
      },
      onPanResponderTerminate: () => {
        clearLongPressTimer();
        gesture.startDistance = 0;
      },
    });
  }
  const responder = responderRef.current;

  if (!visible) return null;

  return (
    <Modal visible transparent={false} animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.wrap}>
        <View ref={canvasClipRef} style={styles.canvasClip} {...responder.panHandlers}>
          <View ref={canvasRef} style={[styles.canvas, { transform: [{ translateX: translate.x }, { translateY: translate.y }, { scale }] }]}>
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

        <View style={[styles.zoomStack, { bottom: insets.bottom + spacing.xxxl + 34 }]}>
          <Pressable onPress={() => zoomBy(1.5)} style={styles.zoomButton} accessibilityRole="button" accessibilityLabel="Zoom in">
            <Icon path={PLUS_ICON} color="#fff" size={16} strokeWidth={2.4} />
          </Pressable>
          <View style={styles.zoomDivider} />
          <Pressable onPress={() => zoomBy(1 / 1.5)} style={styles.zoomButton} accessibilityRole="button" accessibilityLabel="Zoom out">
            <Icon path={MINUS_ICON} color="#fff" size={16} strokeWidth={2.4} />
          </Pressable>
        </View>

        <Text style={[styles.hint, { bottom: insets.bottom + spacing.lg }]}>
          {onAddSpotAt ? 'Pinch or scroll to zoom · Hold to drop a pin' : 'Pinch or scroll to zoom · Drag to pan'}
        </Text>
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
  zoomStack: {
    position: 'absolute',
    right: spacing.xxxl,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,.14)',
    overflow: 'hidden',
  },
  zoomButton: {
    width: 44,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  zoomDivider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,.18)',
  },
  hint: {
    position: 'absolute',
    alignSelf: 'center',
    fontFamily: fontFamily.sans500,
    fontSize: 12.5,
    color: 'rgba(255,255,255,.6)',
  },
});
