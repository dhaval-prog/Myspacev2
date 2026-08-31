import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fontFamily, noOutline, radius, spacing } from '../../theme';
import { Icon } from '../../components/Icon';
import { FriendAvatar } from '../../components/friends/FriendAvatar';
import { useFriends } from '../../context/FriendsContext';

const LOCK_ICON = 'M6 11V8a6 6 0 0 1 12 0v3M5 11h14v9H5z';

/** Match found / send request (6p-4) — establishes the gate: chat does not exist yet. */
export function MatchFoundScreen() {
  const insets = useSafeAreaInsets();
  const { matchFound, matchRelationship, goHome, sendRequest, openChatWithUser } = useFriends();
  const [message, setMessage] = useState('Hey! Adding you on MySpace 👋');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (!matchFound) return null;

  const submit = async () => {
    setSubmitting(true);
    setError(null);
    const result = await sendRequest(message);
    setSubmitting(false);
    if (result.error) setError(result.error);
  };

  const relationshipNote =
    matchRelationship === 'self'
      ? 'That’s your own code.'
      : matchRelationship === 'already_friends'
        ? `You and ${matchFound.name.split(' ')[0]} are already friends.`
        : matchRelationship === 'already_pending'
          ? 'A friend request is already pending between you.'
          : null;

  return (
    <View style={styles.screen}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[styles.scroll, { paddingTop: insets.top + spacing.xl }]}>
        <FriendAvatar userId={matchFound.userId} name={matchFound.name} size={104} avatarUrl={matchFound.avatarUrl} />
        <Text style={styles.name}>{matchFound.name}</Text>
        {matchFound.username && <Text style={styles.meta}>@{matchFound.username}</Text>}

        {relationshipNote ? (
          <View style={styles.relationshipCard}>
            <Text style={styles.relationshipText}>{relationshipNote}</Text>
          </View>
        ) : (
          <>
            <View style={styles.introCard}>
              <Text style={styles.introEyebrow}>SAY HI WITH YOUR REQUEST</Text>
              <TextInput
                value={message}
                onChangeText={setMessage}
                multiline
                placeholder="Say hi…"
                placeholderTextColor={colors.textFaint}
                style={[styles.introInput, noOutline]}
              />
            </View>

            <View style={styles.lockNotice}>
              <Icon path={LOCK_ICON} color={colors.textMuted} size={16} strokeWidth={1.8} />
              <Text style={styles.lockText}>
                Chat unlocks once {matchFound.name.split(' ')[0]} accepts. Until then they'll only see your name and message.
              </Text>
            </View>

            {error && <Text style={styles.error}>{error}</Text>}
          </>
        )}
      </ScrollView>

      <View style={[styles.pinned, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}>
        {matchRelationship === 'already_friends' ? (
          <Pressable onPress={() => openChatWithUser(matchFound.userId)} style={styles.primaryButton}>
            <Text style={styles.primaryLabel}>Message {matchFound.name.split(' ')[0]}</Text>
          </Pressable>
        ) : matchRelationship === 'none' ? (
          <Pressable onPress={submit} disabled={submitting} style={[styles.primaryButton, submitting && styles.primaryButtonDisabled]}>
            <Text style={styles.primaryLabel}>{submitting ? 'Sending…' : 'Send friend request'}</Text>
          </Pressable>
        ) : null}
        <Pressable onPress={goHome} accessibilityRole="button" accessibilityLabel="Not now">
          <Text style={styles.notNow}>{matchRelationship === 'none' ? 'Not now' : 'Back'}</Text>
        </Pressable>
      </View>
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
    paddingBottom: spacing.xxl,
    alignItems: 'center',
    gap: spacing.ms,
  },
  name: {
    marginTop: spacing.sm,
    fontFamily: fontFamily.sans700,
    fontSize: 29,
    lineHeight: 32,
    letterSpacing: -0.7,
    color: colors.textPrimary,
  },
  meta: {
    fontFamily: fontFamily.mono500,
    fontSize: 14,
    color: colors.textSecondary,
  },
  relationshipCard: {
    marginTop: spacing.lg,
    width: '100%',
    borderRadius: radius.md,
    backgroundColor: '#fff',
    padding: spacing.xl,
    alignItems: 'center',
  },
  relationshipText: {
    fontFamily: fontFamily.sans500,
    fontSize: 14.5,
    lineHeight: 20,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  introCard: {
    marginTop: spacing.lg,
    width: '100%',
    borderRadius: radius.lg,
    backgroundColor: '#fff',
    padding: spacing.xl,
    gap: 8,
  },
  introEyebrow: {
    fontFamily: fontFamily.mono500,
    fontSize: 11,
    letterSpacing: 1.3,
    textTransform: 'uppercase',
    color: colors.textMuted,
  },
  introInput: {
    fontFamily: fontFamily.sans400,
    fontSize: 15,
    lineHeight: 21.75,
    color: colors.textSecondary,
    minHeight: 44,
  },
  lockNotice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    width: '100%',
    borderRadius: radius.md,
    backgroundColor: 'rgba(22,33,12,0.06)',
    padding: spacing.lg,
  },
  lockText: {
    flex: 1,
    fontFamily: fontFamily.sans400,
    fontSize: 13,
    lineHeight: 18.85,
    color: colors.textMuted,
  },
  error: {
    fontFamily: fontFamily.sans500,
    fontSize: 12.5,
    color: colors.danger,
  },
  pinned: {
    paddingHorizontal: 26,
    paddingTop: spacing.ms,
    alignItems: 'center',
    gap: spacing.ms,
  },
  primaryButton: {
    width: '100%',
    borderRadius: radius.pill,
    backgroundColor: colors.ink,
    paddingVertical: 20,
    alignItems: 'center',
  },
  primaryButtonDisabled: {
    opacity: 0.6,
  },
  primaryLabel: {
    fontFamily: fontFamily.sans600,
    fontSize: 16,
    color: colors.lime,
  },
  notNow: {
    fontFamily: fontFamily.sans500,
    fontSize: 14,
    color: colors.textSecondary,
  },
});
