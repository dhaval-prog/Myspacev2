import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Icon } from '../Icon';
import { FriendAvatar } from '../friends/FriendAvatar';
import { GlassSurface } from '../friends/GlassSurface';
import { throwColor, throwFont, throwGlass, throwRadius } from '../../theme/throwTokens';

const PLUS_ICON = 'M12 5v14M5 12h14';
const CAMERA_ICON = 'M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z M12 17a4 4 0 100-8 4 4 0 000 8z';

interface ProfileCardProps {
  name: string;
  avatarUrl: string | null;
  userId: string;
  city: string | null;
  friendCount: number;
  /** True once today's status has actually been posted — swaps the empty-state copy/square for a
   * plain "posted" read instead of inviting a second one; the card itself doesn't manage story
   * data, so this is simply handed in by whatever already tracks it. */
  hasStatusToday?: boolean;
  onAddStatus: () => void;
  /** The "Profile" text link — left inert (no screen to open yet) rather than guessing at one. */
  onOpenProfile?: () => void;
}

/** "You" — a glassmorphism card popping over the map the moment the recipient carousel's Add
 * Status slot is selected, showing who's about to post and how many friends they have, with the
 * actual "Add status" entry point into the camera. Sits directly above the Add Friend card (see
 * AddFriendCard) in the same step; both disappear together the moment the camera opens, and both
 * come back once it closes. No explicit close button — flicking the carousel to a real contact
 * (or Notifications) is the way out, same as every other carousel-driven step. */
export function ProfileCard({ name, avatarUrl, userId, city, friendCount, hasStatusToday, onAddStatus, onOpenProfile }: ProfileCardProps) {
  const subtitle = [city, `${friendCount} friend${friendCount === 1 ? '' : 's'}`].filter(Boolean).join(' · ');
  return (
    <GlassSurface tint="light" tintColor={throwGlass.tintWaterBlueStrong} style={styles.card}>
      <View style={styles.headerRow}>
        <FriendAvatar userId={userId} name={name} avatarUrl={avatarUrl} size={48} />
        <View style={styles.headerText}>
          <Text style={styles.name}>{name}</Text>
          <Text style={styles.subtitle}>{subtitle}</Text>
        </View>
      </View>

      <View style={styles.statusRow}>
        <View style={styles.statusSquare}>
          <Icon path={PLUS_ICON} size={18} color={throwColor.inkFaint} strokeWidth={2} />
        </View>
        <Text style={styles.statusCopy}>
          {hasStatusToday
            ? 'Status posted today. Friends on the map see it for 24 hours.'
            : 'No status today. Friends on the map see it for 24 hours.'}
        </Text>
      </View>

      <View style={styles.footerRow}>
        <Pressable onPress={onAddStatus} style={styles.addStatusBtn} accessibilityRole="button" accessibilityLabel="Add status">
          <Icon path={CAMERA_ICON} size={15} color="#FFFFFF" strokeWidth={2} />
          <Text style={styles.addStatusLabel}>Add status</Text>
        </Pressable>
        <Pressable onPress={onOpenProfile} disabled={!onOpenProfile} accessibilityRole="button" accessibilityLabel="Profile">
          <Text style={styles.profileLink}>Profile</Text>
        </Pressable>
      </View>
    </GlassSurface>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: throwRadius.card,
    padding: 16,
    gap: 16,
    ...throwColor.shadowSoft,
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  headerText: { flex: 1, minWidth: 0, gap: 2 },
  name: { fontFamily: throwFont.ui700, fontSize: 18, color: throwColor.ink },
  subtitle: { fontFamily: throwFont.ui400, fontSize: 13, color: throwColor.inkFaint },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  statusSquare: {
    width: 48,
    height: 48,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: throwColor.cardBorder,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusCopy: { flex: 1, fontFamily: throwFont.ui400, fontSize: 13.5, color: throwColor.inkFaint, lineHeight: 18 },
  footerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  addStatusBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 40,
    paddingHorizontal: 18,
    borderRadius: throwRadius.pill,
    backgroundColor: throwColor.ink,
  },
  addStatusLabel: { fontFamily: throwFont.ui700, fontSize: 14, color: '#FFFFFF' },
  profileLink: { fontFamily: throwFont.ui600, fontSize: 14, color: throwColor.ink },
});
