import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fontFamily, radius, spacing } from '../../theme';
import { Icon } from '../../components/Icon';
import { Card, InlineNote, Row, SectionLabel, ToggleRow } from '../../components/account/rows';
import { useAuth } from '../../context/AuthContext';
import { useLocationData } from '../../context/LocationContext';

const BACK_ICON = 'M15 5l-7 7 7 7';

function timeLeftLabel(expiresAt: string | null): string {
  if (!expiresAt) return '';
  const ms = new Date(expiresAt).getTime() - Date.now();
  if (ms <= 0) return 'ending…';
  const mins = Math.round(ms / 60000);
  if (mins < 60) return `${mins} min left`;
  const hrs = Math.round(mins / 60);
  return `${hrs} hr${hrs === 1 ? '' : 's'} left`;
}

interface LocationPrivacyScreenProps {
  onBack: () => void;
}

/**
 * Location sharing defaults — same visual shape as Account settings
 * (lime hero, pale body, white Card rows). "Active shares" reflects your
 * real location_shares row; the auto-last-seen toggle is still cosmetic
 * (capture always runs on screen open) since there's no per-user setting
 * for it in the backend yet.
 */
export function LocationPrivacyScreen({ onBack }: LocationPrivacyScreenProps) {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { shareFor, stopShare } = useLocationData();
  const [autoLastSeen, setAutoLastSeen] = useState(true);
  const ownShare = user ? shareFor(user.id) : undefined;

  return (
    <View style={styles.screen}>
      <View style={[styles.hero, { paddingTop: insets.top + spacing.md }]}>
        <Pressable onPress={onBack} style={styles.backButton} accessibilityRole="button" accessibilityLabel="Back">
          <Icon path={BACK_ICON} color={colors.textPrimary} size={17} strokeWidth={2.4} />
        </Pressable>
        <Text style={styles.heroTitle}>Location & privacy</Text>
        <View style={styles.backButton} />
      </View>

      <ScrollView style={styles.body} showsVerticalScrollIndicator={false} contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + spacing.huge }]}>
        <SectionLabel>Location sharing</SectionLabel>
        <Card>
          <ToggleRow
            label="Share last-seen automatically"
            sublabel="Updates only when you open MySpace — never in the background"
            value={autoLastSeen}
            onValueChange={setAutoLastSeen}
          />
          <Row label="Default share duration" value="1 hour" />
          <Row label="Who can see your last-seen" value="All friends" last />
        </Card>

        <SectionLabel>Active shares</SectionLabel>
        <Card>
          {ownShare ? (
            <Row label="Stop sharing with all friends" sublabel={timeLeftLabel(ownShare.expiresAt)} destructive onPress={() => stopShare()} last />
          ) : (
            <Text style={styles.emptyText}>You're not sharing your live location with anyone right now.</Text>
          )}
        </Card>

        <InlineNote>
          MySpace never tracks your location in the background. Last-seen only updates while the app is open, and a live share
          always has an end time you control. The real map only renders on a native build — this screen still works fully on
          web, just without it.
        </InlineNote>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.lime,
  },
  hero: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xxl,
    paddingBottom: spacing.xl,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(22,33,12,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroTitle: {
    fontFamily: fontFamily.sans600,
    fontSize: 17,
    color: colors.textPrimary,
  },
  body: {
    flex: 1,
    backgroundColor: colors.pale,
    borderTopLeftRadius: radius.organic,
  },
  scroll: {
    paddingHorizontal: spacing.xxl,
    paddingTop: spacing.xl,
    gap: spacing.ms,
  },
  emptyText: {
    fontFamily: fontFamily.sans400,
    fontSize: 13,
    color: colors.textFaint,
    paddingVertical: spacing.md,
  },
});
