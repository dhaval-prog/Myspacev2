import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Icon } from '../Icon';
import { throwColor } from '../../theme/throwTokens';

const SIZE = 56;
const BADGE_SIZE = 20;
const BELL_ICON = 'M6 8a6 6 0 0 1 12 0c0 4 1.5 5.5 2 6.5H4c.5-1 2-2.5 2-6.5z M9.5 18.5a2.5 2.5 0 0 0 5 0';

interface NotificationCircleButtonProps {
  onPress: () => void;
  unreadCount: number;
}

/** Opens the full-screen notification history (see NotificationsScreen) — same dark-circle chrome
 * as AddStoryButton, per explicit request ("similar to the add status contact circle"). Rendered
 * as a slot inside RecipientCarousel's own animated strip, one position further left than the
 * add-story slot, so it slides/scales with the rest of the carousel like any other off-center
 * item — it just never becomes the "selected" one, since drag/selection never reaches its slot. */
export function NotificationCircleButton({ onPress, unreadCount }: NotificationCircleButtonProps) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : 'Notifications'} hitSlop={8}>
      {({ pressed }) => (
        <View style={[styles.circle, pressed && styles.pressed]}>
          <Icon path={BELL_ICON} size={24} color="rgba(255,255,255,.85)" strokeWidth={1.8} />
          {unreadCount > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
            </View>
          )}
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  circle: {
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    backgroundColor: throwColor.ink,
    alignItems: 'center',
    justifyContent: 'center',
    ...throwColor.shadowSoft,
  },
  pressed: { opacity: 0.85 },
  badge: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    minWidth: BADGE_SIZE,
    height: BADGE_SIZE,
    paddingHorizontal: 4,
    borderRadius: BADGE_SIZE / 2,
    backgroundColor: '#FF3B30',
    borderWidth: 2,
    borderColor: throwColor.paper,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { color: '#FFFFFF', fontSize: 10.5, fontWeight: '800' },
});
