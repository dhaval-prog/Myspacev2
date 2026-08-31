import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fontFamily, spacing } from '../../theme';
import { Icon } from '../../components/Icon';
import { MemberAvatar } from '../../components/split/MemberAvatar';
import { useFriends } from '../../context/FriendsContext';

const BACK_ICON = 'M15 5l-7 7 7 7';
const CHECK_ICON = 'M5 12.5l4.5 4.5L19 7';
const CLOSE_ICON = 'M6 6l12 12M18 6L6 18';

type Tab = 'received' | 'sent';

/** Incoming and outgoing friend requests. */
export function FriendRequestsScreen() {
  const insets = useSafeAreaInsets();
  const { receivedRequests, sentRequests, goHome, acceptRequest, declineRequest, cancelRequest } = useFriends();
  const [tab, setTab] = useState<Tab>('received');

  const list = tab === 'received' ? receivedRequests : sentRequests;

  return (
    <View style={styles.screen}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[styles.scroll, { paddingTop: insets.top + spacing.md }]}>
        <View style={styles.topRow}>
          <Pressable onPress={goHome} style={styles.iconButton} accessibilityRole="button" accessibilityLabel="Back">
            <Icon path={BACK_ICON} color={colors.friendsInk} size={19} strokeWidth={2} />
          </Pressable>
          <Text style={styles.title}>Requests</Text>
          <View style={styles.iconButton} />
        </View>

        <View style={styles.tabRow}>
          <Pressable onPress={() => setTab('received')} style={[styles.tab, tab === 'received' && styles.tabOn]}>
            <Text style={[styles.tabLabel, tab === 'received' && styles.tabLabelOn]}>
              Received{receivedRequests.length > 0 ? ` (${receivedRequests.length})` : ''}
            </Text>
          </Pressable>
          <Pressable onPress={() => setTab('sent')} style={[styles.tab, tab === 'sent' && styles.tabOn]}>
            <Text style={[styles.tabLabel, tab === 'sent' && styles.tabLabelOn]}>Sent{sentRequests.length > 0 ? ` (${sentRequests.length})` : ''}</Text>
          </Pressable>
        </View>

        {list.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyBody}>{tab === 'received' ? 'No requests waiting on you.' : "You haven't sent any requests."}</Text>
          </View>
        ) : (
          <View style={styles.list}>
            {list.map((r) => (
              <View key={r.connectionId} style={styles.row}>
                <MemberAvatar userId={r.userId} name={r.name} size={46} />
                <View style={styles.rowText}>
                  <Text style={styles.rowName}>{r.name}</Text>
                  {r.username && <Text style={styles.rowMeta}>@{r.username}</Text>}
                </View>
                {tab === 'received' ? (
                  <View style={styles.rowActions}>
                    <Pressable
                      onPress={() => declineRequest(r.connectionId)}
                      style={[styles.iconButtonSm, styles.declineButton]}
                      accessibilityRole="button"
                      accessibilityLabel={`Decline ${r.name}`}
                    >
                      <Icon path={CLOSE_ICON} color={colors.splitDangerFg} size={15} strokeWidth={2.2} />
                    </Pressable>
                    <Pressable
                      onPress={() => acceptRequest(r.connectionId)}
                      style={[styles.iconButtonSm, styles.acceptButton]}
                      accessibilityRole="button"
                      accessibilityLabel={`Accept ${r.name}`}
                    >
                      <Icon path={CHECK_ICON} color="#fff" size={15} strokeWidth={2.4} />
                    </Pressable>
                  </View>
                ) : (
                  <Pressable
                    onPress={() => cancelRequest(r.connectionId)}
                    style={styles.cancelButton}
                    accessibilityRole="button"
                    accessibilityLabel={`Cancel request to ${r.name}`}
                  >
                    <Text style={styles.cancelLabel}>Cancel</Text>
                  </Pressable>
                )}
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
  tabRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    backgroundColor: colors.friendsSurface,
    borderRadius: 16,
    padding: 5,
  },
  tab: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 11,
    alignItems: 'center',
  },
  tabOn: {
    backgroundColor: colors.friendsInk,
  },
  tabLabel: {
    fontFamily: fontFamily.sans500,
    fontSize: 13,
    color: colors.friendsInkFaint55,
  },
  tabLabelOn: {
    fontFamily: fontFamily.sans600,
    color: '#fff',
  },
  empty: {
    borderRadius: 24,
    backgroundColor: colors.friendsSurface,
    padding: spacing.xxl,
    alignItems: 'center',
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
  rowText: {
    flex: 1,
  },
  rowName: {
    fontFamily: fontFamily.sans600,
    fontSize: 14.5,
    color: colors.friendsInk,
  },
  rowMeta: {
    fontFamily: fontFamily.sans400,
    fontSize: 12,
    color: colors.friendsInkFaint45,
  },
  rowActions: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  iconButtonSm: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  declineButton: {
    backgroundColor: colors.splitDangerBg,
  },
  acceptButton: {
    backgroundColor: colors.friendsAccent,
  },
  cancelButton: {
    borderRadius: 999,
    paddingVertical: 9,
    paddingHorizontal: 16,
    backgroundColor: colors.friendsInkFaint08,
  },
  cancelLabel: {
    fontFamily: fontFamily.sans600,
    fontSize: 12.5,
    color: colors.friendsInk,
  },
});
