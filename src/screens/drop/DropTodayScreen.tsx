import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '../../components/Icon';
import { BottomNav } from '../../components/BottomNav';
import { DropBackdrop } from '../../components/drop/DropBackdrop';
import { DropCard } from '../../components/drop/DropCard';
import { DropPress } from '../../components/drop/DropPress';
import { DropBtn } from '../../components/drop/DropBtn';
import { DropTok } from '../../components/drop/DropTok';
import { Kick, Serif } from '../../components/drop/DropText';
import { MoodCheckCard } from '../../components/drop/MoodCheckCard';
import { RepairCheckinCard } from '../../components/drop/RepairCheckinCard';
import { useDrop } from '../../context/DropContext';
import { dpColor, dpFont, dpGradient, dpSpace } from '../../theme/dropTokens';

const CHEV_ICON = 'M9 6l6 6-6 6';
const FLAME_ICON = 'M12 2c1 3-2 4-2 7a4 4 0 0 0 8 0c0-2-1-3-1-3s2 2 2 6a6 6 0 0 1-12 0c0-4 3-6 5-10z';

interface DropTodayScreenProps {
  onHome: () => void;
  onOpenExpenses: () => void;
  onOpenSplit: () => void;
  onOpenAnswer: () => void;
  onOpenReveal: () => void;
  onOpenRefocus: () => void;
  onOpenLoveMap: () => void;
  onOpenPartnerSettings: () => void;
}

/** The Drop hub — "the whole feature at a glance": today's Drop, the daily pulse, anything live, and the one thing to reach for when something's up. */
export function DropTodayScreen({
  onHome,
  onOpenExpenses,
  onOpenSplit,
  onOpenAnswer,
  onOpenReveal,
  onOpenRefocus,
  onOpenLoveMap,
  onOpenPartnerSettings,
}: DropTodayScreenProps) {
  const insets = useSafeAreaInsets();
  const { pair, todayState, openYesterdayCatchUp, loveMap } = useDrop();

  if (!pair) return null;

  const latestLearning = loveMap[0] ?? null;

  const dropCtaLabel = (() => {
    if (!todayState) return 'Loading…';
    if (todayState.state === 'revealed') return 'See how you did';
    if (todayState.iAnswered) return "Your side is in — waiting on them";
    if (todayState.state === 'one_done') return 'Answer today’s Drop';
    return "Answer today's Drop";
  })();

  const handleDropCardPress = () => {
    if (todayState?.state === 'revealed') onOpenReveal();
    else onOpenAnswer();
  };

  return (
    <LinearGradient colors={dpGradient.dawn.colors} locations={dpGradient.dawn.locations} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.screen}>
      <DropBackdrop />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[styles.content, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 110 }]}>
        <View style={styles.headerRow}>
          <Serif s={28}>Drop</Serif>
          <DropPress onPress={onOpenPartnerSettings} scale={false}>
            <DropTok who={{ initial: pair.other.initial, name: pair.other.name }} size={38} />
          </DropPress>
        </View>
        <Text style={styles.subhead}>with {pair.other.name}</Text>

        {pair.streak > 0 && (
          <View style={styles.streakRow}>
            <Icon path={FLAME_ICON} color={dpColor.p1Deep} size={16} strokeWidth={2} />
            <Text style={styles.streakText}>{pair.streak} day streak</Text>
            {pair.freezesRemaining > 0 && <Text style={styles.freezeText}>· {pair.freezesRemaining} freeze{pair.freezesRemaining === 1 ? '' : 's'} left</Text>}
          </View>
        )}

        <MoodCheckCard playedToday={todayState?.state === 'revealed'} onTalkItThrough={onOpenRefocus} />

        <DropPress onPress={handleDropCardPress}>
          <DropCard style={styles.dropCard}>
            <Kick>{todayState?.dropTitle ?? 'today’s drop'}</Kick>
            <Serif s={24} style={{ marginTop: 6, marginBottom: 6 }}>
              {dropCtaLabel}
            </Serif>
            {todayState?.held && <Text style={styles.heldNote}>Held until {pair.other.name} joins Drop with you.</Text>}
            {!todayState?.held && todayState?.state !== 'revealed' && <Text style={styles.dropSub}>3 quick prompts — answer for yourself, guess theirs.</Text>}
            {todayState?.state === 'revealed' && typeof todayState.wavePct === 'number' && <Text style={styles.dropSub}>{todayState.wavePct}% on the same wavelength today.</Text>}
            <Icon path={CHEV_ICON} color={dpColor.inkMute} size={18} strokeWidth={2.2} style={styles.chev} />
          </DropCard>
        </DropPress>

        {todayState?.catchUpAvailable && (
          <DropPress
            onPress={async () => {
              const { error } = await openYesterdayCatchUp();
              if (!error) onOpenAnswer();
            }}
          >
            <Text style={styles.catchUpLink}>catch up on yesterday's Drop</Text>
          </DropPress>
        )}

        <RepairCheckinCard partnerName={pair.other.name} onTalkAgain={onOpenRefocus} />

        <View style={{ marginTop: 10 }}>
          <Serif s={26} style={{ marginBottom: 8 }}>
            Something's up?
          </Serif>
          <Text style={styles.somethingBody}>Say it messily, privately. You'll get back what's underneath it for you, and one thing you could actually say next.</Text>
          <DropBtn kind="us" onPress={onOpenRefocus}>
            Something happened
          </DropBtn>
        </View>

        {latestLearning && (
          <DropPress onPress={onOpenLoveMap}>
            <DropCard style={[styles.dropCard, { marginTop: 20 }]}>
              <Kick>what you two know</Kick>
              <Text style={styles.learningText}>
                {latestLearning.emoji ? `${latestLearning.emoji} ` : ''}
                {latestLearning.need}
              </Text>
            </DropCard>
          </DropPress>
        )}
      </ScrollView>

      <BottomNav
        activeId="drop"
        onSelect={(id) => {
          if (id === 'home') onHome();
          if (id === 'expenses') onOpenExpenses();
          if (id === 'split') onOpenSplit();
        }}
        bottomInset={insets.bottom}
      />
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { paddingHorizontal: dpSpace.gutter },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  subhead: { fontFamily: dpFont.ui400, fontSize: 13, color: dpColor.inkSoft, marginTop: 2 },
  streakRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12 },
  streakText: { fontFamily: dpFont.ui700, fontSize: 12.5, color: dpColor.p1Deep },
  freezeText: { fontFamily: dpFont.ui400, fontSize: 11.5, color: dpColor.inkSoft },
  dropCard: { padding: 18, marginTop: 18, marginBottom: 6 },
  dropSub: { fontFamily: dpFont.ui400, fontSize: 13, color: dpColor.inkSoft, lineHeight: 13 * 1.4 },
  heldNote: { fontFamily: dpFont.ui400, fontSize: 12.5, color: dpColor.inkMute, fontStyle: 'italic' },
  chev: { position: 'absolute', right: 16, top: 18 },
  catchUpLink: { fontFamily: dpFont.ui600, fontSize: 12.5, color: dpColor.p2Deep, textAlign: 'center', marginBottom: 16 },
  somethingBody: { fontFamily: dpFont.ui400, fontSize: 14, color: dpColor.inkSoft, lineHeight: 14 * 1.5, marginBottom: 14 },
  learningText: { fontFamily: dpFont.ui400, fontSize: 14, color: dpColor.ink, marginTop: 8, lineHeight: 14 * 1.5 },
});
