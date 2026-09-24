import React, { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DropBackdrop } from '../../components/drop/DropBackdrop';
import { DropCard } from '../../components/drop/DropCard';
import { DropPress } from '../../components/drop/DropPress';
import { DropTok } from '../../components/drop/DropTok';
import { DropTopBar } from '../../components/drop/DropTopBar';
import { Kick, Serif } from '../../components/drop/DropText';
import { useDrop } from '../../context/DropContext';
import { dpColor, dpFont, dpGradient, dpSpace } from '../../theme/dropTokens';

interface DropSettingsScreenProps {
  onBack: () => void;
  onUnpaired: () => void;
  onOpenPaywall: () => void;
}

/** "You & Drop" — partner info, streak, and Plus, consolidated from Parallax's profile/settings/manageSub screens. */
export function DropSettingsScreen({ onBack, onUnpaired, onOpenPaywall }: DropSettingsScreenProps) {
  const insets = useSafeAreaInsets();
  const { pair, unpair } = useDrop();
  const [unpairing, setUnpairing] = useState(false);

  if (!pair) return null;

  const handleUnpair = () => {
    Alert.alert('Unpair from ' + pair.other.name + '?', 'This ends your Drop together. Your Love Map and history stay, but no new Drops will start.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Unpair',
        style: 'destructive',
        onPress: async () => {
          setUnpairing(true);
          await unpair();
          setUnpairing(false);
          onUnpaired();
        },
      },
    ]);
  };

  return (
    <LinearGradient colors={dpGradient.dawn.colors} locations={dpGradient.dawn.locations} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.screen}>
      <DropBackdrop />
      <DropTopBar title="you & drop" onBack={onBack} />
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + 52 + 24, paddingBottom: insets.bottom + 60 }]} showsVerticalScrollIndicator={false}>
        <DropCard style={styles.identityCard}>
          <DropTok who={{ initial: pair.other.initial, name: pair.other.name }} size={64} ring />
          <Serif s={22} style={{ marginTop: 10 }}>
            {pair.other.name}
          </Serif>
          <Text style={styles.pairedSince}>{pair.togetherSince ? `Dropping together since ${new Date(pair.togetherSince).toLocaleDateString()}` : 'Dropping together'}</Text>
        </DropCard>

        <View style={styles.statsRow}>
          <DropCard style={styles.statCard}>
            <Text style={styles.statBig}>{pair.streak}</Text>
            <Kick style={{ textAlign: 'center' }}>day streak</Kick>
          </DropCard>
          <DropCard style={styles.statCard}>
            <Text style={styles.statBig}>{pair.longestStreak}</Text>
            <Kick style={{ textAlign: 'center' }}>longest</Kick>
          </DropCard>
          <DropCard style={styles.statCard}>
            <Text style={styles.statBig}>{pair.freezesRemaining}</Text>
            <Kick style={{ textAlign: 'center' }}>freezes</Kick>
          </DropCard>
        </View>

        <Kick style={{ marginTop: 24, marginBottom: 8 }}>account</Kick>
        <DropPress onPress={onOpenPaywall}>
          <DropCard style={styles.row}>
            <Text style={styles.rowLabel}>Drop Plus</Text>
            <Text style={styles.rowValue}>Upgrade</Text>
          </DropCard>
        </DropPress>
        <DropPress onPress={handleUnpair} disabled={unpairing}>
          <DropCard style={styles.row}>
            <Text style={[styles.rowLabel, styles.danger]}>{unpairing ? 'Unpairing…' : `Unpair from ${pair.other.name}`}</Text>
          </DropCard>
        </DropPress>

        <Text style={styles.footer}>drop · a MySpace feature, built for two</Text>
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { paddingHorizontal: dpSpace.gutter },
  identityCard: { alignItems: 'center', padding: 24, marginBottom: 16 },
  pairedSince: { fontFamily: dpFont.ui400, fontSize: 12.5, color: dpColor.inkSoft, marginTop: 4 },
  statsRow: { flexDirection: 'row', gap: 10 },
  statCard: { flex: 1, alignItems: 'center', paddingVertical: 16 },
  statBig: { fontFamily: dpFont.disp, fontSize: 26, color: dpColor.ink, marginBottom: 4 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, marginBottom: 10 },
  rowLabel: { fontFamily: dpFont.ui600, fontSize: 14, color: dpColor.ink },
  rowValue: { fontFamily: dpFont.ui600, fontSize: 13, color: dpColor.p2Deep },
  danger: { color: dpColor.danger },
  footer: { fontFamily: dpFont.mono, fontSize: 10, color: dpColor.inkMute, textAlign: 'center', marginTop: 30, letterSpacing: 0.5 },
});
