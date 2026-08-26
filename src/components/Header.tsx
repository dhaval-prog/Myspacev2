import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, spacing, typography } from '../theme';
import { AccountBadge } from './AccountBadge';
import { SearchBar } from './SearchBar';

interface HeaderProps {
  onSearchPress: () => void;
  onAvatarPress?: () => void;
}

/** Quiet top area: wordmark, integrated search, profile action. */
export function Header({ onSearchPress, onAvatarPress }: HeaderProps) {
  return (
    <View style={styles.row}>
      <Text style={typography.logo}>myspace</Text>
      <SearchBar onPress={onSearchPress} />
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
