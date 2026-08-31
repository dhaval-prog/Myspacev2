import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fontFamily, radius, spacing } from '../../theme';
import { Icon } from '../../components/Icon';
import { AccountBadge } from '../../components/AccountBadge';
import { MemberAvatar } from '../../components/split/MemberAvatar';
import { useFriends } from '../../context/FriendsContext';

const BACK_ICON = 'M15 5l-7 7 7 7';
const ADD_ICON = 'M15 19c0-3.3-2.7-6-6-6s-6 2.7-6 6M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM18 8v6M15 11h6';
const INBOX_ICON = 'M4 12h4l2 3h4l2-3h4M4 12l1.5-6.5A2 2 0 0 1 7.44 4h9.12a2 2 0 0 1 1.94 1.5L20 12M4 12v6a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-6';
const CHAT_ICON = 'M4 4h16v12H8l-4 4z';

interface FriendsHomeScreenProps {
  onHome: () => void;
  onOpenAccount: () => void;
}

/** Friends list — the entry point into add-a-friend, requests, and chats. */
export function FriendsHomeScreen({ onHome, onOpenAccount }: FriendsHomeScreenProps) {
  const insets = useSafeAreaInsets();
  const { friends, receivedRequests, goAdd, goRequests, goChats, openChat, loading } = useFriends();

  return (
    <View style={styles.screen}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[styles.scroll, { paddingTop: insets.top + spacing.md }]}>
        <View style={styles.topRow}>
          <Pressable onPress={onHome} style={styles.iconButton} accessibilityRole="button" accessibilityLabel="Back to Home">
            <Icon path={BACK_ICON} color={colors.friendsInk} size={19} strokeWidth={2} />
          </Pressable>
          <Text style={styles.title}>Friends</Text>
          <AccountBadge onPress={onOpenAccount} bg={colors.friendsSurface} tint={colors.friendsInk} />
        </View>

        <View style={styles.actionsRow}>
          <Pressable onPress={goAdd} style={styles.actionTile} accessibilityRole="button" accessibilityLabel="Add a friend">
            <View style={styles.actionIcon}>
              <Icon path={ADD_ICON} color="#fff" size={20} strokeWidth={2} />
            </View>
            <Text style={styles.actionLabel}>Add a friend</Text>
          </Pressable>
          <Pressable onPress={goRequests} style={styles.actionTile} accessibilityRole="button" accessibilityLabel="Friend requests">
            <View style={[styles.actionIcon, styles.actionIconAlt]}>
              <Icon path={INBOX_ICON} color={colors.friendsInk} size={19} strokeWidth={1.8} />
              {receivedRequests.length > 0 && (
                <View style={styles.actionBadge}>
                  <Text style={styles.actionBadgeText}>{receivedRequests.length}</Text>
                </View>
              )}
            </View>
            <Text style={styles.actionLabel}>Requests</Text>
          </Pressable>
          <Pressable onPress={goChats} style={styles.actionTile} accessibilityRole="button" accessibilityLabel="Chats">
            <View style={[styles.actionIcon, styles.actionIconAlt]}>
              <Icon path={CHAT_ICON} color={colors.friendsInk} size={18} strokeWidth={1.8} />
            </View>
            <Text style={styles.actionLabel}>Chats</Text>
          </Pressable>
        </View>

        <Text style={styles.sectionTitle}>
          {friends.length > 0 ? `${friends.length} friend${friends.length === 1 ? '' : 's'}` : 'Your friends'}
        </Text>

        {!loading && friends.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>No friends yet</Text>
            <Text style={styles.emptyBody}>Share your code or scan someone else's to start connecting.</Text>
            <Pressable onPress={goAdd} style={styles.emptyCta}>
              <Text style={styles.emptyCtaLabel}>Add a friend</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.list}>
            {friends.map((f) => (
              <Pressable
                key={f.connectionId}
                onPress={() => openChat(f.connectionId)}
                style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
              >
                <MemberAvatar userId={f.userId} name={f.name} size={48} />
                <View style={styles.rowText}>
                  <Text style={styles.rowName}>{f.name}</Text>
                  {f.username && <Text style={styles.rowMeta}>@{f.username}</Text>}
                </View>
                <Icon path={CHAT_ICON} color={colors.friendsInkFaint30} size={18} strokeWidth={1.7} />
              </Pressable>
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
    gap: spacing.xxl,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.friendsSurface,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.friendsInk,
    shadowOpacity: 0.06,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 18,
    elevation: 1,
  },
  title: {
    fontFamily: fontFamily.sans700,
    fontSize: 19,
    color: colors.friendsInk,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  actionTile: {
    flex: 1,
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.friendsSurface,
    borderRadius: 22,
    paddingVertical: spacing.ms,
    shadowColor: colors.friendsInk,
    shadowOpacity: 0.06,
    shadowOffset: { width: 0, height: 10 },
    shadowRadius: 22,
    elevation: 1,
  },
  actionIcon: {
    width: 44,
    height: 44,
    borderRadius: 16,
    backgroundColor: colors.friendsAccent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionIconAlt: {
    backgroundColor: colors.friendsAccentSoftBg,
  },
  actionBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    borderRadius: 9,
    backgroundColor: colors.friendsAccent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionBadgeText: {
    fontFamily: fontFamily.sans700,
    fontSize: 10,
    color: '#fff',
  },
  actionLabel: {
    fontFamily: fontFamily.sans600,
    fontSize: 12.5,
    color: colors.friendsInk,
  },
  sectionTitle: {
    fontFamily: fontFamily.sans700,
    fontSize: 17,
    letterSpacing: -0.2,
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
  emptyCta: {
    marginTop: spacing.xs,
    borderRadius: 999,
    backgroundColor: colors.friendsAccent,
    paddingVertical: 13,
    paddingHorizontal: 24,
  },
  emptyCtaLabel: {
    fontFamily: fontFamily.sans600,
    fontSize: 14,
    color: '#fff',
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
  rowText: {
    flex: 1,
  },
  rowName: {
    fontFamily: fontFamily.sans600,
    fontSize: 15,
    color: colors.friendsInk,
  },
  rowMeta: {
    fontFamily: fontFamily.sans400,
    fontSize: 12,
    color: colors.friendsInkFaint45,
  },
});
