import React, { useEffect, useRef, useState } from 'react';
import { Animated, Dimensions, Easing, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fontFamily, radius, spacing } from '../../../theme';
import { useAuth } from '../../../context/AuthContext';
import { useCardsGame } from '../../../context/CardsGameContext';
import type { CardSuit, PlayingCard } from '../../../types/cards';
import { CardFace, SUIT_COLORS, SUIT_LABELS } from './CardFace';
import { useCardDrag, type DropZone } from './useCardDrag';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

/**
 * A face-down card — the draw pile, opponent stacks, and every in-flight
 * card while its identity isn't public yet. Never shows a suit/rank, since
 * the deck is never readable by any client — this is the only face a
 * hidden card can ever wear. Carries this game's own branding, not UNO's.
 */
function CardBack({ size = 'lg', style }: { size?: 'sm' | 'lg'; style?: unknown }) {
  const dims = size === 'lg' ? backStyles.lg : backStyles.sm;
  const isLg = size === 'lg';
  return (
    <View style={[backStyles.card, dims, style as object]}>
      <View style={backStyles.ring}>
        <Text style={[backStyles.brand, !isLg && backStyles.brandSm]}>MY SPACE</Text>
        <Text style={[backStyles.title, !isLg && backStyles.titleSm]}>SPACE{'\n'}CARDS</Text>
      </View>
    </View>
  );
}

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
        <CardBack size="lg" />
      </Animated.View>
      <Animated.View style={[styles.flipFace, { opacity: frontOpacity }]}>
        <CardFace card={card} size="lg" />
      </Animated.View>
    </View>
  );
}

/** A card flying between two fixed points — used for opponents' draws/plays, which the player only ever watches. */
function FlyingCard({ from, to, revealCard, size = 'lg' }: { from: { x: number; y: number }; to: { x: number; y: number }; revealCard?: PlayingCard; size?: 'sm' | 'lg' }) {
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
        <CardBack size={size} />
      </Animated.View>
    );
  }
  const backOpacity = progress.interpolate({ inputRange: [0, 0.45, 0.55, 1], outputRange: [1, 1, 0, 0] });
  const frontOpacity = progress.interpolate({ inputRange: [0, 0.45, 0.55, 1], outputRange: [0, 0, 1, 1] });
  return (
    <Animated.View pointerEvents="none" style={[styles.flyingAbs, style]}>
      <Animated.View style={[styles.flipFace, { opacity: backOpacity }]}>
        <CardBack size={size} />
      </Animated.View>
      <Animated.View style={[styles.flipFace, { opacity: frontOpacity }]}>
        <CardFace card={revealCard} size={size} />
      </Animated.View>
    </Animated.View>
  );
}

/** The draw pile — a stack of face-down cards, top-right. Tapping it draws, same as the Draw button. */
function DrawPile({ onPress, disabled, topOffset, bounce }: { onPress: () => void; disabled: boolean; topOffset: number; bounce: Animated.Value }) {
  return (
    <Animated.View style={[styles.drawPileWrap, { top: topOffset, transform: [{ scale: bounce }] }]}>
      <Pressable onPress={onPress} disabled={disabled} style={[styles.drawPileTouch, disabled && styles.drawPileDisabled]} accessibilityRole="button" accessibilityLabel="Draw a card">
        <CardBack size="lg" style={[styles.drawPileLayer, { transform: [{ rotate: '-6deg' }, { translateX: -5 }, { translateY: 3 }] }]} />
        <CardBack size="lg" style={[styles.drawPileLayer, { transform: [{ rotate: '4deg' }, { translateX: 4 }, { translateY: 1 }] }]} />
        <CardBack size="lg" />
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
      <CardFace card={card} size="lg" disabled={!enabled || !isPlayable} />
    </Animated.View>
  );
}

/** A stack of face-down cards sized by how many the opponent actually holds — never a fixed count. */
function OpponentStack({ count }: { count: number }) {
  const layers = Math.max(1, Math.min(count, 5));
  return (
    <View style={styles.opponentStack}>
      {Array.from({ length: layers }).map((_, i) => (
        <CardBack key={i} size="sm" style={[styles.opponentStackLayer, { transform: [{ translateX: i * 3 }, { translateY: -i * 2 }] }]} />
      ))}
    </View>
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

const SUITS: CardSuit[] = ['ember', 'tide', 'moss', 'solar'];
const OPPONENT_ANCHOR = { x: 70, y: 0 }; // approximate opponents-row position; y filled in with insets at render time

interface CardsBoardScreenProps {
  onHome: () => void;
}

export function CardsBoardScreen({ onHome }: CardsBoardScreenProps) {
  const insets = useSafeAreaInsets();
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

  const urgency = remaining !== null && remaining <= 5 ? 'danger' : remaining !== null && remaining <= 10 ? 'warn' : 'normal';

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
    <View style={styles.screen}>
      <View style={[styles.topBar, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable onPress={leaveGame ? () => { leaveGame(); onHome(); } : onHome} style={styles.leaveChip}>
          <Text style={styles.leaveChipLabel}>Leave</Text>
        </Pressable>
        <Text style={styles.roomCode}>{game.roomCode}</Text>
        {remaining !== null ? (
          <Text style={[styles.timer, urgency === 'warn' && styles.timerWarn, urgency === 'danger' && styles.timerDanger]}>{remaining}s</Text>
        ) : (
          <View style={{ width: 50 }} />
        )}
      </View>

      <DrawPile onPress={handleDraw} disabled={!isMyTurn || busy || game.drewThisTurn} topOffset={insets.top + 66} bounce={drawPileBounce} />

      <ScrollView contentContainerStyle={styles.opponentsRow} horizontal showsHorizontalScrollIndicator={false}>
        {opponents.map((p) => (
          <View key={p.id} style={[styles.opponent, p.id === currentPlayer?.id && styles.opponentActive]}>
            <OpponentStack count={p.cardsRemaining} />
            <Text style={styles.opponentName} numberOfLines={1}>{p.name}</Text>
            <Text style={styles.opponentCount}>{p.cardsRemaining} card{p.cardsRemaining === 1 ? '' : 's'}</Text>
            {p.cardsRemaining === 1 && !p.lastCardAnnounced && (
              <Pressable onPress={() => catchLastCard(p.id)} style={styles.catchButton}>
                <Text style={styles.catchLabel}>🔥 Catch!</Text>
              </Pressable>
            )}
            {p.cardsRemaining === 1 && p.lastCardAnnounced && <Text style={styles.announcedLabel}>LAST CARD!</Text>}
          </View>
        ))}
      </ScrollView>

      <View style={styles.center}>
        <View ref={discardViewRef} onLayout={measureDiscardZone} style={styles.discardStack} accessibilityLabel="Discard pile">
          <Animated.View style={[styles.discardGlow, dropGlow && styles.discardGlowActive]} />
          {(game.topCardSuit || game.topCardRank) && (
            <>
              <View style={[styles.discardGhost, { backgroundColor: '#3A2C5C', transform: [{ rotate: '-9deg' }, { translateX: -12 }, { translateY: 6 }] }]} />
              <View style={[styles.discardGhost, { backgroundColor: '#2E2249', transform: [{ rotate: '7deg' }, { translateX: 10 }, { translateY: 4 }] }]} />
              <View style={[styles.discardGhost, { backgroundColor: '#40316A', transform: [{ rotate: '-3deg' }, { translateX: 6 }, { translateY: -3 }] }]} />
            </>
          )}
          {game.topCardSuit || game.topCardRank ? (
            <Animated.View style={{ transform: [{ scale: discardBounce }] }}>
              <CardFace card={{ suit: game.topCardSuit, rank: game.topCardRank ?? '0' }} size="lg" />
            </Animated.View>
          ) : (
            <View style={styles.cardPlaceholder} />
          )}
        </View>
        {game.activeSuit && (
          <View style={[styles.activeSuitChip, { backgroundColor: SUIT_COLORS[game.activeSuit] }]}>
            <Text style={styles.activeSuitLabel}>{SUIT_LABELS[game.activeSuit]}</Text>
          </View>
        )}
      </View>

      <Text style={styles.turnBanner}>{isMyTurn ? 'Your turn' : `${currentPlayer?.name ?? 'Someone'}'s turn`}</Text>
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

      <View style={[styles.actions, { paddingBottom: insets.bottom + spacing.md }]}>
        <Pressable onPress={handleDraw} disabled={!isMyTurn || busy || game.drewThisTurn} style={[styles.actionButton, (!isMyTurn || game.drewThisTurn) && styles.actionButtonDisabled]}>
          <Text style={styles.actionLabel}>Draw</Text>
        </Pressable>
        {isMyTurn && game.drewThisTurn && (
          <Pressable onPress={handlePass} disabled={busy} style={styles.actionButton}>
            <Text style={styles.actionLabel}>Pass</Text>
          </Pressable>
        )}
        {me && me.cardsRemaining === 1 && !me.lastCardAnnounced && (
          <Pressable onPress={announceLastCard} style={[styles.actionButton, styles.lastCardButton]}>
            <Text style={styles.lastCardLabel}>🔥 LAST CARD!</Text>
          </Pressable>
        )}
      </View>

      {pendingWild && (
        <View style={styles.suitSheetBackdrop}>
          <View style={styles.suitSheet}>
            <Text style={styles.suitSheetTitle}>Choose a color</Text>
            <View style={styles.suitSheetRow}>
              {SUITS.map((s) => (
                <Pressable key={s} onPress={() => handleChooseSuit(s)} style={[styles.suitSwatch, { backgroundColor: SUIT_COLORS[s] }]}>
                  <Text style={styles.suitSwatchLabel}>{SUIT_LABELS[s]}</Text>
                </Pressable>
              ))}
            </View>
            <Pressable onPress={() => setPendingWild(null)} style={styles.suitSheetCancel}>
              <Text style={styles.suitSheetCancelLabel}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      )}

      {flying && (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.flyingCardWrap,
            { top: flyBaseTop, left: flyBaseLeft, opacity: flyOpacity, transform: [{ translateX: flyTranslateX }, { translateY: flyTranslateY }, { scale: flyScale }, { rotate: flyRotate }] },
          ]}
        >
          <CardBack size="sm" />
        </Animated.View>
      )}

      {opponentFlights.map((f) => (
        <FlyingCard
          key={f.id}
          size="sm"
          from={f.kind === 'draw' ? drawPilePoint : opponentPoint}
          to={f.kind === 'draw' ? opponentPoint : discardPoint}
          revealCard={f.kind === 'play' ? f.card : undefined}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#1A1230' },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: spacing.sm },
  leaveChip: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: radius.pill, backgroundColor: 'rgba(255,255,255,.1)' },
  leaveChipLabel: { fontFamily: fontFamily.sans600, fontSize: 12.5, color: 'rgba(255,255,255,.7)' },
  roomCode: { fontFamily: fontFamily.mono500, fontSize: 13, letterSpacing: 2, color: 'rgba(255,255,255,.5)' },
  timer: { fontFamily: fontFamily.mono500, fontSize: 18, color: '#fff', width: 50, textAlign: 'right' },
  timerWarn: { color: '#F5B93F' },
  timerDanger: { color: '#FF5B5B' },
  opponentsRow: { paddingHorizontal: 16, gap: 10, paddingBottom: spacing.sm },
  opponent: { alignItems: 'center', gap: 3, backgroundColor: 'rgba(255,255,255,.06)', borderRadius: 18, padding: 10, minWidth: 78 },
  opponentActive: { backgroundColor: 'rgba(195,234,79,.16)' },
  opponentStack: { width: 46, height: 64, marginBottom: 2 },
  opponentStackLayer: { position: 'absolute' },
  opponentName: { fontFamily: fontFamily.sans600, fontSize: 12, color: '#fff', maxWidth: 70 },
  opponentCount: { fontFamily: fontFamily.mono500, fontSize: 10.5, color: 'rgba(255,255,255,.55)' },
  catchButton: { marginTop: 2, paddingVertical: 4, paddingHorizontal: 8, borderRadius: radius.pill, backgroundColor: '#FF5B5B' },
  catchLabel: { fontFamily: fontFamily.sans700, fontSize: 10, color: '#fff' },
  announcedLabel: { fontFamily: fontFamily.sans700, fontSize: 9.5, color: colors.lime, marginTop: 2 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  discardStack: { width: 100, height: 116, alignItems: 'center', justifyContent: 'center' },
  discardGlow: { position: 'absolute', width: 96, height: 112, borderRadius: radius.lg, backgroundColor: colors.lime, opacity: 0 },
  discardGlowActive: { opacity: 0.28 },
  discardGhost: { position: 'absolute', width: 72, height: 100, borderRadius: radius.md, borderWidth: 2, borderColor: 'rgba(255,255,255,.12)' },
  cardPlaceholder: { width: 68, height: 96 },
  activeSuitChip: { borderRadius: radius.pill, paddingVertical: 6, paddingHorizontal: 16 },
  activeSuitLabel: { fontFamily: fontFamily.sans700, fontSize: 12.5, color: '#fff', letterSpacing: 0.5, textTransform: 'uppercase' },
  turnBanner: { fontFamily: fontFamily.sans600, fontSize: 15, color: '#fff', textAlign: 'center', marginBottom: 4 },
  error: { fontFamily: fontFamily.sans500, fontSize: 12, color: '#FF8A6B', textAlign: 'center', marginBottom: 4 },
  hand: { paddingHorizontal: 16, gap: 10, alignItems: 'flex-end', minHeight: 106 },
  actions: { flexDirection: 'row', gap: 10, paddingHorizontal: 20, paddingTop: spacing.sm },
  actionButton: { flex: 1, borderRadius: radius.pill, backgroundColor: colors.lime, paddingVertical: 15, alignItems: 'center' },
  actionButtonDisabled: { opacity: 0.35 },
  actionLabel: { fontFamily: fontFamily.sans600, fontSize: 14.5, color: colors.ink },
  lastCardButton: { backgroundColor: '#FF5B5B' },
  lastCardLabel: { fontFamily: fontFamily.sans700, fontSize: 13.5, color: '#fff' },
  suitSheetBackdrop: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,.55)', alignItems: 'center', justifyContent: 'center' },
  suitSheet: { backgroundColor: '#241A3D', borderRadius: 24, padding: 22, width: '84%', gap: 16 },
  suitSheetTitle: { fontFamily: fontFamily.sans600, fontSize: 16, color: '#fff', textAlign: 'center' },
  suitSheetRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'center' },
  suitSwatch: { width: 78, height: 60, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  suitSwatchLabel: { fontFamily: fontFamily.sans700, fontSize: 12.5, color: '#fff' },
  suitSheetCancel: { alignItems: 'center', paddingVertical: 8 },
  suitSheetCancelLabel: { fontFamily: fontFamily.sans500, fontSize: 13, color: 'rgba(255,255,255,.5)' },
  drawPileWrap: { position: 'absolute', right: 16, width: 90, height: 116, zIndex: 10 },
  drawPileTouch: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  drawPileDisabled: { opacity: 0.45 },
  drawPileLayer: { position: 'absolute' },
  drawPileLabel: { position: 'absolute', bottom: -2, fontFamily: fontFamily.sans700, fontSize: 10, letterSpacing: 1, color: 'rgba(255,255,255,.55)' },
  flyingCardWrap: { position: 'absolute', zIndex: 20 },
  flyingAbs: { position: 'absolute', zIndex: 25 },
  flipWrap: { width: 72, height: 100 },
  flipFace: { position: 'absolute', width: 72, height: 100, backfaceVisibility: 'hidden' },
});

const backStyles = StyleSheet.create({
  card: {
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,.2)',
    backgroundColor: '#2A2050',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 6,
    elevation: 3,
  },
  lg: { width: 72, height: 100 },
  sm: { width: 46, height: 64 },
  ring: {
    width: '80%',
    aspectRatio: 0.82,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,.28)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  brand: { fontFamily: fontFamily.sans700, fontSize: 7.5, letterSpacing: 1, color: colors.lime },
  brandSm: { fontSize: 5.5, letterSpacing: 0.6 },
  title: { fontFamily: fontFamily.sans800, fontSize: 10.5, lineHeight: 11.5, textAlign: 'center', color: '#fff' },
  titleSm: { fontSize: 7, lineHeight: 8 },
});
