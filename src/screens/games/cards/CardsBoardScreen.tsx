import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fontFamily, radius, spacing } from '../../../theme';
import { useAuth } from '../../../context/AuthContext';
import { useCardsGame } from '../../../context/CardsGameContext';
import type { CardSuit, PlayingCard } from '../../../types/cards';
import { CardFace, SUIT_COLORS, SUIT_LABELS } from './CardFace';

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

  if (!game) return null;

  const me = players.find((p) => p.id === myPlayerId);
  const isMyTurn = me?.seat === game.currentSeat;
  const opponents = players.filter((p) => p.active && p.id !== myPlayerId).sort((a, b) => a.seat - b.seat);
  const currentPlayer = players.find((p) => p.seat === game.currentSeat);

  const isPlayable = (card: PlayingCard) => card.rank === 'prism' || card.rank === 'prism4' || card.suit === game.activeSuit || card.rank === game.topCardRank;

  const handleCardPress = async (card: PlayingCard) => {
    if (!isMyTurn || busy) return;
    if (card.rank === 'prism' || card.rank === 'prism4') {
      setPendingWild(card);
      return;
    }
    setBusy(true);
    setError(null);
    const { error: err } = await playCard(card.suit, card.rank);
    setBusy(false);
    if (err) setError(err);
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

      <ScrollView contentContainerStyle={styles.opponentsRow} horizontal showsHorizontalScrollIndicator={false}>
        {opponents.map((p) => (
          <View key={p.id} style={[styles.opponent, p.id === currentPlayer?.id && styles.opponentActive]}>
            <View style={styles.opponentAvatar}>
              <Text style={styles.opponentInitial}>{p.name.charAt(0).toUpperCase()}</Text>
            </View>
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
        {game.topCardSuit || game.topCardRank ? (
          <CardFace card={{ suit: game.topCardSuit, rank: game.topCardRank ?? '0' }} size="lg" />
        ) : (
          <View style={styles.cardPlaceholder} />
        )}
        {game.activeSuit && (
          <View style={[styles.activeSuitChip, { backgroundColor: SUIT_COLORS[game.activeSuit] }]}>
            <Text style={styles.activeSuitLabel}>{SUIT_LABELS[game.activeSuit]}</Text>
          </View>
        )}
      </View>

      <Text style={styles.turnBanner}>{isMyTurn ? 'Your turn' : `${currentPlayer?.name ?? 'Someone'}'s turn`}</Text>
      {error && <Text style={styles.error}>{error}</Text>}

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.hand}>
        {myHand.map((card, i) => (
          <CardFace key={`${card.suit}-${card.rank}-${i}`} card={card} disabled={!isMyTurn || !isPlayable(card)} onPress={() => handleCardPress(card)} />
        ))}
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
  opponentAvatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,.14)', alignItems: 'center', justifyContent: 'center' },
  opponentInitial: { fontFamily: fontFamily.sans700, fontSize: 15, color: '#fff' },
  opponentName: { fontFamily: fontFamily.sans600, fontSize: 12, color: '#fff', maxWidth: 70 },
  opponentCount: { fontFamily: fontFamily.mono500, fontSize: 10.5, color: 'rgba(255,255,255,.55)' },
  catchButton: { marginTop: 2, paddingVertical: 4, paddingHorizontal: 8, borderRadius: radius.pill, backgroundColor: '#FF5B5B' },
  catchLabel: { fontFamily: fontFamily.sans700, fontSize: 10, color: '#fff' },
  announcedLabel: { fontFamily: fontFamily.sans700, fontSize: 9.5, color: colors.lime, marginTop: 2 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
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
});
