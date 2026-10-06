import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, fontFamily, radius, spacing } from '../../theme';
import { Icon } from '../Icon';
import { FriendAvatar } from '../friends/FriendAvatar';
import { useNotifications, type AppNotification } from '../../context/NotificationsContext';
import { useFriends } from '../../context/FriendsContext';
import { targetForNotification, type NotificationTarget } from '../../utils/notify';
import { throwColor, throwRadius } from '../../theme/throwTokens';

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

const RELEVANT_CATEGORIES = new Set<string>(FILTERS.map((f) => f.id).filter((id) => id !== 'all'));

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

interface NotificationsPanelProps {
  /** Jumps to whatever this notification is about (a chat, a throw, a contact) — omit to just
   * acknowledge in place. */
  onNavigate?: (target: NotificationTarget) => void;
}

/** The notification history — every friend request, throw, chat message, and status post that's
 * come in, grouped by day, filterable by category, built to match a supplied reference design.
 * Rendered as a floating solid white card above the map, directly inside ThrowHomeScreen,
 * instead of pushing to a separate full-screen route — reached from the recipient carousel's own
 * Notifications slot (see RecipientCarousel's own isNotificationsSelected), which the card stays
 * open for exactly as long as that slot stays selected. Distinct from the smaller quick-glance
 * NotificationsSheet used elsewhere in the app. */
export function NotificationsPanel({ onNavigate }: NotificationsPanelProps) {
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

  // `notifications` (NotificationsContext) is shared app-wide and also carries categories this
  // panel has no pill/badge art for at all (Expenses' budget_reset/budget_alerts/invitations/
  // expiring_items/item_reminders, shared_space_activity, etc.) — "All" must mean "all of this
  // panel's own four categories", not literally every notification the user has ever gotten,
  // or those rows show up with the wrong badge icon, no matching avatar, and a tap target that
  // falls through to targetForNotification's generic default.
  const relevant = useMemo(() => notifications.filter((n) => RELEVANT_CATEGORIES.has(n.category)), [notifications]);
  const filtered = useMemo(() => (filter === 'all' ? relevant : relevant.filter((n) => n.category === filter)), [relevant, filter]);
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
          <FriendAvatar userId={n.relatedUserId ?? n.id} name={avatar?.name ?? n.title} avatarUrl={avatar?.avatarUrl} size={44} />
          <View style={[styles.badge, { backgroundColor: badge.bg }]}>
            <Icon path={badge.icon} size={11} color={badge.iconColor} strokeWidth={2.4} />
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
            <Icon path={PHOTO_ICON} size={15} color={colors.textFaint} strokeWidth={1.8} />
            <Text style={styles.photoThumbLabel}>photo</Text>
          </View>
        )}

        {!n.read && <View style={styles.unreadDot} />}
      </Pressable>
    );
  };

  return (
    <View style={styles.card}>
      {unreadCount > 0 && (
        <View style={styles.header}>
          <Pressable onPress={clearAll} accessibilityRole="button" accessibilityLabel="Mark all read">
            <Text style={styles.markAllRead}>Mark all read</Text>
          </Pressable>
        </View>
      )}

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

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.listContent}>
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
  card: {
    flex: 1,
    backgroundColor: throwColor.cardBg,
    borderWidth: 1,
    borderColor: throwColor.cardBorder,
    borderRadius: throwRadius.card,
    // A little more breathing room above the filter row than the header alone gave it (see item
    // 2's own explicit request) — starts the row a bit further down instead of flush against the
    // card's own top edge/rounded corner, whether or not "Mark all read" is showing above it.
    paddingTop: spacing.md,
    ...throwColor.shadowSoft,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  markAllRead: { fontFamily: fontFamily.sans600, fontSize: 13, color: ACCENT_BLUE },
  // `width: '100%'` keeps this ScrollView from ever stretching past the card's own width (it
  // otherwise shrink-wraps to its unclipped content on web) — without it, a too-wide pill row
  // bleeds past the right edge instead of becoming properly horizontally scrollable there.
  // `height` is pinned explicitly to the pills' own height (filterPill below) rather than left to
  // auto-size from content — real iPhone Safari otherwise measures this horizontal ScrollView's
  // cross-axis height too short (a flexbox min-height/overflow-content quirk specific to that
  // engine, distinct from the WebKit pill-shrinking one noted on filterPill below), slicing the
  // tops off every pill in the row instead of showing them full-height.
  filterScroll: { flexGrow: 0, width: '100%', height: 30, marginBottom: spacing.lg },
  // Extra bottom MARGIN (not padding) so the TODAY/EARLIER label below has real space before it —
  // kept off the ScrollView's own contentContainerStyle since that padding would otherwise just
  // extend the (now explicitly height-pinned) scrollable content past what's visible, rather than
  // actually making room below the row the way a true sibling-level gap does.
  filterRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, paddingHorizontal: spacing.md },
  filterPill: {
    paddingHorizontal: 12,
    height: 30,
    borderRadius: radius.pill,
    backgroundColor: colors.ink07,
    alignItems: 'center',
    justifyContent: 'center',
    // Without this, some WebKit builds shrink these pills below their own text's natural width
    // once the row's combined content doesn't fit the available width — the pill's background
    // shrinks but its one-line Text doesn't wrap, so the label spills out past its own pill and
    // visually overlaps its neighbor instead of the row simply scrolling. Pinning flexShrink to 0
    // keeps every pill at its natural size no matter what.
    flexShrink: 0,
  },
  filterPillActive: { backgroundColor: colors.ink },
  filterLabel: { fontFamily: fontFamily.sans600, fontSize: 12.5, color: colors.textPrimary },
  filterLabelActive: { color: colors.white },
  sectionLabel: {
    fontFamily: fontFamily.sans600,
    fontSize: 11,
    letterSpacing: 1.2,
    color: colors.textFaint,
    textTransform: 'uppercase',
    paddingHorizontal: spacing.lg,
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
  },
  listContent: { paddingBottom: spacing.lg },
  empty: { fontFamily: fontFamily.sans400, fontSize: 13.5, color: colors.textFaint, textAlign: 'center', paddingVertical: spacing.xl },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
  avatarWrap: { position: 'relative' },
  badge: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowBody: { flex: 1, minWidth: 0, gap: 2 },
  rowLine: { flexWrap: 'wrap' },
  rowName: { fontFamily: fontFamily.sans700, fontSize: 14, color: colors.textPrimary },
  rowPhrase: { fontFamily: fontFamily.sans400, fontSize: 14, color: colors.textPrimary },
  rowPreview: { fontFamily: fontFamily.sans400, fontSize: 13, color: colors.textSecondary, marginTop: 2 },
  rowTime: { fontFamily: fontFamily.sans400, fontSize: 12, color: colors.textFaint, marginTop: 2 },
  actionsRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: spacing.sm },
  acceptButton: { backgroundColor: colors.ink, borderRadius: radius.pill, paddingVertical: 7, paddingHorizontal: 16 },
  acceptLabel: { fontFamily: fontFamily.sans700, fontSize: 13, color: colors.white },
  declineButton: { paddingVertical: 7, paddingHorizontal: 4 },
  declineLabel: { fontFamily: fontFamily.sans600, fontSize: 13, color: colors.textSecondary },
  photoThumb: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: colors.ink07,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoThumbLabel: { fontFamily: fontFamily.sans400, fontSize: 9, color: colors.textFaint, marginTop: 2 },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: ACCENT_BLUE, marginTop: 6 },
});
