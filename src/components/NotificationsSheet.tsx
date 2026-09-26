import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, fontFamily, radius, spacing } from '../theme';
import { BottomSheet } from './expenses/BottomSheet';
import { FriendAvatar } from './friends/FriendAvatar';
import { useNotifications, type AppNotification } from '../context/NotificationsContext';
import { useFriends } from '../context/FriendsContext';
import { targetForNotification, type NotificationTarget } from '../utils/notify';

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.max(0, Math.round(diffMs / 60000));
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}

interface NotificationsSheetProps {
  visible: boolean;
  onClose: () => void;
  /** Jumps to whatever this notification is about (a card or chat) — omit to just acknowledge in place. */
  onNavigate?: (target: NotificationTarget) => void;
}

/** Slide-up inbox of real notifications — tapping one reads it, removes it, and jumps to where it happened.
 * Pending friend requests (received and sent, i.e. not yet accepted) live here too, as actionable
 * rows above the regular list, rather than requiring a trip to a separate Friends page. */
export function NotificationsSheet({ visible, onClose, onNavigate }: NotificationsSheetProps) {
  const { notifications, unreadCount, acknowledge, clearAll } = useNotifications();
  const { receivedRequests, sentRequests, acceptRequest, declineRequest, cancelRequest } = useFriends();

  const handlePress = (n: AppNotification) => {
    acknowledge(n.id);
    if (onNavigate) {
      onNavigate(targetForNotification(n));
      onClose();
    }
  };

  const hasRequests = receivedRequests.length > 0 || sentRequests.length > 0;

  return (
    <BottomSheet visible={visible} onClose={onClose} maxHeightRatio={0.78}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>Notifications</Text>
        {unreadCount > 0 ? (
          <Pressable onPress={clearAll} accessibilityRole="button" accessibilityLabel="Clear all">
            <Text style={styles.clearAll}>Clear all</Text>
          </Pressable>
        ) : null}
      </View>

      {hasRequests && (
        <View style={styles.requestsSection}>
          <Text style={styles.eyebrow}>FRIEND REQUESTS</Text>
          {receivedRequests.map((r) => (
            <View key={r.connectionId} style={styles.requestRow}>
              <FriendAvatar userId={r.userId} name={r.name} size={40} avatarUrl={r.avatarUrl} />
              <View style={styles.requestText}>
                <Text style={styles.requestName} numberOfLines={1}>
                  {r.name}
                </Text>
                <Text style={styles.requestMeta}>wants to be friends</Text>
              </View>
              <Pressable onPress={() => acceptRequest(r.connectionId)} style={styles.acceptButton} accessibilityRole="button" accessibilityLabel={`Accept ${r.name}`}>
                <Text style={styles.acceptLabel}>Accept</Text>
              </Pressable>
              <Pressable onPress={() => declineRequest(r.connectionId)} style={styles.declineButton} accessibilityRole="button" accessibilityLabel={`Decline ${r.name}`}>
                <Text style={styles.declineLabel}>✕</Text>
              </Pressable>
            </View>
          ))}
          {sentRequests.map((r) => (
            <View key={r.connectionId} style={styles.requestRow}>
              <FriendAvatar userId={r.userId} name={r.name} size={40} avatarUrl={r.avatarUrl} />
              <View style={styles.requestText}>
                <Text style={styles.requestName} numberOfLines={1}>
                  {r.name}
                </Text>
                <Text style={styles.requestMeta}>Request sent · pending</Text>
              </View>
              <Pressable onPress={() => cancelRequest(r.connectionId)} style={styles.declineButton} accessibilityRole="button" accessibilityLabel={`Cancel request to ${r.name}`}>
                <Text style={styles.declineLabel}>✕</Text>
              </Pressable>
            </View>
          ))}
        </View>
      )}

      {notifications.length === 0 && !hasRequests ? (
        <Text style={styles.empty}>You're all caught up.</Text>
      ) : notifications.length === 0 ? null : (
        <ScrollView showsVerticalScrollIndicator={false}>
          {notifications.map((n, i) => (
            <Pressable
              key={n.id}
              onPress={() => handlePress(n)}
              accessibilityRole="button"
              accessibilityLabel={`${n.title}. ${n.body}. ${onNavigate ? 'Tap to open.' : 'Tap to dismiss.'}`}
              style={[styles.row, i !== notifications.length - 1 && styles.rowDivider]}
            >
              <View style={styles.unreadDot} />
              <View style={styles.rowText}>
                <Text style={styles.rowTitle}>{n.title}</Text>
                <Text style={styles.rowBody}>{n.body}</Text>
                <Text style={styles.rowTime}>{timeAgo(n.createdAt)}</Text>
              </View>
            </Pressable>
          ))}
        </ScrollView>
      )}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  requestsSection: {
    marginBottom: spacing.md,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  eyebrow: {
    marginBottom: spacing.sm,
    fontFamily: fontFamily.sans600,
    fontSize: 10.5,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: colors.textFaint,
  },
  requestRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  requestText: {
    flex: 1,
    gap: 1,
    minWidth: 0,
  },
  requestName: {
    fontFamily: fontFamily.sans600,
    fontSize: 13.5,
    color: colors.textPrimary,
  },
  requestMeta: {
    fontFamily: fontFamily.sans400,
    fontSize: 11.5,
    color: colors.textSecondary,
  },
  acceptButton: {
    borderRadius: radius.pill,
    backgroundColor: colors.lime,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  acceptLabel: {
    fontFamily: fontFamily.sans600,
    fontSize: 12.5,
    color: colors.ink,
  },
  declineButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.ink07,
    alignItems: 'center',
    justifyContent: 'center',
  },
  declineLabel: {
    fontFamily: fontFamily.sans600,
    fontSize: 12.5,
    color: colors.ink70,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  title: {
    fontFamily: fontFamily.sans700,
    fontSize: 18,
    color: colors.textPrimary,
  },
  clearAll: {
    fontFamily: fontFamily.sans600,
    fontSize: 12.5,
    color: colors.textSecondary,
  },
  empty: {
    fontFamily: fontFamily.sans400,
    fontSize: 13,
    color: colors.textFaint,
    paddingVertical: spacing.xl,
    textAlign: 'center',
  },
  row: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingVertical: spacing.ms,
  },
  rowDivider: {
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  unreadDot: {
    width: 7,
    height: 7,
    borderRadius: 999,
    backgroundColor: colors.danger,
    marginTop: 6,
  },
  rowText: {
    flex: 1,
    gap: 2,
  },
  rowTitle: {
    fontFamily: fontFamily.sans600,
    fontSize: 13.5,
    color: colors.textPrimary,
  },
  rowBody: {
    fontFamily: fontFamily.sans400,
    fontSize: 12.5,
    color: colors.textSecondary,
  },
  rowTime: {
    fontFamily: fontFamily.mono500,
    fontSize: 10,
    color: colors.textFaint,
    marginTop: 2,
  },
});
