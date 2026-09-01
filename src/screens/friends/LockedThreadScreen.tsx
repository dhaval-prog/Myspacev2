import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fontFamily, radius, spacing } from '../../theme';
import { LockIcon } from '../../components/icons/LockIcon';
import { FriendAvatar } from '../../components/friends/FriendAvatar';
import { useFriends } from '../../context/FriendsContext';

const HEADER_AVATAR_COLOR = { bg: colors.onInkChip, fg: '#FFFFFF' };

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
    <LinearGradient
      colors={colors.friendsChatCanvas as [string, string, ...string[]]}
      locations={colors.friendsChatCanvasStops as [number, number, ...number[]]}
      start={{ x: 0.5, y: 0 }}
      end={{ x: 0.5, y: 1 }}
      style={styles.screen}
    >
      <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
        <Pressable onPress={goChats} style={styles.iconButton} accessibilityRole="button" accessibilityLabel="Back">
          <Text style={styles.backArrow}>←</Text>
        </Pressable>
        <FriendAvatar
          userId={focusedPendingRequest.userId}
          name={focusedPendingRequest.name}
          size={44}
          colorOverride={HEADER_AVATAR_COLOR}
          avatarUrl={focusedPendingRequest.avatarUrl}
        />
        <View style={styles.headerText}>
          <Text style={styles.headerTitle}>{focusedPendingRequest.name}</Text>
          <Text style={styles.headerSub}>Request pending</Text>
        </View>
      </View>

      <View style={styles.body}>
        <View style={styles.lockTile}>
          <LockIcon size={38} color={colors.ink55} strokeWidth={1.5} withKeyhole />
        </View>
        <Text style={styles.title}>Chat is locked</Text>
        <Text style={styles.bodyCopy}>
          {focusedPendingRequest.name.split(' ')[0]} hasn't accepted yet. Your intro message is the only thing they can see for now.
        </Text>

        {focusedPendingRequest.introMessage && (
          <View style={styles.sentBubble}>
            <Text style={styles.sentBubbleText}>{focusedPendingRequest.introMessage}</Text>
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
      </View>

      <View style={[styles.pinned, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}>
        <View style={styles.disabledComposer}>
          <LockIcon size={18} color={colors.textDisabled} strokeWidth={1.7} />
          <Text style={styles.disabledComposerText}>Messaging unlocks after accept</Text>
        </View>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
    paddingHorizontal: 22,
    paddingBottom: 18,
    backgroundColor: colors.ink,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
  },
  iconButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.onInkBtn,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backArrow: {
    fontSize: 19,
    color: '#FFFFFF',
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
    marginTop: 2,
    color: colors.onInk55,
  },
  body: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 26,
    paddingTop: 70,
  },
  lockTile: {
    width: 88,
    height: 88,
    borderRadius: 32,
    backgroundColor: colors.divider,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    marginTop: 24,
    fontFamily: fontFamily.sans700,
    fontSize: 24,
    lineHeight: 27.6,
    letterSpacing: -0.48,
    color: colors.textPrimary,
  },
  bodyCopy: {
    marginTop: 10,
    maxWidth: 280,
    fontFamily: fontFamily.sans400,
    fontSize: 14.5,
    lineHeight: 21.75,
    color: colors.textMuted,
    textAlign: 'center',
  },
  sentBubble: {
    marginTop: 26,
    width: '100%',
    backgroundColor: colors.surface70,
    borderRadius: 22,
    borderBottomRightRadius: 7,
    paddingVertical: 14,
    paddingHorizontal: 17,
  },
  sentBubbleText: {
    fontFamily: fontFamily.sans400,
    fontSize: 14.5,
    lineHeight: 20.3,
    color: colors.ink65,
  },
  sentFooter: {
    marginTop: 6,
    textAlign: 'right',
    fontFamily: fontFamily.mono500,
    fontSize: 10.5,
    color: colors.textDisabled,
  },
  actionsRow: {
    marginTop: 16,
    width: '100%',
    flexDirection: 'row',
    gap: 10,
  },
  cancelButton: {
    flex: 1,
    borderRadius: radius.pill,
    backgroundColor: colors.ink07,
    paddingVertical: 15,
    alignItems: 'center',
  },
  cancelLabel: {
    fontFamily: fontFamily.sans600,
    fontSize: 14.5,
    color: colors.ink70,
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
    fontSize: 14.5,
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
    backgroundColor: colors.surface55,
    paddingVertical: 18,
    paddingHorizontal: 20,
  },
  disabledComposerText: {
    fontFamily: fontFamily.sans400,
    fontSize: 14.5,
    color: colors.ink38,
  },
});
