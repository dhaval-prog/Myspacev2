import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fontFamily, radius, spacing } from '../../theme';
import { Icon } from '../../components/Icon';
import { LockIcon } from '../../components/icons/LockIcon';
import { FriendAvatar } from '../../components/friends/FriendAvatar';
import { GlassSurface } from '../../components/friends/GlassSurface';
import { FriendsGlow } from '../../components/friends/FriendsGlow';
import { ChatsBottomBar } from '../../components/friends/ChatsBottomBar';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import { useFriends } from '../../context/FriendsContext';
import { useAuth } from '../../context/AuthContext';
import { useThrowColorMode } from '../../context/ThrowColorModeContext';
import { timeAgo } from '../../utils/relativeTime';
import { avatarSkinFor, initialsOf } from '../../utils/friendAvatar';

const CHAT_PLUS_ICON = 'M20 11.5a7.5 7.5 0 0 1-10.7 6.8L4 19.5l1.3-4.9A7.5 7.5 0 1 1 20 11.5z M12 8.5v6M9 11.5h6';
const GROUP_ICON = 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75';
const PLANE_BODY = 'M4 30 L60 8 L38 58 L30 36 Z';
const ARC_PATH = 'M8 52 C14 34 28 52 34 34';

type Filter = 'all' | 'unread' | 'groups' | 'letters';

/** The MySpace Chats Throw handoff's logo mark — a dashed arc trailing a tiny two-tone paper
 * plane, next to the "Chats" title (day) or above it beside a MYSPACE wordmark (night). */
function ChatsLogoMark({ size, arcColor, bodyFill, wingFill }: { size: number; arcColor: string; bodyFill: string; wingFill: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 64 64">
      <Path d={ARC_PATH} fill="none" stroke={arcColor} strokeWidth={4.5} strokeLinecap="round" strokeDasharray="1 8" />
      <Path d={PLANE_BODY} transform="translate(28 6) scale(.48)" fill={bodyFill} stroke={bodyFill} strokeWidth={5} strokeLinejoin="round" />
      <Path d="M30 36 L60 8 L22 40 Z" transform="translate(28 6) scale(.48)" fill={wingFill} />
    </Svg>
  );
}

/** A group row's avatar — the first two other members' own colored initials circles, overlapping
 * diagonally (back circle top-left, front circle bottom-right), matching every other avatar's
 * lime/ice/coral hash-rotation. Falls back to the plain group-icon circle for an empty/solo group. */
function GroupAvatarPair({ members, size, borderColor }: { members: { id: string; name: string }[]; size: number; borderColor: string }) {
  if (members.length === 0) {
    return (
      <View style={[styles.groupAvatar, { width: size, height: size, borderRadius: size / 2 }]}>
        <Icon path={GROUP_ICON} color={colors.lime} size={20} strokeWidth={1.8} />
      </View>
    );
  }
  const circleSize = Math.round(size * 0.667);
  return (
    <View style={{ width: size, height: size }}>
      {members.slice(0, 2).map((m, i) => {
        const skin = avatarSkinFor(m.id);
        const pos = i === 0 ? { left: 0, top: 0 } : { right: 0, bottom: 0 };
        return (
          <View
            key={m.id}
            style={[styles.groupAvatarCircle, pos, { width: circleSize, height: circleSize, borderRadius: circleSize / 2, backgroundColor: skin.bg, borderColor }]}
          >
            <Text style={[styles.groupAvatarCircleText, { color: skin.fg }]}>{initialsOf(m.name)}</Text>
          </View>
        );
      })}
    </View>
  );
}

interface ChatsListScreenProps {
  onOpenExpenses: () => void;
  /** Opens Throw — both the Chats menu bar's Throw/Map tabs and the quick-action row's center button. */
  onOpenThrow: () => void;
  /** Opens the Games hub — also in the quick-action row. */
  onOpenGames: () => void;
  /** Opens account settings — the Chats menu bar's "Me" tab. */
  onOpenAccount: () => void;
}

/** Chats (MySpace Chats Throw handoff) — day/night themed, only accepted friends get a thread here. */
export function ChatsListScreen({ onOpenExpenses, onOpenThrow, onOpenGames, onOpenAccount }: ChatsListScreenProps) {
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const { isDay } = useThrowColorMode();
  const { user } = useAuth();
  const [filter, setFilter] = useState<Filter>('all');
  const {
    friends,
    sentRequests,
    goAdd,
    openChat,
    lastMessageFor,
    isUnread,
    unreadCountFor,
    isOnline,
    isTyping,
    groups,
    goCreateGroup,
    openGroupChat,
    lastGroupMessageFor,
    groupMemberIdsFor,
    groupMemberNamesFor,
    goMap,
  } = useFriends();

  const firstTwoMembers = (groupId: string): { id: string; name: string }[] => {
    const otherIds = groupMemberIdsFor(groupId).filter((id) => id !== user?.id);
    const names = groupMemberNamesFor(groupId);
    return otherIds.slice(0, 2).map((id, i) => ({ id, name: names[i] ?? 'Someone' }));
  };

  const unreadTotal = friends.reduce((sum, f) => sum + unreadCountFor(f.connectionId), 0);
  const friendsForFilter = filter === 'groups' || filter === 'letters' ? [] : filter === 'unread' ? friends.filter((f) => isUnread(f.connectionId)) : friends;
  const groupsForFilter = filter === 'unread' || filter === 'letters' ? [] : groups;
  const sentRequestsForFilter = filter === 'all' ? sentRequests : [];
  const nothingToShow = friendsForFilter.length === 0 && groupsForFilter.length === 0 && sentRequestsForFilter.length === 0;
  const emptyCopy =
    filter === 'letters'
      ? { title: 'No letter chats yet', body: 'Thrown letters shared in a conversation will show up here.' }
      : filter === 'unread'
        ? { title: "You're all caught up", body: 'No unread chats right now.' }
        : filter === 'groups'
          ? { title: 'No groups yet', body: 'Start a group to see it here.' }
          : { title: 'No chats yet', body: 'Add a friend to start a conversation.' };

  const sidePad = isDay ? 26 : 22;
  const nameColor = isDay ? colors.textPrimary : colors.pale;
  const timeColor = isDay ? colors.textFaint : 'rgba(237,253,255,0.45)';
  const previewReadColor = isDay ? colors.ink55 : 'rgba(237,253,255,0.5)';
  const previewUnreadColor = isDay ? colors.textPrimary : colors.pale;

  return (
    <LinearGradient
      colors={(isDay ? colors.friendsCanvas : colors.chatsNightCanvas) as [string, string, ...string[]]}
      locations={(isDay ? colors.friendsCanvasStops : colors.chatsNightCanvasStops) as [number, number, ...number[]]}
      start={{ x: 0.5, y: 0 }}
      end={{ x: 0.5, y: 1 }}
      style={styles.screen}
    >
      {isDay && <FriendsGlow />}
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[styles.scroll, { paddingTop: insets.top + spacing.md, paddingHorizontal: sidePad }]}>
        <View style={styles.headerRow}>
          {isDay ? (
            <View style={styles.headerLeftDay}>
              <ChatsLogoMark size={34} arcColor={colors.ink} bodyFill={colors.ink} wingFill={colors.coral} />
              <Text style={[styles.title, { color: nameColor }]}>Chats</Text>
            </View>
          ) : (
            <View style={styles.headerLeftNight}>
              <View style={styles.headerWordmarkRow}>
                <ChatsLogoMark size={22} arcColor={colors.pale} bodyFill={colors.lime} wingFill="#8FB52E" />
                <Text style={styles.wordmark}>MYSPACE</Text>
              </View>
              <Text style={[styles.title, { color: nameColor }]}>Chats</Text>
            </View>
          )}
          <Pressable
            onPress={goAdd}
            style={[styles.newChatBtn, { backgroundColor: isDay ? colors.ink : colors.lime, shadowColor: isDay ? colors.ink : colors.lime }]}
            accessibilityRole="button"
            accessibilityLabel="Start a new chat"
          >
            <Icon path={CHAT_PLUS_ICON} color={isDay ? colors.lime : colors.ink} size={22} strokeWidth={1.9} />
          </Pressable>
        </View>

        {isDay ? (
          <>
            <Text style={styles.railKicker}>IN THE AIR</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rail}>
              <Pressable onPress={goCreateGroup} style={styles.railItem} accessibilityRole="button" accessibilityLabel="Start a group">
                <View style={styles.railRing}>
                  <Icon path={GROUP_ICON} color={colors.ink50} size={22} strokeWidth={1.8} />
                </View>
                <Text style={styles.railLabelNew}>Groups</Text>
              </Pressable>
              {friends.map((f) => (
                <Pressable key={f.connectionId} onPress={() => openChat(f.connectionId)} style={styles.railItem}>
                  <View style={styles.railRing}>
                    <FriendAvatar userId={f.userId} name={f.name} size={50} initialsFontSize={16} avatarUrl={f.avatarUrl} />
                    {isUnread(f.connectionId) && (
                      <View style={styles.railUnreadBadge}>
                        <Svg width={12} height={12} viewBox="0 0 64 64">
                          <Path d={PLANE_BODY} fill={colors.lime} />
                        </Svg>
                      </View>
                    )}
                  </View>
                  <Text style={styles.railLabel} numberOfLines={1}>
                    {f.name.split(' ')[0]}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          </>
        ) : (
          <View style={styles.chipsRow}>
            {(['all', 'unread', 'groups', 'letters'] as Filter[]).map((f) => {
              const active = filter === f;
              return (
                <Pressable key={f} onPress={() => setFilter(f)} style={[styles.chip, { backgroundColor: active ? colors.pale : 'rgba(237,253,255,0.08)' }]}>
                  <Text style={[styles.chipText, { color: active ? colors.ink : colors.pale }]}>{f === 'all' ? 'All' : f === 'unread' ? 'Unread' : f === 'groups' ? 'Groups' : 'Letters'}</Text>
                  {f === 'unread' && <Text style={styles.chipCount}>{unreadTotal}</Text>}
                </Pressable>
              );
            })}
          </View>
        )}

        {nothingToShow ? (
          isDay ? (
            <GlassSurface tint="light" tintColor="rgba(255,255,255,0.45)" style={styles.empty}>
              <Text style={styles.emptyTitle}>{emptyCopy.title}</Text>
              <Text style={styles.emptyBody}>{emptyCopy.body}</Text>
            </GlassSurface>
          ) : (
            <View style={[styles.empty, styles.emptyNight]}>
              <Text style={[styles.emptyTitle, { color: colors.pale }]}>{emptyCopy.title}</Text>
              <Text style={[styles.emptyBody, { color: 'rgba(237,253,255,0.6)' }]}>{emptyCopy.body}</Text>
            </View>
          )
        ) : (
          <>
            {groupsForFilter.length > 0 && (
              <View style={styles.list}>
                {groupsForFilter.map((g) => {
                  const last = lastGroupMessageFor(g.id);
                  const avatarSize = isDay ? 48 : 50;
                  const members = firstTwoMembers(g.id);
                  return (
                    <Pressable key={g.id} onPress={() => openGroupChat(g.id)} style={({ pressed }) => [pressed && styles.rowPressed]}>
                      {isDay ? (
                        <GlassSurface tint="light" tintColor="rgba(255,255,255,0.6)" style={styles.rowDay}>
                          <GroupAvatarPair members={members} size={avatarSize} borderColor="#F6F5DF" />
                          <View style={styles.rowText}>
                            <View style={styles.rowNameLine}>
                              <Text style={[styles.rowName, { color: nameColor }]}>{g.name}</Text>
                              {last && <Text style={[styles.rowTime, { color: timeColor }]}>{timeAgo(last.createdAt)}</Text>}
                            </View>
                            <View style={styles.rowPreviewLine}>
                              <Text style={[styles.rowPreview, { color: previewReadColor }]} numberOfLines={1}>
                                {last ? last.text : 'Say hi to the group 👋'}
                              </Text>
                            </View>
                          </View>
                        </GlassSurface>
                      ) : (
                        <View style={styles.rowNight}>
                          <GroupAvatarPair members={members} size={avatarSize} borderColor="#121B0B" />
                          <View style={styles.rowText}>
                            <View style={styles.rowNameLine}>
                              <Text style={[styles.rowName, { color: nameColor }]}>{g.name}</Text>
                              {last && <Text style={[styles.rowTime, { color: timeColor }]}>{timeAgo(last.createdAt)}</Text>}
                            </View>
                            <View style={styles.rowPreviewLine}>
                              <Text style={[styles.rowPreview, { color: previewReadColor }]} numberOfLines={1}>
                                {last ? last.text : 'Say hi to the group 👋'}
                              </Text>
                            </View>
                          </View>
                        </View>
                      )}
                    </Pressable>
                  );
                })}
              </View>
            )}

            {friendsForFilter.length > 0 && (
              <View style={styles.list}>
                {friendsForFilter.map((f) => {
                  const last = lastMessageFor(f.connectionId);
                  const unread = isUnread(f.connectionId);
                  const unreadCount = unreadCountFor(f.connectionId);
                  const typing = isTyping(f.connectionId);
                  const previewText = typing ? 'Typing…' : last ? last.text : 'Say hi 👋';
                  return (
                    <Pressable key={f.connectionId} onPress={() => openChat(f.connectionId)} style={({ pressed }) => [pressed && styles.rowPressed]}>
                      {isDay ? (
                        <GlassSurface tint="light" tintColor={unread ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.6)'} style={styles.rowDay}>
                          <FriendAvatar userId={f.userId} name={f.name} size={48} initialsFontSize={16} avatarUrl={f.avatarUrl} />
                          <View style={styles.rowText}>
                            <View style={styles.rowNameLine}>
                              <Text style={[styles.rowName, { color: nameColor }]}>{f.name}</Text>
                              {last && <Text style={[styles.rowTime, { color: timeColor }]}>{timeAgo(last.createdAt)}</Text>}
                            </View>
                            <View style={styles.rowPreviewLine}>
                              <Text style={[styles.rowPreview, { color: unread ? previewUnreadColor : previewReadColor }, unread && styles.rowPreviewUnreadWeight]} numberOfLines={1}>
                                {previewText}
                              </Text>
                              {unreadCount > 0 && (
                                <View style={styles.unreadPillDay}>
                                  <Svg width={11} height={11} viewBox="0 0 64 64">
                                    <Path d={PLANE_BODY} fill={colors.lime} />
                                  </Svg>
                                  <Text style={styles.unreadPillDayText}>{unreadCount}</Text>
                                </View>
                              )}
                            </View>
                          </View>
                        </GlassSurface>
                      ) : (
                        <View style={[styles.rowNight, { backgroundColor: unread ? 'rgba(237,253,255,0.09)' : 'rgba(237,253,255,0.03)' }]}>
                          <FriendAvatar userId={f.userId} name={f.name} size={50} initialsFontSize={16} online={isOnline(f.userId)} avatarUrl={f.avatarUrl} />
                          <View style={styles.rowText}>
                            <View style={styles.rowNameLine}>
                              <Text style={[styles.rowName, { color: nameColor }]}>{f.name}</Text>
                              {last && <Text style={[styles.rowTime, { color: timeColor }]}>{timeAgo(last.createdAt)}</Text>}
                            </View>
                            <View style={styles.rowPreviewLine}>
                              <Text style={[styles.rowPreview, { color: unread ? previewUnreadColor : previewReadColor }, unread && styles.rowPreviewUnreadWeight]} numberOfLines={1}>
                                {previewText}
                              </Text>
                              {unreadCount > 0 && (
                                <View style={styles.unreadPillNight}>
                                  <Text style={styles.unreadPillNightText}>{unreadCount}</Text>
                                </View>
                              )}
                            </View>
                          </View>
                        </View>
                      )}
                    </Pressable>
                  );
                })}
              </View>
            )}

            {sentRequestsForFilter.length > 0 && (
              <View style={styles.lockedList}>
                {sentRequestsForFilter.map((r) => (
                  <Pressable key={r.connectionId} onPress={() => openChat(r.connectionId)} style={[styles.lockedRow, !isDay && styles.lockedRowNight]}>
                    <View style={[styles.lockedIcon, !isDay && styles.lockedIconNight]}>
                      <LockIcon size={18} color={isDay ? colors.ink50 : colors.pale} strokeWidth={1.7} />
                    </View>
                    <Text style={[styles.lockedText, { color: isDay ? colors.ink55 : 'rgba(237,253,255,0.6)' }]}>
                      <Text style={[styles.lockedName, { color: isDay ? colors.ink75 : colors.pale }]}>{r.name}</Text> — chat opens when they accept your request.
                    </Text>
                  </Pressable>
                ))}
              </View>
            )}
          </>
        )}
      </ScrollView>

      <ChatsBottomBar isDay={isDay} onOpenThrow={onOpenThrow} onOpenMap={goMap} onOpenExpenses={onOpenExpenses} onOpenGames={onOpenGames} onOpenAccount={onOpenAccount} />
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  scroll: {
    paddingBottom: spacing.huge,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerLeftDay: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerLeftNight: {
    gap: 4,
  },
  headerWordmarkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  wordmark: {
    fontFamily: fontFamily.mono500,
    fontSize: 10.5,
    letterSpacing: 1.5,
    color: 'rgba(237,253,255,0.55)',
  },
  title: {
    fontFamily: fontFamily.sans700,
    fontSize: 30,
    letterSpacing: -0.9,
  },
  newChatBtn: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOpacity: 0.26,
    shadowOffset: { width: 0, height: 10 },
    shadowRadius: 22,
    elevation: 2,
  },
  railKicker: {
    marginTop: 22,
    fontFamily: fontFamily.mono500,
    fontSize: 10.5,
    letterSpacing: 1.5,
    color: colors.ink50,
  },
  rail: {
    marginTop: 10,
    gap: 14,
    paddingRight: 26,
  },
  railItem: {
    alignItems: 'center',
    gap: 7,
    width: 62,
  },
  railRing: {
    width: 62,
    height: 62,
    borderRadius: 31,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: 'rgba(22,33,12,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  railUnreadBadge: {
    position: 'absolute',
    right: -4,
    top: -4,
    width: 24,
    height: 24,
    borderRadius: 12,
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
  chipsRow: {
    marginTop: 20,
    flexDirection: 'row',
    gap: 8,
  },
  chip: {
    height: 34,
    paddingHorizontal: 14,
    borderRadius: 17,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  chipText: {
    fontFamily: fontFamily.sans600,
    fontSize: 13,
  },
  chipCount: {
    fontFamily: fontFamily.mono500,
    fontSize: 11,
    color: colors.lime,
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
  emptyNight: {
    backgroundColor: 'rgba(237,253,255,0.05)',
    borderColor: 'rgba(237,253,255,0.1)',
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
  rowDay: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderRadius: 24,
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.5)',
  },
  rowNight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderRadius: 26,
    paddingVertical: 13,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: 'rgba(237,253,255,0.07)',
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
  },
  rowPreviewUnreadWeight: {
    fontFamily: fontFamily.sans700,
  },
  rowTime: {
    fontFamily: fontFamily.mono500,
    fontSize: 11.5,
  },
  unreadPillDay: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    height: 22,
    paddingHorizontal: 8,
    borderRadius: 11,
    backgroundColor: colors.ink,
  },
  unreadPillDayText: {
    fontFamily: fontFamily.sans600,
    fontSize: 11.5,
    color: colors.lime,
  },
  unreadPillNight: {
    minWidth: 22,
    height: 22,
    paddingHorizontal: 7,
    borderRadius: 11,
    backgroundColor: colors.lime,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unreadPillNightText: {
    fontFamily: fontFamily.sans700,
    fontSize: 11.5,
    color: colors.ink,
  },
  groupAvatar: {
    backgroundColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  groupAvatarCircle: {
    position: 'absolute',
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  groupAvatarCircleText: {
    fontFamily: fontFamily.sans700,
    fontSize: 11,
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
  lockedRowNight: {
    borderColor: 'rgba(237,253,255,0.22)',
  },
  lockedIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.ink06,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lockedIconNight: {
    backgroundColor: 'rgba(237,253,255,0.06)',
  },
  lockedText: {
    flex: 1,
    fontFamily: fontFamily.sans400,
    fontSize: 13,
    lineHeight: 18,
  },
  lockedName: {
    fontFamily: fontFamily.sans600,
  },
});
