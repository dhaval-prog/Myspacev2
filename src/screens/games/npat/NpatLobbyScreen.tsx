import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fontFamily, noOutline, radius, spacing } from '../../../theme';
import { Icon } from '../../../components/Icon';
import { BottomNav } from '../../../components/BottomNav';
import { useReducedMotion } from '../../../hooks/useReducedMotion';
import { useAuth } from '../../../context/AuthContext';
import { useGame } from '../../../context/GameContext';

const BACK_ICON = 'M15 5l-7 7 7 7';
const DICE_ICON = 'M4 4h16v16H4z M8 8h.01 M16 8h.01 M8 16h.01 M16 16h.01 M12 12h.01';
const LEAVE_ICON = 'M9 5l-7 7 7 7 M2 12h13 M17 5v14';

const ROUND_OPTIONS = [3, 5, 10];
const TIMER_OPTIONS = [30, 45, 60, 90];

function defaultName(user: { user_metadata?: { full_name?: string } } | null): string {
  return user?.user_metadata?.full_name?.split(' ')[0]?.trim() || 'Player';
}

interface NpatLobbyScreenProps {
  onHome: () => void;
  onOpenExpenses: () => void;
  onOpenSplit: () => void;
}

/** Create-or-join hub when there's no game yet; ready-up room once one exists. */
export function NpatLobbyScreen({ onHome, onOpenExpenses, onOpenSplit }: NpatLobbyScreenProps) {
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const { user } = useAuth();
  const { game, players, myPlayerId, loading, createGame, joinGame, setReady, startRound, leaveGame } = useGame();

  if (game) {
    return (
      <NpatReadyRoom
        onHome={onHome}
        onOpenExpenses={onOpenExpenses}
        onOpenSplit={onOpenSplit}
        game={game}
        players={players}
        myPlayerId={myPlayerId}
        setReady={setReady}
        startRound={startRound}
        leaveGame={leaveGame}
        insets={insets}
        reduceMotion={reduceMotion}
      />
    );
  }

  return (
    <NpatHub
      onHome={onHome}
      onOpenExpenses={onOpenExpenses}
      onOpenSplit={onOpenSplit}
      loading={loading}
      createGame={createGame}
      joinGame={joinGame}
      defaultName={defaultName(user)}
      insets={insets}
      reduceMotion={reduceMotion}
    />
  );
}

function NpatHub({
  onHome,
  onOpenExpenses,
  onOpenSplit,
  loading,
  createGame,
  joinGame,
  defaultName: fallbackName,
  insets,
  reduceMotion,
}: {
  onHome: () => void;
  onOpenExpenses: () => void;
  onOpenSplit: () => void;
  loading: boolean;
  createGame: (rounds: number, timerSeconds: number, name: string) => Promise<{ error: string | null; roomCode?: string }>;
  joinGame: (roomCode: string, name: string) => Promise<{ error: string | null }>;
  defaultName: string;
  insets: { top: number; bottom: number };
  reduceMotion?: boolean;
}) {
  const [tab, setTab] = useState<'create' | 'join'>('create');
  const [name, setName] = useState(fallbackName);
  const [rounds, setRounds] = useState(5);
  const [timerSeconds, setTimerSeconds] = useState(60);
  const [roomCode, setRoomCode] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleCreate = async () => {
    setError(null);
    const { error: err } = await createGame(rounds, timerSeconds, name);
    if (err) setError(err);
  };

  const handleJoin = async () => {
    setError(null);
    const { error: err } = await joinGame(roomCode, name);
    if (err) setError(err);
  };

  return (
    <LinearGradient
      colors={colors.friendsCanvas as [string, string, ...string[]]}
      locations={colors.friendsCanvasStops as [number, number, ...number[]]}
      start={{ x: 0.5, y: 0 }}
      end={{ x: 0.5, y: 1 }}
      style={styles.screen}
    >
      <ScrollView style={styles.scrollFlex} showsVerticalScrollIndicator={false} contentContainerStyle={[styles.scroll, { paddingTop: insets.top + spacing.md }]}>
        <View style={styles.headerRow}>
          <Text style={styles.title}>Games</Text>
          <Text style={styles.sub}>Name, Place, Animal, Thing — play it live with friends.</Text>
        </View>

        <View style={styles.tabRow}>
          <Pressable onPress={() => setTab('create')} style={[styles.tabButton, tab === 'create' && styles.tabButtonActive]}>
            <Text style={[styles.tabLabel, tab === 'create' && styles.tabLabelActive]}>Create a game</Text>
          </Pressable>
          <Pressable onPress={() => setTab('join')} style={[styles.tabButton, tab === 'join' && styles.tabButtonActive]}>
            <Text style={[styles.tabLabel, tab === 'join' && styles.tabLabelActive]}>Join a game</Text>
          </Pressable>
        </View>

        <View style={styles.card}>
          <Text style={styles.fieldLabel}>Your name</Text>
          <TextInput value={name} onChangeText={setName} placeholder="Player" placeholderTextColor={colors.placeholder} style={[styles.input, noOutline]} />

          {tab === 'create' ? (
            <>
              <Text style={styles.fieldLabel}>Rounds</Text>
              <View style={styles.pillRow}>
                {ROUND_OPTIONS.map((n) => (
                  <Pressable key={n} onPress={() => setRounds(n)} style={[styles.optionPill, rounds === n && styles.optionPillActive]}>
                    <Text style={[styles.optionLabel, rounds === n && styles.optionLabelActive]}>{n}</Text>
                  </Pressable>
                ))}
              </View>
              <Text style={styles.fieldLabel}>Timer per round</Text>
              <View style={styles.pillRow}>
                {TIMER_OPTIONS.map((s) => (
                  <Pressable key={s} onPress={() => setTimerSeconds(s)} style={[styles.optionPill, timerSeconds === s && styles.optionPillActive]}>
                    <Text style={[styles.optionLabel, timerSeconds === s && styles.optionLabelActive]}>{s}s</Text>
                  </Pressable>
                ))}
              </View>
              {error && <Text style={styles.error}>{error}</Text>}
              <Pressable onPress={handleCreate} disabled={loading} style={({ pressed }) => [styles.ctaButton, pressed && styles.pressed]}>
                <Icon path={DICE_ICON} color={colors.ink} size={19} strokeWidth={1.8} />
                <Text style={styles.ctaLabel}>{loading ? 'Creating…' : 'Create game'}</Text>
              </Pressable>
            </>
          ) : (
            <>
              <Text style={styles.fieldLabel}>Room code</Text>
              <TextInput
                value={roomCode}
                onChangeText={(t) => setRoomCode(t.replace(/[^0-9]/g, '').slice(0, 6))}
                placeholder="000000"
                placeholderTextColor={colors.placeholder}
                keyboardType="number-pad"
                style={[styles.input, styles.inputMono, noOutline]}
              />
              {error && <Text style={styles.error}>{error}</Text>}
              <Pressable onPress={handleJoin} disabled={loading} style={({ pressed }) => [styles.ctaButton, pressed && styles.pressed]}>
                <Text style={styles.ctaLabel}>{loading ? 'Joining…' : 'Join game'}</Text>
              </Pressable>
            </>
          )}
        </View>
      </ScrollView>

      <View style={styles.pinned}>
        <Pressable onPress={onHome} style={styles.iconButton} accessibilityRole="button" accessibilityLabel="Back to Home">
          <Icon path={BACK_ICON} color={colors.textPrimary} size={18} strokeWidth={2} />
        </Pressable>
      </View>

      <BottomNav
        activeId="games"
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

function NpatReadyRoom({
  onHome,
  onOpenExpenses,
  onOpenSplit,
  game,
  players,
  myPlayerId,
  setReady,
  startRound,
  leaveGame,
  insets,
  reduceMotion,
}: {
  onHome: () => void;
  onOpenExpenses: () => void;
  onOpenSplit: () => void;
  game: NonNullable<ReturnType<typeof useGame>['game']>;
  players: ReturnType<typeof useGame>['players'];
  myPlayerId: string | null;
  setReady: (ready: boolean) => Promise<void>;
  startRound: () => Promise<{ error: string | null }>;
  leaveGame: () => Promise<void>;
  insets: { top: number; bottom: number };
  reduceMotion?: boolean;
}) {
  const { user } = useAuth();
  const isHost = !!user && user.id === game.hostId;
  const me = players.find((p) => p.id === myPlayerId);
  const active = players.filter((p) => p.active);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleStart = async () => {
    setStarting(true);
    setError(null);
    const { error: err } = await startRound();
    setStarting(false);
    if (err) setError(err);
  };

  return (
    <LinearGradient
      colors={colors.friendsCanvas as [string, string, ...string[]]}
      locations={colors.friendsCanvasStops as [number, number, ...number[]]}
      start={{ x: 0.5, y: 0 }}
      end={{ x: 0.5, y: 1 }}
      style={styles.screen}
    >
      <ScrollView style={styles.scrollFlex} showsVerticalScrollIndicator={false} contentContainerStyle={[styles.scroll, { paddingTop: insets.top + spacing.md }]}>
        <View style={styles.headerRow}>
          <Text style={styles.title}>Waiting room</Text>
          <Text style={styles.sub}>{active.length} player{active.length === 1 ? '' : 's'} in · share the code below</Text>
        </View>

        <View style={styles.codeCard}>
          <Text style={styles.codeLabel}>ROOM CODE</Text>
          <Text style={styles.codeValue}>{game.roomCode}</Text>
          <Text style={styles.codeSub}>{game.roundsTotal} rounds · {game.timerSeconds}s per round · {game.categories.join(', ')}</Text>
        </View>

        <Text style={styles.eyebrow}>PLAYERS</Text>
        <View style={styles.list}>
          {active.map((p) => (
            <View key={p.id} style={styles.row}>
              <View style={[styles.readyDot, p.ready && styles.readyDotActive]} />
              <Text style={styles.rowName}>
                {p.name}
                {p.userId === game.hostId ? ' · Host' : ''}
                {p.id === myPlayerId ? ' (you)' : ''}
              </Text>
              <Text style={styles.readyLabel}>{p.ready ? 'Ready' : 'Not ready'}</Text>
            </View>
          ))}
        </View>

        {error && <Text style={styles.error}>{error}</Text>}

        {me && (
          <Pressable
            onPress={() => setReady(!me.ready)}
            style={({ pressed }) => [styles.ctaButton, me.ready && styles.ctaButtonSecondary, pressed && styles.pressed]}
          >
            <Text style={[styles.ctaLabel, me.ready && styles.ctaLabelSecondary]}>{me.ready ? "I'm ready" : "I'm not ready yet"}</Text>
          </Pressable>
        )}

        {isHost && (
          <Pressable onPress={handleStart} disabled={starting} style={({ pressed }) => [styles.ctaButton, styles.startButton, pressed && styles.pressed]}>
            <Text style={styles.ctaLabel}>{starting ? 'Starting…' : 'Start round'}</Text>
          </Pressable>
        )}
        {!isHost && <Text style={styles.waitingText}>Waiting for the host to start the round…</Text>}

        <Pressable onPress={leaveGame} style={styles.leaveRow}>
          <Icon path={LEAVE_ICON} color={colors.ink50} size={16} strokeWidth={1.8} />
          <Text style={styles.leaveLabel}>Leave game</Text>
        </Pressable>
      </ScrollView>

      <View style={styles.pinned}>
        <Pressable
          onPress={() => {
            leaveGame();
            onHome();
          }}
          style={styles.iconButton}
          accessibilityRole="button"
          accessibilityLabel="Back to Home"
        >
          <Icon path={BACK_ICON} color={colors.textPrimary} size={18} strokeWidth={2} />
        </Pressable>
      </View>

      <BottomNav
        activeId="games"
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
  scroll: { paddingHorizontal: 26, paddingBottom: spacing.lg, gap: 14 },
  pinned: { paddingHorizontal: 26, paddingTop: spacing.ms, paddingBottom: spacing.ms },
  headerRow: { gap: 2 },
  title: { fontFamily: fontFamily.sans700, fontSize: 30, lineHeight: 31.5, letterSpacing: -0.9, color: colors.textPrimary },
  sub: { fontFamily: fontFamily.sans400, fontSize: 13.5, color: colors.textSecondary },
  iconButton: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.ink,
    shadowOpacity: 0.06,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 14,
    elevation: 1,
  },
  pressed: { opacity: 0.85 },
  tabRow: { flexDirection: 'row', backgroundColor: 'rgba(255,255,255,.5)', borderRadius: radius.pill, padding: 4, gap: 4 },
  tabButton: { flex: 1, paddingVertical: 12, borderRadius: radius.pill, alignItems: 'center' },
  tabButtonActive: { backgroundColor: colors.ink },
  tabLabel: { fontFamily: fontFamily.sans600, fontSize: 13.5, color: colors.ink65 },
  tabLabelActive: { color: '#fff' },
  card: { backgroundColor: 'rgba(255,255,255,.86)', borderRadius: 26, padding: 20, gap: 10 },
  fieldLabel: {
    fontFamily: fontFamily.mono500,
    fontSize: 10.5,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: colors.textFaint,
    marginTop: 6,
  },
  input: {
    fontFamily: fontFamily.sans600,
    fontSize: 16,
    color: colors.textPrimary,
    backgroundColor: 'rgba(255,255,255,.7)',
    borderRadius: radius.pill,
    paddingVertical: 13,
    paddingHorizontal: 18,
  },
  inputMono: { fontFamily: fontFamily.mono500, letterSpacing: 4, textAlign: 'center', fontSize: 22 },
  pillRow: { flexDirection: 'row', gap: 8 },
  optionPill: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(22,33,12,0.08)',
  },
  optionPillActive: { backgroundColor: colors.ink },
  optionLabel: { fontFamily: fontFamily.sans600, fontSize: 13.5, color: colors.ink65 },
  optionLabelActive: { color: colors.lime },
  ctaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    borderRadius: radius.pill,
    backgroundColor: colors.lime,
    paddingVertical: 17,
    marginTop: 6,
    shadowColor: '#7AA82C',
    shadowOpacity: 0.32,
    shadowOffset: { width: 0, height: 10 },
    shadowRadius: 24,
    elevation: 4,
  },
  ctaButtonSecondary: { backgroundColor: 'rgba(255,255,255,.8)', shadowOpacity: 0 },
  startButton: {},
  ctaLabel: { fontFamily: fontFamily.sans600, fontSize: 16, color: colors.ink },
  ctaLabelSecondary: { color: colors.ink65 },
  error: { fontFamily: fontFamily.sans500, fontSize: 12.5, color: colors.danger },
  eyebrow: {
    fontFamily: fontFamily.sans600,
    fontSize: 11.5,
    letterSpacing: 1.495,
    textTransform: 'uppercase',
    color: colors.textFaint,
  },
  list: { gap: 8 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(255,255,255,.7)',
    borderRadius: 18,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  rowName: { flex: 1, fontFamily: fontFamily.sans600, fontSize: 14.5, color: colors.textPrimary },
  readyDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.ink14 },
  readyDotActive: { backgroundColor: '#3FBF6A' },
  readyLabel: { fontFamily: fontFamily.mono500, fontSize: 11, color: colors.ink50 },
  codeCard: { backgroundColor: colors.ink, borderRadius: 26, paddingVertical: 20, paddingHorizontal: 22, alignItems: 'center', gap: 4 },
  codeLabel: { fontFamily: fontFamily.mono500, fontSize: 10.5, letterSpacing: 1.4, color: 'rgba(255,255,255,.5)' },
  codeValue: { fontFamily: fontFamily.mono500, fontSize: 40, letterSpacing: 6, color: colors.lime },
  codeSub: { fontFamily: fontFamily.sans400, fontSize: 12, color: 'rgba(255,255,255,.6)', textAlign: 'center', marginTop: 4 },
  waitingText: { fontFamily: fontFamily.sans400, fontSize: 13, color: colors.textSecondary, textAlign: 'center' },
  leaveRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10 },
  leaveLabel: { fontFamily: fontFamily.sans500, fontSize: 12.5, color: colors.ink50 },
});
