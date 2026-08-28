import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, fontFamily, radius, spacing } from '../theme';
import { BottomSheet } from './expenses/BottomSheet';
import { useNotifications } from '../context/NotificationsContext';

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
}

/** Slide-up inbox of real notifications — tap to mark read, long-press to remove. */
export function NotificationsSheet({ visible, onClose }: NotificationsSheetProps) {
  const { notifications, unreadCount, markRead, markAllRead, remove } = useNotifications();

  return (
    <BottomSheet visible={visible} onClose={onClose} maxHeightRatio={0.78}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>Notifications</Text>
        {unreadCount > 0 ? (
          <Pressable onPress={markAllRead} accessibilityRole="button" accessibilityLabel="Mark all as read">
            <Text style={styles.markAll}>Mark all read</Text>
          </Pressable>
        ) : null}
      </View>

      {notifications.length === 0 ? (
        <Text style={styles.empty}>You're all caught up.</Text>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false}>
          {notifications.map((n, i) => (
            <Pressable
              key={n.id}
              onPress={() => markRead(n.id)}
              onLongPress={() => remove(n.id)}
              accessibilityRole="button"
              accessibilityLabel={`${n.title}. ${n.body}`}
              style={[styles.row, i !== notifications.length - 1 && styles.rowDivider]}
            >
              {!n.read ? <View style={styles.unreadDot} /> : <View style={styles.unreadDotSpacer} />}
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
  markAll: {
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
    borderRadius: radius.pill,
    backgroundColor: colors.danger,
    marginTop: 6,
  },
  unreadDotSpacer: {
    width: 7,
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
