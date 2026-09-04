import React, { useState } from 'react';
import { Animated, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '../../../components/Icon';
import { BottomNav } from '../../../components/BottomNav';
import { PrimaryCta } from '../../../components/spacecards/PrimaryCta';
import { NpatHeader } from '../../../components/npat/NpatHeader';
import { RoomCodeCells } from '../../../components/npat/RoomCodeCells';
import { useReducedMotion } from '../../../hooks/useReducedMotion';
import { useFocusBorder } from '../../../hooks/useFocusBorder';
import { useAuth } from '../../../context/AuthContext';
import { useGame } from '../../../context/GameContext';
import { noOutline } from '../../../theme/webStyles';
import { npColor, npFont, ROUND_OPTIONS, TIMER_OPTIONS } from '../../../theme/npatTokens';

const BACK_ICON = 'M15 5l-7 7 7 7';
const LEAVE_ICON = 'M9 5l-7 7 7 7 M2 12h13 M17 5v14';

function defaultName(user: { user_metadata?: { full_name?: string } } | null): string {
  return user?.user_metadata?.full_name?.split(' ')[0]?.trim() || 'Player';
}

function DieIcon() {
  return (
    <View style={styles.dieIcon}>
      <View style={styles.dieDot} />
    </View>
  );
}

interface NpatLobbyScreenProps {
  onHome: () => void;
  onOpenExpenses: () => void;
  onOpenSplit: () => void;
  /** Which tab the create/join hub opens on — e.g. the Games hub's "Join with code" row button jumps straight to Join. */
  initialTab?: 'create' | 'join';
}

/** Create-or-join hub when there's no game yet; ready-up room once one exists — restyled to the "MySpace Games · 1A · 1B" handoff. */
export function NpatLobbyScreen({ onHome, onOpenExpenses, onOpenSplit, initialTab }: NpatLobbyScreenProps) {
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
      initialTab={initialTab}
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
  initialTab,
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
  initialTab?: 'create' | 'join';
}) {
  const [tab, setTab] = useState<'create' | 'join'>(initialTab ?? 'create');
  const [name, setName] = useState(fallbackName);
  const [rounds, setRounds] = useState(5);
  const [timerSeconds, setTimerSeconds] = useState(30);
  const [roomCode, setRoomCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const { borderColor: nameBorderColor, onFocus: onNameFocus, onBlur: onNameBlur } = useFocusBorder('rgba(22,33,12,0)', npColor.lime);
  const isJoin = tab === 'join';

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
    <LinearGradient colors={[npColor.headerTop, npColor.headerMid, npColor.headerBottom]} locations={[0, 0.52, 1]} style={styles.screen}>
      <View style={{ paddingTop: insets.top }}>
        <NpatHeader showOnlineRow={!isJoin} reduceMotion={reduceMotion} />
      </View>

      <ScrollView style={styles.scrollFlex} contentContainerStyle={styles.sheetScroll} showsVerticalScrollIndicator={false} bounces={false}>
        <View style={styles.sheet}>
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
                placeholder="Player"
                placeholderTextColor="rgba(22,33,12,.35)"
                style={[styles.inputText, noOutline]}
              />
            </Animated.View>
          </View>

          {!isJoin ? (
            <>
              <View style={styles.field}>
                <Text style={styles.label}>ROUNDS</Text>
                <View style={styles.pillRow}>
                  {ROUND_OPTIONS.map((n) => (
                    <Pressable key={n} onPress={() => setRounds(n)} style={[styles.optionPill, rounds === n && styles.optionPillActive]} accessibilityRole="button" accessibilityLabel={`${n} rounds`}>
                      <Text style={[styles.optionLabel, rounds === n && styles.optionLabelActive]}>{n}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>

              <View style={styles.field}>
                <Text style={styles.label}>TIMER PER ROUND</Text>
                <View style={styles.pillRow}>
                  {TIMER_OPTIONS.map((s) => (
                    <Pressable key={s} onPress={() => setTimerSeconds(s)} style={[styles.optionPill, timerSeconds === s && styles.optionPillActive]} accessibilityRole="button" accessibilityLabel={`${s} second timer`}>
                      <Text style={[styles.optionLabel, timerSeconds === s && styles.optionLabelActive]}>{s}s</Text>
                    </Pressable>
                  ))}
                </View>
              </View>

              {error && <Text style={styles.error}>{error}</Text>}
              <View style={styles.actionsRow}>
                <Pressable onPress={onHome} style={styles.backChip} accessibilityRole="button" accessibilityLabel="Back to Games">
                  <Icon path={BACK_ICON} color={npColor.ink} size={19} strokeWidth={2.2} />
                </Pressable>
                <View style={styles.ctaFlex}>
                  <PrimaryCta label={loading ? 'Creating…' : 'Create'} onPress={handleCreate} disabled={loading} reduceMotion={reduceMotion} icon={<DieIcon />} />
                </View>
              </View>
            </>
          ) : (
            <>
              <View style={styles.field}>
                <Text style={styles.label}>ROOM CODE</Text>
                <RoomCodeCells value={roomCode} onChangeText={setRoomCode} autoFocus />
              </View>
              {error && <Text style={styles.error}>{error}</Text>}
              <Text style={styles.hint}>Ask your host for the 6-digit room code.</Text>
              <View style={styles.actionsRow}>
                <Pressable onPress={onHome} style={styles.backChip} accessibilityRole="button" accessibilityLabel="Back to Games">
                  <Icon path={BACK_ICON} color={npColor.ink} size={18} strokeWidth={2.2} />
                </Pressable>
                <View style={styles.ctaFlex}>
                  <PrimaryCta label={loading ? 'Joining…' : 'Join'} onPress={handleJoin} disabled={loading} reduceMotion={reduceMotion} />
                </View>
              </View>
            </>
          )}
        </View>
      </ScrollView>

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
  const readyCount = active.filter((p) => p.ready).length;
  const host = active.find((p) => p.userId === game.hostId);
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
    <LinearGradient colors={[npColor.headerTop, npColor.headerMid, npColor.headerBottom]} locations={[0, 0.52, 1]} style={styles.screen}>
      <View style={{ paddingTop: insets.top }}>
        <NpatHeader showOnlineRow={false} reduceMotion={reduceMotion} />
      </View>

      <ScrollView style={styles.scrollFlex} contentContainerStyle={styles.sheetScroll} showsVerticalScrollIndicator={false} bounces={false}>
        <View style={styles.sheet}>
          <View style={styles.handle} />

          <View style={styles.field}>
            <Text style={styles.label}>ROOM CODE</Text>
            <RoomCodeCells value={game.roomCode} />
            <Text style={styles.roomSub}>
              {game.roundsTotal} rounds · {game.timerSeconds}s per round
            </Text>
          </View>

          <View style={styles.field}>
            <View style={styles.playersHeaderRow}>
              <Text style={styles.label}>PLAYERS IN</Text>
              <Text style={styles.label}>{active.length}</Text>
            </View>
            <View style={styles.playerList}>
              {active.map((p) => (
                <View key={p.id} style={styles.playerRow}>
                  <View style={[styles.readyDot, p.ready && styles.readyDotActive]} />
                  <Text style={styles.playerName}>
                    {p.name}
                    {p.userId === game.hostId ? ' · Host' : ''}
                    {p.id === myPlayerId ? ' (you)' : ''}
                  </Text>
                  <Text style={[styles.playerStatus, p.ready && styles.playerStatusActive]}>{p.ready ? 'Ready' : 'Not ready'}</Text>
                </View>
              ))}
            </View>
          </View>

          {error && <Text style={styles.error}>{error}</Text>}

          {me && (
            <View style={styles.readyRow}>
              <Pressable onPress={() => setReady(true)} style={[styles.readyBtn, me.ready && styles.readyBtnActive]} accessibilityRole="button" accessibilityLabel="I'm ready">
                <Text style={[styles.readyBtnLabel, me.ready && styles.readyBtnLabelActive]}>I'm ready</Text>
              </Pressable>
              <Pressable onPress={() => setReady(false)} style={[styles.readyBtn, !me.ready && styles.notReadyBtnActive]} accessibilityRole="button" accessibilityLabel="Not ready">
                <Text style={[styles.readyBtnLabel, !me.ready && styles.notReadyBtnLabelActive]}>Not ready</Text>
              </Pressable>
            </View>
          )}

          {isHost ? (
            <PrimaryCta label={starting ? 'Starting…' : 'Start round'} onPress={handleStart} disabled={starting} reduceMotion={reduceMotion} />
          ) : (
            <Text style={styles.waitHint}>
              Waiting for {host?.name ?? 'the host'} to start · {readyCount} of {active.length} ready
            </Text>
          )}

          <Pressable onPress={leaveGame} style={styles.leaveRow} accessibilityRole="button" accessibilityLabel="Leave game">
            <Icon path={LEAVE_ICON} color={npColor.fieldLabel} size={16} strokeWidth={1.8} />
            <Text style={styles.leaveLabel}>Leave game</Text>
          </Pressable>
        </View>
      </ScrollView>

      <BottomNav
        activeId="games"
        onSelect={(id) => {
          if (id === 'home') {
            leaveGame();
            onHome();
          }
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
  sheetScroll: { flexGrow: 1, justifyContent: 'flex-end' },
  sheet: {
    marginTop: 18,
    backgroundColor: npColor.sheet,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingHorizontal: 22,
    paddingTop: 14,
    paddingBottom: 26,
    gap: 14,
  },
  handle: { alignSelf: 'center', width: 38, height: 4, borderRadius: 2, backgroundColor: 'rgba(22,33,12,.14)', marginBottom: 2 },
  tabs: { flexDirection: 'row', backgroundColor: 'rgba(22,33,12,.06)', borderRadius: 999, padding: 4 },
  tab: { flex: 1, paddingVertical: 12, borderRadius: 999, alignItems: 'center' },
  tabActive: { backgroundColor: npColor.ink },
  tabLabel: { fontFamily: npFont.sans500, fontSize: 13.5, color: npColor.tabInactiveText },
  tabLabelActive: { fontFamily: npFont.sans700, color: '#FFFFFF' },
  field: { gap: 9 },
  label: { fontFamily: npFont.mono500, fontSize: 9.5, letterSpacing: 9.5 * 0.12, color: npColor.fieldLabel, textTransform: 'uppercase' },
  input: { backgroundColor: npColor.fieldBg, borderRadius: 16, borderWidth: 1.5, paddingVertical: 15, paddingHorizontal: 17 },
  inputText: { fontFamily: npFont.sans700, fontSize: 16, color: npColor.ink },
  pillRow: { flexDirection: 'row', gap: 8 },
  optionPill: { flex: 1, paddingVertical: 13, borderRadius: 14, alignItems: 'center', backgroundColor: npColor.fieldBg },
  optionPillActive: { backgroundColor: npColor.ink },
  optionLabel: { fontFamily: npFont.sans600, fontSize: 13.5, color: npColor.pillInactiveText },
  optionLabelActive: { fontFamily: npFont.sans700, color: npColor.lime },
  error: { fontFamily: npFont.sans500, fontSize: 12.5, color: '#D33243' },
  hint: { fontFamily: npFont.sans400, fontSize: 10.5, color: npColor.fieldLabel, textAlign: 'center' },
  actionsRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  backChip: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1.6,
    borderColor: 'rgba(22,33,12,.16)',
    backgroundColor: npColor.fieldBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaFlex: { flex: 1 },
  dieIcon: { width: 19, height: 19, borderRadius: 5, borderWidth: 2, borderColor: npColor.ink, alignItems: 'center', justifyContent: 'center' },
  dieDot: { width: 4.5, height: 4.5, borderRadius: 3, backgroundColor: npColor.ink },
  roomSub: { fontFamily: npFont.sans400, fontSize: 11.5, color: npColor.fieldLabel, textAlign: 'center' },
  playersHeaderRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  playerList: { gap: 5 },
  playerRow: { flexDirection: 'row', alignItems: 'center', gap: 11, backgroundColor: npColor.fieldBg, borderRadius: 999, paddingVertical: 10, paddingHorizontal: 15 },
  readyDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: npColor.neutralDot },
  readyDotActive: { backgroundColor: npColor.ready },
  playerName: { flex: 1, fontFamily: npFont.sans700, fontSize: 13.5, color: npColor.ink },
  playerStatus: { fontFamily: npFont.mono500, fontSize: 11, letterSpacing: 11 * 0.06, color: npColor.notReady },
  playerStatusActive: { color: npColor.ready },
  readyRow: { flexDirection: 'row', gap: 10 },
  readyBtn: { flex: 1, paddingVertical: 17, borderRadius: 999, alignItems: 'center', backgroundColor: npColor.fieldBg },
  readyBtnActive: { backgroundColor: npColor.lime },
  notReadyBtnActive: { backgroundColor: npColor.ink },
  readyBtnLabel: { fontFamily: npFont.sans600, fontSize: 14.5, color: npColor.pillInactiveText },
  readyBtnLabelActive: { fontFamily: npFont.sans700, color: npColor.ink },
  notReadyBtnLabelActive: { fontFamily: npFont.sans700, color: '#FFFFFF' },
  waitHint: { fontFamily: npFont.sans400, fontSize: 11.5, color: npColor.fieldLabel, textAlign: 'center' },
  leaveRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 6 },
  leaveLabel: { fontFamily: npFont.sans500, fontSize: 12.5, color: npColor.fieldLabel },
});
