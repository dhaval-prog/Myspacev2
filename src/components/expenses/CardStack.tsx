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
// Web only: without this, a mouse-drag over the card's text starts a native
// text selection, which fights the in-progress PanResponder gesture and can
// cut it off partway through a longer swipe. RN's ViewStyle type doesn't
// model this CSS-only key, so — like `noOutline` in theme/webStyles.ts —
// it's applied as a loosely-typed style rather than added to it.
const noSelect: Record<string, unknown> = { userSelect: 'none' };
/** Matches the 340ms delay ExpensesContext.openCard waits before swapping to the wallet screen. */
const FLY_DURATION = 340;

interface CardStackProps {
  reduceMotion?: boolean;
}

/**
 * The card-browsing deck: scroll through an invisible tall list (native
 * touch-scroll, or mouse wheel on web) to fan through the cards, tap the
 * focused one to open its wallet. There is no per-card drag — a touch
 * that starts directly on the focused card also just browses the deck
 * (it drives the same `pickP` position everything else reads from,
 * rather than lifting that one card independently), and only resolves
 * to opening it if the touch never really moved. Styles are computed
 * per-frame from plain state, mirroring how the reference itself drives
 * this (imperative JS math, not CSS transitions) rather than trying to
 * force it through Animated nodes — except the tap-to-open lift itself,
 * which needs a real eased animation (see `flyProgress` below) rather
 * than an instant snap to its end position held static for the rest of
 * the 340ms.
 */
export function CardStack({ reduceMotion }: CardStackProps) {
  const { deck, flyCard, openCard, expensesFor } = useExpenses();
  const [pickP, setPickP] = useState(0);
  // Index of the card whose touch gesture is in progress, purely so its
  // panHandlers/pointerEvents stay attached for the gesture's full
  // duration. Without this, scrolling the touched card just past the
  // "focused" window (ad>=0.5) flips it out of the focused/held check
  // that grants a responder at all, stripping its panHandlers mid-drag
  // and silently killing the gesture partway through a longer swipe. It
  // has no effect on layout/position — every card (including this one)
  // is positioned purely from `pickP`, uniformly, with no special offset.
  const [gestureCardIdx, setGestureCardIdx] = useState<number | null>(null);
  // The trailing spacer is sized so the ScrollView's scrollable range is
  // exactly (n-1)*SLOT_HEIGHT — one slot short of the viewport itself.
  // Anything taller than that leaves dead scroll room past the point
  // where the last card is already fully focused (pickP has clamped to
  // n-1), which reads as the gesture "sticking" right at the end.
  const [areaHeight, setAreaHeight] = useState(0);
  const moved = React.useRef(0);
  // 0→1 over the same window ExpensesContext holds before swapping to the
  // wallet screen, easing the tapped card's lift instead of snapping it
  // straight to its end position and holding it there static.
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
  // `pickP` when the current touch-on-card gesture started, so its
  // cumulative `g.dy` maps onto an absolute pickP rather than compounding
  // every frame.
  const gestureStartPickP = React.useRef(0);
  // One PanResponder per card, cached for the card's lifetime (keyed by its
  // stable rid, not its deck index). Calling PanResponder.create() fresh on
  // every render — which a plain `panResponderFor(i)` call in the render
  // body would do, since every state update it drives (setPickP) triggers a
  // re-render — hands react-native-web's DOM listeners a new callback
  // identity mid-gesture and resets its internal responder bookkeeping,
  // breaking the gesture into disconnected few-pixel fragments.
  const responderCache = React.useRef(new Map<string, { responder: ReturnType<typeof PanResponder.create>; indexRef: { current: number } }>());

  const n = Math.max(1, deck.length);
  // `movePickTo` is called from the cached per-card PanResponder's
  // onPanResponderMove — a closure fixed at whichever render first created
  // that responder (e.g. the very first card, the moment it existed, deck
  // length 1). Reading `n` through a ref that's kept current every render,
  // instead of closing over that render's local `n` directly, keeps its
  // clamp accurate no matter how many cards have been added since.
  const nRef = React.useRef(n);
  nRef.current = n;

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
    const clamped = Math.max(0, Math.min(nRef.current - 1, next));
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
        gestureStartPickP.current = pickPRef.current;
        setGestureCardIdx(indexRef.current);
      },
      onPanResponderMove: (_e: GestureResponderEvent, g: PanResponderGestureState) => {
        moved.current = Math.abs(g.dy);
        // A touch that starts on the focused card browses the deck exactly
        // like a touch anywhere else — it just moves `pickP`, the same
        // position everything else on screen reads from. There's no
        // separate "lift this one card off the stack" offset, so the
        // touched card slides back with the rest of the deck instead of
        // pulling free of it.
        movePickTo(gestureStartPickP.current - g.dy / SLOT_HEIGHT);
      },
      onPanResponderRelease: () => {
        setGestureCardIdx(null);
        // Only a genuine tap (negligible movement) opens the card — any
        // real vertical movement was already just a scroll, not a
        // pull-to-open gesture.
        if (moved.current < 6) openCard(indexRef.current);
      },
      onPanResponderTerminate: () => {
        setGestureCardIdx(null);
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
        <View style={{ height: Math.max(0, areaHeight - SLOT_HEIGHT) }} />
      </ScrollView>

      <View style={styles.centerWrap} pointerEvents="box-none">
        <View style={{ width: CARD_WIDTH, height: CARD_HEIGHT }}>
          {deck.map((card, i) => {
            const rawD = i - pickP;
            const flying = flyCard === i;
            const isGestureCard = gestureCardIdx === i;
            // Cards far enough behind the focused one are fully hidden
            // anyway (opacity floors at 0.5 only within `ad<=3`, everything
            // past that renders nothing extra) — skip them outright so a
            // long deck stays cheap instead of animating every card on
            // every scroll tick. The card currently mid-gesture is kept
            // mounted regardless, so a long swipe never unmounts the very
            // view holding its own touch responder.
            if (!flying && !isGestureCard && Math.abs(rawD) > 3.5) return null;
            const d = rawD;
            const ad = Math.min(3, Math.abs(d));
            const focused = ad < 0.5;
            // Computed the same way regardless of `flying`, so this is
            // exactly the card's on-screen position the instant it started
            // flying — the animation's start point for a tap opened from rest.
            const restingY = d >= 0 ? d * 46 - ad * ad * 4 : d * 62;
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
            // While a gesture is in progress, no other card may become
            // interactive — even one that has newly scrolled into the
            // focused window — so nothing can front the gesture-owning
            // card in the DOM and steal its pointer capture mid-drag.
            const interactive = isGestureCard || (gestureCardIdx === null && focused);
            const responder = interactive ? panResponderFor(card.rid, i) : null;

            return (
              <Animated.View
                key={card.rid}
                {...(responder ? responder.panHandlers : {})}
                pointerEvents={interactive ? 'auto' : 'none'}
                style={[
                  styles.card,
                  noSelect,
                  {
                    backgroundColor: card.bg,
                    zIndex: flying ? 60 : Math.round(40 - ad * 10),
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
