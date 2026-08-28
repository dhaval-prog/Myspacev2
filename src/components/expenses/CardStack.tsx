import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  PanResponder,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type GestureResponderEvent,
  type PanResponderGestureState,
} from 'react-native';
import { EASE, fontFamily } from '../../theme';
import { useExpenses } from '../../context/ExpensesContext';
import { formatMoney, parseAmount } from '../../utils/expensesFormat';

const CARD_WIDTH = 326;
const CARD_HEIGHT = 206;
const SLOT_HEIGHT = 132;
const OPEN_THRESHOLD = -64;
/** Matches the 340ms delay ExpensesContext.openCard waits before swapping to the wallet screen. */
const FLY_DURATION = 340;

interface CardStackProps {
  reduceMotion?: boolean;
}

/**
 * The card-browsing deck: scroll through an invisible tall list to fan
 * through the cards, drag the front card up (or tap it) to open its
 * wallet. Styles are computed per-frame from plain state, mirroring how
 * the reference itself drives this (imperative JS math, not CSS
 * transitions) rather than trying to force it through Animated nodes —
 * except the tap/drag-to-open lift itself, which needs a real eased
 * animation (see `flyProgress` below) rather than an instant snap to its
 * end position held static for the rest of the 340ms.
 */
export function CardStack({ reduceMotion }: CardStackProps) {
  const { deck, flyCard, openCard, expensesFor } = useExpenses();
  const [pickP, setPickP] = useState(0);
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [dragY, setDragY] = useState(0);
  // The trailing spacer must be at least as tall as the viewport itself —
  // a fixed spacer shorter than that leaves the ScrollView with less
  // scrollable content than (n-1)*SLOT_HEIGHT on taller screens, so it
  // bottoms out before pickP can ever reach the last card.
  const [areaHeight, setAreaHeight] = useState(0);
  const moved = React.useRef(0);
  // 0→1 over the same window ExpensesContext holds before swapping to the
  // wallet screen, easing the tapped/dragged card's lift instead of
  // snapping it straight to its end position and holding it there static.
  const flyProgress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (flyCard === null) {
      flyProgress.setValue(0);
      return;
    }
    Animated.timing(flyProgress, {
      toValue: 1,
      duration: reduceMotion ? 0 : FLY_DURATION,
      easing: EASE,
      useNativeDriver: true,
    }).start();
  }, [flyCard, reduceMotion, flyProgress]);
  const scrollRef = React.useRef<ScrollView>(null);
  // Mirrors `pickP` so rapid same-tick wheel/drag events accumulate
  // correctly instead of each reading the same stale value from the
  // render closure.
  const pickPRef = React.useRef(0);
  // `pickP` when the current drag gesture started, so a drag's cumulative
  // `g.dy` maps onto an absolute pickP rather than compounding every frame.
  const dragStartPickP = React.useRef(0);
  // One PanResponder per card, cached for the card's lifetime (keyed by its
  // stable rid, not its deck index). Calling PanResponder.create() fresh on
  // every render — which a plain `panResponderFor(i)` call in the render
  // body would do, since every state update it drives (setDragY, setPickP)
  // triggers a re-render — hands react-native-web's DOM listeners a new
  // callback identity mid-gesture and resets its internal responder
  // bookkeeping, breaking the drag into disconnected few-pixel fragments.
  const responderCache = React.useRef(new Map<string, { responder: ReturnType<typeof PanResponder.create>; indexRef: { current: number } }>());

  const n = Math.max(1, deck.length);

  // Drop cached responders for cards that no longer exist (deleted).
  for (const rid of responderCache.current.keys()) {
    if (!deck.some((card) => card.rid === rid)) responderCache.current.delete(rid);
  }

  const handleScroll = (e: { nativeEvent: { contentOffset: { y: number } } }) => {
    const p = Math.max(0, Math.min(n - 1, e.nativeEvent.contentOffset.y / SLOT_HEIGHT));
    pickPRef.current = p;
    setPickP(p);
  };

  /**
   * Commits a new browse position. Deliberately does NOT also move the
   * invisible ScrollView here — calling its scrollTo on every wheel/drag
   * tick raced its own async onScroll echo against the next tick's write,
   * intermittently stomping a just-set pickP back to a stale value. The
   * ScrollView is instead resynced once, at the start of a real native
   * scroll gesture (see onScrollBeginDrag below).
   */
  const movePickTo = (next: number) => {
    const clamped = Math.max(0, Math.min(n - 1, next));
    pickPRef.current = clamped;
    setPickP(clamped);
  };

  const handleScrollBeginDrag = () => {
    scrollRef.current?.scrollTo({ y: pickPRef.current * SLOT_HEIGHT, animated: false });
  };

  // Web-only: a mouse wheel over the focused card can't reach the invisible
  // ScrollView behind it (it's pointer-events:auto so taps/drags work), so
  // browsing the deck by wheel is driven here instead and mirrored onto the
  // ScrollView's own offset to keep native touch-scroll in sync with it.
  const handleWheel = (e: { deltaY: number }) => movePickTo(pickPRef.current + e.deltaY / SLOT_HEIGHT);

  const panResponderFor = (rid: string, index: number) => {
    const cache = responderCache.current;
    const existing = cache.get(rid);
    if (existing) {
      existing.indexRef.current = index;
      return existing.responder;
    }

    const indexRef = { current: index };
    const responder = PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_e, g) => Math.abs(g.dy) > 2,
      onPanResponderGrant: () => {
        moved.current = 0;
        dragStartPickP.current = pickPRef.current;
        setDragIdx(indexRef.current);
        setDragY(0);
      },
      onPanResponderMove: (_e: GestureResponderEvent, g: PanResponderGestureState) => {
        moved.current = Math.abs(g.dy);
        setDragY(Math.max(-190, Math.min(40, g.dy)));
        // Dragging the focused card up/down also browses the deck — the
        // held card keeps lifting free of the stack (dragY) on top of that.
        movePickTo(dragStartPickP.current - g.dy / SLOT_HEIGHT);
      },
      onPanResponderRelease: (_e, g: PanResponderGestureState) => {
        setDragIdx(null);
        const finalDragY = Math.max(-190, Math.min(40, g.dy));
        setDragY(0);
        if (moved.current < 6 || finalDragY < OPEN_THRESHOLD) openCard(indexRef.current);
      },
      onPanResponderTerminate: () => {
        setDragIdx(null);
        setDragY(0);
      },
    });
    cache.set(rid, { responder, indexRef });
    return responder;
  };

  if (deck.length === 0) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyTitle}>No budget cards yet</Text>
        <Text style={styles.emptyBody}>Add one below to start tracking spend.</Text>
      </View>
    );
  }

  // onWheel is a react-native-web-only View prop, not modeled by RN core's
  // types — spreading it (rather than a literal JSX attribute) sidesteps
  // that gap the same way `noOutline` does for web-only style keys.
  const wheelProps: Record<string, unknown> = { onWheel: handleWheel };

  return (
    <View style={styles.area} {...wheelProps} onLayout={(e) => setAreaHeight(e.nativeEvent.layout.height)}>
      <ScrollView
        ref={scrollRef}
        onScroll={handleScroll}
        onScrollBeginDrag={handleScrollBeginDrag}
        scrollEventThrottle={16}
        style={StyleSheet.absoluteFill}
        contentContainerStyle={{ paddingBottom: 84 }}
        showsVerticalScrollIndicator={false}
      >
        {deck.map((card) => (
          <View key={card.rid} style={{ height: SLOT_HEIGHT }} />
        ))}
        <View style={{ height: Math.max(300, areaHeight) }} />
      </ScrollView>

      <View style={styles.centerWrap} pointerEvents="box-none">
        <View style={{ width: CARD_WIDTH, height: CARD_HEIGHT }}>
          {deck.map((card, i) => {
            const held = dragIdx === i;
            // The held card keeps its own pre-drag resting look (focused,
            // full opacity/scale) so it never fades while you're actually
            // holding it — only the rest of the stack reacts live as the
            // drag also moves `pickP`, giving the "dragging browses too"
            // feedback without disturbing the card under your finger.
            const d = i - (held ? dragStartPickP.current : pickP);
            const ad = Math.min(3, Math.abs(d));
            const focused = ad < 0.5;
            const flying = flyCard === i;
            // Computed the same way regardless of `flying`, so this is
            // exactly the card's on-screen position the instant it started
            // flying — the animation's start point, whether that's a tap
            // from rest (d≈0) or a release mid-drag (baseY + dragY).
            const restingY = (d >= 0 ? d * 46 - ad * ad * 4 : d * 62) + (held ? dragY : 0);
            const restingScale = Math.max(0.78, 1 - ad * 0.06);
            const restingOpacity = Math.max(0.5, 1 - ad * 0.16);
            const spent = expensesFor(card).reduce((s, x) => s + parseAmount(x.amt), 0);
            const remaining = Math.max(0, parseAmount(card.amount) - spent);
            const translateY = flying ? flyProgress.interpolate({ inputRange: [0, 1], outputRange: [restingY, -190] }) : restingY;
            const scale = flying
              ? flyProgress.interpolate({ inputRange: [0, 1], outputRange: [restingScale, 1.06] })
              : restingScale;
            const opacity = flying
              ? flyProgress.interpolate({ inputRange: [0, 1], outputRange: [restingOpacity, 1] })
              : restingOpacity;
            const responder = focused || held ? panResponderFor(card.rid, i) : null;

            return (
              <Animated.View
                key={card.rid}
                {...(responder ? responder.panHandlers : {})}
                pointerEvents={focused || held ? 'auto' : 'none'}
                style={[
                  styles.card,
                  {
                    backgroundColor: card.bg,
                    zIndex: flying || held ? 60 : Math.round(40 - ad * 10),
                    opacity,
                    transform: [{ translateY }, { scale }],
                  },
                ]}
              >
                <View style={[styles.blobA, { backgroundColor: card.artA }]} />
                <View style={[styles.blobB, { backgroundColor: card.artB }]} />
                <View style={styles.headerRow}>
                  <View style={{ flex: 1, gap: 5 }}>
                    <Text style={[styles.label, { color: card.sub, opacity: focused ? 1 : 0 }]} numberOfLines={1}>
                      {card.label.toUpperCase()}
                    </Text>
                    <Text style={[styles.amount, { color: card.ink, opacity: focused ? 1 : 0 }]} numberOfLines={1}>
                      {formatMoney(remaining)}
                    </Text>
                  </View>
                  <View style={styles.dots}>
                    <View style={[styles.dotFill, { backgroundColor: card.ink }]} />
                    <View style={[styles.dotRing, { borderColor: card.ink }]} />
                  </View>
                </View>
                <Text style={[styles.digits, { color: card.ink, opacity: focused ? 1 : 0 }]}>{card.digits}</Text>
                <Text style={[styles.reset, { color: card.sub, opacity: focused ? 1 : 0 }]}>{card.exp}</Text>
              </Animated.View>
            );
          })}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  area: {
    flex: 1,
    minHeight: 0,
    position: 'relative',
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontFamily: fontFamily.sans600,
    fontSize: 15,
    color: '#fff',
  },
  emptyBody: {
    fontFamily: fontFamily.sans400,
    fontSize: 13,
    color: 'rgba(255,255,255,.45)',
    textAlign: 'center',
  },
  centerWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    height: CARD_HEIGHT,
    borderRadius: 26,
    overflow: 'hidden',
  },
  blobA: {
    position: 'absolute',
    right: -34,
    top: -30,
    width: 150,
    height: 150,
    borderRadius: 75,
  },
  blobB: {
    position: 'absolute',
    right: 16,
    bottom: -52,
    width: 120,
    height: 120,
    borderRadius: 60,
  },
  headerRow: {
    position: 'absolute',
    left: 20,
    right: 20,
    top: 18,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
  },
  label: {
    fontSize: 12,
    letterSpacing: 1.68,
    fontFamily: fontFamily.sans500,
  },
  amount: {
    fontSize: 26,
    letterSpacing: -0.78,
    fontFamily: fontFamily.sans700,
  },
  dots: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dotFill: {
    width: 22,
    height: 22,
    borderRadius: 11,
  },
  dotRing: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.6,
    marginLeft: -9,
  },
  digits: {
    position: 'absolute',
    left: 20,
    bottom: 18,
    fontSize: 13,
    letterSpacing: 0.78,
    fontFamily: fontFamily.sans500,
  },
  reset: {
    position: 'absolute',
    right: 20,
    bottom: 18,
    fontSize: 13,
    letterSpacing: 0.52,
    fontFamily: fontFamily.sans500,
  },
});
