import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, fontFamily, noOutline, radius, spacing } from '../../theme';
import { Icon } from '../../components/Icon';
import { LockIcon } from '../../components/icons/LockIcon';
import { FriendAvatar } from '../../components/friends/FriendAvatar';
import { useFriends } from '../../context/FriendsContext';

const BACK_ICON = 'M15 5l-7 7 7 7';

function formatDisplayCode(code: string): string {
  return code.length > 3 ? `${code.slice(0, 3)}·${code.slice(3)}` : code;
}

/** Match found / send request (6p-4) — establishes the gate: chat does not exist yet. */
export function MatchFoundScreen() {
  const insets = useSafeAreaInsets();
  const { matchFound, matchCode, mutualFriendCount, matchRelationship, goAdd, goHome, sendRequest, openChatWithUser } = useFriends();
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
    <LinearGradient
      colors={colors.friendsCanvas as [string, string, ...string[]]}
      locations={colors.friendsCanvasStops as [number, number, ...number[]]}
      start={{ x: 0.5, y: 0 }}
      end={{ x: 0.5, y: 1 }}
      style={styles.screen}
    >
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[styles.scroll, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable onPress={goAdd} style={styles.backButton} accessibilityRole="button" accessibilityLabel="Back">
          <Icon path={BACK_ICON} color={colors.textPrimary} size={19} strokeWidth={2} />
        </Pressable>

        <View style={styles.body}>
          <FriendAvatar
            userId={matchFound.userId}
            name={matchFound.name}
            size={104}
            radius={38}
            avatarUrl={matchFound.avatarUrl}
            colorOverride={{ bg: colors.lime, fg: colors.ink }}
            initialsFontFamily={fontFamily.sans800}
            initialsFontSize={36}
          />
          <Text style={styles.name}>{matchFound.name}</Text>
          {matchFound.username && (
            <Text style={styles.meta}>
              @{matchFound.username}
              {matchCode ? ` · ${formatDisplayCode(matchCode)}` : ''}
            </Text>
          )}

          {relationshipNote ? (
            <View style={styles.relationshipCard}>
              <Text style={styles.relationshipText}>{relationshipNote}</Text>
            </View>
          ) : (
            <>
              {mutualFriendCount !== null ? (
                <View style={styles.statRow}>
                  <View style={styles.statCard}>
                    <Text style={styles.statValue}>{mutualFriendCount}</Text>
                    <Text style={styles.statLabel}>{mutualFriendCount === 1 ? 'mutual friend' : 'mutual friends'}</Text>
                  </View>
                </View>
              ) : null}

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
                <LockIcon color={colors.textMuted} size={18} strokeWidth={1.7} />
                <Text style={styles.lockText}>
                  Chat unlocks once {matchFound.name.split(' ')[0]} accepts. Until then they'll only see your name and message.
                </Text>
              </View>

              {error && <Text style={styles.error}>{error}</Text>}
            </>
          )}
        </View>
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
        <View style={styles.homeIndicator} />
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  scroll: {
    paddingHorizontal: 26,
    paddingBottom: spacing.xxl,
  },
  backButton: {
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
  body: {
    marginTop: 30,
    alignItems: 'center',
  },
  name: {
    marginTop: 20,
    fontFamily: fontFamily.sans700,
    fontSize: 29,
    lineHeight: 31.9,
    letterSpacing: -0.725,
    color: colors.textPrimary,
    textAlign: 'center',
  },
  meta: {
    marginTop: 7,
    fontFamily: fontFamily.mono500,
    fontSize: 14,
    color: colors.ink55,
  },
  relationshipCard: {
    marginTop: spacing.lg,
    width: '100%',
    borderRadius: radius.md,
    backgroundColor: colors.surface86,
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
  statRow: {
    marginTop: 22,
    width: '100%',
    flexDirection: 'row',
    gap: 10,
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.surface86,
    borderRadius: 22,
    paddingVertical: 16,
    paddingHorizontal: 14,
    alignItems: 'center',
  },
  statValue: {
    fontFamily: fontFamily.sans700,
    fontSize: 21,
    color: colors.textPrimary,
  },
  statLabel: {
    marginTop: 3,
    fontFamily: fontFamily.sans400,
    fontSize: 12,
    color: colors.ink55,
  },
  introCard: {
    marginTop: 16,
    width: '100%',
    borderRadius: 26,
    backgroundColor: colors.surface86,
    paddingTop: 18,
    paddingHorizontal: 20,
    paddingBottom: 18,
    gap: 8,
  },
  introEyebrow: {
    fontFamily: fontFamily.sans600,
    fontSize: 11.5,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    color: colors.textFaint,
  },
  introInput: {
    fontFamily: fontFamily.sans400,
    fontSize: 15,
    lineHeight: 21.75,
    color: colors.ink75,
    minHeight: 44,
  },
  lockNotice: {
    marginTop: 16,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 11,
    width: '100%',
    borderRadius: radius.md,
    backgroundColor: colors.ink06,
    paddingVertical: 15,
    paddingHorizontal: 18,
  },
  lockText: {
    flex: 1,
    marginTop: 1,
    fontFamily: fontFamily.sans400,
    fontSize: 13,
    lineHeight: 18.85,
    color: colors.ink62,
  },
  error: {
    marginTop: spacing.sm,
    fontFamily: fontFamily.sans500,
    fontSize: 12.5,
    color: colors.danger,
  },
  pinned: {
    paddingHorizontal: 26,
    paddingTop: spacing.ms,
    alignItems: 'center',
  },
  primaryButton: {
    width: '100%',
    borderRadius: radius.pill,
    backgroundColor: colors.ink,
    paddingVertical: 20,
    alignItems: 'center',
    shadowColor: colors.ink,
    shadowOpacity: 0.26,
    shadowOffset: { width: 0, height: 12 },
    shadowRadius: 26,
    elevation: 4,
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
    marginTop: 12,
    fontFamily: fontFamily.sans600,
    fontSize: 14.5,
    color: colors.textMuted,
  },
  homeIndicator: {
    marginTop: 16,
    width: 140,
    height: 5,
    borderRadius: 999,
    backgroundColor: colors.ink,
  },
});
