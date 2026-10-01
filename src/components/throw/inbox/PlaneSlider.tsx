import React, { useEffect, useMemo, useRef, useState } from 'react';
import { PanResponder, Platform, Pressable, ScrollView, StyleSheet, Text, Vibration, View } from 'react-native';
import { Icon } from '../../Icon';
import { LetterPlaneGlyph } from './LetterPlaneGlyph';
import { ConfirmDialog } from '../../ConfirmDialog';
import { inboxColor } from '../../../theme/throwInboxTokens';
import { noSelect } from '../../../theme/webStyles';

export interface PlaneSliderChip {
  id: string;
  short: string;
  /** For the accessibility label, e.g. "Letter from Dhaval, Sunday, Lonavala". */
  a11yLabel: string;
}

interface PlaneSliderProps {
  chips: PlaneSliderChip[];
  activeIndex: number;
  contactName: string;
  scale: number;
  busy: boolean;
  canReplay: boolean;
  onSelectChip: (index: number, originScreen: { x: number; y: number }) => void;
  onReplay: () => void;
  onDelete: () => void;
  /** Hides the "LETTERS FROM X · N" header row and its Replay button, moves each chip's own day
   * label inside its own box (white text once active/armed-to-delete, black otherwise) instead of
   * rendering it as a separate line below, and swaps the delete gesture's own drag-to-bin flow for
   * a plain long-press-then-confirm popup (see ConfirmDialog below) — per explicit request, all
   * scoped to ThrowHomeScreen's own in-place panel. Defaults to the original header-plus-below-
   * box-label-plus-drag-to-bin look, which ThrowInboxScreen's own standalone screen keeps
   * unchanged. */
  compact?: boolean;
  /** Extra bottom clearance (the device's own safe-area inset, e.g. the home indicator) — only
   * applied in `compact` mode, which floats flush against the real screen bottom the same way
   * BottomNav's own dock does (and already gives itself this same clearance internally); ignored
   * otherwise, since ThrowInboxScreen's own usage is positioned from the top, not anchored to the
   * bottom edge. Per explicit request that the row not crowd the screen's bottom edge. */
  bottomInset?: number;
}

const s = (n: number, scale: number) => n * scale;
const DEL = 80;
const LONG_PRESS_MS = 420;
const MOVE_SLOP = 8;
const REPLAY_ICON = 'M20 11a8 8 0 1 0-2.3 5.7 M20 4v7h-7';
const TRASH_ICON = 'M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3';

/** `navigator.vibrate` on web, RN's own `Vibration` module on native — no new dependency. iOS
 * ignores the custom durations/patterns RN's Vibration API takes (a single default "tick"
 * regardless of what's passed, a known platform limitation), so this is a best-effort match to
 * the handoff's own `navigator.vibrate(12)` / `navigator.vibrate([8,40,8])`, not exact everywhere. */
function vibrate(pattern: number | number[]) {
  if (Platform.OS === 'web') {
    (navigator as { vibrate?: (p: number | number[]) => void }).vibrate?.(pattern);
    return;
  }
  Vibration.vibrate(pattern);
}

/**
 * The active chip's own long-press(420ms)-then-drag-down(80px)-to-delete gesture — a single
 * PanResponder (native) / raw window pointer listeners (web), same dual-path convention
 * ContactStoryStack/FoldingLetter already use for their own long-press+drag gestures (RN Web's
 * PanResponder gesture state isn't reliable under a real drag). Only the active chip ever gets
 * this: inactive chips are plain taps (see PlaneSlider's own chip rendering below) — matches the
 * handoff's own `chipDown`, which only starts the long-press timer `if (i === activeIndex)`.
 */
function useActiveChipGesture(opts: { enabled: boolean; onArm: () => void; onDragChange: (dy: number) => void; onRelease: (dy: number) => void }) {
  const { enabled, onArm, onDragChange, onRelease } = opts;
  const nodeRef = useRef<View>(null);
  const armedRef = useRef(false);
  const movedRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startRef = useRef({ x: 0, y: 0 });
  const dragYRef = useRef(0);

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
      dragYRef.current = 0;
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
    dragYRef.current = dy > 0 ? dy : dy * 0.2;
    onDragChange(dragYRef.current);
  };
  const onEnd = () => {
    clearTimer();
    if (armedRef.current) {
      armedRef.current = false;
      onRelease(dragYRef.current);
    }
    dragYRef.current = 0;
  };
  const onCancel = () => {
    clearTimer();
    if (armedRef.current) {
      armedRef.current = false;
      onRelease(-1); // negative = below threshold, always cancels
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
 * The bottom row — a horizontal scroll-snap strip of plane chips (newest-first), a header with
 * the letter count + Replay button, and the active chip's own long-press-to-arm delete gesture
 * (see `useActiveChipGesture`), which then either drags to a bin (the default look) or opens a
 * plain Delete/Cancel confirm popup (`compact`) — both with the same haptics.
 */
export function PlaneSlider({
  chips,
  activeIndex,
  contactName,
  scale,
  busy,
  canReplay,
  onSelectChip,
  onReplay,
  onDelete,
  compact = false,
  bottomInset = 0,
}: PlaneSliderProps) {
  const [armed, setArmed] = useState(false);
  const [dragY, setDragY] = useState(0);
  const [dropping, setDropping] = useState(false);
  // Compact mode's own delete flow (see ConfirmDialog below) — a plain long-press-then-confirm
  // instead of the drag-to-bin gesture ThrowInboxScreen's own standalone screen still uses (see
  // `compact`'s own doc comment), per explicit request.
  const [confirmOpen, setConfirmOpen] = useState(false);
  const chipRefs = useRef(new Map<string, View>()).current;

  // A committed delete leaves `armed` (and so the bin/dimmed-chip/"RELEASE TO DELETE" label, or
  // compact mode's own confirm dialog) up indefinitely otherwise — nothing else in this component
  // ever turns it back off. The screen that owns the real data removes the deleted letter and
  // lands on whatever's next a beat later (see ThrowInboxScreen's own handleDelete), which is
  // exactly the moment this should reset: once the chip row itself reflects the delete, the
  // delete-gesture chrome should be gone too.
  useEffect(() => {
    setArmed(false);
    setDragY(0);
    setDropping(false);
    setConfirmOpen(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeIndex, chips.length]);

  const commitDelete = () => {
    vibrate([8, 40, 8]);
    setDropping(true);
    onDelete();
  };

  const gesture = useActiveChipGesture({
    enabled: !busy,
    onArm: () => {
      vibrate(12);
      setArmed(true);
      if (compact) {
        setConfirmOpen(true);
      } else {
        setDragY(0);
        setDropping(false);
      }
    },
    // Compact mode's own gesture never drags anywhere (see ConfirmDialog below) — these are
    // effectively no-ops there, left wired only so useActiveChipGesture doesn't need two shapes.
    onDragChange: compact ? () => {} : setDragY,
    onRelease: compact
      ? () => {}
      : (finalDragY) => {
          if (finalDragY > DEL) commitDelete();
          else {
            setArmed(false);
            setDragY(0);
          }
        },
  });

  const handleConfirmDelete = () => {
    setConfirmOpen(false);
    commitDelete();
  };
  const handleCancelDelete = () => {
    setConfirmOpen(false);
    setArmed(false);
  };

  const onChipTap = (index: number, id: string) => {
    if (busy || index === activeIndex) return;
    const node = chipRefs.get(id);
    if (!node) {
      onSelectChip(index, { x: 195, y: 660 });
      return;
    }
    node.measureInWindow((x, y, w, h) => onSelectChip(index, { x: x + w / 2, y: y + h / 2 }));
  };

  const over = dragY > DEL;
  const bottomLabel = over ? 'RELEASE TO DELETE' : 'DRAG DOWN TO DELETE';

  return (
    <View style={[{ gap: s(10, scale), paddingBottom: compact ? Math.max(bottomInset, 12) : 0 }, noSelect]}>
      {!compact && (
        <View style={[styles.headerRow, { paddingHorizontal: s(24, scale) }]}>
          <Text style={[styles.mono, { fontSize: s(10.5, scale), letterSpacing: 1.4 }]}>
            LETTERS FROM {contactName.toUpperCase()} · {chips.length}
          </Text>
          <Pressable
            onPress={canReplay ? onReplay : undefined}
            disabled={!canReplay}
            style={[styles.replayBtn, { height: s(28, scale), paddingHorizontal: s(12, scale), borderRadius: s(14, scale), opacity: canReplay ? 1 : 0.4 }]}
            accessibilityRole="button"
            accessibilityLabel="Replay arrival"
          >
            <Icon path={REPLAY_ICON} size={s(12, scale)} color={inboxColor.ink} strokeWidth={2.4} />
            <Text style={[styles.replayText, { fontSize: s(12, scale) }]}>Replay</Text>
          </Pressable>
        </View>
      )}

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        decelerationRate="fast"
        snapToInterval={s(68, scale)}
        scrollEnabled={!armed}
        contentContainerStyle={{ gap: s(10, scale), paddingHorizontal: s(24, scale), paddingVertical: s(4, scale) }}
      >
        {chips.map((c, i) => {
          const active = i === activeIndex;
          const armedHere = active && armed;
          const variant = armedHere ? 'delete' : active ? 'active' : 'default';
          const bg = armedHere ? inboxColor.deleteRed : active ? inboxColor.accentBlue : inboxColor.paper;
          const labelColor = armedHere ? inboxColor.deleteRed : active ? inboxColor.accentBlue : '#555555';
          // Inline (compact) labels sit ON the chip's own colored box instead of matching its hue
          // below — white reads on the active/armed box's blue or red fill, black on the idle
          // box's cream fill.
          const inlineLabelColor = armedHere || active ? '#FFFFFF' : '#171717';
          const chipBox = (
            <View style={[styles.chip, { width: s(52, scale), height: s(52, scale), borderRadius: s(16, scale), backgroundColor: bg }]}>
              <LetterPlaneGlyph size={s(compact ? 21 : 28, scale)} variant={variant} tiltDeg={-14} />
              {compact && (
                <Text style={[styles.mono, styles.chipInlineLabel, { fontSize: s(7.5, scale), color: inlineLabelColor }]}>{c.short}</Text>
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
                style={{ alignItems: 'center', gap: compact ? 0 : s(5, scale), opacity: armedHere && !compact ? 0.2 : 1, minWidth: 44, minHeight: 44 }}
              >
                {chipBox}
                {!compact && <Text style={[styles.mono, { fontSize: s(9, scale), color: labelColor }]}>{c.short}</Text>}
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
              style={{ alignItems: 'center', gap: compact ? 0 : s(5, scale), minWidth: 44, minHeight: 44 }}
            >
              {chipBox}
              {!compact && <Text style={[styles.mono, { fontSize: s(9, scale), color: labelColor }]}>{c.short}</Text>}
            </Pressable>
          );
        })}
      </ScrollView>

      {!compact && (
        <View pointerEvents="none" style={[styles.binWrap, { opacity: armed ? 1 : 0, gap: s(8, scale), top: s(106, scale) }]}>
          <Text style={[styles.mono, { fontSize: s(10, scale), letterSpacing: 1.4, color: over ? inboxColor.deleteRed : '#333333' }]}>{bottomLabel}</Text>
          <View
            style={[
              styles.bin,
              {
                width: s(58, scale),
                height: s(58, scale),
                borderRadius: s(29, scale),
                backgroundColor: over ? inboxColor.deleteRed : inboxColor.binDark,
                transform: [{ scale: over ? 1.15 : 1 }],
              },
            ]}
          >
            <Icon path={TRASH_ICON} size={s(24, scale)} color="#FFFFFF" strokeWidth={1.8} />
          </View>
        </View>
      )}

      {!compact && armed && (
        <View pointerEvents="none" style={[styles.dragCapture, { top: s(-56, scale), height: s(220, scale) }]}>
          <View
            style={[
              styles.ghost,
              {
                width: s(52, scale),
                height: s(52, scale),
                borderRadius: s(16, scale),
                top: dragY,
                opacity: dropping ? 0 : 1,
                transform: [{ rotate: `${(dragY * 0.08).toFixed(1)}deg` }, { scale: dropping ? 0.4 : 1.08 }],
              },
            ]}
          >
            <LetterPlaneGlyph size={s(28, scale)} variant="delete" tiltDeg={-14} />
          </View>
        </View>
      )}

      {compact && (
        <ConfirmDialog
          visible={confirmOpen}
          title="Delete this letter?"
          message="This can't be undone."
          confirmLabel="Delete"
          cancelLabel="Cancel"
          destructive
          glass
          onConfirm={handleConfirmDelete}
          onCancel={handleCancelDelete}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  mono: { fontFamily: 'DMMono_500Medium', color: '#444444' },
  replayBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(255,255,255,.75)' },
  replayText: { fontFamily: 'Figtree_700Bold', color: inboxColor.ink },
  chip: { alignItems: 'center', justifyContent: 'center' },
  chipInlineLabel: { marginTop: 2, letterSpacing: 0.3 },
  binWrap: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  bin: { alignItems: 'center', justifyContent: 'center' },
  dragCapture: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  ghost: {
    position: 'absolute',
    backgroundColor: inboxColor.deleteRed,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
