import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fontFamily, radius, spacing } from '../../theme';
import { Icon } from '../../components/Icon';
import { LockIcon } from '../../components/icons/LockIcon';
import { FriendAvatar } from '../../components/friends/FriendAvatar';
import { BottomNav } from '../../components/BottomNav';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import { useFriends } from '../../context/FriendsContext';
import { timeAgo } from '../../utils/relativeTime';

const CHAT_PLUS_ICON = 'M20 11.5a7.5 7.5 0 0 1-10.7 6.8L4 19.5l1.3-4.9A7.5 7.5 0 1 1 20 11.5z M12 8.5v6M9 11.5h6';
const BACK_ICON = 'M15 5l-7 7 7 7';

const STORY_DOT_OVERRIDE = { size: 14, ringWidth: 2.5, ringColor: colors.onlineDotRing };

interface ChatsListScreenProps {
  onHome: () => void;
  onOpenExpenses: () => void;
  onOpenSplit: () => void;
}

/** Chats (6p-6) — only accepted friends get a thread here. */
export function ChatsListScreen({ onHome, onOpenExpenses, onOpenSplit }: ChatsListScreenProps) {
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const { friends, sentRequests, goHome, goAdd, openChat, lastMessageFor, isUnread, unreadCountFor, isOnline, isTyping } = useFriends();

  return (
    <LinearGradient
      colors={colors.friendsCanvas as [string, string, ...string[]]}
      locations={colors.friendsCanvasStops as [number, number, ...number[]]}
      start={{ x: 0.5, y: 0 }}
      end={{ x: 0.5, y: 1 }}
      style={styles.screen}
    >
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[styles.scroll, { paddingTop: insets.top + spacing.md }]}>
        <View style={styles.topRow}>
          <Text style={styles.title}>Chats</Text>
        </View>

        <View style={styles.spacerUnderHeader} />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rail}>
          <Pressable onPress={goAdd} style={styles.railItem} accessibilityRole="button" accessibilityLabel="Add a new friend">
            <View style={styles.railNewTile}>
              <Text style={styles.railNewPlus}>+</Text>
            </View>
            <Text style={styles.railLabelNew}>New</Text>
          </Pressable>
          {friends.map((f) => (
            <Pressable key={f.connectionId} onPress={() => openChat(f.connectionId)} style={styles.railItem}>
              <FriendAvatar userId={f.userId} name={f.name} size={58} initialsFontSize={18} online={isOnline(f.userId)} onlineDotOverride={STORY_DOT_OVERRIDE} avatarUrl={f.avatarUrl} />
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
          <>
            {friends.length > 0 && (
              <View style={styles.list}>
                {friends.map((f) => {
                  const last = lastMessageFor(f.connectionId);
                  const unread = isUnread(f.connectionId);
                  const unreadCount = unreadCountFor(f.connectionId);
                  const typing = isTyping(f.connectionId);
                  return (
                    <Pressable
                      key={f.connectionId}
                      onPress={() => openChat(f.connectionId)}
                      style={({ pressed }) => [styles.row, unread ? styles.rowUnread : styles.rowRead, pressed && styles.rowPressed]}
                    >
                      <FriendAvatar userId={f.userId} name={f.name} size={48} initialsFontSize={16} online={isOnline(f.userId)} avatarUrl={f.avatarUrl} />
                      <View style={styles.rowText}>
                        <View style={styles.rowNameLine}>
                          <Text style={styles.rowName}>{f.name}</Text>
                          {last && <Text style={styles.rowTime}>{timeAgo(last.createdAt)}</Text>}
                        </View>
                        <View style={styles.rowPreviewLine}>
                          <Text style={[styles.rowPreview, unread && styles.rowPreviewUnread]} numberOfLines={1}>
                            {typing ? 'Typing…' : last ? last.text : 'Say hi 👋'}
                          </Text>
                          {unreadCount > 0 && (
                            <View style={styles.unreadPill}>
                              <Text style={styles.unreadPillText}>{unreadCount}</Text>
                            </View>
                          )}
                        </View>
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            )}

            {sentRequests.length > 0 && (
              <View style={styles.lockedList}>
                {sentRequests.map((r) => (
                  <Pressable key={r.connectionId} onPress={() => openChat(r.connectionId)} style={styles.lockedRow}>
                    <View style={styles.lockedIcon}>
                      <LockIcon size={18} color={colors.ink50} strokeWidth={1.7} />
                    </View>
                    <Text style={styles.lockedText}>
                      <Text style={styles.lockedName}>{r.name}</Text> — chat opens when they accept your request.
                    </Text>
                  </Pressable>
                ))}
              </View>
            )}
          </>
        )}
      </ScrollView>

      <View style={styles.pinned}>
        <Pressable onPress={goHome} style={styles.iconButton} accessibilityRole="button" accessibilityLabel="Back to Friends">
          <Icon path={BACK_ICON} color={colors.textPrimary} size={18} strokeWidth={2} />
        </Pressable>
      </View>

      <BottomNav
        activeId="friends"
        onSelect={(id) => {
          if (id === 'home') onHome();
          if (id === 'expenses') onOpenExpenses();
          if (id === 'split') onOpenSplit();
        }}
        onAdd={goAdd}
        fabIconPath={CHAT_PLUS_ICON}
        fabAccessibilityLabel="Add a friend"
        bottomInset={insets.bottom}
        reduceMotion={reduceMotion}
      />
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  scroll: {
    paddingHorizontal: 26,
    paddingBottom: spacing.huge,
  },
  pinned: {
    paddingHorizontal: 26,
    paddingTop: spacing.ms,
    paddingBottom: spacing.ms,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.ms,
  },
  title: {
    fontFamily: fontFamily.sans700,
    fontSize: 30,
    letterSpacing: -0.9,
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
  spacerUnderHeader: {
    height: 20,
  },
  rail: {
    gap: 14,
    paddingRight: 26,
  },
  railItem: {
    alignItems: 'center',
    gap: 7,
    width: 58,
  },
  railNewTile: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: colors.surface70,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: 'rgba(22,33,12,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  railNewPlus: {
    fontSize: 22,
    color: colors.ink50,
  },
  railLabel: {
    fontFamily: fontFamily.sans400,
    fontSize: 11.5,
    color: colors.ink70,
  },
  railLabelNew: {
    fontFamily: fontFamily.sans400,
    fontSize: 11.5,
    color: colors.ink55,
  },
  empty: {
    marginTop: 24,
    borderRadius: radius.md,
    backgroundColor: colors.surface70,
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
    marginTop: 24,
    gap: 6,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderRadius: 24,
    paddingVertical: 14,
    paddingHorizontal: 18,
  },
  rowRead: {
    backgroundColor: colors.surface60,
  },
  rowUnread: {
    backgroundColor: colors.surface90,
  },
  rowPressed: {
    opacity: 0.85,
  },
  rowText: {
    flex: 1,
    gap: 3,
    minWidth: 0,
  },
  rowNameLine: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: 8,
  },
  rowName: {
    fontFamily: fontFamily.sans600,
    fontSize: 15.5,
    color: colors.textPrimary,
  },
  rowPreviewLine: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  rowPreview: {
    flex: 1,
    fontFamily: fontFamily.sans400,
    fontSize: 13,
    color: colors.ink55,
  },
  rowPreviewUnread: {
    fontFamily: fontFamily.sans500,
    color: colors.textPrimary,
  },
  rowTime: {
    fontFamily: fontFamily.mono500,
    fontSize: 11.5,
    color: colors.textFaint,
  },
  unreadPill: {
    minWidth: 21,
    height: 21,
    paddingHorizontal: 5,
    borderRadius: 10.5,
    backgroundColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unreadPillText: {
    fontFamily: fontFamily.sans600,
    fontSize: 11.5,
    color: colors.lime,
  },
  lockedList: {
    marginTop: 20,
  },
  lockedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 24,
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
    backgroundColor: colors.ink06,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lockedText: {
    flex: 1,
    fontFamily: fontFamily.sans400,
    fontSize: 13,
    lineHeight: 18,
    color: colors.ink55,
  },
  lockedName: {
    fontFamily: fontFamily.sans600,
    color: colors.ink75,
  },
});
