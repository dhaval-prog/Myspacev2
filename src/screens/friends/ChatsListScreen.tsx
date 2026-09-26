import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fontFamily, radius, spacing } from '../../theme';
import { Icon } from '../../components/Icon';
import { LockIcon } from '../../components/icons/LockIcon';
import { FriendAvatar } from '../../components/friends/FriendAvatar';
import { BottomNav } from '../../components/BottomNav';
import { GlassSurface } from '../../components/friends/GlassSurface';
import { FriendsGlow } from '../../components/friends/FriendsGlow';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import { useFriends } from '../../context/FriendsContext';
import { timeAgo } from '../../utils/relativeTime';

const CHAT_PLUS_ICON = 'M20 11.5a7.5 7.5 0 0 1-10.7 6.8L4 19.5l1.3-4.9A7.5 7.5 0 1 1 20 11.5z M12 8.5v6M9 11.5h6';
const GROUP_ICON = 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75';
// Same paper-plane glyph as HomeScreen's own Throw entry tile — reused here so this reads as the
// same destination, not a Chats-specific reinterpretation.
const THROW_ICON = 'M22 2L11 13 M22 2L15 22L11 13L2 9L22 2Z';
const ADD_FRIEND_ICON = 'M3.5 3.5h6.5v6.5h-6.5z M14 3.5h6.5v6.5h-6.5z M3.5 14h6.5v6.5h-6.5z M14 14h3v3h-3zM20.5 17.5v3h-3';
const THROW_INBOX_ICON = 'M3 11h5l1.8 2.8h4.4L16 11h5 M3 11V5h18v6 M3 11v7a1 1 0 0 0 1 1h16a1 1 0 0 0 1-1v-7';
// Same dice glyph as HomeScreen's own Games entry tile — reused here so this reads as the same
// destination, not a Chats-specific reinterpretation.
const GAMES_ICON = 'M4 4h16v16H4z M8 8h.01 M16 8h.01 M8 16h.01 M16 16h.01 M12 12h.01';

const STORY_DOT_OVERRIDE = { size: 14, ringWidth: 2.5, ringColor: colors.onlineDotRing };

interface ChatsListScreenProps {
  onHome: () => void;
  onOpenExpenses: () => void;
  /** Opens Throw — both the bottom nav dock's Throw tab and the pinned row below the list
   * (which replaces the old "back to Friends" button there). */
  onOpenThrow: () => void;
  /** Opens Throw straight to its inbox — also in the pinned row. */
  onOpenThrowInbox: () => void;
  /** Opens the Games hub — also in the pinned row. */
  onOpenGames: () => void;
}

/** Chats (6p-6) — only accepted friends get a thread here. */
export function ChatsListScreen({ onHome, onOpenExpenses, onOpenThrow, onOpenThrowInbox, onOpenGames }: ChatsListScreenProps) {
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const { friends, sentRequests, goAdd, openChat, lastMessageFor, isUnread, unreadCountFor, isOnline, isTyping, groups, goCreateGroup, openGroupChat, lastGroupMessageFor } =
    useFriends();

  return (
    <LinearGradient
      colors={colors.friendsCanvas as [string, string, ...string[]]}
      locations={colors.friendsCanvasStops as [number, number, ...number[]]}
      start={{ x: 0.5, y: 0 }}
      end={{ x: 0.5, y: 1 }}
      style={styles.screen}
    >
      <FriendsGlow />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[styles.scroll, { paddingTop: insets.top + spacing.md }]}>
        <View style={styles.topRow}>
          <Text style={styles.title}>Chats</Text>
        </View>

        <View style={styles.spacerUnderHeader} />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rail}>
          <Pressable onPress={goCreateGroup} style={styles.railItem} accessibilityRole="button" accessibilityLabel="Start a group">
            <GlassSurface tint="light" tintColor="rgba(255,255,255,0.35)" style={styles.railNewTile}>
              <Icon path={GROUP_ICON} color={colors.ink50} size={22} strokeWidth={1.8} />
            </GlassSurface>
            <Text style={styles.railLabelNew}>Groups</Text>
          </Pressable>
          {friends.map((f) => (
            <Pressable key={f.connectionId} onPress={() => openChat(f.connectionId)} style={styles.railItem}>
              <FriendAvatar userId={f.userId} name={f.name} size={58} initialsFontSize={18} online={isOnline(f.userId)} onlineDotOverride={STORY_DOT_OVERRIDE} avatarUrl={f.avatarUrl} />
              <Text style={styles.railLabel} numberOfLines={1}>
                {f.name.split(' ')[0]}
              </Text>
            </Pressable>
          ))}
          {groups.map((g) => (
            <Pressable key={g.id} onPress={() => openGroupChat(g.id)} style={styles.railItem}>
              <View style={styles.railGroupAvatar}>
                <Icon path={GROUP_ICON} color={colors.lime} size={22} strokeWidth={1.8} />
              </View>
              <Text style={styles.railLabel} numberOfLines={1}>
                {g.name}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        {friends.length === 0 && sentRequests.length === 0 && groups.length === 0 ? (
          <GlassSurface tint="light" tintColor="rgba(255,255,255,0.45)" style={styles.empty}>
            <Text style={styles.emptyTitle}>No chats yet</Text>
            <Text style={styles.emptyBody}>Add a friend to start a conversation.</Text>
          </GlassSurface>
        ) : (
          <>
            {groups.length > 0 && (
              <View style={styles.list}>
                {groups.map((g) => {
                  const last = lastGroupMessageFor(g.id);
                  return (
                    <Pressable key={g.id} onPress={() => openGroupChat(g.id)} style={({ pressed }) => [pressed && styles.rowPressed]}>
                      <GlassSurface tint="light" tintColor="rgba(255,255,255,0.4)" style={styles.row}>
                        <View style={styles.groupAvatar}>
                          <Icon path={GROUP_ICON} color={colors.lime} size={20} strokeWidth={1.8} />
                        </View>
                        <View style={styles.rowText}>
                          <View style={styles.rowNameLine}>
                            <Text style={styles.rowName}>{g.name}</Text>
                            {last && <Text style={styles.rowTime}>{timeAgo(last.createdAt)}</Text>}
                          </View>
                          <View style={styles.rowPreviewLine}>
                            <Text style={styles.rowPreview} numberOfLines={1}>
                              {last ? last.text : 'Say hi to the group 👋'}
                            </Text>
                          </View>
                        </View>
                      </GlassSurface>
                    </Pressable>
                  );
                })}
              </View>
            )}

            {friends.length > 0 && (
              <View style={styles.list}>
                {friends.map((f) => {
                  const last = lastMessageFor(f.connectionId);
                  const unread = isUnread(f.connectionId);
                  const unreadCount = unreadCountFor(f.connectionId);
                  const typing = isTyping(f.connectionId);
                  return (
                    <Pressable key={f.connectionId} onPress={() => openChat(f.connectionId)} style={({ pressed }) => [pressed && styles.rowPressed]}>
                      <GlassSurface tint="light" tintColor={unread ? 'rgba(255,255,255,0.55)' : 'rgba(255,255,255,0.35)'} style={styles.row}>
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
                      </GlassSurface>
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
        <Pressable onPress={onOpenThrow} style={styles.iconButton} accessibilityRole="button" accessibilityLabel="Throw">
          <Icon path={THROW_ICON} color={colors.textPrimary} size={20} strokeWidth={1.8} />
        </Pressable>
        <Pressable onPress={goAdd} style={styles.iconButton} accessibilityRole="button" accessibilityLabel="Add a friend">
          <Icon path={ADD_FRIEND_ICON} color={colors.textPrimary} size={18} strokeWidth={1.8} />
        </Pressable>
        <Pressable onPress={onOpenThrowInbox} style={styles.iconButton} accessibilityRole="button" accessibilityLabel="Throw inbox">
          <Icon path={THROW_INBOX_ICON} color={colors.textPrimary} size={18} strokeWidth={1.8} />
        </Pressable>
        <Pressable onPress={onOpenGames} style={styles.iconButton} accessibilityRole="button" accessibilityLabel="Games">
          <Icon path={GAMES_ICON} color={colors.textPrimary} size={18} strokeWidth={1.8} />
        </Pressable>
      </View>

      <BottomNav
        activeId="friends"
        onSelect={(id) => {
          if (id === 'home') onHome();
          if (id === 'expenses') onOpenExpenses();
          if (id === 'throw') onOpenThrow();
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
  // Three even columns spanning the row's full width, rather than a tight left-aligned cluster.
  pinned: {
    flexDirection: 'row',
    justifyContent: 'space-between',
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
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: 'rgba(22,33,12,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  groupAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  railGroupAvatar: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
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
    padding: spacing.xxl,
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.55)',
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
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.5)',
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
