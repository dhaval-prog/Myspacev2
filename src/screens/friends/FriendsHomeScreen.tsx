import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fontFamily, noOutline, radius, spacing } from '../../theme';
import { Icon } from '../../components/Icon';
import { FriendAvatar } from '../../components/friends/FriendAvatar';
import { AddFriendFab } from '../../components/friends/AddFriendFab';
import { useFriends } from '../../context/FriendsContext';

const CHAT_ICON = 'M4 4h16v12H8l-4 4z';
const BACK_ICON = 'M15 5l-7 7 7 7';
const CHEVRON_ICON = 'M9 6l6 6-6 6';

interface FriendsHomeScreenProps {
  onHome: () => void;
}

/** Friends list (6p-1): pending requests surfaced at the top, then everyone connected or waiting. */
export function FriendsHomeScreen({ onHome }: FriendsHomeScreenProps) {
  const insets = useSafeAreaInsets();
  const { friends, receivedRequests, sentRequests, goAdd, goRequests, goChats, openChat, cancelRequest } = useFriends();
  const [query, setQuery] = useState('');

  const people = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = [
      ...friends.map((f) => ({ kind: 'friend' as const, connectionId: f.connectionId, userId: f.userId, name: f.name, username: f.username, avatarUrl: f.avatarUrl })),
      ...sentRequests.map((r) => ({ kind: 'pending' as const, connectionId: r.connectionId, userId: r.userId, name: r.name, username: r.username, avatarUrl: r.avatarUrl })),
    ];
    if (!q) return list;
    return list.filter((p) => p.name.toLowerCase().includes(q) || p.username?.toLowerCase().includes(q));
  }, [friends, sentRequests, query]);

  const requestNames = receivedRequests.slice(0, 2).map((r) => r.name.split(' ')[0]);
  const requestSummary =
    receivedRequests.length === 0
      ? ''
      : requestNames.length === 1
        ? `${requestNames[0]} wants to connect`
        : `${requestNames.join(' and ')} want to connect`;

  return (
    <View style={styles.screen}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[styles.scroll, { paddingTop: insets.top + spacing.md }]}>
        <View style={styles.headerRow}>
          <View style={styles.headerLeft}>
            <Pressable onPress={onHome} style={styles.iconButton} accessibilityRole="button" accessibilityLabel="Back to Home">
              <Icon path={BACK_ICON} color={colors.textPrimary} size={18} strokeWidth={2} />
            </Pressable>
            <View>
              <Text style={styles.title}>Friends</Text>
              <Text style={styles.sub}>
                {friends.length} connected{receivedRequests.length > 0 ? ` · ${receivedRequests.length} waiting` : ''}
              </Text>
            </View>
          </View>
          <Pressable onPress={goChats} style={styles.chatButton} accessibilityRole="button" accessibilityLabel="Chats">
            <Icon path={CHAT_ICON} color={colors.lime} size={20} strokeWidth={1.9} />
          </Pressable>
        </View>

        <View style={styles.searchField}>
          <Text style={styles.searchIcon}>⌕</Text>
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search friends"
            placeholderTextColor={colors.placeholder}
            style={[styles.searchInput, noOutline]}
          />
        </View>

        {receivedRequests.length > 0 && (
          <Pressable onPress={goRequests} style={({ pressed }) => [styles.requestsBanner, pressed && styles.pressed]}>
            <View style={styles.requestsAvatars}>
              {receivedRequests.slice(0, 2).map((r, i) => (
                <FriendAvatar
                  key={r.connectionId}
                  userId={r.userId}
                  name={r.name}
                  size={38}
                  style={i > 0 ? styles.requestsAvatarOverlap : undefined}
                  avatarUrl={r.avatarUrl}
                />
              ))}
            </View>
            <View style={styles.requestsText}>
              <Text style={styles.requestsTitle}>
                {receivedRequests.length} friend request{receivedRequests.length === 1 ? '' : 's'}
              </Text>
              <Text style={styles.requestsSub}>{requestSummary}</Text>
            </View>
            <Icon path={CHEVRON_ICON} color={colors.lime} size={18} strokeWidth={2} />
          </Pressable>
        )}

        {people.length > 0 && (
          <>
            <Text style={styles.eyebrow}>YOUR PEOPLE</Text>
            <View style={styles.list}>
              {people.map((p) =>
                p.kind === 'friend' ? (
                  <Pressable
                    key={p.connectionId}
                    onPress={() => openChat(p.connectionId)}
                    style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
                    accessibilityRole="button"
                    accessibilityLabel={`Message ${p.name}`}
                  >
                    <FriendAvatar userId={p.userId} name={p.name} size={44} avatarUrl={p.avatarUrl} />
                    <View style={styles.rowText}>
                      <Text style={styles.rowName}>{p.name}</Text>
                      {p.username && <Text style={styles.rowMeta}>@{p.username}</Text>}
                    </View>
                  </Pressable>
                ) : (
                  <View key={p.connectionId} style={[styles.row, styles.rowPending]}>
                    <FriendAvatar userId={p.userId} name={p.name} size={44} style={styles.rowPendingAvatar} avatarUrl={p.avatarUrl} />
                    <View style={styles.rowText}>
                      <Text style={[styles.rowName, styles.rowNamePending]}>{p.name}</Text>
                      <Text style={styles.rowMeta}>Request sent · pending</Text>
                    </View>
                    <Pressable
                      onPress={() => cancelRequest(p.connectionId)}
                      style={styles.cancelPill}
                      accessibilityRole="button"
                      accessibilityLabel={`Cancel request to ${p.name}`}
                    >
                      <Text style={styles.cancelLabel}>Cancel</Text>
                    </Pressable>
                  </View>
                ),
              )}
            </View>
          </>
        )}

        {people.length === 0 && receivedRequests.length === 0 && (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>No friends yet</Text>
            <Text style={styles.emptyBody}>Share your code or scan someone else's to start connecting.</Text>
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
    gap: 14,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    fontFamily: fontFamily.sans700,
    fontSize: 30,
    lineHeight: 31.5,
    letterSpacing: -0.9,
    color: colors.textPrimary,
  },
  sub: {
    fontFamily: fontFamily.sans400,
    fontSize: 13.5,
    color: colors.textSecondary,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.ms,
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
  chatButton: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.85,
  },
  searchField: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: 'rgba(255,255,255,.86)',
    borderRadius: radius.pill,
    paddingVertical: 15,
    paddingHorizontal: 20,
  },
  searchIcon: {
    fontSize: 15,
    color: colors.textPrimary,
    opacity: 0.5,
  },
  searchInput: {
    flex: 1,
    fontFamily: fontFamily.sans400,
    fontSize: 15,
    color: colors.textPrimary,
  },
  requestsBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.ms,
    backgroundColor: colors.ink,
    borderRadius: 26,
    paddingVertical: 16,
    paddingHorizontal: 18,
  },
  requestsAvatars: {
    flexDirection: 'row',
  },
  requestsAvatarOverlap: {
    marginLeft: -14,
    borderWidth: 2,
    borderColor: colors.ink,
  },
  requestsText: {
    flex: 1,
    gap: 2,
  },
  requestsTitle: {
    fontFamily: fontFamily.sans600,
    fontSize: 14.5,
    color: '#fff',
  },
  requestsSub: {
    fontFamily: fontFamily.sans400,
    fontSize: 12.5,
    color: 'rgba(255,255,255,.6)',
  },
  eyebrow: {
    fontFamily: fontFamily.mono500,
    fontSize: 11.5,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    color: colors.textMuted,
  },
  list: {
    gap: 10,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: 'rgba(255,255,255,.86)',
    borderRadius: radius.md,
    paddingVertical: 14,
    paddingHorizontal: 18,
  },
  rowPressed: {
    opacity: 0.85,
  },
  rowPending: {
    backgroundColor: 'rgba(255,255,255,.5)',
  },
  rowPendingAvatar: {
    opacity: 0.5,
  },
  rowText: {
    flex: 1,
  },
  rowName: {
    fontFamily: fontFamily.sans600,
    fontSize: 15.5,
    color: colors.textPrimary,
  },
  rowNamePending: {
    color: colors.textFaint,
  },
  rowMeta: {
    fontFamily: fontFamily.mono500,
    fontSize: 12.5,
    color: colors.textFaint,
  },
  cancelPill: {
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: 'rgba(22,33,12,0.2)',
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  cancelLabel: {
    fontFamily: fontFamily.sans600,
    fontSize: 11.5,
    color: colors.textPrimary,
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
});
