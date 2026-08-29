import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, fontFamily, radius } from '../theme';
import { Icon } from './Icon';
import { useNotifications } from '../context/NotificationsContext';

const BELL_ICON = 'M6 8.5a6 6 0 1 1 12 0c0 3.4 1 5.3 2 6.5H4c1-1.2 2-3.1 2-6.5zM9.5 18.5a2.5 2.5 0 0 0 5 0';

interface NotificationsBellProps {
  onPress: () => void;
  bg?: string;
  tint?: string;
}

/** Bell icon with an unread-count dot — the entry point into the notifications inbox. */
export function NotificationsBell({ onPress, bg, tint }: NotificationsBellProps) {
  const { unreadCount } = useNotifications();

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : 'Notifications'}
      hitSlop={4}
      style={({ pressed }) => [styles.badge, bg ? { backgroundColor: bg } : null, pressed && styles.pressed]}
    >
      <Icon path={BELL_ICON} color={tint ?? colors.textPrimary} size={17} strokeWidth={2} />
      {unreadCount > 0 ? (
        <View style={styles.dot}>
          <Text style={styles.dotText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  badge: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.pale,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  pressed: {
    opacity: 0.85,
  },
  dot: {
    position: 'absolute',
    top: -2,
    right: -2,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    paddingHorizontal: 3,
    backgroundColor: colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotText: {
    fontFamily: fontFamily.sans700,
    fontSize: 9,
    color: colors.white,
  },
});
