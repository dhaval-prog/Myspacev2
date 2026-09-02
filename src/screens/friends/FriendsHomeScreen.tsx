import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fontFamily, noOutline, radius, spacing } from '../../theme';
import { Icon } from '../../components/Icon';
import { SearchIcon } from '../../components/icons/SearchIcon';
import { FriendAvatar } from '../../components/friends/FriendAvatar';
import { BottomNav } from '../../components/BottomNav';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import { useFriends } from '../../context/FriendsContext';

const CHAT_ICON = 'M20 11.5a7.5 7.5 0 0 1-10.7 6.8L4 19.5l1.3-4.9A7.5 7.5 0 1 1 20 11.5z';
const BACK_ICON = 'M15 5l-7 7 7 7';
const CHEVRON_ICON = 'M9 6l6 6-6 6';
const QR_ICON = 'M3.5 3.5h6.5v6.5h-6.5z M14 3.5h6.5v6.5h-6.5z M3.5 14h6.5v6.5h-6.5z M14 14h3v3h-3zM20.5 17.5v3h-3';
const PIN_ICON = 'M12 21s7-7.58 7-12A7 7 0 0 0 5 9c0 4.42 7 12 7 12z M12 11.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5';

interface FriendsHomeScreenProps {
  onHome: () => void;
  onOpenExpenses: () => void;
  onOpenSplit: () => void;
  onOpenLiveLocations: () => void;
}

/** Friends list (6p-1): pending requests surfaced at the top, then everyone connected or waiting. */
export function FriendsHomeScreen({ onHome, onOpenExpenses, onOpenSplit, onOpenLiveLocations }: FriendsHomeScreenProps) {
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
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
    <LinearGradient
      colors={colors.friendsCanvas as [string, string, ...string[]]}
      locations={colors.friendsCanvasStops as [number, number, ...number[]]}
      start={{ x: 0.5, y: 0 }}
      end={{ x: 0.5, y: 1 }}
      style={styles.screen}
    >
      <ScrollView style={styles.scrollFlex} showsVerticalScrollIndicator={false} contentContainerStyle={[styles.scroll, { paddingTop: insets.top + spacing.md }]}>
        <View style={styles.headerRow}>
          <Text style={styles.title}>Friends</Text>
          <Text style={styles.sub}>
            {friends.length} connected{receivedRequests.length > 0 ? ` · ${receivedRequests.length} waiting` : ''}
          </Text>
        </View>

        <Pressable
          onPress={onOpenLiveLocations}
          style={({ pressed }) => [styles.radarBanner, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel="Radar - Find Your People"
        >
          <View style={styles.radarIcon}>
            <Icon path={PIN_ICON} color={colors.lime} size={19} strokeWidth={1.8} />
          </View>
          <View style={styles.requestsText}>
            <Text style={styles.radarTitle}>Radar - Find Your People</Text>
            <Text style={styles.radarSub}>See where your friends are right now</Text>
          </View>
          <Icon path={CHEVRON_ICON} color={colors.lime} size={18} strokeWidth={2} />
        </Pressable>

        <View style={styles.searchField}>
          <SearchIcon size={19} color={colors.ink55} />
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
                  initialsFontSize={i > 0 ? 13 : 14}
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
                    <View style={styles.rowAction} pointerEvents="none">
                      <Icon path={CHAT_ICON} color={colors.lime} size={16} strokeWidth={1.9} />
                    </View>
                  </Pressable>
                ) : (
                  <View key={p.connectionId} style={[styles.row, styles.rowPending]}>
                    <FriendAvatar userId={p.userId} name={p.name} size={44} pending avatarUrl={p.avatarUrl} />
                    <View style={styles.rowText}>
                      <Text style={[styles.rowName, styles.rowNamePending]}>{p.name}</Text>
                      <Text style={styles.rowMetaPending}>Request sent · pending</Text>
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

        <Pressable
          onPress={goAdd}
          style={({ pressed }) => [styles.ctaButton, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel="Add a friend"
        >
          <Icon path={QR_ICON} color={colors.ink} size={19} strokeWidth={1.8} />
          <Text style={styles.ctaLabel}>Add a friend</Text>
        </Pressable>
      </ScrollView>

      <View style={styles.pinned}>
        <Pressable onPress={onHome} style={styles.iconButton} accessibilityRole="button" accessibilityLabel="Back to Home">
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
        onAdd={goChats}
        fabIconPath={CHAT_ICON}
        fabAccessibilityLabel="Chats"
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
  scrollFlex: {
    flex: 1,
  },
  scroll: {
    paddingHorizontal: 26,
    paddingBottom: spacing.lg,
    gap: 14,
  },
  pinned: {
    paddingHorizontal: 26,
    paddingTop: spacing.ms,
    paddingBottom: spacing.ms,
  },
  ctaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    borderRadius: radius.pill,
    backgroundColor: colors.lime,
    paddingVertical: 19,
    shadowColor: '#7AA82C',
    shadowOpacity: 0.32,
    shadowOffset: { width: 0, height: 10 },
    shadowRadius: 24,
    elevation: 4,
  },
  ctaLabel: {
    fontFamily: fontFamily.sans600,
    fontSize: 16,
    color: colors.ink,
  },
  headerRow: {
    gap: 2,
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
  searchInput: {
    flex: 1,
    fontFamily: fontFamily.sans400,
    fontSize: 15,
    color: colors.textPrimary,
  },
  radarBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.ms,
    backgroundColor: colors.ink,
    borderRadius: 26,
    paddingVertical: 16,
    paddingHorizontal: 18,
  },
  radarIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radarTitle: {
    fontFamily: fontFamily.sans600,
    fontSize: 14.5,
    color: '#fff',
  },
  radarSub: {
    fontFamily: fontFamily.sans400,
    fontSize: 12.5,
    color: 'rgba(255,255,255,.6)',
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
    fontFamily: fontFamily.sans600,
    fontSize: 11.5,
    letterSpacing: 1.495,
    textTransform: 'uppercase',
    color: colors.textFaint,
  },
  list: {
    gap: 10,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: 'rgba(255,255,255,.86)',
    borderRadius: 24,
    paddingVertical: 14,
    paddingHorizontal: 18,
  },
  rowPressed: {
    opacity: 0.85,
  },
  rowPending: {
    backgroundColor: 'rgba(255,255,255,.5)',
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
    color: colors.ink65,
  },
  rowMeta: {
    fontFamily: fontFamily.mono500,
    fontSize: 12.5,
    color: colors.ink50,
  },
  rowMetaPending: {
    fontFamily: fontFamily.mono500,
    fontSize: 12.5,
    color: colors.placeholder,
  },
  rowAction: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
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
    color: colors.ink50,
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
