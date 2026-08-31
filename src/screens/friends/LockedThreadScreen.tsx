import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fontFamily, radius, spacing } from '../../theme';
import { Icon } from '../../components/Icon';
import { FriendAvatar } from '../../components/friends/FriendAvatar';
import { useFriends } from '../../context/FriendsContext';

const BACK_ICON = 'M15 5l-7 7 7 7';
const LOCK_ICON = 'M6 11V8a6 6 0 0 1 12 0v3M5 11h14v9H5z';

/** What a pending, not-yet-accepted thread looks like (6p-8) — proves the gate. */
export function LockedThreadScreen() {
  const insets = useSafeAreaInsets();
  const { focusedPendingRequest, goChats, cancelRequest, nudge } = useFriends();
  const [nudged, setNudged] = useState(false);

  if (!focusedPendingRequest) return null;

  const sendNudge = async () => {
    await nudge(focusedPendingRequest.connectionId);
    setNudged(true);
    setTimeout(() => setNudged(false), 2400);
  };

  return (
    <View style={styles.screen}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
        <Pressable onPress={goChats} style={styles.iconButton} accessibilityRole="button" accessibilityLabel="Back">
          <Icon path={BACK_ICON} color="#fff" size={19} strokeWidth={2} />
        </Pressable>
        <FriendAvatar userId={focusedPendingRequest.userId} name={focusedPendingRequest.name} size={44} style={styles.avatarDim} />
        <View style={styles.headerText}>
          <Text style={styles.headerTitle}>{focusedPendingRequest.name}</Text>
          <Text style={styles.headerSub}>Request pending</Text>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <View style={styles.lockTile}>
          <Icon path={LOCK_ICON} color={colors.textMuted} size={34} strokeWidth={1.6} />
        </View>
        <Text style={styles.title}>Chat is locked</Text>
        <Text style={styles.body}>
          {focusedPendingRequest.name.split(' ')[0]} hasn't accepted yet. Your intro message is the only thing they can see for now.
        </Text>

        {focusedPendingRequest.introMessage && (
          <View style={styles.sentBubbleWrap}>
            <View style={styles.sentBubble}>
              <Text style={styles.sentBubbleText}>{focusedPendingRequest.introMessage}</Text>
            </View>
            <Text style={styles.sentFooter}>Sent · awaiting reply</Text>
          </View>
        )}

        <View style={styles.actionsRow}>
          <Pressable onPress={() => cancelRequest(focusedPendingRequest.connectionId)} style={styles.cancelButton}>
            <Text style={styles.cancelLabel}>Cancel request</Text>
          </Pressable>
          <Pressable onPress={sendNudge} style={styles.nudgeButton}>
            <Text style={styles.nudgeLabel}>{nudged ? 'Nudged!' : 'Nudge'}</Text>
          </Pressable>
        </View>
      </ScrollView>

      <View style={[styles.pinned, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}>
        <View style={styles.disabledComposer}>
          <Icon path={LOCK_ICON} color={colors.textDisabled} size={15} strokeWidth={1.8} />
          <Text style={styles.disabledComposerText}>Messaging unlocks after accept</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.pale,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.ms,
    paddingHorizontal: 22,
    paddingBottom: spacing.lg,
    backgroundColor: colors.ink,
    borderBottomLeftRadius: radius.organic - 4,
    borderBottomRightRadius: radius.organic - 4,
  },
  iconButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(255,255,255,.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarDim: {
    opacity: 0.55,
  },
  headerText: {
    flex: 1,
  },
  headerTitle: {
    fontFamily: fontFamily.sans600,
    fontSize: 16.5,
    color: '#fff',
  },
  headerSub: {
    fontFamily: fontFamily.sans400,
    fontSize: 12,
    color: 'rgba(255,255,255,.55)',
  },
  scroll: {
    flexGrow: 1,
    alignItems: 'center',
    paddingHorizontal: 26,
    paddingTop: 70,
    gap: spacing.ms,
  },
  lockTile: {
    width: 88,
    height: 88,
    borderRadius: 32,
    backgroundColor: 'rgba(22,33,12,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    marginTop: spacing.sm,
    fontFamily: fontFamily.sans700,
    fontSize: 24,
    lineHeight: 27.6,
    color: colors.textPrimary,
  },
  body: {
    maxWidth: 280,
    fontFamily: fontFamily.sans400,
    fontSize: 14.5,
    lineHeight: 21.75,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  sentBubbleWrap: {
    marginTop: spacing.lg,
    alignSelf: 'flex-end',
    alignItems: 'flex-end',
    maxWidth: '85%',
    gap: 4,
  },
  sentBubble: {
    backgroundColor: 'rgba(255,255,255,.7)',
    borderRadius: 22,
    borderBottomRightRadius: 7,
    paddingVertical: 13,
    paddingHorizontal: 16,
  },
  sentBubbleText: {
    fontFamily: fontFamily.sans400,
    fontSize: 14,
    lineHeight: 20,
    color: 'rgba(22,33,12,0.65)',
  },
  sentFooter: {
    fontFamily: fontFamily.mono500,
    fontSize: 10.5,
    color: colors.textFaint,
  },
  actionsRow: {
    marginTop: spacing.lg,
    width: '100%',
    flexDirection: 'row',
    gap: spacing.xs,
  },
  cancelButton: {
    flex: 1,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(22,33,12,0.07)',
    paddingVertical: 15,
    alignItems: 'center',
  },
  cancelLabel: {
    fontFamily: fontFamily.sans600,
    fontSize: 14,
    color: colors.textPrimary,
  },
  nudgeButton: {
    flex: 1,
    borderRadius: radius.pill,
    backgroundColor: colors.ink,
    paddingVertical: 15,
    alignItems: 'center',
  },
  nudgeLabel: {
    fontFamily: fontFamily.sans600,
    fontSize: 14,
    color: colors.lime,
  },
  pinned: {
    paddingHorizontal: 26,
    paddingTop: spacing.ms,
  },
  disabledComposer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,.55)',
    paddingVertical: 18,
  },
  disabledComposerText: {
    fontFamily: fontFamily.sans500,
    fontSize: 14.5,
    color: colors.textDisabled,
  },
});
