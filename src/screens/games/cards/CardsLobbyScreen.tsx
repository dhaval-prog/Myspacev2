import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fontFamily, noOutline, radius, spacing } from '../../../theme';
import { Icon } from '../../../components/Icon';
import { BottomNav } from '../../../components/BottomNav';
import { useReducedMotion } from '../../../hooks/useReducedMotion';
import { useAuth } from '../../../context/AuthContext';
import { useCardsGame } from '../../../context/CardsGameContext';

const BACK_ICON = 'M15 5l-7 7 7 7';
const LEAVE_ICON = 'M9 5l-7 7 7 7 M2 12h13 M17 5v14';

const PLAYER_OPTIONS = [2, 3, 4];
const TIMER_OPTIONS: { label: string; value: number | null }[] = [
  { label: 'No timer', value: null },
  { label: '15s', value: 15 },
  { label: '30s', value: 30 },
  { label: '60s', value: 60 },
];

function defaultName(user: { user_metadata?: { full_name?: string } } | null): string {
  return user?.user_metadata?.full_name?.split(' ')[0]?.trim() || 'Player';
}

interface CardsLobbyScreenProps {
  onHome: () => void;
  onOpenExpenses: () => void;
  onOpenSplit: () => void;
}

export function CardsLobbyScreen({ onHome, onOpenExpenses, onOpenSplit }: CardsLobbyScreenProps) {
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const { user } = useAuth();
  const { game } = useCardsGame();

  if (game) {
    return <CardsReadyRoom onHome={onHome} onOpenExpenses={onOpenExpenses} onOpenSplit={onOpenSplit} insets={insets} reduceMotion={reduceMotion} />;
  }
  return <CardsHub onHome={onHome} onOpenExpenses={onOpenExpenses} onOpenSplit={onOpenSplit} defaultName={defaultName(user)} insets={insets} reduceMotion={reduceMotion} />;
}

function CardsHub({
  onHome,
  onOpenExpenses,
  onOpenSplit,
  defaultName: fallbackName,
  insets,
  reduceMotion,
}: {
  onHome: () => void;
  onOpenExpenses: () => void;
  onOpenSplit: () => void;
  defaultName: string;
  insets: { top: number; bottom: number };
  reduceMotion?: boolean;
}) {
  const { loading, createGame, joinGame } = useCardsGame();
  const [tab, setTab] = useState<'create' | 'join'>('create');
  const [name, setName] = useState(fallbackName);
  const [maxPlayers, setMaxPlayers] = useState(4);
  const [timerSeconds, setTimerSeconds] = useState<number | null>(null);
  const [roomCode, setRoomCode] = useState('');
  const [error, setError] = useState<string | null>(null);

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

  return (
    <LinearGradient
      colors={['#2C1B4D', '#4A2E6E', '#7A4FA0'] as [string, string, ...string[]]}
      locations={[0, 0.5, 1]}
      start={{ x: 0.5, y: 0 }}
      end={{ x: 0.5, y: 1 }}
      style={styles.screen}
    >
      <ScrollView style={styles.scrollFlex} showsVerticalScrollIndicator={false} contentContainerStyle={[styles.scroll, { paddingTop: insets.top + spacing.md }]}>
        <View style={styles.headerRow}>
          <Text style={styles.titleOnDark}>My Space Cards</Text>
          <Text style={styles.subOnDark}>Shed your hand before anyone else — 2 to 4 players.</Text>
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
              <Text style={styles.fieldLabel}>Players</Text>
              <View style={styles.pillRow}>
                {PLAYER_OPTIONS.map((n) => (
                  <Pressable key={n} onPress={() => setMaxPlayers(n)} style={[styles.optionPill, maxPlayers === n && styles.optionPillActive]}>
                    <Text style={[styles.optionLabel, maxPlayers === n && styles.optionLabelActive]}>{n}</Text>
                  </Pressable>
                ))}
              </View>
              <Text style={styles.fieldLabel}>Turn timer</Text>
              <View style={styles.pillRow}>
                {TIMER_OPTIONS.map((t) => (
                  <Pressable key={t.label} onPress={() => setTimerSeconds(t.value)} style={[styles.optionPill, timerSeconds === t.value && styles.optionPillActive]}>
                    <Text style={[styles.optionLabel, timerSeconds === t.value && styles.optionLabelActive]}>{t.label}</Text>
                  </Pressable>
                ))}
              </View>
              {error && <Text style={styles.error}>{error}</Text>}
              <Pressable onPress={handleCreate} disabled={loading} style={({ pressed }) => [styles.ctaButton, pressed && styles.pressed]}>
                <Text style={styles.ctaLabel}>{loading ? 'Creating…' : 'Create room'}</Text>
              </Pressable>
            </>
          ) : (
            <>
              <Text style={styles.fieldLabel}>Room code</Text>
              <TextInput
                value={roomCode}
                onChangeText={(t) => setRoomCode(t.toUpperCase().slice(0, 4))}
                placeholder="AB7K"
                placeholderTextColor={colors.placeholder}
                autoCapitalize="characters"
                style={[styles.input, styles.inputMono, noOutline]}
              />
              {error && <Text style={styles.error}>{error}</Text>}
              <Pressable onPress={handleJoin} disabled={loading} style={({ pressed }) => [styles.ctaButton, pressed && styles.pressed]}>
                <Text style={styles.ctaLabel}>{loading ? 'Joining…' : 'Join room'}</Text>
              </Pressable>
            </>
          )}
        </View>
      </ScrollView>

      <View style={styles.pinned}>
        <Pressable onPress={onHome} style={styles.iconButtonDark} accessibilityRole="button" accessibilityLabel="Back to Games">
          <Icon path={BACK_ICON} color="#fff" size={18} strokeWidth={2} />
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
    <LinearGradient
      colors={['#2C1B4D', '#4A2E6E', '#7A4FA0'] as [string, string, ...string[]]}
      locations={[0, 0.5, 1]}
      start={{ x: 0.5, y: 0 }}
      end={{ x: 0.5, y: 1 }}
      style={styles.screen}
    >
      <ScrollView style={styles.scrollFlex} showsVerticalScrollIndicator={false} contentContainerStyle={[styles.scroll, { paddingTop: insets.top + spacing.md }]}>
        <View style={styles.headerRow}>
          <Text style={styles.titleOnDark}>Waiting room</Text>
          <Text style={styles.subOnDark}>{active.length}/{game.maxPlayers} players · share the code below</Text>
        </View>

        <View style={styles.codeCard}>
          <Text style={styles.codeLabel}>ROOM CODE</Text>
          <Text style={styles.codeValue}>{game.roomCode}</Text>
          <Text style={styles.codeSub}>{game.timerSeconds ? `${game.timerSeconds}s per turn` : 'No turn timer'}</Text>
        </View>

        <Text style={styles.eyebrow}>PLAYERS</Text>
        <View style={styles.list}>
          {active.map((p) => (
            <View key={p.id} style={styles.row}>
              <View style={styles.seatBadge}>
                <Text style={styles.seatBadgeLabel}>{p.seat + 1}</Text>
              </View>
              <Text style={styles.rowName}>
                {p.name}
                {p.userId === game.hostId ? ' · Host' : ''}
                {p.id === myPlayerId ? ' (you)' : ''}
              </Text>
            </View>
          ))}
          {Array.from({ length: Math.max(0, game.maxPlayers - active.length) }).map((_, i) => (
            <View key={`empty-${i}`} style={[styles.row, styles.rowEmpty]}>
              <View style={[styles.seatBadge, styles.seatBadgeEmpty]} />
              <Text style={styles.rowNameEmpty}>Waiting for a player…</Text>
            </View>
          ))}
        </View>

        {error && <Text style={styles.error}>{error}</Text>}

        {isHost ? (
          <Pressable onPress={handleStart} disabled={starting || !canStart} style={({ pressed }) => [styles.ctaButton, (!canStart || starting) && styles.ctaButtonDisabled, pressed && styles.pressed]}>
            <Text style={styles.ctaLabel}>{starting ? 'Starting…' : canStart ? 'Start game' : `Need ${game.minPlayers} players`}</Text>
          </Pressable>
        ) : (
          <Text style={styles.waitingText}>Waiting for the host to start the game…</Text>
        )}

        <Pressable onPress={leaveGame} style={styles.leaveRow}>
          <Icon path={LEAVE_ICON} color="rgba(255,255,255,.5)" size={16} strokeWidth={1.8} />
          <Text style={styles.leaveLabel}>Leave game</Text>
        </Pressable>
      </ScrollView>

      <View style={styles.pinned}>
        <Pressable
          onPress={() => {
            leaveGame();
            onHome();
          }}
          style={styles.iconButtonDark}
          accessibilityRole="button"
          accessibilityLabel="Back to Games"
        >
          <Icon path={BACK_ICON} color="#fff" size={18} strokeWidth={2} />
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
  titleOnDark: { fontFamily: fontFamily.sans700, fontSize: 28, lineHeight: 30, letterSpacing: -0.8, color: '#fff' },
  subOnDark: { fontFamily: fontFamily.sans400, fontSize: 13.5, color: 'rgba(255,255,255,.65)' },
  tabRow: { flexDirection: 'row', backgroundColor: 'rgba(255,255,255,.12)', borderRadius: radius.pill, padding: 4, gap: 4 },
  tabButton: { flex: 1, paddingVertical: 12, borderRadius: radius.pill, alignItems: 'center' },
  tabButtonActive: { backgroundColor: '#fff' },
  tabLabel: { fontFamily: fontFamily.sans600, fontSize: 13.5, color: 'rgba(255,255,255,.7)' },
  tabLabelActive: { color: colors.ink },
  card: { backgroundColor: 'rgba(255,255,255,.1)', borderRadius: 26, padding: 20, gap: 10 },
  fieldLabel: {
    fontFamily: fontFamily.mono500,
    fontSize: 10.5,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: 'rgba(255,255,255,.5)',
    marginTop: 6,
  },
  input: {
    fontFamily: fontFamily.sans600,
    fontSize: 16,
    color: '#fff',
    backgroundColor: 'rgba(255,255,255,.12)',
    borderRadius: radius.pill,
    paddingVertical: 13,
    paddingHorizontal: 18,
  },
  inputMono: { fontFamily: fontFamily.mono500, letterSpacing: 6, textAlign: 'center', fontSize: 22 },
  pillRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  optionPill: { paddingVertical: 10, paddingHorizontal: 16, borderRadius: radius.pill, backgroundColor: 'rgba(255,255,255,.1)' },
  optionPillActive: { backgroundColor: colors.lime },
  optionLabel: { fontFamily: fontFamily.sans600, fontSize: 13.5, color: 'rgba(255,255,255,.7)' },
  optionLabelActive: { color: colors.ink },
  ctaButton: {
    borderRadius: radius.pill,
    backgroundColor: colors.lime,
    paddingVertical: 17,
    alignItems: 'center',
    marginTop: 6,
    shadowColor: '#000',
    shadowOpacity: 0.24,
    shadowOffset: { width: 0, height: 10 },
    shadowRadius: 24,
    elevation: 4,
  },
  ctaButtonDisabled: { opacity: 0.5 },
  ctaLabel: { fontFamily: fontFamily.sans600, fontSize: 16, color: colors.ink },
  pressed: { opacity: 0.85 },
  error: { fontFamily: fontFamily.sans500, fontSize: 12.5, color: '#FF8A6B' },
  eyebrow: { fontFamily: fontFamily.sans600, fontSize: 11.5, letterSpacing: 1.495, textTransform: 'uppercase', color: 'rgba(255,255,255,.5)' },
  list: { gap: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: 'rgba(255,255,255,.1)', borderRadius: 18, paddingVertical: 12, paddingHorizontal: 16 },
  rowEmpty: { backgroundColor: 'rgba(255,255,255,.05)' },
  rowName: { flex: 1, fontFamily: fontFamily.sans600, fontSize: 14.5, color: '#fff' },
  rowNameEmpty: { flex: 1, fontFamily: fontFamily.sans400, fontSize: 13.5, color: 'rgba(255,255,255,.4)' },
  seatBadge: { width: 28, height: 28, borderRadius: 14, backgroundColor: colors.lime, alignItems: 'center', justifyContent: 'center' },
  seatBadgeEmpty: { backgroundColor: 'rgba(255,255,255,.1)' },
  seatBadgeLabel: { fontFamily: fontFamily.mono500, fontSize: 12, color: colors.ink },
  codeCard: { backgroundColor: 'rgba(0,0,0,.25)', borderRadius: 26, paddingVertical: 20, paddingHorizontal: 22, alignItems: 'center', gap: 4 },
  codeLabel: { fontFamily: fontFamily.mono500, fontSize: 10.5, letterSpacing: 1.4, color: 'rgba(255,255,255,.5)' },
  codeValue: { fontFamily: fontFamily.mono500, fontSize: 40, letterSpacing: 8, color: colors.lime },
  codeSub: { fontFamily: fontFamily.sans400, fontSize: 12, color: 'rgba(255,255,255,.6)', marginTop: 4 },
  waitingText: { fontFamily: fontFamily.sans400, fontSize: 13, color: 'rgba(255,255,255,.6)', textAlign: 'center' },
  leaveRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10 },
  leaveLabel: { fontFamily: fontFamily.sans500, fontSize: 12.5, color: 'rgba(255,255,255,.5)' },
  iconButtonDark: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(255,255,255,.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
