import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, PanResponder, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Icon } from '../../Icon';
import { LetterPlaneGlyph } from '../inbox/LetterPlaneGlyph';
import { vibrate } from '../../../utils/haptics';
import { v3Color, v3Font } from '../../../theme/throwLettersV3Tokens';
import { noSelect } from '../../../theme/webStyles';

const BELL_ICON = 'M6 16v-5a6 6 0 1 1 12 0v5l1.5 2h-15z M10 20.5a2 2 0 0 0 4 0';
const PAPERCLIP_ICON = 'M20 11.5l-7.8 7.8a5 5 0 0 1-7.1-7.1l8.5-8.5a3.3 3.3 0 0 1 4.7 4.7l-8.5 8.5a1.7 1.7 0 0 1-2.4-2.4l7.8-7.8';
const TRASH_ICON = 'M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3';

export interface ChipsRowV3Item {
  id: string;
  short: string;
  unread: boolean;
  alert: boolean;
  hasMedia: boolean;
  a11yLabel: string;
}

const s = (n: number, scale: number) => n * scale;
const DEL = 80;
const LONG_PRESS_MS = 420;
const MOVE_SLOP = 8;
const CHIP = 60;
const CHIP_GLYPH = 32;

/** The active chip's own long-press(420ms)-then-drag-UP(80px)-to-delete gesture — the mirror image
 * of PlaneSlider's own long-press-drag-DOWN gesture (this screen's bin sits above the chip row,
 * not below it, per its own handoff), same dual-path convention (native PanResponder / raw window
 * pointer listeners on web, since RN Web's PanResponder move events aren't reliable under a real
 * drag). Duplicated here rather than shared with PlaneSlider's own private copy — small, and the
 * sign is inverted throughout, so sharing would need its own direction flag for one call site. */
function useActiveChipDragUp(opts: { enabled: boolean; onArm: () => void; onLiftChange: (lift: number) => void; onRelease: (lift: number) => void }) {
  const { enabled, onArm, onLiftChange, onRelease } = opts;
  const nodeRef = useRef<View>(null);
  const armedRef = useRef(false);
  const movedRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startRef = useRef({ x: 0, y: 0 });
  const liftRef = useRef(0);

  const clearTimer = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };
  const onStart = (x: number, y: number) => {
    if (!enabled) return;
    armedRef.current = false;
    movedRef.current = false;
    startRef.current = { x, y };
    clearTimer();
    timerRef.current = setTimeout(() => {
      if (movedRef.current) return;
      armedRef.current = true;
      liftRef.current = 0;
      onArm();
    }, LONG_PRESS_MS);
  };
  const onMove = (x: number, y: number) => {
    const dx = x - startRef.current.x;
    const dy = y - startRef.current.y;
    if (!armedRef.current) {
      if (Math.hypot(dx, dy) > MOVE_SLOP) {
        movedRef.current = true;
        clearTimer();
      }
      return;
    }
    const lift = -dy;
    liftRef.current = lift > 0 ? lift : lift * 0.2;
    onLiftChange(liftRef.current);
  };
  const onEnd = () => {
    clearTimer();
    if (armedRef.current) {
      armedRef.current = false;
      onRelease(liftRef.current);
    }
    liftRef.current = 0;
  };
  const onCancel = () => {
    clearTimer();
    if (armedRef.current) {
      armedRef.current = false;
      onRelease(-1);
    }
  };

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => enabled,
        onMoveShouldSetPanResponder: () => enabled,
        onPanResponderGrant: (e) => onStart(e.nativeEvent.pageX, e.nativeEvent.pageY),
        onPanResponderMove: (e) => onMove(e.nativeEvent.pageX, e.nativeEvent.pageY),
        onPanResponderRelease: onEnd,
        onPanResponderTerminate: onCancel,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [enabled],
  );

  useEffect(() => {
    if (Platform.OS !== 'web' || !enabled) return;
    const node = nodeRef.current as unknown as HTMLElement | null;
    if (!node) return;
    const point = (e: MouseEvent | TouchEvent) => ('touches' in e ? e.touches[0] : e);
    const onDown = (e: MouseEvent | TouchEvent) => {
      const p = point(e);
      if (p) onStart(p.clientX, p.clientY);
    };
    const onMoveWeb = (e: MouseEvent | TouchEvent) => {
      const p = point(e);
      if (p) onMove(p.clientX, p.clientY);
    };
    node.addEventListener('mousedown', onDown);
    node.addEventListener('touchstart', onDown, { passive: true });
    window.addEventListener('mousemove', onMoveWeb);
    window.addEventListener('touchmove', onMoveWeb, { passive: true });
    window.addEventListener('mouseup', onEnd);
    window.addEventListener('touchend', onEnd);
    return () => {
      node.removeEventListener('mousedown', onDown);
      node.removeEventListener('touchstart', onDown);
      window.removeEventListener('mousemove', onMoveWeb);
      window.removeEventListener('touchmove', onMoveWeb);
      window.removeEventListener('mouseup', onEnd);
      window.removeEventListener('touchend', onEnd);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  return { nodeRef, panHandlers: Platform.OS === 'web' ? {} : panResponder.panHandlers };
}

/**
 * The bottom letters strip — title + snap-scrolling chip row, the active chip's own long-press-
 * drag-up-to-delete gesture (bin rendered above the row, see ChipsRowV3's sibling in the screen),
 * ported from the handoff's own `chipDown`/`chipMove`/`chipUp`/`deleteActive`.
 */
export function ChipsRowV3({
  rowTitle,
  chips,
  activeIndex,
  busy,
  onSelectChip,
  onDeleteCommit,
  onArmedChange,
  scale,
}: {
  rowTitle: string;
  chips: ChipsRowV3Item[];
  activeIndex: number;
  busy: boolean;
  onSelectChip: (index: number, origin: { x: number; y: number }) => void;
  onDeleteCommit: () => void;
  onArmedChange: (armed: boolean) => void;
  scale: number;
}) {
  const [armed, setArmed] = useState(false);
  const [lift, setLift] = useState(0);
  const ghostY = useRef(new Animated.Value(0)).current;
  const ghostScale = useRef(new Animated.Value(1.08)).current;
  const ghostOpacity = useRef(new Animated.Value(1)).current;
  const chipRefs = useRef(new Map<string, View>()).current;

  useEffect(() => {
    setArmed(false);
    setLift(0);
    onArmedChange(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeIndex, chips.length]);

  const commitDelete = () => {
    vibrate([8, 40, 8]);
    // Continues the ghost's own upward travel a bit further (into the bin above) while it shrinks
    // and fades, rather than freezing it at the exact release point — reads as "dropping into the
    // bin" instead of just vanishing in place. `armed` (and so the bin/ghost themselves) stays true
    // through this — the reset below only fires once the real delete actually lands and the chip
    // list/active index change.
    Animated.parallel([
      Animated.timing(ghostY, { toValue: -(lift + s(80, scale)), duration: 400, easing: Easing.bezier(0.5, 0, 0.8, 0.4), useNativeDriver: true }),
      Animated.timing(ghostScale, { toValue: 0.4, duration: 400, easing: Easing.bezier(0.5, 0, 0.8, 0.4), useNativeDriver: true }),
      Animated.timing(ghostOpacity, { toValue: 0, duration: 400, easing: Easing.linear, useNativeDriver: true }),
    ]).start();
    onDeleteCommit();
  };

  const gesture = useActiveChipDragUp({
    enabled: !busy,
    onArm: () => {
      vibrate(12);
      setArmed(true);
      setLift(0);
      ghostScale.setValue(1.08);
      ghostOpacity.setValue(1);
      onArmedChange(true);
    },
    onLiftChange: setLift,
    onRelease: (finalLift) => {
      if (finalLift > DEL) {
        commitDelete();
      } else {
        setArmed(false);
        setLift(0);
        onArmedChange(false);
      }
    },
  });

  useEffect(() => {
    ghostY.setValue(-lift);
  }, [lift, ghostY]);

  const onChipTap = (index: number, id: string) => {
    if (busy || index === activeIndex) return;
    const node = chipRefs.get(id);
    if (!node) {
      onSelectChip(index, { x: 195 * scale, y: 640 * scale });
      return;
    }
    node.measureInWindow((x, y, w, h) => {
      onSelectChip(index, { x: x + w / 2, y: y + h / 2 });
    });
  };

  const over = lift > DEL;

  return (
    <View style={[{ gap: s(10, scale) }, noSelect]}>
      <View style={{ paddingHorizontal: s(24, scale) }}>
        <Text style={[styles.mono, { fontSize: s(10.5, scale), letterSpacing: 1.1 }]}>{rowTitle}</Text>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        decelerationRate="fast"
        snapToInterval={s(CHIP + 10, scale)}
        scrollEnabled={!armed}
        contentContainerStyle={{ gap: s(10, scale), paddingHorizontal: s(24, scale), paddingVertical: s(6, scale) }}
      >
        {chips.map((c, i) => {
          const active = i === activeIndex;
          const armedHere = active && armed;
          const variant = armedHere ? 'delete' : active ? 'active' : 'default';
          const bg = armedHere ? v3Color.deleteRed : active ? v3Color.accentBlue : c.unread ? v3Color.chipUnread : v3Color.chipRead;
          const labelColor = armedHere ? v3Color.deleteRed : active ? v3Color.accentBlue : c.unread ? v3Color.ink : v3Color.muted;
          const chipBox = (
            <View style={[styles.chip, { width: s(CHIP, scale), height: s(CHIP, scale), borderRadius: s(18, scale), backgroundColor: bg }, !active && c.unread && styles.chipUnreadShadow, active && styles.chipActiveShadow]}>
              <LetterPlaneGlyph size={s(CHIP_GLYPH, scale)} variant={variant} tiltDeg={-14} />
              {!active && c.unread && (
                <View style={[styles.unreadDot, { width: s(16, scale), height: s(16, scale), borderRadius: s(8, scale), borderWidth: s(3, scale), borderColor: bg }]} />
              )}
              {(c.alert || c.hasMedia) && (
                <View style={[styles.cornerBadges, { gap: s(2, scale) }]}>
                  {c.alert && (
                    <View style={[styles.cornerBadge, styles.alertBadge, { width: s(20, scale), height: s(20, scale), borderRadius: s(10, scale) }]}>
                      <Icon path={BELL_ICON} size={s(10, scale)} color="#FFFFFF" strokeWidth={3} />
                    </View>
                  )}
                  {c.hasMedia && (
                    <View style={[styles.cornerBadge, styles.mediaBadge, { width: s(20, scale), height: s(20, scale), borderRadius: s(10, scale) }]}>
                      <Icon path={PAPERCLIP_ICON} size={s(11, scale)} color={v3Color.accentBlue} strokeWidth={2.8} />
                    </View>
                  )}
                </View>
              )}
            </View>
          );
          if (active) {
            return (
              <View
                key={c.id}
                ref={(node) => {
                  if (node) chipRefs.set(c.id, node as unknown as View);
                  gesture.nodeRef.current = node as unknown as View;
                }}
                {...gesture.panHandlers}
                accessibilityRole="button"
                accessibilityLabel={c.a11yLabel}
                style={{ alignItems: 'center', gap: s(5, scale), opacity: armedHere ? 0.2 : 1, minWidth: 44, minHeight: 44 }}
              >
                {chipBox}
                <Text style={[styles.mono, { fontSize: s(9, scale), color: labelColor }]}>{c.short}</Text>
              </View>
            );
          }
          return (
            <Pressable
              key={c.id}
              ref={(node) => {
                if (node) chipRefs.set(c.id, node as unknown as View);
              }}
              onPress={() => onChipTap(i, c.id)}
              accessibilityRole="button"
              accessibilityLabel={c.a11yLabel}
              hitSlop={4}
              style={{ alignItems: 'center', gap: s(5, scale), minWidth: 44, minHeight: 44 }}
            >
              {chipBox}
              <Text style={[styles.mono, { fontSize: s(9, scale), color: labelColor }]}>{c.short}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {armed && (
        <View pointerEvents="none" style={[styles.binWrap, { gap: s(8, scale), bottom: s(108, scale) }]}>
          <Text style={[styles.mono, { fontSize: s(10, scale), letterSpacing: 1.1, color: over ? v3Color.deleteRed : '#333333' }]}>
            {over ? 'RELEASE TO DELETE' : 'DRAG UP TO DELETE'}
          </Text>
          <View style={[styles.bin, { width: s(54, scale), height: s(54, scale), borderRadius: s(27, scale), backgroundColor: over ? v3Color.deleteRed : v3Color.binDark, transform: [{ scale: over ? 1.15 : 1 }] }]}>
            <Icon path={TRASH_ICON} size={s(24, scale)} color="#FFFFFF" strokeWidth={1.8} />
          </View>
        </View>
      )}

      {armed && (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.ghost,
            {
              width: s(CHIP, scale),
              height: s(CHIP, scale),
              borderRadius: s(18, scale),
              bottom: s(60, scale),
              alignSelf: 'center',
              opacity: ghostOpacity,
              transform: [{ translateY: ghostY }, { rotate: `${Math.min(8, lift * 0.08).toFixed(1)}deg` }, { scale: ghostScale }],
            },
          ]}
        >
          <LetterPlaneGlyph size={s(CHIP_GLYPH, scale)} variant="delete" tiltDeg={-14} />
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  mono: { fontFamily: v3Font.mono, color: '#444444' },
  chip: { alignItems: 'center', justifyContent: 'center' },
  chipUnreadShadow: { shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 14, shadowOffset: { width: 0, height: 6 }, elevation: 3 },
  chipActiveShadow: { shadowColor: v3Color.accentBlue, shadowOpacity: 0.35, shadowRadius: 18, shadowOffset: { width: 0, height: 8 }, elevation: 5 },
  unreadDot: { position: 'absolute', left: -4, top: -4, backgroundColor: v3Color.accentBlue },
  cornerBadges: { position: 'absolute', right: -5, top: -5, flexDirection: 'row' },
  cornerBadge: { borderWidth: 2, borderColor: '#F4F4F2', alignItems: 'center', justifyContent: 'center' },
  alertBadge: { backgroundColor: v3Color.ink },
  mediaBadge: { backgroundColor: '#FFFFFF' },
  binWrap: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  bin: { alignItems: 'center', justifyContent: 'center' },
  ghost: { position: 'absolute', backgroundColor: v3Color.deleteRed, alignItems: 'center', justifyContent: 'center' },
});
