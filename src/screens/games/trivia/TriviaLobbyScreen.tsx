import React, { useRef, useState } from 'react';
import { Animated, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '../../../components/Icon';
import { BottomNav } from '../../../components/BottomNav';
import { PrimaryCta } from '../../../components/spacecards/PrimaryCta';
import { NpatGlassBackdrop } from '../../../components/npat/NpatGlassBackdrop';
import { useReducedMotion } from '../../../hooks/useReducedMotion';
import { useFocusBorder } from '../../../hooks/useFocusBorder';
import { useAuth } from '../../../context/AuthContext';
import { useTriviaGame } from '../../../context/TriviaGameContext';
import { noOutline } from '../../../theme/webStyles';
import type { TriviaDifficulty } from '../../../types/trivia';
import {
  CATEGORY_OPTIONS,
  DIFFICULTY_OPTIONS,
  QUESTION_COUNT_OPTIONS,
  TIME_PER_QUESTION_OPTIONS,
  trColor,
  trFont,
} from '../../../theme/triviaTokens';

const BACK_ICON = 'M15 5l-7 7 7 7';
const LEAVE_ICON = 'M9 5l-7 7 7 7 M2 12h13 M17 5v14';
const CODE_CELL_COUNT = 6;

function defaultName(user: { user_metadata?: { full_name?: string } } | null): string {
  return user?.user_metadata?.full_name?.split(' ')[0]?.trim() || 'Player';
}

function BrainIcon() {
  return (
    <View style={styles.brainIcon}>
      <Text style={styles.brainGlyph}>🧠</Text>
    </View>
  );
}

/** Read-only or editable 6-character invite-code cell row — alphanumeric, matching Space Cards' inline code-entry pattern rather than NPAT's numeric-only one. */
function CodeCells({ value, onChangeText }: { value: string; onChangeText?: (t: string) => void }) {
  const editable = !!onChangeText;
  const focusIndex = Math.min(value.length, CODE_CELL_COUNT - 1);
  const cells = Array.from({ length: CODE_CELL_COUNT }, (_, i) => value[i] ?? '');
  const inputRef = useRef<TextInput>(null);

  const cellRow = (
    <View style={styles.codeRow}>
      {cells.map((ch, i) => (
        <View key={i} style={[styles.codeCell, editable && i === focusIndex && !ch && styles.codeCellFocused]}>
          <Text style={styles.codeCellText}>{ch}</Text>
        </View>
      ))}
    </View>
  );

  return (
    <View>
      {editable ? (
        <Pressable onPress={() => inputRef.current?.focus()} accessibilityRole="button" accessibilityLabel="Enter invite code">
          {cellRow}
        </Pressable>
      ) : (
        cellRow
      )}
      {editable && (
        <TextInput
          ref={inputRef}
          value={value}
          onChangeText={(t) => onChangeText?.(t.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, CODE_CELL_COUNT))}
          autoCapitalize="characters"
          autoCorrect={false}
          maxLength={CODE_CELL_COUNT}
          style={styles.hiddenInput}
        />
      )}
    </View>
  );
}

interface TriviaLobbyScreenProps {
  onHome: () => void;
  onOpenExpenses: () => void;
  onOpenSplit: () => void;
  /** Which tab the create/join hub opens on — the Games hub's "Join with code" row jumps straight to Join. */
  initialTab?: 'create' | 'join';
}

/** Create-or-join hub when there's no game yet; the lobby once one exists. */
export function TriviaLobbyScreen({ onHome, onOpenExpenses, onOpenSplit, initialTab }: TriviaLobbyScreenProps) {
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const { user } = useAuth();
  const { game, players, myPlayerId, loading, createGame, joinGame, leaveGame, startGame } = useTriviaGame();

  if (game) {
    return (
      <TriviaReadyRoom
        onHome={onHome}
        onOpenExpenses={onOpenExpenses}
        onOpenSplit={onOpenSplit}
        game={game}
        players={players}
        myPlayerId={myPlayerId}
        leaveGame={leaveGame}
        startGame={startGame}
        insets={insets}
        reduceMotion={reduceMotion}
      />
    );
  }

  return (
    <TriviaHub
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

function TriviaHub({
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
  createGame: ReturnType<typeof useTriviaGame>['createGame'];
  joinGame: ReturnType<typeof useTriviaGame>['joinGame'];
  defaultName: string;
  insets: { top: number; bottom: number };
  reduceMotion?: boolean;
  initialTab?: 'create' | 'join';
}) {
  const [tab, setTab] = useState<'create' | 'join'>(initialTab ?? 'create');
  const [name, setName] = useState(fallbackName);
  const [category, setCategory] = useState<string>('Random');
  const [difficulty, setDifficulty] = useState<TriviaDifficulty>('mixed');
  const [questionCount, setQuestionCount] = useState(10);
  const [timePerQuestion, setTimePerQuestion] = useState(20);
  const [roomCode, setRoomCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const { borderColor: nameBorderColor, onFocus: onNameFocus, onBlur: onNameBlur } = useFocusBorder('rgba(22,33,12,0)', trColor.lime);
  const isJoin = tab === 'join';

  const handleCreate = async () => {
    setError(null);
    const { error: err } = await createGame({ category, difficulty, questionCount, timePerQuestion, name });
    if (err) setError(err);
  };

  const handleJoin = async () => {
    setError(null);
    const { error: err } = await joinGame(roomCode, name);
    if (err) setError(err);
  };

  return (
    <LinearGradient colors={[trColor.headerTop, trColor.headerMid, trColor.headerBottom]} locations={[0, 0.52, 1]} style={styles.screen}>
      <NpatGlassBackdrop colors={[trColor.blobIndigoDark, trColor.blobLimeDark]} />
      <View style={{ paddingTop: insets.top }}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>🧠 Trivia Night</Text>
          <Text style={styles.headerSub}>Think fast. Answer faster.</Text>
        </View>
      </View>

      <ScrollView style={styles.scrollFlex} contentContainerStyle={styles.sheetScroll} showsVerticalScrollIndicator={false} bounces={false}>
        <View style={styles.sheet}>
          <BlurView intensity={50} tint="light" style={[StyleSheet.absoluteFill, { zIndex: -1 }]} pointerEvents="none" />
          <View style={styles.sheetTint} pointerEvents="none" />
          <View style={styles.handle} />

          <View style={styles.tabs}>
            <Pressable onPress={() => setTab('create')} style={[styles.tab, !isJoin && styles.tabActive]} accessibilityRole="button" accessibilityLabel="Create Trivia Night">
              <Text style={[styles.tabLabel, !isJoin && styles.tabLabelActive]}>Create Trivia Night</Text>
            </Pressable>
            <Pressable onPress={() => setTab('join')} style={[styles.tab, isJoin && styles.tabActive]} accessibilityRole="button" accessibilityLabel="Join with code">
              <Text style={[styles.tabLabel, isJoin && styles.tabLabelActive]}>Join with code</Text>
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
                <Text style={styles.label}>CATEGORY</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pillScrollRow}>
                  {CATEGORY_OPTIONS.map((c) => (
                    <Pressable key={c} onPress={() => setCategory(c)} style={[styles.optionPill, category === c && styles.optionPillActive]} accessibilityRole="button" accessibilityLabel={c}>
                      <Text style={[styles.optionLabel, category === c && styles.optionLabelActive]}>{c}</Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </View>

              <View style={styles.field}>
                <Text style={styles.label}>DIFFICULTY</Text>
                <View style={styles.pillRow}>
                  {DIFFICULTY_OPTIONS.map((d) => (
                    <Pressable key={d} onPress={() => setDifficulty(d)} style={[styles.optionPill, styles.optionPillFlex, difficulty === d && styles.optionPillActive]} accessibilityRole="button" accessibilityLabel={d}>
                      <Text style={[styles.optionLabel, difficulty === d && styles.optionLabelActive]}>{d[0].toUpperCase() + d.slice(1)}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>

              <View style={styles.field}>
                <Text style={styles.label}>QUESTIONS</Text>
                <View style={styles.pillRow}>
                  {QUESTION_COUNT_OPTIONS.map((n) => (
                    <Pressable key={n} onPress={() => setQuestionCount(n)} style={[styles.optionPill, styles.optionPillFlex, questionCount === n && styles.optionPillActive]} accessibilityRole="button" accessibilityLabel={`${n} questions`}>
                      <Text style={[styles.optionLabel, questionCount === n && styles.optionLabelActive]}>{n}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>

              <View style={styles.field}>
                <Text style={styles.label}>TIME PER QUESTION</Text>
                <View style={styles.pillRow}>
                  {TIME_PER_QUESTION_OPTIONS.map((s) => (
                    <Pressable key={s} onPress={() => setTimePerQuestion(s)} style={[styles.optionPill, styles.optionPillFlex, timePerQuestion === s && styles.optionPillActive]} accessibilityRole="button" accessibilityLabel={`${s} second timer`}>
                      <Text style={[styles.optionLabel, timePerQuestion === s && styles.optionLabelActive]}>{s}s</Text>
                    </Pressable>
                  ))}
                </View>
              </View>

              {error && <Text style={styles.error}>{error}</Text>}
              <View style={styles.actionsRow}>
                <Pressable onPress={onHome} style={styles.backChip} accessibilityRole="button" accessibilityLabel="Back to Games">
                  <Icon path={BACK_ICON} color={trColor.ink} size={19} strokeWidth={2.2} />
                </Pressable>
                <View style={styles.ctaFlex}>
                  <PrimaryCta label={loading ? 'Creating…' : 'Create Trivia Night'} onPress={handleCreate} disabled={loading} reduceMotion={reduceMotion} icon={<BrainIcon />} />
                </View>
              </View>
            </>
          ) : (
            <>
              <View style={styles.field}>
                <Text style={styles.label}>INVITE CODE</Text>
                <CodeCells value={roomCode} onChangeText={setRoomCode} />
              </View>
              {error && <Text style={styles.error}>{error}</Text>}
              <Text style={styles.hint}>Ask your host for the 6-character invite code.</Text>
              <View style={styles.actionsRow}>
                <Pressable onPress={onHome} style={styles.backChip} accessibilityRole="button" accessibilityLabel="Back to Games">
                  <Icon path={BACK_ICON} color={trColor.ink} size={18} strokeWidth={2.2} />
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

function TriviaReadyRoom({
  onHome,
  onOpenExpenses,
  onOpenSplit,
  game,
  players,
  myPlayerId,
  leaveGame,
  startGame,
  insets,
  reduceMotion,
}: {
  onHome: () => void;
  onOpenExpenses: () => void;
  onOpenSplit: () => void;
  game: NonNullable<ReturnType<typeof useTriviaGame>['game']>;
  players: ReturnType<typeof useTriviaGame>['players'];
  myPlayerId: string | null;
  leaveGame: () => Promise<void>;
  startGame: ReturnType<typeof useTriviaGame>['startGame'];
  insets: { top: number; bottom: number };
  reduceMotion?: boolean;
}) {
  const { user } = useAuth();
  const isHost = !!user && user.id === game.hostId;
  const active = players.filter((p) => p.active);
  const host = active.find((p) => p.userId === game.hostId);
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);
  const isStarting = starting || game.status === 'starting';

  const handleStart = async () => {
    setStarting(true);
    setStartError(null);
    const { error: err } = await startGame();
    setStarting(false);
    if (err) setStartError(err);
  };

  return (
    <LinearGradient colors={[trColor.headerTop, trColor.headerMid, trColor.headerBottom]} locations={[0, 0.52, 1]} style={styles.screen}>
      <NpatGlassBackdrop colors={[trColor.blobIndigoDark, trColor.blobLimeDark]} />
      <View style={{ paddingTop: insets.top }}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>🧠 Trivia Night</Text>
        </View>
      </View>

      <ScrollView style={styles.scrollFlex} contentContainerStyle={styles.sheetScroll} showsVerticalScrollIndicator={false} bounces={false}>
        <View style={styles.sheet}>
          <BlurView intensity={50} tint="light" style={[StyleSheet.absoluteFill, { zIndex: -1 }]} pointerEvents="none" />
          <View style={styles.sheetTint} pointerEvents="none" />
          <View style={styles.handle} />

          <View style={styles.field}>
            <Text style={styles.label}>INVITE CODE</Text>
            <CodeCells value={game.roomCode} />
            <Text style={styles.roomSub}>
              {game.questionCount} questions · {game.timePerQuestion}s each · {game.category} · {game.difficulty}
            </Text>
          </View>

          <View style={styles.field}>
            <View style={styles.playersHeaderRow}>
              <Text style={styles.label}>PLAYERS</Text>
              <Text style={styles.label}>{active.length}</Text>
            </View>
            <View style={styles.playerList}>
              {active.map((p) => (
                <View key={p.id} style={styles.playerRow}>
                  <View style={styles.avatarDot}>
                    <Text style={styles.avatarInitial}>{p.name.trim().slice(0, 1).toUpperCase() || '?'}</Text>
                  </View>
                  <Text style={styles.playerName}>
                    {p.name}
                    {p.id === myPlayerId ? ' (you)' : ''}
                  </Text>
                  {p.userId === game.hostId && <Text style={styles.hostBadge}>HOST</Text>}
                </View>
              ))}
            </View>
          </View>

          {isHost ? (
            <>
              <PrimaryCta
                label={isStarting ? 'Starting…' : active.length < 2 ? 'Need 2+ players' : 'Start Game'}
                onPress={handleStart}
                disabled={isStarting || active.length < 2}
                reduceMotion={reduceMotion}
              />
              {startError && <Text style={styles.error}>{startError}</Text>}
            </>
          ) : (
            <Text style={styles.waitHint}>
              {game.status === 'starting' ? 'The host is starting the game…' : `Waiting for ${host?.name ?? 'the host'} to start…`}
            </Text>
          )}

          <Pressable onPress={leaveGame} style={styles.leaveRow} accessibilityRole="button" accessibilityLabel="Leave game">
            <Icon path={LEAVE_ICON} color={trColor.fieldLabel} size={16} strokeWidth={1.8} />
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
  header: { paddingHorizontal: 22, paddingTop: 14, paddingBottom: 4, gap: 3 },
  headerTitle: { fontFamily: trFont.sans800, fontSize: 22, color: '#FFFFFF' },
  headerSub: { fontFamily: trFont.sans400, fontSize: 12.5, color: trColor.onDark60 },
  sheet: {
    marginTop: 18,
    overflow: 'hidden',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: trColor.glassBorder,
    paddingHorizontal: 22,
    paddingTop: 14,
    paddingBottom: 26,
    gap: 14,
  },
  sheetTint: { position: 'absolute', zIndex: -1, top: 0, left: 0, right: 0, bottom: 0, backgroundColor: trColor.sheetGlassFill },
  handle: { alignSelf: 'center', width: 38, height: 4, borderRadius: 2, backgroundColor: 'rgba(22,33,12,.14)', marginBottom: 2 },
  tabs: { flexDirection: 'row', backgroundColor: trColor.rowGlassFill, borderRadius: 999, padding: 4, borderWidth: 1, borderColor: trColor.rowGlassBorder },
  tab: { flex: 1, paddingVertical: 12, borderRadius: 999, alignItems: 'center' },
  tabActive: { backgroundColor: trColor.ink },
  tabLabel: { fontFamily: trFont.sans500, fontSize: 12.5, color: trColor.tabInactiveText, textAlign: 'center' },
  tabLabelActive: { fontFamily: trFont.sans700, color: '#FFFFFF' },
  field: { gap: 9 },
  label: { fontFamily: trFont.mono500, fontSize: 9.5, letterSpacing: 9.5 * 0.12, color: trColor.fieldLabel, textTransform: 'uppercase' },
  input: { backgroundColor: trColor.rowGlassFill, borderRadius: 16, borderWidth: 1.5, borderColor: trColor.rowGlassBorder, paddingVertical: 15, paddingHorizontal: 17 },
  inputText: { fontFamily: trFont.sans700, fontSize: 16, color: trColor.ink },
  pillRow: { flexDirection: 'row', gap: 8 },
  pillScrollRow: { flexDirection: 'row', gap: 8, paddingRight: 4 },
  optionPill: { paddingVertical: 13, paddingHorizontal: 15, borderRadius: 14, alignItems: 'center', backgroundColor: trColor.rowGlassFill, borderWidth: 1, borderColor: trColor.rowGlassBorder },
  optionPillFlex: { flex: 1 },
  optionPillActive: { backgroundColor: trColor.ink, borderColor: trColor.ink },
  optionLabel: { fontFamily: trFont.sans600, fontSize: 13, color: trColor.pillInactiveText },
  optionLabelActive: { fontFamily: trFont.sans700, color: trColor.lime },
  error: { fontFamily: trFont.sans500, fontSize: 12.5, color: '#D33243' },
  hint: { fontFamily: trFont.sans400, fontSize: 10.5, color: trColor.fieldLabel, textAlign: 'center' },
  actionsRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  backChip: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1.6,
    borderColor: trColor.rowGlassBorder,
    backgroundColor: trColor.rowGlassFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaFlex: { flex: 1 },
  brainIcon: { width: 19, height: 19, alignItems: 'center', justifyContent: 'center' },
  brainGlyph: { fontSize: 15, lineHeight: 18 },
  roomSub: { fontFamily: trFont.sans400, fontSize: 11.5, color: trColor.fieldLabel, textAlign: 'center' },
  playersHeaderRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  playerList: { gap: 5 },
  playerRow: { flexDirection: 'row', alignItems: 'center', gap: 11, backgroundColor: trColor.rowGlassFill, borderRadius: 999, borderWidth: 1, borderColor: trColor.rowGlassBorder, paddingVertical: 8, paddingHorizontal: 12 },
  avatarDot: { width: 26, height: 26, borderRadius: 13, backgroundColor: trColor.ink, alignItems: 'center', justifyContent: 'center' },
  avatarInitial: { fontFamily: trFont.sans700, fontSize: 11, color: trColor.lime },
  playerName: { flex: 1, fontFamily: trFont.sans700, fontSize: 13.5, color: trColor.ink },
  hostBadge: { fontFamily: trFont.mono500, fontSize: 9, letterSpacing: 9 * 0.1, color: trColor.ready },
  waitHint: { fontFamily: trFont.sans400, fontSize: 11.5, color: trColor.fieldLabel, textAlign: 'center' },
  leaveRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 6 },
  leaveLabel: { fontFamily: trFont.sans500, fontSize: 12.5, color: trColor.fieldLabel },
  codeRow: { flexDirection: 'row', gap: 7 },
  codeCell: { flex: 1, aspectRatio: 1 / 1.05, borderRadius: 14, backgroundColor: trColor.ink, alignItems: 'center', justifyContent: 'center' },
  codeCellFocused: { backgroundColor: 'rgba(22,33,12,.07)', borderWidth: 1.6, borderColor: trColor.lime },
  codeCellText: { fontFamily: trFont.mono500, fontSize: 21, color: trColor.lime },
  hiddenInput: { position: 'absolute', opacity: 0, height: 0, width: 0, fontSize: 16 },
});
