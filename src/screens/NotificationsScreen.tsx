import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fontFamily, radius, spacing } from '../theme';
import { Icon } from '../components/Icon';
import { FriendAvatar } from '../components/friends/FriendAvatar';
import { useNotifications, type AppNotification } from '../context/NotificationsContext';
import { useFriends } from '../context/FriendsContext';
import { targetForNotification, type NotificationTarget } from '../utils/notify';

const BACK_ICON = 'M15 18l-6-6 6-6';
const PLUS_ICON = 'M12 5v14M5 12h14';
const PLANE_ICON = 'M22 2L11 13 M22 2L15 22L11 13L2 9L22 2Z';
const CHAT_ICON = 'M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z';
const CLOUD_ICON = 'M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z';
const PHOTO_ICON = 'M19 3H5a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2V5a2 2 0 00-2-2z M8.5 10a1.5 1.5 0 100-3 1.5 1.5 0 000 3z M21 15l-5-5L5 21';
// The reference design's own blue accent (Mark all read, unread dots) — this app's shared theme
// has no blue token of its own (its palette is lime/ink/pale throughout), so this matches Throw's
// own accentBlue instead of introducing an unrelated hue from scratch.
const ACCENT_BLUE = '#3D7BFF';

type Filter = 'all' | 'status_posted' | 'friend_requests' | 'chat_message' | 'throw';

const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'status_posted', label: 'Statuses' },
  { id: 'friend_requests', label: 'Requests' },
  { id: 'chat_message', label: 'Chats' },
  { id: 'throw', label: 'Throws' },
];

const BADGE: Record<string, { bg: string; icon: string; iconColor: string }> = {
  friend_requests: { bg: '#3DD16B', icon: PLUS_ICON, iconColor: '#FFFFFF' },
  throw: { bg: '#111111', icon: PLANE_ICON, iconColor: '#FFFFFF' },
  chat_message: { bg: '#C9A227', icon: CHAT_ICON, iconColor: '#FFFFFF' },
  status_posted: { bg: '#3D7BFF', icon: CLOUD_ICON, iconColor: '#FFFFFF' },
};

/** "2m"/"18m"/"1h"/"3d" — deliberately without an "ago" suffix, matching the reference design;
 * a notification from yesterday (but not today) reads "Yesterday" instead of "1d". */
function timeLabel(iso: string): string {
  const then = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - then.getTime();
  const mins = Math.max(0, Math.round(diffMs / 60000));
  if (mins < 60) return `${mins}m`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h`;
  const oneDayAgo = new Date(now);
  oneDayAgo.setDate(now.getDate() - 1);
  if (then.toDateString() === oneDayAgo.toDateString()) return 'Yesterday';
  const days = Math.round(hours / 24);
  return `${days}d`;
}

function isToday(iso: string): boolean {
  return new Date(iso).toDateString() === new Date().toDateString();
}

interface NotificationsScreenProps {
  onBack: () => void;
  /** Jumps to whatever this notification is about (a chat, a throw, a contact) — omit to just
   * acknowledge in place. */
  onNavigate?: (target: NotificationTarget) => void;
}

/** Full-screen notification history — every friend request, throw, chat message, and status post
 * that's come in, grouped by day, filterable by category, built to match a supplied reference
 * design exactly. Reached from Throw's own recipient rail (see RecipientCarousel's own
 * onOpenNotifications), distinct from the smaller quick-glance NotificationsSheet used elsewhere
 * in the app. */
export function NotificationsScreen({ onBack, onNavigate }: NotificationsScreenProps) {
  const insets = useSafeAreaInsets();
  const { notifications, unreadCount, acknowledge, clearAll } = useNotifications();
  const { friends, receivedRequests, sentRequests, acceptRequest, declineRequest } = useFriends();
  const [filter, setFilter] = useState<Filter>('all');

  const avatarFor = (userId: string | null): { name: string; avatarUrl: string | null } | null => {
    if (!userId) return null;
    const f = friends.find((x) => x.userId === userId);
    if (f) return { name: f.name, avatarUrl: f.avatarUrl };
    const r = receivedRequests.find((x) => x.userId === userId) ?? sentRequests.find((x) => x.userId === userId);
    if (r) return { name: r.name, avatarUrl: r.avatarUrl };
    return null;
  };

  const filtered = useMemo(() => (filter === 'all' ? notifications : notifications.filter((n) => n.category === filter)), [notifications, filter]);
  const todayItems = useMemo(() => filtered.filter((n) => isToday(n.createdAt)), [filtered]);
  const earlierItems = useMemo(() => filtered.filter((n) => !isToday(n.createdAt)), [filtered]);

  const handlePress = (n: AppNotification) => {
    acknowledge(n.id);
    onNavigate?.(targetForNotification(n));
  };

  const renderRow = (n: AppNotification) => {
    const badge = BADGE[n.category] ?? BADGE.throw;
    const avatar = avatarFor(n.relatedUserId);
    const isPendingRequest = n.category === 'friend_requests' && receivedRequests.some((r) => r.connectionId === n.entityId);
    const [phrase, preview] = n.category === 'chat_message' ? n.body.split('\n') : [n.body, null];

    return (
      <Pressable key={n.id} onPress={() => handlePress(n)} accessibilityRole="button" accessibilityLabel={`${n.title} ${n.body}`} style={styles.row}>
        <View style={styles.avatarWrap}>
          <FriendAvatar userId={n.relatedUserId ?? n.id} name={avatar?.name ?? n.title} avatarUrl={avatar?.avatarUrl} size={48} />
          <View style={[styles.badge, { backgroundColor: badge.bg }]}>
            <Icon path={badge.icon} size={12} color={badge.iconColor} strokeWidth={2.4} />
          </View>
        </View>

        <View style={styles.rowBody}>
          <Text style={styles.rowLine}>
            <Text style={styles.rowName}>{n.title}</Text>
            <Text style={styles.rowPhrase}> {phrase}</Text>
          </Text>
          {preview ? (
            <Text style={styles.rowPreview} numberOfLines={1}>
              {preview}
            </Text>
          ) : null}
          <Text style={styles.rowTime}>{timeLabel(n.createdAt)}</Text>

          {isPendingRequest && (
            <View style={styles.actionsRow}>
              <Pressable
                onPress={() => acceptRequest(n.entityId!)}
                style={styles.acceptButton}
                accessibilityRole="button"
                accessibilityLabel={`Accept ${n.title}`}
              >
                <Text style={styles.acceptLabel}>Accept</Text>
              </Pressable>
              <Pressable
                onPress={() => declineRequest(n.entityId!)}
                style={styles.declineButton}
                accessibilityRole="button"
                accessibilityLabel={`Decline ${n.title}`}
              >
                <Text style={styles.declineLabel}>Decline</Text>
              </Pressable>
            </View>
          )}
        </View>

        {n.category === 'status_posted' && (
          <View style={styles.photoThumb}>
            <Icon path={PHOTO_ICON} size={16} color={colors.textFaint} strokeWidth={1.8} />
            <Text style={styles.photoThumbLabel}>photo</Text>
          </View>
        )}

        {!n.read && <View style={styles.unreadDot} />}
      </Pressable>
    );
  };

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable onPress={onBack} hitSlop={8} accessibilityRole="button" accessibilityLabel="Back">
          <Icon path={BACK_ICON} size={24} color={colors.textPrimary} strokeWidth={2.2} />
        </Pressable>
        <Text style={styles.title}>Notifications</Text>
        {unreadCount > 0 ? (
          <Pressable onPress={clearAll} accessibilityRole="button" accessibilityLabel="Mark all read">
            <Text style={styles.markAllRead}>Mark all read</Text>
          </Pressable>
        ) : (
          <View style={{ width: 1 }} />
        )}
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll} contentContainerStyle={styles.filterRow}>
        {FILTERS.map((f) => {
          const active = f.id === filter;
          return (
            <Pressable
              key={f.id}
              onPress={() => setFilter(f.id)}
              style={[styles.filterPill, active && styles.filterPillActive]}
              accessibilityRole="button"
              accessibilityLabel={f.label}
            >
              <Text style={[styles.filterLabel, active && styles.filterLabelActive]}>{f.label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}>
        {filtered.length === 0 ? (
          <Text style={styles.empty}>You're all caught up.</Text>
        ) : (
          <>
            {todayItems.length > 0 && (
              <>
                <Text style={styles.sectionLabel}>TODAY</Text>
                {todayItems.map(renderRow)}
              </>
            )}
            {earlierItems.length > 0 && (
              <>
                <Text style={styles.sectionLabel}>EARLIER</Text>
                {earlierItems.map(renderRow)}
              </>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.white },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
    gap: spacing.sm,
  },
  title: { flex: 1, fontFamily: fontFamily.sans800, fontSize: 22, color: colors.textPrimary },
  markAllRead: { fontFamily: fontFamily.sans600, fontSize: 13.5, color: ACCENT_BLUE },
  filterScroll: { flexGrow: 0 },
  filterRow: { flexDirection: 'row', gap: spacing.sm, paddingHorizontal: spacing.lg, paddingBottom: spacing.md },
  filterPill: {
    paddingHorizontal: 16,
    height: 34,
    borderRadius: radius.pill,
    backgroundColor: colors.pale,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterPillActive: { backgroundColor: colors.ink },
  filterLabel: { fontFamily: fontFamily.sans600, fontSize: 13.5, color: colors.textPrimary },
  filterLabelActive: { color: colors.white },
  sectionLabel: {
    fontFamily: fontFamily.sans600,
    fontSize: 11,
    letterSpacing: 1.2,
    color: colors.textFaint,
    textTransform: 'uppercase',
    paddingHorizontal: spacing.lg,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  empty: { fontFamily: fontFamily.sans400, fontSize: 13.5, color: colors.textFaint, textAlign: 'center', paddingVertical: spacing.xl },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
  avatarWrap: { position: 'relative' },
  badge: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowBody: { flex: 1, minWidth: 0, gap: 2 },
  rowLine: { flexWrap: 'wrap' },
  rowName: { fontFamily: fontFamily.sans700, fontSize: 15, color: colors.textPrimary },
  rowPhrase: { fontFamily: fontFamily.sans400, fontSize: 15, color: colors.textPrimary },
  rowPreview: { fontFamily: fontFamily.sans400, fontSize: 13.5, color: colors.textSecondary, marginTop: 2 },
  rowTime: { fontFamily: fontFamily.sans400, fontSize: 12.5, color: colors.textFaint, marginTop: 2 },
  actionsRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: spacing.sm },
  acceptButton: { backgroundColor: colors.ink, borderRadius: radius.pill, paddingVertical: 8, paddingHorizontal: 18 },
  acceptLabel: { fontFamily: fontFamily.sans700, fontSize: 13.5, color: colors.white },
  declineButton: { paddingVertical: 8, paddingHorizontal: 4 },
  declineLabel: { fontFamily: fontFamily.sans600, fontSize: 13.5, color: colors.textSecondary },
  photoThumb: {
    width: 48,
    height: 48,
    borderRadius: 10,
    backgroundColor: colors.pale,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoThumbLabel: { fontFamily: fontFamily.sans400, fontSize: 9.5, color: colors.textFaint, marginTop: 2 },
  unreadDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: ACCENT_BLUE, marginTop: 6 },
});
