import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fontFamily, spacing } from '../../theme';
import { Icon } from '../../components/Icon';
import { MemberAvatar } from '../../components/split/MemberAvatar';
import { useFriends } from '../../context/FriendsContext';

const CLOSE_ICON = 'M6 6l12 12M18 6L6 18';

/** Shown right after a code lookup or QR scan resolves to a real account. */
export function MatchFoundScreen() {
  const insets = useSafeAreaInsets();
  const { matchFound, goAdd, sendRequest } = useFriends();
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (!matchFound) return null;

  const submit = async () => {
    setSubmitting(true);
    setError(null);
    const result = await sendRequest();
    setSubmitting(false);
    if (result.error) setError(result.error);
  };

  return (
    <View style={styles.screen}>
      <View style={[styles.topRow, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable onPress={goAdd} style={styles.iconButton} accessibilityRole="button" accessibilityLabel="Close">
          <Icon path={CLOSE_ICON} color={colors.friendsInk} size={18} strokeWidth={2} />
        </Pressable>
      </View>

      <View style={styles.body}>
        <Text style={styles.eyebrow}>Match found</Text>
        <MemberAvatar userId={matchFound.userId} name={matchFound.name} size={96} />
        <Text style={styles.name}>{matchFound.name}</Text>
        {matchFound.username && <Text style={styles.username}>@{matchFound.username}</Text>}

        {error && <Text style={styles.error}>{error}</Text>}

        <Pressable onPress={submit} disabled={submitting} style={[styles.submitButton, { opacity: submitting ? 0.6 : 1 }]}>
          <Text style={styles.submitLabel}>{submitting ? 'Sending…' : 'Send friend request'}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.friendsBg,
  },
  topRow: {
    paddingHorizontal: spacing.xxxl,
  },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 16,
    backgroundColor: colors.friendsSurface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.xxxl,
  },
  eyebrow: {
    fontFamily: fontFamily.sans600,
    fontSize: 13,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: colors.friendsAccent,
    marginBottom: spacing.ms,
  },
  name: {
    fontFamily: fontFamily.sans700,
    fontSize: 22,
    color: colors.friendsInk,
    marginTop: spacing.sm,
  },
  username: {
    fontFamily: fontFamily.sans400,
    fontSize: 14,
    color: colors.friendsInkFaint45,
  },
  error: {
    marginTop: spacing.sm,
    fontFamily: fontFamily.sans500,
    fontSize: 12.5,
    color: colors.splitDangerFg,
  },
  submitButton: {
    marginTop: spacing.xl,
    width: '100%',
    borderRadius: 999,
    backgroundColor: colors.friendsAccent,
    paddingVertical: 16,
    alignItems: 'center',
  },
  submitLabel: {
    fontFamily: fontFamily.sans600,
    fontSize: 15.5,
    color: '#fff',
  },
});
