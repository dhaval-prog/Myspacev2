import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DropBackdrop } from '../../components/drop/DropBackdrop';
import { DropCard } from '../../components/drop/DropCard';
import { DropTok } from '../../components/drop/DropTok';
import { DropTopBar } from '../../components/drop/DropTopBar';
import { Kick, Serif } from '../../components/drop/DropText';
import { useDrop } from '../../context/DropContext';
import { dpColor, dpFont, dpGradient, dpSpace } from '../../theme/dropTokens';

interface DropLoveMapScreenProps {
  onBack: () => void;
}

/** "The map" — every insight the two of you have learned, sourced from Drops and Refocus. */
export function DropLoveMapScreen({ onBack }: DropLoveMapScreenProps) {
  const insets = useSafeAreaInsets();
  const { loveMap, pair } = useDrop();

  if (!pair) return null;
  const fightCount = loveMap.filter((l) => l.source === 'refocus' || l.source === 'repair').length;

  return (
    <LinearGradient colors={dpGradient.dawn.colors} locations={dpGradient.dawn.locations} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.screen}>
      <DropBackdrop />
      <DropTopBar title="love map" onBack={onBack} />
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + 52 + 24, paddingBottom: insets.bottom + 60 }]} showsVerticalScrollIndicator={false}>
        <Serif s={34} style={{ marginBottom: 10 }}>
          What you're learning about each other
        </Serif>

        <LinearGradient colors={dpGradient.us.colors} locations={dpGradient.us.locations} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.loopCard}>
          <View style={styles.loopOverlay} />
          <Kick c="rgba(255,255,255,0.85)">the drop loop</Kick>
          <Serif s={20} c="#fff" style={{ marginTop: 6, marginBottom: 12 }}>
            A rough moment becomes a lesson.
          </Serif>
          <View style={styles.loopStrip}>
            <View style={styles.loopTile}>
              <Text style={styles.loopTileText}>💢 something happened</Text>
            </View>
            <Text style={styles.loopArrow}>→</Text>
            <View style={styles.loopTile}>
              <Text style={styles.loopTileText}>🤍 you refocused</Text>
            </View>
            <Text style={styles.loopArrow}>→</Text>
            <View style={styles.loopTile}>
              <Text style={styles.loopTileText}>🎯 it's on the map</Text>
            </View>
          </View>
        </LinearGradient>

        {loveMap.length > 0 && (
          <View style={styles.sectionHeader}>
            <Kick>the map · {loveMap.length} learning{loveMap.length === 1 ? '' : 's'}</Kick>
            <Kick>{fightCount} from fights</Kick>
          </View>
        )}

        {loveMap.length === 0 ? (
          <Text style={styles.emptyText}>Nothing learned yet. Play a Drop or refocus something, and it lands here.</Text>
        ) : (
          loveMap.map((l) => (
            <DropCard key={l.id} style={styles.learnCard}>
              <View style={styles.learnHeader}>
                <Text style={styles.learnEmoji}>{l.emoji ?? '🤍'}</Text>
                <View style={styles.whoChip}>
                  <DropTok who={{ initial: l.about === pair.me.userId ? pair.me.initial : pair.other.initial }} you={l.about === pair.me.userId} size={20} />
                  <Text style={styles.whoChipText}>{l.about === pair.me.userId ? 'You' : pair.other.name}</Text>
                </View>
                <View style={[styles.sourceBadge, l.source === 'drop' ? styles.sourceBadgeDrop : styles.sourceBadgeFight]}>
                  <Text style={styles.sourceBadgeText}>{l.source === 'drop' ? '💬 FROM A DROP' : '💢 FROM A MOMENT'}</Text>
                </View>
              </View>
              <Text style={styles.learnNeed}>{l.need}</Text>
              {l.detail && l.detail !== l.need && <Text style={styles.learnDetail}>{l.detail}</Text>}
            </DropCard>
          ))
        )}

        <Text style={styles.footer}>The more honestly you play, the sharper your map. Nothing here is ever shown to anyone outside the two of you.</Text>
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { paddingHorizontal: dpSpace.gutter },
  loopCard: { borderRadius: 24, padding: 18, marginBottom: 20, overflow: 'hidden' },
  loopOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(255,255,255,0.08)' },
  loopStrip: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  loopTile: { backgroundColor: 'rgba(255,255,255,0.18)', borderRadius: 12, paddingVertical: 8, paddingHorizontal: 10 },
  loopTileText: { fontFamily: dpFont.ui600, fontSize: 11, color: '#fff' },
  loopArrow: { color: 'rgba(255,255,255,0.7)', fontSize: 14 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  emptyText: { fontFamily: dpFont.ui400, fontSize: 13.5, color: dpColor.inkSoft, textAlign: 'center', marginTop: 30, lineHeight: 13.5 * 1.5 },
  learnCard: { padding: 14, marginBottom: 12 },
  learnHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  learnEmoji: { fontSize: 18 },
  whoChip: { flexDirection: 'row', alignItems: 'center', gap: 5, flex: 1 },
  whoChipText: { fontFamily: dpFont.ui600, fontSize: 12, color: dpColor.ink },
  sourceBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999 },
  sourceBadgeDrop: { backgroundColor: dpColor.sunken },
  sourceBadgeFight: { backgroundColor: 'rgba(157,149,245,0.18)' },
  sourceBadgeText: { fontFamily: dpFont.mono, fontSize: 8, letterSpacing: 0.6, color: dpColor.inkSoft },
  learnNeed: { fontFamily: dpFont.ui700, fontSize: 14, color: dpColor.ink, lineHeight: 14 * 1.4 },
  learnDetail: { fontFamily: dpFont.ui400, fontSize: 13, color: dpColor.inkSoft, marginTop: 6, lineHeight: 13 * 1.45 },
  footer: { fontFamily: dpFont.ui400, fontSize: 11, color: dpColor.inkMute, textAlign: 'center', marginTop: 20, lineHeight: 11 * 1.5 },
});
