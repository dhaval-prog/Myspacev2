import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fontFamily, noOutline, radius, spacing } from '../../theme';
import { Icon } from '../../components/Icon';
import { FriendAvatar } from '../../components/friends/FriendAvatar';
import { useFriends } from '../../context/FriendsContext';

const BACK_ICON = 'M15 5l-7 7 7 7';
const CHECK_ICON = 'M5 12.5 10 17.5 19 7';

/** Name a group, pick which friends to add, then create it. */
export function CreateGroupScreen() {
  const insets = useSafeAreaInsets();
  const { friends, goChats, createGroup } = useFriends();
  const [name, setName] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggle = (userId: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  };

  const canSubmit = name.trim().length > 0 && selected.size > 0 && !submitting;

  const submit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    const result = await createGroup(name, Array.from(selected));
    setSubmitting(false);
    if (result.error) setError(result.error);
  };

  return (
    <LinearGradient
      colors={colors.friendsCanvas as [string, string, ...string[]]}
      locations={colors.friendsCanvasStops as [number, number, ...number[]]}
      start={{ x: 0.5, y: 0 }}
      end={{ x: 0.5, y: 1 }}
      style={styles.screen}
    >
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[styles.scroll, { paddingTop: insets.top + spacing.md }]}>
        <Text style={styles.title}>New group</Text>
        <Text style={styles.sub}>Name it, then pick who's in.</Text>

        <View style={styles.section}>
          <Text style={styles.label}>Group name</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="e.g. Weekend trip"
            placeholderTextColor={colors.placeholder}
            style={[styles.input, noOutline]}
            accessibilityLabel="Group name"
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Members to add</Text>
          {friends.length === 0 ? (
            <Text style={styles.emptyText}>Add a friend first — you'll need at least one to start a group.</Text>
          ) : (
            <View style={styles.list}>
              {friends.map((f) => {
                const on = selected.has(f.userId);
                return (
                  <Pressable
                    key={f.connectionId}
                    onPress={() => toggle(f.userId)}
                    style={[styles.row, on && styles.rowOn]}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: on }}
                    accessibilityLabel={f.name}
                  >
                    <FriendAvatar userId={f.userId} name={f.name} size={44} avatarUrl={f.avatarUrl} />
                    <Text style={styles.rowName}>{f.name}</Text>
                    <View style={[styles.checkbox, on && styles.checkboxOn]}>
                      {on && <Icon path={CHECK_ICON} color={colors.lime} size={14} strokeWidth={2.4} />}
                    </View>
                  </Pressable>
                );
              })}
            </View>
          )}
        </View>

        {error && <Text style={styles.error}>{error}</Text>}

        <Pressable
          onPress={submit}
          disabled={!canSubmit}
          style={[styles.createButton, { backgroundColor: canSubmit ? colors.lime : colors.pressWash }]}
          accessibilityRole="button"
          accessibilityLabel="Create group"
        >
          <Text style={[styles.createLabel, { color: canSubmit ? colors.ink : 'rgba(22,33,12,0.35)' }]}>
            {submitting ? 'Creating…' : 'Create group'}
          </Text>
        </Pressable>
      </ScrollView>

      <View style={[styles.pinned, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}>
        <Pressable onPress={goChats} style={styles.backCircle} accessibilityRole="button" accessibilityLabel="Back">
          <Icon path={BACK_ICON} color={colors.textPrimary} size={18} strokeWidth={2} />
        </Pressable>
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
    paddingBottom: spacing.lg,
    gap: spacing.xl,
  },
  title: {
    fontFamily: fontFamily.sans700,
    fontSize: 30,
    lineHeight: 31.5,
    letterSpacing: -0.9,
    color: colors.textPrimary,
  },
  sub: {
    marginTop: -spacing.lg,
    fontFamily: fontFamily.sans400,
    fontSize: 13.5,
    color: colors.textSecondary,
  },
  section: {
    gap: spacing.xs,
  },
  label: {
    fontFamily: fontFamily.sans600,
    fontSize: 11.5,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: colors.textFaint,
  },
  input: {
    backgroundColor: 'rgba(255,255,255,.86)',
    borderRadius: radius.pill,
    paddingVertical: 15,
    paddingHorizontal: 20,
    fontFamily: fontFamily.sans400,
    fontSize: 15,
    color: colors.textPrimary,
  },
  emptyText: {
    fontFamily: fontFamily.sans400,
    fontSize: 13,
    color: colors.textSecondary,
  },
  list: {
    gap: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.ms,
    backgroundColor: 'rgba(255,255,255,.7)',
    borderRadius: 20,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  rowOn: {
    backgroundColor: 'rgba(255,255,255,.95)',
  },
  rowName: {
    flex: 1,
    fontFamily: fontFamily.sans600,
    fontSize: 14.5,
    color: colors.textPrimary,
  },
  checkbox: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 1.5,
    borderColor: 'rgba(22,33,12,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxOn: {
    backgroundColor: colors.ink,
    borderColor: colors.ink,
  },
  error: {
    fontFamily: fontFamily.sans500,
    fontSize: 12.5,
    color: colors.danger,
  },
  createButton: {
    borderRadius: radius.pill,
    paddingVertical: 19,
    alignItems: 'center',
  },
  createLabel: {
    fontFamily: fontFamily.sans600,
    fontSize: 16,
  },
  pinned: {
    paddingHorizontal: 26,
    paddingTop: spacing.ms,
  },
  backCircle: {
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
});
