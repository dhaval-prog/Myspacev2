import React from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { colors, radius, spacing } from '../theme';
import { AccountBadge } from './AccountBadge';
import { NotificationsBell } from './NotificationsBell';
import { SearchBar } from './SearchBar';

interface HeaderProps {
  onSearchPress: () => void;
  onAvatarPress?: () => void;
  onBellPress?: () => void;
}

/** Quiet top area: logo mark, integrated search, notifications, profile action. */
export function Header({ onSearchPress, onAvatarPress, onBellPress }: HeaderProps) {
  return (
    <View style={styles.row}>
      <Image source={require('../../assets/logos/logo-lime.png')} style={styles.logo} />
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
  logo: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
  },
});
