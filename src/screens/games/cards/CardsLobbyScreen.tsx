import React, { useState } from 'react';
import { Animated, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '../../../components/Icon';
import { BottomNav } from '../../../components/BottomNav';
import { LobbyHeader } from '../../../components/spacecards/LobbyHeader';
import { OpponentStack } from '../../../components/spacecards/OpponentStack';
import { PrimaryCta } from '../../../components/spacecards/PrimaryCta';
import { useReducedMotion } from '../../../hooks/useReducedMotion';
import { useFocusBorder } from '../../../hooks/useFocusBorder';
import { useAuth } from '../../../context/AuthContext';
import { useCardsGame } from '../../../context/CardsGameContext';
import { noOutline } from '../../../theme/webStyles';
import { scColor, scFont } from '../../../theme/spaceCardsTokens';
import type { PlayingCard } from '../../../types/cards';

const LEAVE_ICON = 'M9 5l-7 7 7 7 M2 12h13 M17 5v14';
const BACK_ICON = 'M15 5l-7 7 7 7';

const PLAYER_OPTIONS = [2, 3, 4];
const TIMER_OPTIONS: { label: string; value: number }[] = [
  { label: '15s', value: 15 },
  { label: '30s', value: 30 },
  { label: '45s', value: 45 },
  { label: '60s', value: 60 },
];

function defaultName(user: { user_metadata?: { full_name?: string } } | null): string {
  return user?.user_metadata?.full_name?.split(' ')[0]?.trim() || 'Player';
}

function fanCard(suit: PlayingCard['suit'], rank: PlayingCard['rank']): PlayingCard {
  return { suit, rank };
}
const CREATE_FAN = [
  { card: fanCard('tide', '5'), rotateDeg: -17, x: -58 },
  { card: fanCard('solar', '2'), rotateDeg: -7, x: -27 },
  { card: fanCard('moss', '6'), rotateDeg: 12, x: 30 },
  { card: fanCard('ember', '7'), rotateDeg: 2, x: 0 },
];
const JOIN_FAN = [
  { card: fanCard('tide', '4'), rotateDeg: -14, x: -46 },
  { card: fanCard('solar', '8'), rotateDeg: -3, x: -14 },
  { card: fanCard('ember', '6'), rotateDeg: 9, x: 20 },
];

interface CardsLobbyScreenProps {
  onHome: () => void;
  onOpenExpenses: () => void;
  onOpenSplit: () => void;
  /** Which tab the create/join hub opens on — e.g. the Games hub's "Join with code" row button jumps straight to Join. */
  initialTab?: 'create' | 'join';
}

/** Space Cards — Create/Join lobby (2A/2B) and the waiting room, restyled to the design handoff, wired to the real backend (CardsGameContext). */
export function CardsLobbyScreen({ onHome, onOpenExpenses, onOpenSplit, initialTab }: CardsLobbyScreenProps) {
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const { user } = useAuth();
  const { game } = useCardsGame();

  if (game) {
    return <CardsReadyRoom onHome={onHome} onOpenExpenses={onOpenExpenses} onOpenSplit={onOpenSplit} insets={insets} reduceMotion={reduceMotion} />;
  }
  return (
    <CardsHub onHome={onHome} onOpenExpenses={onOpenExpenses} onOpenSplit={onOpenSplit} defaultName={defaultName(user)} insets={insets} reduceMotion={reduceMotion} initialTab={initialTab} />
  );
}

function CardsHub({
  onHome,
  onOpenExpenses,
  onOpenSplit,
  defaultName: fallbackName,
  insets,
  reduceMotion,
  initialTab,
}: {
  onHome: () => void;
  onOpenExpenses: () => void;
  onOpenSplit: () => void;
  defaultName: string;
  insets: { top: number; bottom: number };
  reduceMotion?: boolean;
  initialTab?: 'create' | 'join';
}) {
  const { loading, createGame, joinGame } = useCardsGame();
  const [tab, setTab] = useState<'create' | 'join'>(initialTab ?? 'create');
  const [name, setName] = useState(fallbackName);
  const [maxPlayers, setMaxPlayers] = useState(4);
  const [timerSeconds, setTimerSeconds] = useState(15);
  const [roomCode, setRoomCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const { borderColor: nameBorderColor, onFocus: onNameFocus, onBlur: onNameBlur } = useFocusBorder('rgba(255,255,255,0)', scColor.lime);

  const handleCreate = async () => {
    setError(null);
    const { error: err } = await createGame(maxPlayers, timerSeconds, 2, name);
    if (err) setError(err);
  };

  const handleJoin = async () => {
    setError(null);
    const { error: err } = await joinGame(roomCode, name);
    if (err) setError(err);
  };

  const isJoin = tab === 'join';
  const fan = isJoin ? JOIN_FAN : CREATE_FAN;
  const codeCells = [0, 1, 2, 3].map((i) => roomCode[i] ?? '');
  const focusIndex = Math.min(roomCode.length, 3);

  return (
    <LinearGradient colors={[scColor.sheet1, scColor.sheet1, scColor.tableMid]} locations={[0, 0.5, 1]} style={styles.screen}>
      <View style={{ paddingTop: insets.top + 14 }}>
        <LobbyHeader
          title={!isJoin ? 'UNO Space Cards' : undefined}
          subtitle={!isJoin ? 'Shed your hand before anyone else.' : undefined}
          cards={fan}
          reduceMotion={reduceMotion}
        />
      </View>

      {/* The header stays pinned at the top; this scroll area fills the space
          between it and the bottom nav and centers the sheet within that space
          (rather than leaving leftover room pool below it), while still
          scrolling if the sheet's content ever grows taller than that space. */}
      <ScrollView style={styles.scrollFlex} contentContainerStyle={styles.sheetScroll} showsVerticalScrollIndicator={false} bounces={false}>
        <LinearGradient colors={[scColor.sheet2, scColor.sheet3]} style={styles.sheet}>
          <View style={styles.handle} />

          <View style={styles.tabs}>
            <Pressable onPress={() => setTab('create')} style={[styles.tab, !isJoin && styles.tabActive]} accessibilityRole="button" accessibilityLabel="Create a game">
              <Text style={[styles.tabLabel, !isJoin && styles.tabLabelActive]}>Create a game</Text>
            </Pressable>
            <Pressable onPress={() => setTab('join')} style={[styles.tab, isJoin && styles.tabActive]} accessibilityRole="button" accessibilityLabel="Join a game">
              <Text style={[styles.tabLabel, isJoin && styles.tabLabelActive]}>Join a game</Text>
            </Pressable>
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>YOUR NAME</Text>
            <Animated.View style={[styles.input, { borderColor: nameBorderColor }]}>
              <TextInput
                value={name}
                onChangeText={setName}
                onFocus={onNameFocus}
                onBlur={onNameBlur}
                placeholder="Your name"
                placeholderTextColor="rgba(255,255,255,.4)"
                style={[styles.inputText, noOutline]}
              />
            </Animated.View>
          </View>

          {!isJoin ? (
            <>
              <View style={styles.field}>
                <Text style={styles.label}>PLAYERS</Text>
                <View style={styles.optionRow}>
                  {PLAYER_OPTIONS.map((n) => (
                    <Pressable key={n} onPress={() => setMaxPlayers(n)} style={[styles.optionTile, maxPlayers === n && styles.optionTileActive]} accessibilityRole="button" accessibilityLabel={`${n} players`}>
                      <Text style={[styles.optionLabel, maxPlayers === n && styles.optionLabelActive]}>{n}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>

              <View style={styles.field}>
                <Text style={styles.label}>TURN TIMER</Text>
                <View style={styles.optionRow}>
                  {TIMER_OPTIONS.map((t) => (
                    <Pressable key={t.label} onPress={() => setTimerSeconds(t.value)} style={[styles.optionTile, timerSeconds === t.value && styles.optionTileActive]} accessibilityRole="button" accessibilityLabel={`${t.value} second timer`}>
                      <Text style={[styles.optionLabel, timerSeconds === t.value && styles.optionLabelActive]}>{t.label}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>

              {error && <Text style={styles.error}>{error}</Text>}
              <View style={styles.actionsRow}>
                <Pressable onPress={onHome} style={styles.backChip} accessibilityRole="button" accessibilityLabel="Back to Games">
                  <Icon path={BACK_ICON} color="#fff" size={18} strokeWidth={2} />
                </Pressable>
                <View style={styles.ctaFlex}>
                  <PrimaryCta label={loading ? 'Creating…' : 'Create room'} onPress={handleCreate} disabled={loading} reduceMotion={reduceMotion} />
                </View>
              </View>
            </>
          ) : (
            <>
              <View style={styles.field}>
                <Text style={styles.label}>ROOM CODE</Text>
                <View style={styles.codeRow}>
                  {codeCells.map((ch, i) => (
                    <View key={i} style={[styles.codeCell, i === focusIndex && !ch && styles.codeCellFocused]}>
                      <Text style={styles.codeCellText}>{ch}</Text>
                      {i === focusIndex && !ch ? <View style={styles.caret} /> : null}
                    </View>
                  ))}
                </View>
                <TextInput
                  value={roomCode}
                  onChangeText={(t) => setRoomCode(t.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4))}
                  autoCapitalize="characters"
                  maxLength={4}
                  style={styles.hiddenInput}
                  autoFocus
                />
              </View>
              {error && <Text style={styles.error}>{error}</Text>}
              <View style={styles.actionsRow}>
                <Pressable onPress={onHome} style={styles.backChip} accessibilityRole="button" accessibilityLabel="Back to Games">
                  <Icon path={BACK_ICON} color="#fff" size={18} strokeWidth={2} />
                </Pressable>
                <View style={styles.ctaFlex}>
                  <PrimaryCta label={loading ? 'Joining…' : 'Join game'} onPress={handleJoin} disabled={loading} reduceMotion={reduceMotion} />
                </View>
              </View>
            </>
          )}
        </LinearGradient>
      </ScrollView>

      <BottomNav
        activeId="home"
        onSelect={(id) => {
          if (id === 'home') onHome();
          if (id === 'expenses') onOpenExpenses();
          if (id === 'split') onOpenSplit();
        }}
        bottomInset={insets.bottom}
        reduceMotion={reduceMotion}
      />
    </LinearGradient>
  );
}

function CardsReadyRoom({
  onHome,
  onOpenExpenses,
  onOpenSplit,
  insets,
  reduceMotion,
}: {
  onHome: () => void;
  onOpenExpenses: () => void;
  onOpenSplit: () => void;
  insets: { top: number; bottom: number };
  reduceMotion?: boolean;
}) {
  const { user } = useAuth();
  const { game, players, myPlayerId, startGame, leaveGame } = useCardsGame();
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!game) return null;
  const isHost = !!user && user.id === game.hostId;
  const active = players.filter((p) => p.active).sort((a, b) => a.seat - b.seat);
  const canStart = active.length >= game.minPlayers;

  const handleStart = async () => {
    setStarting(true);
    setError(null);
    const { error: err } = await startGame();
    setStarting(false);
    if (err) setError(err);
  };

  return (
    <LinearGradient colors={[scColor.sheet1, scColor.sheet1, scColor.tableMid]} locations={[0, 0.5, 1]} style={styles.screen}>
      <View style={{ paddingTop: insets.top + 14 }}>
        <LobbyHeader
          cards={JOIN_FAN}
          onBack={() => {
            leaveGame();
            onHome();
          }}
          reduceMotion={reduceMotion}
        />
      </View>

      <ScrollView style={styles.scrollFlex} contentContainerStyle={styles.sheetScroll} showsVerticalScrollIndicator={false} bounces={false}>
        <LinearGradient colors={[scColor.sheet2, scColor.sheet3]} style={styles.sheet}>
          <View style={styles.handle} />

          <View style={styles.field}>
            <Text style={styles.label}>ROOM CODE</Text>
            <Text style={styles.roomCodeValue}>{game.roomCode}</Text>
            <Text style={styles.roomCodeSub}>{game.timerSeconds ? `${game.timerSeconds}s per turn` : 'No turn timer'} · {active.length}/{game.maxPlayers} seated</Text>
          </View>

          <View style={styles.waitList}>
            {active.map((p) => (
              <View key={p.id} style={styles.waitRow}>
                <View style={[styles.statusDot, p.userId === game.hostId ? styles.statusDotHost : styles.statusDotReady]} />
                <OpponentStack style={styles.waitAvatar} />
                <Text style={styles.waitName}>
                  {p.name}
                  {p.userId === game.hostId ? ' · Host' : ''}
                  {p.id === myPlayerId ? ' (you)' : ''}
                </Text>
              </View>
            ))}
            {Array.from({ length: Math.max(0, game.maxPlayers - active.length) }).map((_, i) => (
              <View key={`empty-${i}`} style={[styles.waitRow, styles.waitRowEmpty]}>
                <View style={styles.statusDot} />
                <View style={[styles.waitAvatar, styles.waitAvatarEmpty]} />
                <Text style={styles.waitNameEmpty}>Waiting for a player…</Text>
              </View>
            ))}
          </View>

          {error && <Text style={styles.error}>{error}</Text>}

          {isHost ? (
            <PrimaryCta label={starting ? 'Starting…' : canStart ? 'Start game' : `Need ${game.minPlayers} players`} onPress={handleStart} disabled={starting || !canStart} reduceMotion={reduceMotion} />
          ) : (
            <Text style={styles.waitHint}>Waiting for the host to start the round…</Text>
          )}

          <Pressable onPress={leaveGame} style={styles.leaveRow} accessibilityRole="button" accessibilityLabel="Leave game">
            <Icon path={LEAVE_ICON} color="rgba(255,255,255,.5)" size={16} strokeWidth={1.8} />
            <Text style={styles.leaveLabel}>Leave game</Text>
          </Pressable>
        </LinearGradient>
      </ScrollView>

      <BottomNav
        activeId="home"
        onSelect={(id) => {
          if (id === 'home') onHome();
          if (id === 'expenses') onOpenExpenses();
          if (id === 'split') onOpenSplit();
        }}
        bottomInset={insets.bottom}
        reduceMotion={reduceMotion}
      />
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  scrollFlex: { flex: 1 },
  sheetScroll: { flexGrow: 1, justifyContent: 'center' },
  sheet: {
    marginTop: 18,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,.20)',
    borderBottomWidth: 0,
    paddingHorizontal: 22,
    paddingTop: 14,
    paddingBottom: 28,
    gap: 18,
  },
  handle: { alignSelf: 'center', width: 44, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,.28)', marginBottom: 4 },
  tabs: { flexDirection: 'row', backgroundColor: 'rgba(255,255,255,.08)', borderRadius: 999, padding: 4 },
  tab: { flex: 1, paddingVertical: 11, borderRadius: 999, alignItems: 'center' },
  tabActive: { backgroundColor: scColor.ink },
  tabLabel: { fontFamily: scFont.sans500, fontSize: 13.5, color: 'rgba(255,255,255,.62)' },
  tabLabelActive: { fontFamily: scFont.sans700, color: scColor.lime },
  field: { gap: 9 },
  label: { fontFamily: scFont.mono500, fontSize: 9.5, letterSpacing: 9.5 * 0.12, color: 'rgba(255,255,255,.52)' },
  input: { backgroundColor: 'rgba(255,255,255,.14)', borderRadius: 16, borderWidth: 1.5, paddingVertical: 15, paddingHorizontal: 17 },
  inputText: { fontFamily: scFont.sans700, fontSize: 16, color: '#FFFFFF' },
  optionRow: { flexDirection: 'row', gap: 8 },
  optionTile: { flex: 1, paddingVertical: 13, borderRadius: 14, alignItems: 'center', backgroundColor: 'rgba(255,255,255,.14)' },
  optionTileActive: { backgroundColor: scColor.lime },
  optionLabel: { fontFamily: scFont.sans600, fontSize: 14, color: 'rgba(255,255,255,.82)' },
  optionLabelActive: { fontFamily: scFont.sans700, color: scColor.ink },
  error: { fontFamily: scFont.sans500, fontSize: 12.5, color: scColor.urgent },
  actionsRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  backChip: { width: 56, height: 56, borderRadius: 28, backgroundColor: 'rgba(255,255,255,.12)', alignItems: 'center', justifyContent: 'center' },
  ctaFlex: { flex: 1 },
  codeRow: { flexDirection: 'row', gap: 10 },
  codeCell: { flex: 1, aspectRatio: 1, borderRadius: 16, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  codeCellFocused: { backgroundColor: 'rgba(255,255,255,.16)', borderWidth: 2, borderColor: scColor.lime },
  codeCellText: { fontFamily: scFont.sans700, fontSize: 24, color: scColor.ink },
  caret: { width: 2, height: 22, backgroundColor: 'rgba(255,255,255,.6)' },
  // fontSize matters even though this input is invisible — iOS Safari zooms the
  // whole page on focus for any text input under 16px, regardless of its own size.
  hiddenInput: { position: 'absolute', opacity: 0, height: 0, width: 0, fontSize: 16 },
  roomCodeValue: { fontFamily: scFont.mono500, fontSize: 32, letterSpacing: 32 * 0.2, color: scColor.lime },
  roomCodeSub: { fontFamily: scFont.sans400, fontSize: 12, color: 'rgba(255,255,255,.55)', marginTop: 2 },
  waitList: { gap: 8 },
  waitRow: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: 'rgba(255,255,255,.08)', borderRadius: 16, padding: 10 },
  waitRowEmpty: { backgroundColor: 'rgba(255,255,255,.04)' },
  statusDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,.2)' },
  statusDotReady: { backgroundColor: '#4FA83A' },
  statusDotHost: { backgroundColor: scColor.lime },
  waitAvatar: {},
  waitAvatarEmpty: { width: 40, height: 52, borderRadius: 8, backgroundColor: 'rgba(255,255,255,.05)' },
  waitName: { flex: 1, fontFamily: scFont.sans700, fontSize: 13.5, color: '#FFFFFF' },
  waitNameEmpty: { flex: 1, fontFamily: scFont.sans400, fontSize: 13, color: 'rgba(255,255,255,.4)' },
  waitHint: { fontFamily: scFont.sans400, fontSize: 12, color: 'rgba(255,255,255,.5)', textAlign: 'center' },
  leaveRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 6 },
  leaveLabel: { fontFamily: scFont.sans500, fontSize: 12.5, color: 'rgba(255,255,255,.5)' },
});
