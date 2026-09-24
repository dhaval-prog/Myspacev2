import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DropBackdrop } from '../../components/drop/DropBackdrop';
import { DropBtn } from '../../components/drop/DropBtn';
import { DropCard } from '../../components/drop/DropCard';
import { DropPress } from '../../components/drop/DropPress';
import { DropTopBar } from '../../components/drop/DropTopBar';
import { Kick, Serif } from '../../components/drop/DropText';
import { dpColor, dpFont, dpGradient, dpSpace } from '../../theme/dropTokens';

const PERKS = [
  { emoji: '🧠', title: 'A mediator that knows you', desc: 'It reads what you two have already worked out before it answers' },
  { emoji: '🪢', title: 'Your patterns, surfaced', desc: 'What keeps coming up, and what actually settles it' },
  { emoji: '📖', title: 'Your whole record', desc: 'Every repair you came through, kept for both of you' },
  { emoji: '🤍', title: 'One purchase, both of you', desc: 'Never paywalled mid-repair. The hard moment is always free' },
];

const PLANS = [
  { id: 'year', price: '$39.99', per: '/yr', mo: '$3.33/mo', badge: 'BEST VALUE' },
  { id: 'month', price: '$4.99', per: '/mo', mo: 'billed monthly', badge: '' },
  { id: 'life', price: '$79.99', per: ' once', mo: 'one price covers you both', badge: 'LIFETIME' },
] as const;

interface DropPaywallScreenProps {
  onBack: () => void;
}

/**
 * Visual-only port of Parallax's paywall — the layout, copy, and plan tiers are faithful, but there's
 * no real billing behind it in this build (no RevenueCat project/keys here). Tapping a plan just says so.
 */
export function DropPaywallScreen({ onBack }: DropPaywallScreenProps) {
  const insets = useSafeAreaInsets();
  const [selected, setSelected] = useState<(typeof PLANS)[number]['id']>('year');
  const [notice, setNotice] = useState(false);

  return (
    <LinearGradient colors={dpGradient.dawn.colors} locations={dpGradient.dawn.locations} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.screen}>
      <DropBackdrop />
      <DropTopBar title="drop plus" onBack={onBack} />
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + 52 + 24, paddingBottom: insets.bottom + 60 }]} showsVerticalScrollIndicator={false}>
        <Serif s={34} style={{ marginBottom: 8 }}>
          Unlock everything, for both of you.
        </Serif>
        <Text style={styles.subhead}>One subscription covers you and your Drop partner.</Text>

        <DropCard style={styles.perksCard}>
          {PERKS.map((p, i) => (
            <View key={p.title} style={[styles.perkRow, i > 0 && styles.perkDivider]}>
              <Text style={styles.perkEmoji}>{p.emoji}</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.perkTitle}>{p.title}</Text>
                <Text style={styles.perkDesc}>{p.desc}</Text>
              </View>
            </View>
          ))}
        </DropCard>

        <Kick style={{ marginBottom: 10 }}>choose your plan</Kick>
        {PLANS.map((plan) => (
          <DropPress key={plan.id} onPress={() => setSelected(plan.id)}>
            <DropCard style={[styles.planCard, selected === plan.id && styles.planCardSelected]}>
              {plan.badge ? (
                <View style={styles.planBadge}>
                  <Text style={styles.planBadgeText}>{plan.badge}</Text>
                </View>
              ) : null}
              <View style={[styles.radio, selected === plan.id && styles.radioSelected]} />
              <View style={{ flex: 1 }}>
                <Text style={styles.planName}>{plan.id === 'year' ? 'Yearly' : plan.id === 'month' ? 'Monthly' : 'Lifetime'}</Text>
                <Text style={styles.planMo}>{plan.mo}</Text>
              </View>
              <Text style={styles.planPrice}>
                {plan.price}
                <Text style={styles.planPer}>{plan.per}</Text>
              </Text>
            </DropCard>
          </DropPress>
        ))}

        <Text style={styles.trustLine}>🔒 Billed through the App Store. Cancel anytime.</Text>

        {notice && <Text style={styles.notice}>This build has no live billing connected — nothing was charged.</Text>}

        <DropBtn kind="us" onPress={() => setNotice(true)} style={{ marginTop: 8 }}>
          {selected === 'life' ? 'Unlock lifetime' : 'Start free trial'}
        </DropBtn>
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { paddingHorizontal: dpSpace.gutter },
  subhead: { fontFamily: dpFont.ui400, fontSize: 14, color: dpColor.inkSoft, marginBottom: 20, lineHeight: 14 * 1.5 },
  perksCard: { padding: 16, marginBottom: 24 },
  perkRow: { flexDirection: 'row', gap: 12, paddingVertical: 10 },
  perkDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: dpColor.line },
  perkEmoji: { fontSize: 22 },
  perkTitle: { fontFamily: dpFont.ui700, fontSize: 13.5, color: dpColor.ink },
  perkDesc: { fontFamily: dpFont.ui400, fontSize: 12, color: dpColor.inkSoft, marginTop: 2, lineHeight: 12 * 1.4 },
  planCard: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, marginBottom: 10, position: 'relative' },
  planCardSelected: { backgroundColor: dpColor.usSoft, borderColor: dpColor.p2Deep, borderWidth: 2 },
  planBadge: { position: 'absolute', top: -9, right: 14, backgroundColor: dpColor.p1Deep, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 },
  planBadgeText: { fontFamily: dpFont.monoBold, fontSize: 8.5, color: '#fff', letterSpacing: 0.6 },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: dpColor.inkMute },
  radioSelected: { borderColor: dpColor.p2Deep, backgroundColor: dpColor.p2Deep },
  planName: { fontFamily: dpFont.ui700, fontSize: 14.5, color: dpColor.ink },
  planMo: { fontFamily: dpFont.ui400, fontSize: 11.5, color: dpColor.inkSoft, marginTop: 2 },
  planPrice: { fontFamily: dpFont.disp, fontSize: 23, color: dpColor.ink },
  planPer: { fontFamily: dpFont.ui400, fontSize: 12, color: dpColor.inkSoft },
  trustLine: { fontFamily: dpFont.ui400, fontSize: 11.5, color: dpColor.inkMute, textAlign: 'center', marginTop: 8, marginBottom: 8 },
  notice: { fontFamily: dpFont.ui400, fontSize: 12, color: dpColor.p1Deep, textAlign: 'center', marginBottom: 8 },
});
