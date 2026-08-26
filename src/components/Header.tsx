import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing, typography } from '../theme';
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
      <Pressable
        onPress={onAvatarPress}
        accessibilityRole="button"
        accessibilityLabel="Profile"
        style={({ pressed }) => [styles.avatar, pressed && styles.avatarPressed]}
        hitSlop={4}
      >
        <Text style={styles.avatarIcon}>◎</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.ms,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: radius.sm,
    backgroundColor: '#111',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  avatarPressed: {
    opacity: 0.85,
  },
  avatarIcon: {
    fontSize: 15,
    color: colors.lime,
  },
});
