import React, { useEffect, useRef, useState } from 'react';
import { Animated, Dimensions, Easing, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../../context/AuthContext';
import { useCardsGame } from '../../../context/CardsGameContext';
import type { CardSuit, PlayingCard } from '../../../types/cards';
import { CardFace, SUIT_COLORS, SUIT_LABELS } from './CardFace';
import { useCardDrag, type DropZone } from './useCardDrag';
import { Icon } from '../../../components/Icon';
import { CardBack } from '../../../components/spacecards/CardBack';
import { OpponentStack } from '../../../components/spacecards/OpponentStack';
import { ColourWheel } from '../../../components/spacecards/ColourWheel';
import { TimerRing } from '../../../components/spacecards/TimerRing';
import { PrimaryCta } from '../../../components/spacecards/PrimaryCta';
import { useReducedMotion } from '../../../hooks/useReducedMotion';
import { fanPose, scColor, scFont, scGeometry } from '../../../theme/spaceCardsTokens';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const CLOCK_ICON = 'M12 5a8 8 0 100 16 8 8 0 000-16z M12 9v4l2.5 2';
const OVERFLOW_DOTS = [5, 12, 19];

/** Flips a card from its back to its revealed face over `duration`ms, then calls onDone. */
function FlipRevealCard({ card, duration = 300, onDone }: { card: PlayingCard; duration?: number; onDone?: () => void }) {
  const progress = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(progress, { toValue: 1, duration, easing: Easing.inOut(Easing.quad), useNativeDriver: true }).start(() => onDone?.());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const backOpacity = progress.interpolate({ inputRange: [0, 0.45, 0.55, 1], outputRange: [1, 1, 0, 0] });
  const frontOpacity = progress.interpolate({ inputRange: [0, 0.45, 0.55, 1], outputRange: [0, 0, 1, 1] });
  const rotateY = progress.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  return (
    <View style={styles.flipWrap}>
      <Animated.View style={[styles.flipFace, { opacity: backOpacity, transform: [{ perspective: 800 }, { rotateY }] }]}>
        <CardBack />
      </Animated.View>
      <Animated.View style={[styles.flipFace, { opacity: frontOpacity }]}>
        <CardFace card={card} size="hand" />
      </Animated.View>
    </View>
  );
}

/** A card flying between two fixed points — used for opponents' draws/plays, which the player only ever watches. Calls onDone once it lands, so the caller can stop rendering it instead of leaving a permanent frozen card sitting at `to`. */
function FlyingCard({ from, to, revealCard, onDone }: { from: { x: number; y: number }; to: { x: number; y: number }; revealCard?: PlayingCard; onDone?: () => void }) {
  const progress = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(progress, { toValue: 1, duration: 420, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start(() => onDone?.());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const translateX = progress.interpolate({ inputRange: [0, 1], outputRange: [from.x, to.x] });
  const translateY = progress.interpolate({ inputRange: [0, 1], outputRange: [from.y, to.y] });
  const scale = progress.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.9, 1.05, 0.92] });
  const style = { transform: [{ translateX }, { translateY }, { scale }] };
  if (!revealCard) {
    return (
      <Animated.View pointerEvents="none" style={[styles.flyingAbs, style]}>
        <CardBack />
      </Animated.View>
    );
  }
  const backOpacity = progress.interpolate({ inputRange: [0, 0.45, 0.55, 1], outputRange: [1, 1, 0, 0] });
  const frontOpacity = progress.interpolate({ inputRange: [0, 0.45, 0.55, 1], outputRange: [0, 0, 1, 1] });
  return (
    <Animated.View pointerEvents="none" style={[styles.flyingAbs, style]}>
      <Animated.View style={[styles.flipFace, { opacity: backOpacity }]}>
        <CardBack />
      </Animated.View>
      <Animated.View style={[styles.flipFace, { opacity: frontOpacity }]}>
        <CardFace card={revealCard} size="hand" />
      </Animated.View>
    </Animated.View>
  );
}

/** Continuous idle bob on the deck's card-back plate — §the deck "breathes" even at rest. Wrapping only the visual (not the Pressable hit box) avoids the tap-reliability regression a moving hit target causes on web. */
function FloatingCardBack({ reduceMotion }: { reduceMotion?: boolean }) {
  const float = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (reduceMotion) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(float, { toValue: 1, duration: 3200, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(float, { toValue: 0, duration: 3200, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [reduceMotion, float]);
  const translateY = float.interpolate({ inputRange: [0, 1], outputRange: [0, -5] });
  return (
    <Animated.View style={{ transform: [{ translateY }] }}>
      <CardBack />
    </Animated.View>
  );
}

const HALO_RING_OPACITIES = [0.42, 0.26, 0.13, 0.05];

/** The discard pile's ambient glow — a continuous breathing pulse (opacity/scale) behind the halo rings, tinted to the active suit. */
function Halo({ color, reduceMotion }: { color: string; reduceMotion?: boolean }) {
  const breathe = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (reduceMotion) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(breathe, { toValue: 1, duration: 1700, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(breathe, { toValue: 0, duration: 1700, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [reduceMotion, breathe]);
  const scale = breathe.interpolate({ inputRange: [0, 1], outputRange: [1, 1.13] });
  const opacityMultiplier = breathe.interpolate({ inputRange: [0, 1], outputRange: [1, 0.72 / 0.34] });
  return (
    <Animated.View style={[styles.haloWrap, { transform: [{ scale }] }]} pointerEvents="none">
      {HALO_RING_OPACITIES.map((o, i) => (
        <Animated.View
          key={i}
          style={[
            styles.haloRing,
            { backgroundColor: color, opacity: Animated.multiply(o, opacityMultiplier), width: 220 - i * 36, height: 220 - i * 36, borderRadius: (220 - i * 36) / 2 },
          ]}
        />
      ))}
    </Animated.View>
  );
}

/** The small live/waiting pill under an opponent's name — a breathing lime dot while their turn is actually counting down, a static muted dot otherwise. */
function OpponentTimerPill({ live, label, reduceMotion }: { live: boolean; label: string; reduceMotion?: boolean }) {
  const breathe = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!live || reduceMotion) {
      breathe.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(breathe, { toValue: 1, duration: 700, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(breathe, { toValue: 0, duration: 700, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [live, reduceMotion, breathe]);
  const scale = breathe.interpolate({ inputRange: [0, 1], outputRange: [1, 1.35] });
  const opacity = breathe.interpolate({ inputRange: [0, 1], outputRange: [1, 0.5] });
  return (
    <View style={[styles.opponentTimerPill, live && styles.opponentTimerPillLive]}>
      <Animated.View style={[styles.opponentTimerDot, live && styles.opponentTimerDotLive, live && { transform: [{ scale }], opacity }]} />
      <Text style={styles.opponentTimerText}>{label}</Text>
    </View>
  );
}

/** The seconds-remaining pill beside the active-suit chip — blinks urgently in the last 5 seconds of my own turn. */
function SecondsChip({ label, urgent, reduceMotion }: { label: string; urgent: boolean; reduceMotion?: boolean }) {
  const blink = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (!urgent || reduceMotion) {
      blink.setValue(1);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(blink, { toValue: 0.15, duration: 500, useNativeDriver: true }),
        Animated.timing(blink, { toValue: 1, duration: 500, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [urgent, reduceMotion, blink]);
  return (
    <Animated.View style={[styles.secondsChip, urgent && styles.secondsChipUrgent, { opacity: blink }]}>
      <Text style={[styles.secondsChipLabel, urgent && styles.secondsChipLabelUrgent]}>{label}</Text>
    </Animated.View>
  );
}

/**
 * A soft red vignette around the whole table when my own turn is about to
 * time out — RN has no inset box-shadow, so a thick semi-transparent border
 * stands in for it.
 */
function EdgeGlow({ urgent, reduceMotion }: { urgent: boolean; reduceMotion?: boolean }) {
  const opacity = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(opacity, { toValue: urgent ? 1 : 0, duration: reduceMotion ? 0 : 400, useNativeDriver: true }).start();
  }, [urgent, reduceMotion, opacity]);
  return <Animated.View pointerEvents="none" style={[styles.edgeGlow, { opacity }]} />;
}

/** The draw pile — the deck's wordmark plate, top-right. Tapping it draws, same as the Draw button. */
function DrawPile({ onPress, disabled, topOffset, bounce, reduceMotion }: { onPress: () => void; disabled: boolean; topOffset: number; bounce: Animated.Value; reduceMotion?: boolean }) {
  return (
    <Animated.View style={[styles.drawPileWrap, { top: topOffset, transform: [{ scale: bounce }] }]}>
      <Pressable onPress={onPress} disabled={disabled} style={[styles.drawPileTouch, disabled && styles.drawPileDisabled]} accessibilityRole="button" accessibilityLabel="Draw a card">
        <FloatingCardBack reduceMotion={reduceMotion} />
        <Text style={styles.drawPileLabel}>DRAW</Text>
      </Pressable>
    </Animated.View>
  );
}

/**
 * One card in the player's own hand — draggable, throwable, and tappable.
 * The design spec calls for a continuous idle float on resting cards, but a
 * card that's never visually still breaks click/tap actionability on web
 * (verified directly: every tap attempt failed against a build with this
 * animation, since the element never satisfies a "stable" hit target) —
 * exactly the kind of regression this pass exists to remove, not add back.
 * Skipped in favour of gameplay reliability.
 */
function DraggableCard({
  card,
  enabled,
  isPlayable,
  basePose,
  getDropZone,
  onPlay,
  onTap,
  onHoverChange,
  onDragActiveChange,
}: {
  card: PlayingCard;
  enabled: boolean;
  isPlayable: boolean;
  basePose: { rotateDeg: number; translateY: number };
  getDropZone: () => DropZone | null;
  onPlay: () => Promise<{ error: string | null } | void>;
  onTap: () => void;
  onHoverChange: (hovering: boolean) => void;
  onDragActiveChange: (active: boolean) => void;
}) {
  const { panHandlers, phase, animatedStyle } = useCardDrag({ enabled, isPlayable, getDropZone, onPlay, onTap, onHoverChange });
  useEffect(() => {
    onDragActiveChange(phase !== 'idle');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);
  // Hand cards never fade out — an opacity-dimmed card still reads as "there, but
  // faint," which players found confusing next to the lit ones. Every card stays
  // fully opaque with its normal drop shadow; only a lime glow on top of that marks
  // a card as playable, so "not playable" is the absence of a highlight, not a
  // washed-out card.
  const lit = enabled && isPlayable;
  // Picked up out of the stack (long-pressed or dragged past the threshold) — deepen
  // its shadow so it visibly pops above its neighbours, on top of the scale/lift the
  // drag hook itself animates. Excludes the brief 'pressed' phase, which hasn't
  // committed to being a hold-and-drag yet (still might just be a tap).
  const lifted = phase !== 'idle' && phase !== 'pressed';
  // Drag offsets are listed first so they land in true screen pixels regardless of
  // the fan's resting tilt — otherwise a card fanned at, say, 20deg would drag along
  // that diagonal instead of following the finger.
  const style = [
    animatedStyle,
    { transform: [...animatedStyle.transform, { translateY: basePose.translateY }, { rotate: `${basePose.rotateDeg}deg` }] },
  ];
  return (
    <Animated.View {...panHandlers} accessibilityLabel={`Hand card: ${card.suit ?? 'wild'} ${card.rank}`} style={style}>
      {lit ? <View style={styles.handCardGlow} pointerEvents="none" /> : null}
      <CardFace card={card} size="hand" style={lifted ? styles.handCardLifted : undefined} />
    </Animated.View>
  );
}

/** Wraps a hand card with the initial-deal entrance: opacity 0 + translateY(-30) + scale(.84) → resting, staggered 55ms per card. A no-op wrapper (no animation) for any card that wasn't part of the initial deal. */
function DealtCard({ index, animate, children }: { index: number; animate: boolean; children: React.ReactNode }) {
  const progress = useRef(new Animated.Value(animate ? 0 : 1)).current;
  useEffect(() => {
    if (!animate) return;
    const delay = setTimeout(() => {
      Animated.timing(progress, { toValue: 1, duration: 500, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
    }, index * 55);
    return () => clearTimeout(delay);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const translateY = progress.interpolate({ inputRange: [0, 1], outputRange: [-30, 0] });
  const scale = progress.interpolate({ inputRange: [0, 1], outputRange: [0.84, 1] });
  return <Animated.View style={{ opacity: progress, transform: [{ translateY }, { scale }] }}>{children}</Animated.View>;
}

function useCountdown(deadline: string | null): number | null {
  const [remaining, setRemaining] = useState<number | null>(deadline ? Math.max(0, Math.ceil((new Date(deadline).getTime() - Date.now()) / 1000)) : null);
  useEffect(() => {
    if (!deadline) {
      setRemaining(null);
      return;
    }
    const tick = () => setRemaining(Math.max(0, Math.ceil((new Date(deadline).getTime() - Date.now()) / 1000)));
    tick();
    const interval = setInterval(tick, 250);
    return () => clearInterval(interval);
  }, [deadline]);
  return remaining;
}

const OPPONENT_ANCHOR = { x: 70, y: 0 }; // approximate opponents-row position; y filled in with insets at render time

interface CardsBoardScreenProps {
  onHome: () => void;
}

export function CardsBoardScreen({ onHome }: CardsBoardScreenProps) {
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const { user } = useAuth();
  const { game, players, myHand, myPlayerId, discardPile, drawCard, playCard, passTurn, announceLastCard, catchLastCard, leaveGame } = useCardsGame();
  const [pendingWild, setPendingWild] = useState<PlayingCard | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const remaining = useCountdown(game?.turnDeadline ?? null);
  const [flying, setFlying] = useState(false);
  const flyProgress = useRef(new Animated.Value(0)).current;
  const drawPileBounce = useRef(new Animated.Value(1)).current;
  const discardBounce = useRef(new Animated.Value(1)).current;
  const [dropGlow, setDropGlow] = useState(false);
  const [revealingIndex, setRevealingIndex] = useState<number | null>(null);
  const prevHandLength = useRef(myHand.length);
  const discardZoneRef = useRef<DropZone | null>(null);
  const discardViewRef = useRef<View>(null);
  const prevOpponents = useRef<Map<string, number>>(new Map());
  const prevTopCard = useRef<string>('');
  const [opponentFlights, setOpponentFlights] = useState<{ id: string; kind: 'draw' | 'play'; card?: PlayingCard }[]>([]);
  const isFirstRender = useRef(true);
  // Which hand card (by index) is currently mid-drag, so its slot can jump above its
  // fanned neighbours instead of staying pinned to its resting stack order.
  const [activeDragIndex, setActiveDragIndex] = useState<number | null>(null);

  // Captures the exact keys of whatever hand this account first ever sees for this
  // game — the initial deal — so only those cards, and only once, get the deal-in
  // entrance animation. Later renders reuse the same key format for cards that
  // shift index after a play, so a fixed set of keys (not "index < N") is what
  // keeps a later re-key from replaying the entrance.
  const initialDealKeys = useRef<Set<string> | null>(null);
  if (initialDealKeys.current === null && myHand.length > 0) {
    initialDealKeys.current = new Set(myHand.map((c, i) => `${c.suit}-${c.rank}-${i}`));
  }

  // Tracks whether this account's own turn just ended because its deadline actually
  // expired (server auto-drew and passed for them) rather than a normal play/pass,
  // so the "X is playing…" banner can explain the auto-draw for a few seconds instead
  // of leaving it silent.
  const wasMyTurnRef = useRef(false);
  const lastDeadlineRef = useRef<string | null>(null);
  const [timedOutBanner, setTimedOutBanner] = useState(false);
  useEffect(() => {
    const meNow = players.find((p) => p.id === myPlayerId);
    const isMyTurnNow = !!game && meNow?.seat === game.currentSeat;
    const deadlineJustPassed = wasMyTurnRef.current && !isMyTurnNow && !!lastDeadlineRef.current && new Date(lastDeadlineRef.current).getTime() <= Date.now();
    wasMyTurnRef.current = isMyTurnNow;
    lastDeadlineRef.current = game?.turnDeadline ?? null;
    if (deadlineJustPassed) {
      setTimedOutBanner(true);
      const timer = setTimeout(() => setTimedOutBanner(false), 4000);
      return () => clearTimeout(timer);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game?.currentSeat, game?.turnDeadline, myPlayerId, players]);

  // A newly-drawn card enters the hand with a flip reveal instead of just appearing.
  useEffect(() => {
    if (myHand.length > prevHandLength.current) {
      setRevealingIndex(myHand.length - 1);
    }
    prevHandLength.current = myHand.length;
  }, [myHand.length]);

  // The discard pile gets a small landing bounce whenever the top card actually changes.
  useEffect(() => {
    const key = `${game?.topCardSuit ?? ''}-${game?.topCardRank ?? ''}`;
    if (!isFirstRender.current && key !== prevTopCard.current) {
      discardBounce.setValue(0.85);
      Animated.spring(discardBounce, { toValue: 1, useNativeDriver: true, friction: 5, tension: 90 }).start();
    }
    prevTopCard.current = key;
  }, [game?.topCardSuit, game?.topCardRank, discardBounce]);

  // Opponents' own draws/plays, watched only — never interactive, never revealing a drawn card's identity.
  useEffect(() => {
    if (!game) return;
    const nextFlights: { id: string; kind: 'draw' | 'play'; card?: PlayingCard }[] = [];
    for (const p of players) {
      if (p.id === myPlayerId) continue;
      const prevCount = prevOpponents.current.get(p.id);
      if (prevCount !== undefined) {
        if (p.cardsRemaining > prevCount) nextFlights.push({ id: `${p.id}-draw-${Date.now()}`, kind: 'draw' });
        else if (p.cardsRemaining < prevCount) nextFlights.push({ id: `${p.id}-play-${Date.now()}`, kind: 'play', card: { suit: game.topCardSuit, rank: game.topCardRank ?? '0' } });
      }
      prevOpponents.current.set(p.id, p.cardsRemaining);
    }
    if (!isFirstRender.current && nextFlights.length > 0) {
      setOpponentFlights((prev) => [...prev, ...nextFlights]);
    }
    isFirstRender.current = false;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [players.map((p) => `${p.id}:${p.cardsRemaining}`).join(','), myPlayerId]);

  if (!game) return null;

  const me = players.find((p) => p.id === myPlayerId);
  const isMyTurn = me?.seat === game.currentSeat;
  const opponents = players.filter((p) => p.active && p.id !== myPlayerId).sort((a, b) => a.seat - b.seat);
  const currentPlayer = players.find((p) => p.seat === game.currentSeat);

  const isPlayable = (card: PlayingCard) => card.rank === 'prism' || card.rank === 'prism4' || card.suit === game.activeSuit || card.rank === game.topCardRank;

  // The top card itself is rendered as a real CardFace below — this is just the up-to-7
  // previously played cards peeking out from underneath it, per the spec's exact stacking formula.
  const pileGhosts = discardPile.slice(0, -1).slice(-7);

  const measureDiscardZone = () => {
    // react-native-web forwards a View's ref to its underlying DOM node, which has no
    // measureInWindow — only real getBoundingClientRect. Native has the opposite. Try both.
    const node = discardViewRef.current as unknown as { measureInWindow?: (cb: (x: number, y: number, w: number, h: number) => void) => void; getBoundingClientRect?: () => DOMRect };
    if (node?.getBoundingClientRect) {
      const rect = node.getBoundingClientRect();
      discardZoneRef.current = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2, radius: Math.max(rect.width, rect.height) * 0.85 };
      return;
    }
    node?.measureInWindow?.((x, y, width, height) => {
      discardZoneRef.current = { x: x + width / 2, y: y + height / 2, radius: Math.max(width, height) * 0.85 };
    });
  };

  const handleCardPress = async (card: PlayingCard) => {
    if (!isMyTurn || busy) return { error: null };
    if (card.rank === 'prism' || card.rank === 'prism4') {
      setPendingWild(card);
      return { error: null };
    }
    setBusy(true);
    setError(null);
    const { error: err } = await playCard(card.suit, card.rank);
    setBusy(false);
    if (err) setError(err);
    return { error: err };
  };

  const handleChooseSuit = async (suit: CardSuit) => {
    if (!pendingWild) return;
    setBusy(true);
    setError(null);
    const { error: err } = await playCard(pendingWild.suit, pendingWild.rank, suit);
    setBusy(false);
    setPendingWild(null);
    if (err) setError(err);
  };

  const handleDraw = async () => {
    if (!isMyTurn || busy || game.drewThisTurn) return;
    setFlying(true);
    flyProgress.setValue(0);
    drawPileBounce.setValue(0.94);
    Animated.spring(drawPileBounce, { toValue: 1, useNativeDriver: true, friction: 5, tension: 100 }).start();
    Animated.timing(flyProgress, { toValue: 1, duration: 420, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start(() => setFlying(false));
    setBusy(true);
    setError(null);
    const { error: err } = await drawCard();
    setBusy(false);
    if (err) setError(err);
  };

  const handlePass = async () => {
    setBusy(true);
    setError(null);
    const { error: err } = await passTurn();
    setBusy(false);
    if (err) setError(err);
  };

  const urgent = remaining !== null && isMyTurn && remaining <= 5;

  // Approximate flight path from the draw pile (top-right) to the hand (bottom-left) —
  // decorative only, so fixed offsets are fine rather than measuring exact layouts.
  const flyBaseTop = insets.top + 66;
  const flyBaseLeft = SCREEN_WIDTH - 16 - 72;
  const flyDeltaX = 40 - flyBaseLeft;
  const flyDeltaY = SCREEN_HEIGHT - insets.bottom - 170 - flyBaseTop;
  const flyTranslateX = flyProgress.interpolate({ inputRange: [0, 1], outputRange: [0, flyDeltaX] });
  const flyTranslateY = flyProgress.interpolate({ inputRange: [0, 1], outputRange: [0, flyDeltaY] });
  const flyScale = flyProgress.interpolate({ inputRange: [0, 1], outputRange: [1, 0.72] });
  const flyRotate = flyProgress.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '18deg'] });
  const flyOpacity = flyProgress.interpolate({ inputRange: [0, 0.12, 0.85, 1], outputRange: [0, 1, 1, 0] });

  const opponentPoint = { x: OPPONENT_ANCHOR.x, y: insets.top + 90 };
  const drawPilePoint = { x: flyBaseLeft + 36, y: flyBaseTop + 50 };
  const discardPoint = discardZoneRef.current ? { x: discardZoneRef.current.x, y: discardZoneRef.current.y } : { x: SCREEN_WIDTH / 2, y: SCREEN_HEIGHT / 2 };

  return (
    <LinearGradient colors={[scColor.tableLift, scColor.tableMid, scColor.tableDeep]} locations={[0, 0.5, 1]} style={styles.screen}>
      {game.timerSeconds ? <EdgeGlow urgent={urgent} reduceMotion={reduceMotion} /> : null}
      <View style={[styles.topBar, { paddingTop: insets.top + 10 }]}>
        <Pressable onPress={leaveGame ? () => { leaveGame(); onHome(); } : onHome} style={styles.leaveChip} accessibilityRole="button" accessibilityLabel="Leave the table">
          <Text style={styles.leaveChipLabel}>Leave</Text>
        </Pressable>
        <Text style={styles.roomCode}>{game.roomCode}</Text>
        {game.timerSeconds ? (
          <View style={styles.timerChip}>
            <Icon path={CLOCK_ICON} color={scColor.lime} size={12} strokeWidth={2.2} />
            <Text style={styles.timerChipLabel}>{game.timerSeconds}S</Text>
          </View>
        ) : (
          <View style={styles.overflowBtn}>
            {OVERFLOW_DOTS.map((y) => (
              <View key={y} style={[styles.overflowDot, { top: y - 1.8 }]} />
            ))}
          </View>
        )}
      </View>

      <DrawPile onPress={handleDraw} disabled={!isMyTurn || busy || game.drewThisTurn} topOffset={insets.top + 66} bounce={drawPileBounce} reduceMotion={reduceMotion} />

      <ScrollView style={styles.opponentsScroll} contentContainerStyle={styles.opponentsRow} horizontal showsHorizontalScrollIndicator={false}>
        {opponents.map((p) => (
          <View key={p.id} style={[styles.opponent, p.id === currentPlayer?.id && styles.opponentActive]}>
            <OpponentStack />
            <Text style={styles.opponentName} numberOfLines={1}>{p.name}</Text>
            <Text style={styles.opponentCount}>{p.cardsRemaining} card{p.cardsRemaining === 1 ? '' : 's'}</Text>
            {game.timerSeconds ? (
              <OpponentTimerPill
                live={p.id === currentPlayer?.id && remaining !== null}
                label={p.id === currentPlayer?.id && remaining !== null ? `${remaining}S` : 'WAITING'}
                reduceMotion={reduceMotion}
              />
            ) : null}
            {p.cardsRemaining === 1 && !p.lastCardAnnounced && (
              <Pressable onPress={() => catchLastCard(p.id)} style={styles.catchButton} accessibilityRole="button" accessibilityLabel={`Catch ${p.name} on last card`}>
                <Text style={styles.catchLabel}>Catch!</Text>
              </Pressable>
            )}
            {p.cardsRemaining === 1 && p.lastCardAnnounced && <Text style={styles.announcedLabel}>LAST CARD!</Text>}
          </View>
        ))}
      </ScrollView>

      <View style={styles.center}>
        <View style={styles.discardOuter}>
          {game.timerSeconds && remaining !== null ? (
            <View style={styles.timerRingAbs} pointerEvents="none">
              <TimerRing secondsLeft={remaining} limit={game.timerSeconds} urgent={urgent} reduceMotion={reduceMotion} />
            </View>
          ) : null}
          <View ref={discardViewRef} onLayout={measureDiscardZone} style={styles.discardStack} accessibilityLabel="Discard pile">
            {dropGlow ? <View style={styles.dropGlowRing} pointerEvents="none" /> : null}
            {game.activeSuit ? <Halo color={SUIT_COLORS[game.activeSuit as CardSuit]} reduceMotion={reduceMotion} /> : null}
            {pileGhosts.map((c, i) => {
              const rotateDeg = ((i * 47) % 34) - 17;
              const offsetX = ((i * 29) % 16) - 8;
              const offsetY = ((i * 19) % 12) - 6;
              const opacity = pileGhosts.length > 1 ? 0.4 + (i / (pileGhosts.length - 1)) * 0.6 : 1;
              return (
                <View
                  key={`${c.suit}-${c.rank}-${i}`}
                  style={[styles.discardGhost, { opacity, transform: [{ rotate: `${rotateDeg}deg` }, { translateX: offsetX }, { translateY: offsetY }] }]}
                />
              );
            })}
            {game.topCardSuit || game.topCardRank ? (
              <Animated.View style={{ transform: [{ scale: discardBounce }] }}>
                <CardFace card={{ suit: game.topCardSuit, rank: game.topCardRank ?? '0' }} size="pile" />
              </Animated.View>
            ) : (
              <View style={styles.cardPlaceholder} />
            )}
          </View>
        </View>
        <View style={styles.chipsRow}>
          {game.activeSuit && (
            <View style={[styles.activeSuitChip, { backgroundColor: SUIT_COLORS[game.activeSuit] }]}>
              <Text style={styles.activeSuitLabel}>{SUIT_LABELS[game.activeSuit].toUpperCase()}</Text>
            </View>
          )}
          {game.timerSeconds && remaining !== null ? <SecondsChip label={`${remaining}s`} urgent={urgent} reduceMotion={reduceMotion} /> : null}
        </View>
      </View>

      <Text style={[styles.turnBanner, urgent && styles.turnBannerUrgent]}>
        {timedOutBanner ? 'You timed out — a card was drawn for you' : isMyTurn ? (urgent ? 'Play now' : 'Your turn') : `${currentPlayer?.name ?? 'Someone'} is playing…`}
      </Text>
      {!timedOutBanner && (
        <Text style={styles.turnHint}>
          {game.timerSeconds
            ? isMyTurn
              ? urgent
                ? `Auto-draws and passes in ${remaining}s`
                : `Turn timer on · ${game.timerSeconds}s per player`
              : "Their clock is running"
            : isMyTurn
              ? myHand.length
                ? 'Tap a lit card, or draw'
                : 'Hand empty — you win'
              : 'Hold on…'}
        </Text>
      )}
      {error && <Text style={styles.error}>{error}</Text>}

      <View style={styles.hand} pointerEvents="box-none">
        {myHand.map((card, i) => {
          const key = `${card.suit}-${card.rank}-${i}`;
          const pose = fanPose(i, myHand.length);
          const slotStyle = [styles.handCardSlot, { marginLeft: pose.x - scGeometry.handCard.w / 2, zIndex: activeDragIndex === i ? 100 : i }];
          if (i === revealingIndex) {
            return (
              <View key={key} style={slotStyle}>
                <FlipRevealCard card={card} onDone={() => setRevealingIndex(null)} />
              </View>
            );
          }
          return (
            <View key={key} style={slotStyle}>
              <DealtCard index={i} animate={!!initialDealKeys.current?.has(key)}>
                <DraggableCard
                  card={card}
                  enabled={isMyTurn && !busy}
                  isPlayable={isPlayable(card)}
                  basePose={pose}
                  getDropZone={() => discardZoneRef.current}
                  onPlay={() => handleCardPress(card)}
                  onTap={() => handleCardPress(card)}
                  onHoverChange={setDropGlow}
                  onDragActiveChange={(active) => setActiveDragIndex((prev) => (active ? i : prev === i ? null : prev))}
                />
              </DealtCard>
            </View>
          );
        })}
      </View>

      <View style={[styles.actions, { paddingBottom: insets.bottom + 12 }]}>
        {isMyTurn && game.drewThisTurn ? (
          <>
            <Pressable onPress={handleDraw} disabled style={[styles.actionButton, styles.actionButtonDisabled]}>
              <Text style={styles.actionLabel}>Draw a card</Text>
            </Pressable>
            <Pressable onPress={handlePass} disabled={busy} style={styles.actionButton}>
              <Text style={styles.actionLabel}>Pass</Text>
            </Pressable>
          </>
        ) : (
          <View style={styles.singleAction}>
            <PrimaryCta label="Draw a card" onPress={handleDraw} disabled={!isMyTurn || busy} reduceMotion={reduceMotion} />
          </View>
        )}
        {me && me.cardsRemaining === 1 && !me.lastCardAnnounced && (
          <Pressable onPress={announceLastCard} style={[styles.actionButton, styles.lastCardButton]}>
            <Text style={styles.lastCardLabel}>LAST CARD!</Text>
          </Pressable>
        )}
      </View>

      <ColourWheel visible={!!pendingWild} onLockColour={handleChooseSuit} onCancel={() => setPendingWild(null)} reduceMotion={reduceMotion} />

      {flying && (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.flyingCardWrap,
            { top: flyBaseTop, left: flyBaseLeft, opacity: flyOpacity, transform: [{ translateX: flyTranslateX }, { translateY: flyTranslateY }, { scale: flyScale }, { rotate: flyRotate }] },
          ]}
        >
          <CardBack />
        </Animated.View>
      )}

      {opponentFlights.map((f) => (
        <FlyingCard
          key={f.id}
          from={f.kind === 'draw' ? drawPilePoint : opponentPoint}
          to={f.kind === 'draw' ? opponentPoint : discardPoint}
          revealCard={f.kind === 'play' ? f.card : undefined}
          onDone={() => setOpponentFlights((prev) => prev.filter((flight) => flight.id !== f.id))}
        />
      ))}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  edgeGlow: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 6, borderWidth: 28, borderColor: 'rgba(240,96,60,.4)' },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, paddingBottom: 10 },
  leaveChip: { paddingVertical: 9, paddingHorizontal: 15, borderRadius: 999, backgroundColor: 'rgba(255,255,255,.1)' },
  leaveChipLabel: { fontFamily: scFont.sans600, fontSize: 13, color: 'rgba(255,255,255,.82)' },
  roomCode: { fontFamily: scFont.mono500, fontSize: 12, letterSpacing: 12 * 0.34, color: 'rgba(255,255,255,.44)' },
  overflowBtn: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  overflowDot: { position: 'absolute', width: 3.6, height: 3.6, borderRadius: 1.8, backgroundColor: 'rgba(255,255,255,.7)' },
  timerChip: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(195,234,79,.14)', borderRadius: 999, paddingVertical: 8, paddingHorizontal: 11 },
  timerChipLabel: { fontFamily: scFont.mono500, fontSize: 9, letterSpacing: 0.9, color: scColor.lime },
  // Without an explicit style, RN Web's ScrollView defaults to flex-growing to fill
  // whatever space is left in its column parent — here that meant it competed with
  // the board's own flex:1 center area, inflating every opponent tile to fill that
  // stretched height (and squeezing the discard/turn-banner block below it in turn).
  // flexGrow/flexShrink: 0 pins it to its content's natural height instead.
  opponentsScroll: { flexGrow: 0, flexShrink: 0 },
  opponentsRow: { paddingHorizontal: 16, gap: 10, paddingBottom: 8, alignItems: 'flex-start' },
  // Shrunk from the original handoff size — this tile competed for attention with the
  // discard pile below it, and there wasn't room to also enlarge the pile without the
  // two crowding or overlapping on shorter screens.
  opponent: { alignItems: 'center', gap: 2, backgroundColor: 'rgba(255,255,255,.07)', borderRadius: 15, padding: 7, minWidth: 70 },
  opponentActive: { backgroundColor: 'rgba(195,234,79,.14)' },
  opponentName: { fontFamily: scFont.sans700, fontSize: 11, color: '#fff', maxWidth: 62, marginTop: 1 },
  opponentCount: { fontFamily: scFont.mono500, fontSize: 9, color: 'rgba(255,255,255,.5)' },
  opponentTimerPill: { marginTop: 4, flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 999, paddingVertical: 3, paddingHorizontal: 7, backgroundColor: 'rgba(255,255,255,.08)' },
  opponentTimerPillLive: { backgroundColor: 'rgba(195,234,79,.18)' },
  opponentTimerDot: { width: 5, height: 5, borderRadius: 2.5, backgroundColor: 'rgba(255,255,255,.3)' },
  opponentTimerDotLive: { backgroundColor: scColor.lime },
  opponentTimerText: { fontFamily: scFont.mono500, fontSize: 8, letterSpacing: 8 * 0.14, color: 'rgba(255,255,255,.66)' },
  catchButton: { marginTop: 3, paddingVertical: 4, paddingHorizontal: 8, borderRadius: 999, backgroundColor: scColor.urgent },
  catchLabel: { fontFamily: scFont.sans700, fontSize: 9, color: '#fff' },
  announcedLabel: { fontFamily: scFont.sans700, fontSize: 8.5, color: scColor.lime, marginTop: 3 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, paddingHorizontal: 30 },
  // Enlarged along with scGeometry.pileCard/timerRing — the discard pile is the board's
  // focal point and read as too small next to the (now-shrunk) opponent tile above it.
  discardOuter: { width: 232, height: 232, alignItems: 'center', justifyContent: 'center' },
  timerRingAbs: { position: 'absolute', left: 0, top: 0 },
  discardStack: { width: 178, height: 178, alignItems: 'center', justifyContent: 'center' },
  haloWrap: { position: 'absolute', width: 220, height: 220, alignItems: 'center', justifyContent: 'center' },
  haloRing: { position: 'absolute' },
  dropGlowRing: { position: 'absolute', width: 178, height: 178, borderRadius: 89, backgroundColor: scColor.lime, opacity: 0.3 },
  discardGhost: { position: 'absolute', width: 92, height: 129, borderRadius: 15, backgroundColor: '#FFFFFF', opacity: 0.22 },
  cardPlaceholder: { width: 92, height: 129 },
  chipsRow: { flexDirection: 'row', gap: 8 },
  activeSuitChip: { borderRadius: 999, paddingVertical: 7, paddingHorizontal: 15 },
  activeSuitLabel: { fontFamily: scFont.mono500, fontSize: 10.5, letterSpacing: 1.68, color: '#FFFFFF' },
  secondsChip: { borderRadius: 999, paddingVertical: 6, paddingHorizontal: 13, backgroundColor: 'rgba(255,255,255,.1)' },
  secondsChipUrgent: { backgroundColor: 'rgba(240,96,60,.2)' },
  secondsChipLabel: { fontFamily: scFont.mono500, fontSize: 11, letterSpacing: 1.32, color: 'rgba(255,255,255,.72)' },
  secondsChipLabelUrgent: { color: scColor.urgent },
  turnBanner: { fontFamily: scFont.sans800, fontSize: 16, color: '#fff', textAlign: 'center', marginBottom: 4 },
  turnBannerUrgent: { color: scColor.urgent },
  turnHint: { fontFamily: scFont.sans400, fontSize: 11.5, color: 'rgba(255,255,255,.45)', textAlign: 'center', marginTop: 3, marginBottom: 4 },
  error: { fontFamily: scFont.sans500, fontSize: 12, color: scColor.urgent, textAlign: 'center', marginBottom: 4 },
  // Cards are laid out via fanPose's absolute x/rotate/translateY rather than flex flow,
  // so each slot below anchors at container-center + its own pose offset.
  hand: { position: 'relative', width: '100%', minHeight: scGeometry.handCard.h + 40, justifyContent: 'flex-end', paddingBottom: 6 },
  handCardSlot: { position: 'absolute', left: '50%', bottom: 6 },
  handCardGlow: {
    position: 'absolute',
    top: -3,
    left: -3,
    right: -3,
    bottom: -3,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: scColor.lime,
    shadowColor: scColor.lime,
    shadowOpacity: 1,
    shadowOffset: { width: 0, height: 0 },
    shadowRadius: 10,
  },
  handCardLifted: {
    shadowColor: '#000',
    shadowOpacity: 0.55,
    shadowOffset: { width: 0, height: 18 },
    shadowRadius: 26,
  },
  actions: { flexDirection: 'row', gap: 10, paddingHorizontal: 18, paddingTop: 10 },
  singleAction: { flex: 1 },
  actionButton: { flex: 1, borderRadius: 999, backgroundColor: scColor.lime, paddingVertical: 17, alignItems: 'center', shadowColor: scColor.lime, shadowOpacity: 0.4, shadowOffset: { width: 0, height: 12 }, shadowRadius: 26 },
  actionButtonDisabled: { opacity: 0.4, shadowOpacity: 0 },
  actionLabel: { fontFamily: scFont.sans700, fontSize: 15, color: scColor.ink },
  lastCardButton: { backgroundColor: scColor.urgent, shadowColor: scColor.urgent },
  lastCardLabel: { fontFamily: scFont.sans700, fontSize: 13.5, color: '#fff' },
  drawPileWrap: { position: 'absolute', right: 16, zIndex: 10, alignItems: 'center' },
  drawPileTouch: { alignItems: 'center', gap: 7 },
  drawPileDisabled: { opacity: 0.45 },
  drawPileLabel: { fontFamily: scFont.mono500, fontSize: 9, letterSpacing: 9 * 0.16, color: 'rgba(255,255,255,.42)' },
  flyingCardWrap: { position: 'absolute', zIndex: 20 },
  flyingAbs: { position: 'absolute', zIndex: 25 },
  flipWrap: { width: 56, height: 78 },
  flipFace: { position: 'absolute', width: 56, height: 78, backfaceVisibility: 'hidden' },
});
