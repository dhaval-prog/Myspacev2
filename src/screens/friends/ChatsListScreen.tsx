import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fontFamily, radius, spacing } from '../../theme';
import { Icon } from '../../components/Icon';
import { FriendAvatar } from '../../components/friends/FriendAvatar';
import { AddFriendFab } from '../../components/friends/AddFriendFab';
import { useFriends } from '../../context/FriendsContext';
import { timeAgo } from '../../utils/relativeTime';

const PLUS_ICON = 'M12 6v12M6 12h12';
const LOCK_ICON = 'M6 11V8a6 6 0 0 1 12 0v3M5 11h14v9H5z';
const BACK_ICON = 'M15 5l-7 7 7 7';

/** Chats (6p-6) — only accepted friends get a thread here. */
export function ChatsListScreen() {
  const insets = useSafeAreaInsets();
  const { friends, sentRequests, goHome, goAdd, openChat, lastMessageFor, isUnread, isOnline } = useFriends();

  return (
    <View style={styles.screen}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[styles.scroll, { paddingTop: insets.top + spacing.md }]}>
        <View style={styles.topRow}>
          <Pressable onPress={goHome} style={styles.iconButton} accessibilityRole="button" accessibilityLabel="Back to Friends">
            <Icon path={BACK_ICON} color={colors.textPrimary} size={18} strokeWidth={2} />
          </Pressable>
          <Text style={styles.title}>Chats</Text>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rail}>
          <Pressable onPress={goAdd} style={styles.railItem} accessibilityRole="button" accessibilityLabel="Add a new friend">
            <View style={styles.railNewTile}>
              <Icon path={PLUS_ICON} color={colors.textFaint} size={20} strokeWidth={2} />
            </View>
            <Text style={styles.railLabel}>New</Text>
          </Pressable>
          {friends.map((f) => (
            <Pressable key={f.connectionId} onPress={() => openChat(f.connectionId)} style={styles.railItem}>
              <FriendAvatar userId={f.userId} name={f.name} size={58} online={isOnline(f.userId)} avatarUrl={f.avatarUrl} />
              <Text style={styles.railLabel} numberOfLines={1}>
                {f.name.split(' ')[0]}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        {friends.length === 0 && sentRequests.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>No chats yet</Text>
            <Text style={styles.emptyBody}>Add a friend to start a conversation.</Text>
          </View>
        ) : (
          <View style={styles.list}>
            {friends.map((f) => {
              const last = lastMessageFor(f.connectionId);
              const unread = isUnread(f.connectionId);
              return (
                <Pressable
                  key={f.connectionId}
                  onPress={() => openChat(f.connectionId)}
                  style={({ pressed }) => [styles.row, unread ? styles.rowUnread : styles.rowRead, pressed && styles.rowPressed]}
                >
                  <FriendAvatar userId={f.userId} name={f.name} size={48} online={isOnline(f.userId)} avatarUrl={f.avatarUrl} />
                  <View style={styles.rowText}>
                    <Text style={styles.rowName}>{f.name}</Text>
                    <Text style={[styles.rowPreview, unread && styles.rowPreviewUnread]} numberOfLines={1}>
                      {last ? last.text : 'Say hi 👋'}
                    </Text>
                  </View>
                  <View style={styles.rowTrailing}>
                    {last && <Text style={styles.rowTime}>{timeAgo(last.createdAt)}</Text>}
                    {unread && (
                      <View style={styles.unreadPill}>
                        <Text style={styles.unreadPillText}>•</Text>
                      </View>
                    )}
                  </View>
                </Pressable>
              );
            })}

            {sentRequests.map((r) => (
              <Pressable key={r.connectionId} onPress={() => openChat(r.connectionId)} style={styles.lockedRow}>
                <View style={styles.lockedIcon}>
                  <Icon path={LOCK_ICON} color={colors.textMuted} size={16} strokeWidth={1.8} />
                </View>
                <Text style={styles.lockedText}>
                  <Text style={styles.lockedName}>{r.name}</Text> — chat opens when they accept your request.
                </Text>
              </Pressable>
            ))}
          </View>
        )}
      </ScrollView>

      <AddFriendFab onPress={goAdd} bottomInset={insets.bottom} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.pale,
  },
  scroll: {
    paddingHorizontal: 26,
    paddingBottom: 110,
    gap: spacing.lg,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.ms,
  },
  title: {
    fontFamily: fontFamily.sans700,
    fontSize: 30,
    letterSpacing: -0.6,
    color: colors.textPrimary,
  },
  iconButton: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.ink,
    shadowOpacity: 0.06,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 14,
    elevation: 1,
  },
  rail: {
    gap: 14,
    paddingRight: 26,
  },
  railItem: {
    alignItems: 'center',
    gap: 6,
    width: 58,
  },
  railNewTile: {
    width: 58,
    height: 58,
    borderRadius: 29,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: 'rgba(22,33,12,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  railLabel: {
    fontFamily: fontFamily.sans500,
    fontSize: 11.5,
    color: colors.textSecondary,
  },
  empty: {
    borderRadius: radius.md,
    backgroundColor: 'rgba(255,255,255,.7)',
    padding: spacing.xxl,
    alignItems: 'center',
    gap: 6,
  },
  emptyTitle: {
    fontFamily: fontFamily.sans600,
    fontSize: 15,
    color: colors.textPrimary,
  },
  emptyBody: {
    fontFamily: fontFamily.sans400,
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  list: {
    gap: 6,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.ms,
    borderRadius: radius.md,
    paddingVertical: 14,
    paddingHorizontal: 18,
  },
  rowRead: {
    backgroundColor: 'rgba(255,255,255,.6)',
  },
  rowUnread: {
    backgroundColor: 'rgba(255,255,255,.9)',
  },
  rowPressed: {
    opacity: 0.85,
  },
  rowText: {
    flex: 1,
    gap: 2,
  },
  rowName: {
    fontFamily: fontFamily.sans600,
    fontSize: 15.5,
    color: colors.textPrimary,
  },
  rowPreview: {
    fontFamily: fontFamily.sans400,
    fontSize: 13,
    color: 'rgba(22,33,12,0.55)',
  },
  rowPreviewUnread: {
    fontFamily: fontFamily.sans500,
    color: colors.textPrimary,
  },
  rowTrailing: {
    alignItems: 'flex-end',
    gap: 6,
  },
  rowTime: {
    fontFamily: fontFamily.mono500,
    fontSize: 11.5,
    color: 'rgba(22,33,12,0.45)',
  },
  unreadPill: {
    minWidth: 21,
    height: 21,
    borderRadius: 10.5,
    backgroundColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unreadPillText: {
    fontFamily: fontFamily.mono500,
    fontSize: 12,
    color: colors.lime,
  },
  lockedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.ms,
    borderRadius: radius.md,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: 'rgba(22,33,12,0.22)',
    paddingVertical: 14,
    paddingHorizontal: 18,
  },
  lockedIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(22,33,12,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  lockedText: {
    flex: 1,
    fontFamily: fontFamily.sans400,
    fontSize: 13,
    lineHeight: 18,
    color: colors.textSecondary,
  },
  lockedName: {
    fontFamily: fontFamily.sans600,
    color: colors.textPrimary,
  },
});
