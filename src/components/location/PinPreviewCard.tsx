import React from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { colors, fontFamily, radius, spacing } from '../../theme';
import { Icon } from '../Icon';
import { FriendAvatar } from '../friends/FriendAvatar';

const CHEVRON_ICON = 'M9 6l6 6-6 6';
const CLOSE_ICON = 'M6 6l12 12M18 6L6 18';

interface PinPreviewCardProps {
  userId: string;
  name: string;
  statusText: string;
  distanceText?: string | null;
  live: boolean;
  onOpen: () => void;
  onClose: () => void;
  style?: StyleProp<ViewStyle>;
}

/**
 * A small floating card shown when a map pin is tapped — enough to place who
 * it is before committing to the full detail sheet, closer to how Maps-style
 * apps peek a location before opening it. Tapping the card (or its chevron)
 * opens the full sheet; the close button or tapping the same pin again
 * dismisses it (see LiveLocationsScreen's previewFriendId toggle).
 */
export function PinPreviewCard({ userId, name, statusText, distanceText, live, onOpen, onClose, style }: PinPreviewCardProps) {
  return (
    <View style={[styles.wrap, style]}>
      <Pressable onPress={onOpen} style={styles.body} accessibilityRole="button" accessibilityLabel={`Open ${name}`}>
        <FriendAvatar userId={userId} name={name} size={46} online={live} />
        <View style={styles.textCol}>
          <Text style={styles.name} numberOfLines={1}>
            {name}
          </Text>
          <Text style={styles.status} numberOfLines={1}>
            {statusText}
            {distanceText ? ` · ${distanceText}` : ''}
          </Text>
        </View>
        <Icon path={CHEVRON_ICON} color={colors.textFaint} size={16} strokeWidth={2} />
      </Pressable>
      <Pressable onPress={onClose} style={styles.closeButton} accessibilityRole="button" accessibilityLabel="Dismiss">
        <Icon path={CLOSE_ICON} color={colors.textPrimary} size={11} strokeWidth={2.4} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: '#fff',
    borderRadius: radius.md,
    shadowColor: colors.ink,
    shadowOpacity: 0.16,
    shadowOffset: { width: 0, height: 10 },
    shadowRadius: 24,
    elevation: 6,
  },
  body: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.ms,
    paddingVertical: 12,
    paddingHorizontal: spacing.lg,
    paddingRight: 30,
  },
  textCol: {
    flex: 1,
    minWidth: 0,
  },
  name: {
    fontFamily: fontFamily.sans600,
    fontSize: 14.5,
    color: colors.textPrimary,
  },
  status: {
    fontFamily: fontFamily.sans400,
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 1,
  },
  closeButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(22,33,12,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
