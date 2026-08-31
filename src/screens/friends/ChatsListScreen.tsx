import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fontFamily, spacing } from '../../theme';
import { Icon } from '../../components/Icon';
import { MemberAvatar } from '../../components/split/MemberAvatar';
import { useFriends } from '../../context/FriendsContext';

const BACK_ICON = 'M15 5l-7 7 7 7';
const LOCK_ICON = 'M6 11V8a6 6 0 0 1 12 0v3M5 11h14v9H5z';

/** Every chat: open threads with accepted friends, plus locked rows for people you've asked but who haven't accepted yet. */
export function ChatsListScreen() {
  const insets = useSafeAreaInsets();
  const { friends, sentRequests, goHome, openChat } = useFriends();

  return (
    <View style={styles.screen}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[styles.scroll, { paddingTop: insets.top + spacing.md }]}>
        <View style={styles.topRow}>
          <Pressable onPress={goHome} style={styles.iconButton} accessibilityRole="button" accessibilityLabel="Back">
            <Icon path={BACK_ICON} color={colors.friendsInk} size={19} strokeWidth={2} />
          </Pressable>
          <Text style={styles.title}>Chats</Text>
          <View style={styles.iconButton} />
        </View>

        {friends.length === 0 && sentRequests.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>No chats yet</Text>
            <Text style={styles.emptyBody}>Add a friend to start a conversation.</Text>
          </View>
        ) : (
          <View style={styles.list}>
            {friends.map((f) => (
              <Pressable key={f.connectionId} onPress={() => openChat(f.connectionId)} style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}>
                <MemberAvatar userId={f.userId} name={f.name} size={48} />
                <View style={styles.rowText}>
                  <Text style={styles.rowName}>{f.name}</Text>
                  <Text style={styles.rowMeta}>Tap to message</Text>
                </View>
              </Pressable>
            ))}
            {sentRequests.map((r) => (
              <View key={r.connectionId} style={[styles.row, styles.rowLocked]}>
                <MemberAvatar userId={r.userId} name={r.name} size={48} style={styles.lockedAvatar} />
                <View style={styles.rowText}>
                  <Text style={[styles.rowName, styles.rowNameLocked]}>{r.name}</Text>
                  <Text style={styles.rowMeta}>Waiting for them to accept</Text>
                </View>
                <Icon path={LOCK_ICON} color={colors.friendsLockedFg} size={16} strokeWidth={1.8} />
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.friendsBg,
  },
  scroll: {
    paddingHorizontal: spacing.xxxl,
    paddingBottom: spacing.huge,
    gap: spacing.xl,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 16,
    backgroundColor: colors.friendsSurface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontFamily: fontFamily.sans700,
    fontSize: 19,
    color: colors.friendsInk,
  },
  empty: {
    borderRadius: 24,
    backgroundColor: colors.friendsSurface,
    padding: spacing.xxl,
    alignItems: 'center',
    gap: 6,
  },
  emptyTitle: {
    fontFamily: fontFamily.sans600,
    fontSize: 15,
    color: colors.friendsInk,
  },
  emptyBody: {
    fontFamily: fontFamily.sans400,
    fontSize: 13,
    color: colors.friendsInkFaint45,
    textAlign: 'center',
  },
  list: {
    gap: spacing.xs,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.ms,
    backgroundColor: colors.friendsSurface,
    borderRadius: 20,
    padding: spacing.ms,
  },
  rowPressed: {
    opacity: 0.85,
  },
  rowLocked: {
    backgroundColor: colors.friendsLockedBg,
  },
  lockedAvatar: {
    opacity: 0.55,
  },
  rowText: {
    flex: 1,
  },
  rowName: {
    fontFamily: fontFamily.sans600,
    fontSize: 15,
    color: colors.friendsInk,
  },
  rowNameLocked: {
    color: colors.friendsLockedFg,
  },
  rowMeta: {
    fontFamily: fontFamily.sans400,
    fontSize: 12,
    color: colors.friendsInkFaint45,
  },
});
