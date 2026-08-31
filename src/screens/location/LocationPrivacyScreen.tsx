import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fontFamily, radius, spacing } from '../../theme';
import { Icon } from '../../components/Icon';
import { Card, InlineNote, Row, SectionLabel, ToggleRow } from '../../components/account/rows';

const BACK_ICON = 'M15 5l-7 7 7 7';

interface LocationPrivacyScreenProps {
  onBack: () => void;
}

/**
 * Location sharing defaults — same visual shape as Account settings
 * (lime hero, pale body, white Card rows). Toggle and "Stop" are live
 * UI state only for now; there's no location backend to persist
 * against yet (see the note at the bottom).
 */
export function LocationPrivacyScreen({ onBack }: LocationPrivacyScreenProps) {
  const insets = useSafeAreaInsets();
  const [autoLastSeen, setAutoLastSeen] = useState(true);

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
          <Text style={styles.emptyText}>You're not sharing your live location with anyone right now.</Text>
        </Card>

        <InlineNote>
          MySpace never tracks your location in the background. Last-seen only updates while the app is open, and a live share
          always has an end time you control. This screen is a preview — location sharing isn't wired up to a real map or
          backend yet.
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
