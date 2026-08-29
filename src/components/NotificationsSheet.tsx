import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, fontFamily, spacing } from '../theme';
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

/** Slide-up inbox of real notifications — each one appears only once: tapping it reads and removes it. */
export function NotificationsSheet({ visible, onClose }: NotificationsSheetProps) {
  const { notifications, unreadCount, acknowledge, clearAll } = useNotifications();

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

      {notifications.length === 0 ? (
        <Text style={styles.empty}>You're all caught up.</Text>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false}>
          {notifications.map((n, i) => (
            <Pressable
              key={n.id}
              onPress={() => acknowledge(n.id)}
              accessibilityRole="button"
              accessibilityLabel={`${n.title}. ${n.body}. Tap to dismiss.`}
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
