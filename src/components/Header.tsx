import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, spacing, typography } from '../theme';
import { AccountBadge } from './AccountBadge';
import { NotificationsBell } from './NotificationsBell';
import { SearchBar } from './SearchBar';

interface HeaderProps {
  onSearchPress: () => void;
  onAvatarPress?: () => void;
  onBellPress?: () => void;
}

/** Quiet top area: wordmark, integrated search, notifications, profile action. */
export function Header({ onSearchPress, onAvatarPress, onBellPress }: HeaderProps) {
  return (
    <View style={styles.row}>
      <Text style={typography.logo}>myspace</Text>
      <SearchBar onPress={onSearchPress} />
      {onBellPress ? <NotificationsBell onPress={onBellPress} bg="#111" tint={colors.lime} /> : null}
      <AccountBadge onPress={onAvatarPress} bg="#111" tint={colors.lime} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.ms,
  },
});
