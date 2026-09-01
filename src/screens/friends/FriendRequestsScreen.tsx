import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, fontFamily, radius, spacing } from '../../theme';
import { Icon } from '../../components/Icon';
import { FriendAvatar } from '../../components/friends/FriendAvatar';
import { useFriends } from '../../context/FriendsContext';
import { timeAgo } from '../../utils/relativeTime';

const BACK_ICON = 'M15 5l-7 7 7 7';

type Tab = 'received' | 'sent';

/** Requests inbox (6p-5) — accepting is what unlocks a chat. */
export function FriendRequestsScreen() {
  const insets = useSafeAreaInsets();
  const { receivedRequests, sentRequests, justAccepted, goHome, acceptRequest, declineRequest, cancelRequest, openChat } = useFriends();
  const [tab, setTab] = useState<Tab>('received');

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
          <Pressable onPress={goHome} style={styles.iconButton} accessibilityRole="button" accessibilityLabel="Back">
            <Icon path={BACK_ICON} color={colors.textPrimary} size={19} strokeWidth={2} />
          </Pressable>
          <Text style={styles.title}>Requests</Text>
        </View>

        <View style={styles.segmented}>
          <Pressable onPress={() => setTab('received')} style={[styles.segment, tab === 'received' && styles.segmentOn]}>
            <Text style={[styles.segmentLabel, tab === 'received' && styles.segmentLabelOn]}>Received · {receivedRequests.length}</Text>
          </Pressable>
          <Pressable onPress={() => setTab('sent')} style={[styles.segment, tab === 'sent' && styles.segmentOn]}>
            <Text style={[styles.segmentLabel, tab === 'sent' && styles.segmentLabelOn]}>Sent · {sentRequests.length}</Text>
          </Pressable>
        </View>

        {tab === 'received' ? (
          receivedRequests.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyText}>No requests waiting on you.</Text>
            </View>
          ) : (
            <View style={[styles.cards, styles.cardsSpaced]}>
              {receivedRequests.map((r) => (
                <View key={r.connectionId} style={styles.card}>
                  <View style={styles.cardTopRow}>
                    <FriendAvatar userId={r.userId} name={r.name} size={48} avatarUrl={r.avatarUrl} />
                    <View style={styles.cardText}>
                      <Text style={styles.cardName}>{r.name}</Text>
                      <Text style={styles.cardMeta}>{r.username ? `@${r.username}` : 'via invite code'}</Text>
                    </View>
                    <Text style={styles.cardAge}>{timeAgo(r.createdAt)}</Text>
                  </View>
                  {r.introMessage && (
                    <View style={styles.introBubble}>
                      <Text style={styles.introText}>{r.introMessage}</Text>
                    </View>
                  )}
                  <View style={styles.cardActions}>
                    <Pressable onPress={() => acceptRequest(r.connectionId)} style={styles.acceptButton}>
                      <Text style={styles.acceptLabel}>Accept</Text>
                    </Pressable>
                    <Pressable onPress={() => declineRequest(r.connectionId)} style={styles.declineButton}>
                      <Text style={styles.declineLabel}>Decline</Text>
                    </Pressable>
                  </View>
                </View>
              ))}
            </View>
          )
        ) : sentRequests.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>You haven't sent any requests.</Text>
          </View>
        ) : (
          <View style={[styles.cards, styles.cardsSpaced]}>
            {sentRequests.map((r) => (
              <View key={r.connectionId} style={styles.card}>
                <View style={styles.cardTopRow}>
                  <FriendAvatar userId={r.userId} name={r.name} size={48} avatarUrl={r.avatarUrl} />
                  <View style={styles.cardText}>
                    <Text style={styles.cardName}>{r.name}</Text>
                    <Text style={styles.cardMeta}>{r.username ? `@${r.username}` : 'via invite code'}</Text>
                  </View>
                  <Text style={styles.cardAge}>{timeAgo(r.createdAt)}</Text>
                </View>
                <Pressable onPress={() => cancelRequest(r.connectionId)} style={styles.cancelButton}>
                  <Text style={styles.cancelLabel}>Cancel request</Text>
                </Pressable>
              </View>
            ))}
          </View>
        )}

        {justAccepted.length > 0 && (
          <>
            <Text style={styles.eyebrow}>JUST ACCEPTED</Text>
            <View style={styles.cards}>
              {justAccepted.map((f) => (
                <View key={f.connectionId} style={styles.acceptedRow}>
                  <FriendAvatar userId={f.userId} name={f.name} size={44} avatarUrl={f.avatarUrl} />
                  <View style={styles.cardText}>
                    <Text style={styles.acceptedName}>{f.name}</Text>
                    <Text style={styles.acceptedSub}>You're friends — chat unlocked</Text>
                  </View>
                  <Pressable onPress={() => openChat(f.connectionId)} style={styles.chatPill}>
                    <Text style={styles.chatPillLabel}>Chat</Text>
                  </Pressable>
                </View>
              ))}
            </View>
          </>
        )}

        <View style={styles.homeIndicator} />
      </ScrollView>
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
  topRow: {
    marginTop: 22,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  iconButton: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.ink,
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 14,
    elevation: 2,
  },
  title: {
    fontFamily: fontFamily.sans700,
    fontSize: 25,
    letterSpacing: -0.625,
    color: colors.textPrimary,
  },
  segmented: {
    marginTop: 22,
    flexDirection: 'row',
    gap: 8,
    backgroundColor: colors.ink07,
    borderRadius: radius.pill,
    padding: 5,
  },
  segment: {
    flex: 1,
    borderRadius: radius.pill,
    paddingVertical: 11,
    alignItems: 'center',
  },
  segmentOn: {
    backgroundColor: colors.ink,
  },
  segmentLabel: {
    fontFamily: fontFamily.sans600,
    fontSize: 13.5,
    color: colors.textMuted,
  },
  segmentLabelOn: {
    color: colors.lime,
  },
  empty: {
    marginTop: 18,
    borderRadius: radius.md,
    backgroundColor: 'rgba(255,255,255,.7)',
    padding: spacing.xxl,
    alignItems: 'center',
  },
  emptyText: {
    fontFamily: fontFamily.sans400,
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  cards: {
    gap: spacing.ms,
  },
  cardsSpaced: {
    marginTop: 18,
  },
  card: {
    backgroundColor: colors.surface90,
    borderRadius: radius.lg,
    paddingTop: 18,
    paddingHorizontal: 20,
    paddingBottom: 18,
    gap: spacing.ms,
  },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  cardText: {
    flex: 1,
  },
  cardName: {
    fontFamily: fontFamily.sans600,
    fontSize: 16,
    color: colors.textPrimary,
  },
  cardMeta: {
    marginTop: 2,
    fontFamily: fontFamily.mono500,
    fontSize: 12.5,
    color: colors.ink50,
  },
  cardAge: {
    fontFamily: fontFamily.mono500,
    fontSize: 11.5,
    color: colors.textDisabled,
  },
  introBubble: {
    backgroundColor: colors.ink05,
    borderRadius: 16,
    borderBottomLeftRadius: 6,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  introText: {
    fontFamily: fontFamily.sans400,
    fontSize: 14.5,
    lineHeight: 21,
    color: colors.textSecondary,
  },
  cardActions: {
    flexDirection: 'row',
    gap: 10,
  },
  acceptButton: {
    flex: 1,
    borderRadius: radius.pill,
    backgroundColor: colors.lime,
    paddingVertical: 14,
    alignItems: 'center',
  },
  acceptLabel: {
    fontFamily: fontFamily.sans600,
    fontSize: 14.5,
    color: colors.ink,
  },
  declineButton: {
    flex: 1,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(22,33,12,0.07)',
    paddingVertical: 14,
    alignItems: 'center',
  },
  declineLabel: {
    fontFamily: fontFamily.sans600,
    fontSize: 14.5,
    color: colors.ink70,
  },
  cancelButton: {
    borderRadius: radius.pill,
    backgroundColor: 'rgba(22,33,12,0.07)',
    paddingVertical: 12,
    alignItems: 'center',
  },
  cancelLabel: {
    fontFamily: fontFamily.sans600,
    fontSize: 13.5,
    color: colors.textSecondary,
  },
  eyebrow: {
    marginTop: 26,
    marginBottom: 12,
    fontFamily: fontFamily.sans600,
    fontSize: 11.5,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    color: colors.textFaint,
  },
  acceptedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.ms,
    backgroundColor: colors.ink,
    borderRadius: 24,
    paddingTop: 15,
    paddingHorizontal: 18,
    paddingBottom: 15,
  },
  acceptedName: {
    fontFamily: fontFamily.sans600,
    fontSize: 15,
    color: '#fff',
  },
  acceptedSub: {
    marginTop: 2,
    fontFamily: fontFamily.sans400,
    fontSize: 12.5,
    color: 'rgba(255,255,255,.6)',
  },
  chatPill: {
    borderRadius: radius.pill,
    backgroundColor: colors.lime,
    paddingVertical: 9,
    paddingHorizontal: 15,
  },
  chatPillLabel: {
    fontFamily: fontFamily.sans600,
    fontSize: 13,
    color: colors.ink,
  },
  homeIndicator: {
    marginTop: 24,
    alignSelf: 'center',
    width: 140,
    height: 5,
    borderRadius: 999,
    backgroundColor: colors.ink,
  },
});
