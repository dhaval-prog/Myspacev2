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
import { useReducedMotion } from '../../../hooks/useReducedMotion';
import { scColor, scFont, scGeometry } from '../../../theme/spaceCardsTokens';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const CLOCK_ICON = 'M12 4a8 8 0 100 16 8 8 0 000-16z M12 9v4l2.5 2';
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

/** A card flying between two fixed points — used for opponents' draws/plays, which the player only ever watches. */
function FlyingCard({ from, to, revealCard }: { from: { x: number; y: number }; to: { x: number; y: number }; revealCard?: PlayingCard }) {
  const progress = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(progress, { toValue: 1, duration: 420, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
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

/** The draw pile — a stack of face-down cards, top-right. Tapping it draws, same as the Draw button. */
function DrawPile({ onPress, disabled, topOffset, bounce }: { onPress: () => void; disabled: boolean; topOffset: number; bounce: Animated.Value }) {
  return (
    <Animated.View style={[styles.drawPileWrap, { top: topOffset, transform: [{ scale: bounce }] }]}>
      <Pressable onPress={onPress} disabled={disabled} style={[styles.drawPileTouch, disabled && styles.drawPileDisabled]} accessibilityRole="button" accessibilityLabel="Draw a card">
        <CardBack style={[styles.drawPileLayer, { transform: [{ rotate: '-6deg' }, { translateX: -5 }, { translateY: 3 }] }]} />
        <CardBack style={[styles.drawPileLayer, { transform: [{ rotate: '4deg' }, { translateX: 4 }, { translateY: 1 }] }]} />
        <CardBack />
        <Text style={styles.drawPileLabel}>DRAW</Text>
      </Pressable>
    </Animated.View>
  );
}

/** One card in the player's own hand — draggable, throwable, and tappable. */
function DraggableCard({
  card,
  enabled,
  isPlayable,
  getDropZone,
  onPlay,
  onTap,
  onHoverChange,
}: {
  card: PlayingCard;
  enabled: boolean;
  isPlayable: boolean;
  getDropZone: () => DropZone | null;
  onPlay: () => Promise<{ error: string | null } | void>;
  onTap: () => void;
  onHoverChange: (hovering: boolean) => void;
}) {
  const { panHandlers, animatedStyle } = useCardDrag({ enabled, isPlayable, getDropZone, onPlay, onTap, onHoverChange });
  return (
    <Animated.View {...panHandlers} accessibilityLabel={`Hand card: ${card.suit ?? 'wild'} ${card.rank}`} style={animatedStyle}>
      <CardFace card={card} size="hand" disabled={!enabled || !isPlayable} />
    </Animated.View>
  );
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
  const { game, players, myHand, myPlayerId, drawCard, playCard, passTurn, announceLastCard, catchLastCard, leaveGame } = useCardsGame();
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

  const urgent = remaining !== null && remaining <= 5;

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
      <View style={[styles.topBar, { paddingTop: insets.top + 10 }]}>
        <Pressable onPress={leaveGame ? () => { leaveGame(); onHome(); } : onHome} style={styles.leaveChip} accessibilityRole="button" accessibilityLabel="Leave the table">
          <Text style={styles.leaveChipLabel}>Leave</Text>
        </Pressable>
        <Text style={styles.roomCode}>{game.roomCode.split('').join(' ')}</Text>
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

      <DrawPile onPress={handleDraw} disabled={!isMyTurn || busy || game.drewThisTurn} topOffset={insets.top + 66} bounce={drawPileBounce} />

      <ScrollView contentContainerStyle={styles.opponentsRow} horizontal showsHorizontalScrollIndicator={false}>
        {opponents.map((p) => (
          <View key={p.id} style={[styles.opponent, p.id === currentPlayer?.id && styles.opponentActive]}>
            <OpponentStack />
            <Text style={styles.opponentName} numberOfLines={1}>{p.name}</Text>
            <Text style={styles.opponentCount}>{p.cardsRemaining} card{p.cardsRemaining === 1 ? '' : 's'}</Text>
            {game.timerSeconds ? (
              <View style={[styles.opponentTimerPill, p.id === currentPlayer?.id && remaining !== null && styles.opponentTimerPillLive]}>
                <Text style={[styles.opponentTimerText, p.id === currentPlayer?.id && remaining !== null && styles.opponentTimerTextLive]}>
                  {p.id === currentPlayer?.id && remaining !== null ? `${remaining}S` : 'WAITING'}
                </Text>
              </View>
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
            {game.activeSuit ? (
              <View style={styles.haloWrap} pointerEvents="none">
                {[0.42, 0.26, 0.13, 0.05].map((o, i) => (
                  <View
                    key={i}
                    style={[
                      styles.haloRing,
                      { backgroundColor: SUIT_COLORS[game.activeSuit as CardSuit], opacity: o, width: 186 - i * 30, height: 186 - i * 30, borderRadius: (186 - i * 30) / 2 },
                    ]}
                  />
                ))}
              </View>
            ) : null}
            {(game.topCardSuit || game.topCardRank) && (
              <>
                <View style={[styles.discardGhost, { transform: [{ rotate: '-9deg' }, { translateX: -12 }, { translateY: 6 }] }]} />
                <View style={[styles.discardGhost, { transform: [{ rotate: '7deg' }, { translateX: 10 }, { translateY: 4 }] }]} />
                <View style={[styles.discardGhost, { transform: [{ rotate: '-3deg' }, { translateX: 6 }, { translateY: -3 }] }]} />
              </>
            )}
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
          {game.timerSeconds && remaining !== null ? (
            <View style={styles.secondsChip}>
              <Text style={[styles.secondsChipLabel, urgent && styles.secondsChipLabelUrgent]}>{remaining}s</Text>
            </View>
          ) : null}
        </View>
      </View>

      <Text style={[styles.turnBanner, urgent && isMyTurn && styles.turnBannerUrgent]}>{isMyTurn ? (urgent ? 'Play now' : 'Your turn') : `${currentPlayer?.name ?? 'Someone'} is playing…`}</Text>
      {error && <Text style={styles.error}>{error}</Text>}

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.hand}
        // On web, a ScrollView's own overflow clipping (needed for horizontal scroll) also
        // clips — and kills hit-testing for — a card being dragged vertically out of the row.
        // Scroll only clips horizontally; the vertical axis stays visible for the drag.
        style={{ overflowX: 'auto', overflowY: 'visible' } as object}
      >
        {myHand.map((card, i) =>
          i === revealingIndex ? (
            <FlipRevealCard key={`${card.suit}-${card.rank}-${i}`} card={card} onDone={() => setRevealingIndex(null)} />
          ) : (
            <DraggableCard
              key={`${card.suit}-${card.rank}-${i}`}
              card={card}
              enabled={isMyTurn && !busy}
              isPlayable={isPlayable(card)}
              getDropZone={() => discardZoneRef.current}
              onPlay={() => handleCardPress(card)}
              onTap={() => handleCardPress(card)}
              onHoverChange={setDropGlow}
            />
          ),
        )}
      </ScrollView>

      <View style={[styles.actions, { paddingBottom: insets.bottom + 12 }]}>
        <Pressable onPress={handleDraw} disabled={!isMyTurn || busy || game.drewThisTurn} style={[styles.actionButton, (!isMyTurn || game.drewThisTurn) && styles.actionButtonDisabled]}>
          <Text style={styles.actionLabel}>Draw a card</Text>
        </Pressable>
        {isMyTurn && game.drewThisTurn && (
          <Pressable onPress={handlePass} disabled={busy} style={styles.actionButton}>
            <Text style={styles.actionLabel}>Pass</Text>
          </Pressable>
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
        <FlyingCard key={f.id} from={f.kind === 'draw' ? drawPilePoint : opponentPoint} to={f.kind === 'draw' ? opponentPoint : discardPoint} revealCard={f.kind === 'play' ? f.card : undefined} />
      ))}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, paddingBottom: 10 },
  leaveChip: { paddingVertical: 9, paddingHorizontal: 15, borderRadius: 999, backgroundColor: 'rgba(255,255,255,.1)' },
  leaveChipLabel: { fontFamily: scFont.sans600, fontSize: 13, color: 'rgba(255,255,255,.82)' },
  roomCode: { fontFamily: scFont.mono500, fontSize: 12, letterSpacing: 12 * 0.34, color: 'rgba(255,255,255,.44)' },
  overflowBtn: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  overflowDot: { position: 'absolute', width: 3.6, height: 3.6, borderRadius: 1.8, backgroundColor: 'rgba(255,255,255,.7)' },
  timerChip: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(195,234,79,.14)', borderRadius: 999, paddingVertical: 8, paddingHorizontal: 11 },
  timerChipLabel: { fontFamily: scFont.sans600, fontSize: 9, letterSpacing: 0.9, color: scColor.lime },
  opponentsRow: { paddingHorizontal: 16, gap: 10, paddingBottom: 8 },
  opponent: { alignItems: 'center', gap: 3, backgroundColor: 'rgba(255,255,255,.07)', borderRadius: 18, padding: 10, minWidth: 84 },
  opponentActive: { backgroundColor: 'rgba(195,234,79,.14)' },
  opponentName: { fontFamily: scFont.sans700, fontSize: 12.5, color: '#fff', maxWidth: 76, marginTop: 2 },
  opponentCount: { fontFamily: scFont.mono500, fontSize: 10, color: 'rgba(255,255,255,.5)' },
  opponentTimerPill: { marginTop: 6, borderRadius: 999, paddingVertical: 4, paddingHorizontal: 9, backgroundColor: 'rgba(255,255,255,.1)' },
  opponentTimerPillLive: { backgroundColor: 'rgba(255,255,255,.1)' },
  opponentTimerText: { fontFamily: scFont.mono500, fontSize: 9, color: 'rgba(255,255,255,.5)' },
  opponentTimerTextLive: { fontFamily: scFont.sans700, color: scColor.lime },
  catchButton: { marginTop: 4, paddingVertical: 5, paddingHorizontal: 10, borderRadius: 999, backgroundColor: scColor.urgent },
  catchLabel: { fontFamily: scFont.sans700, fontSize: 10, color: '#fff' },
  announcedLabel: { fontFamily: scFont.sans700, fontSize: 9.5, color: scColor.lime, marginTop: 4 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, paddingHorizontal: 30 },
  discardOuter: { width: 196, height: 196, alignItems: 'center', justifyContent: 'center' },
  timerRingAbs: { position: 'absolute', left: 0, top: 0 },
  discardStack: { width: 150, height: 150, alignItems: 'center', justifyContent: 'center' },
  haloWrap: { position: 'absolute', width: 186, height: 186, alignItems: 'center', justifyContent: 'center' },
  haloRing: { position: 'absolute' },
  dropGlowRing: { position: 'absolute', width: 150, height: 150, borderRadius: 75, backgroundColor: scColor.lime, opacity: 0.3 },
  discardGhost: { position: 'absolute', width: 80, height: 112, borderRadius: 13, backgroundColor: '#FFFFFF', opacity: 0.22 },
  cardPlaceholder: { width: 80, height: 112 },
  chipsRow: { flexDirection: 'row', gap: 8 },
  activeSuitChip: { borderRadius: 999, paddingVertical: 7, paddingHorizontal: 15 },
  activeSuitLabel: { fontFamily: scFont.mono500, fontSize: 10.5, letterSpacing: 1.68, color: '#FFFFFF' },
  secondsChip: { borderRadius: 999, paddingVertical: 6, paddingHorizontal: 13, backgroundColor: 'rgba(255,255,255,.1)' },
  secondsChipLabel: { fontFamily: scFont.mono500, fontSize: 11, letterSpacing: 1.32, color: 'rgba(255,255,255,.72)' },
  secondsChipLabelUrgent: { color: scColor.urgent },
  turnBanner: { fontFamily: scFont.sans800, fontSize: 16, color: '#fff', textAlign: 'center', marginBottom: 4 },
  turnBannerUrgent: { color: scColor.urgent },
  error: { fontFamily: scFont.sans500, fontSize: 12, color: scColor.urgent, textAlign: 'center', marginBottom: 4 },
  hand: { paddingHorizontal: 16, gap: 10, alignItems: 'flex-end', minHeight: scGeometry.handCard.h + 20 },
  actions: { flexDirection: 'row', gap: 10, paddingHorizontal: 18, paddingTop: 10 },
  actionButton: { flex: 1, borderRadius: 999, backgroundColor: scColor.lime, paddingVertical: 17, alignItems: 'center', shadowColor: scColor.lime, shadowOpacity: 0.4, shadowOffset: { width: 0, height: 12 }, shadowRadius: 26 },
  actionButtonDisabled: { opacity: 0.4, shadowOpacity: 0 },
  actionLabel: { fontFamily: scFont.sans700, fontSize: 15, color: scColor.ink },
  lastCardButton: { backgroundColor: scColor.urgent, shadowColor: scColor.urgent },
  lastCardLabel: { fontFamily: scFont.sans700, fontSize: 13.5, color: '#fff' },
  drawPileWrap: { position: 'absolute', right: 16, width: 90, height: 116, zIndex: 10, alignItems: 'center', justifyContent: 'center' },
  drawPileTouch: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  drawPileDisabled: { opacity: 0.45 },
  drawPileLayer: { position: 'absolute' },
  drawPileLabel: { position: 'absolute', bottom: -16, fontFamily: scFont.sans600, fontSize: 9, letterSpacing: 1.4, color: 'rgba(255,255,255,.42)' },
  flyingCardWrap: { position: 'absolute', zIndex: 20 },
  flyingAbs: { position: 'absolute', zIndex: 25 },
  flipWrap: { width: 56, height: 78 },
  flipFace: { position: 'absolute', width: 56, height: 78, backfaceVisibility: 'hidden' },
});
