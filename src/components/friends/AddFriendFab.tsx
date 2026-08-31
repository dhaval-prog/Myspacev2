import React from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { colors } from '../../theme';
import { Icon } from '../Icon';

const ADD_FRIEND_ICON = 'M15 19c0-3.3-2.7-6-6-6s-6 2.7-6 6M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM18 8v6M15 11h6';

interface AddFriendFabProps {
  onPress: () => void;
  bottomInset: number;
}

/** Floating "Add a friend" action, bottom-right — shared by the Friends and Chats screens. */
export function AddFriendFab({ onPress, bottomInset }: AddFriendFabProps) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.fab, { bottom: Math.max(bottomInset, 16) + 16 }]}
      accessibilityRole="button"
      accessibilityLabel="Add a friend"
    >
      <Icon path={ADD_FRIEND_ICON} color={colors.lime} size={22} strokeWidth={1.9} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    right: 26,
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.ink,
    shadowOpacity: 0.28,
    shadowOffset: { width: 0, height: 10 },
    shadowRadius: 22,
    elevation: 4,
  },
});
