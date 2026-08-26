import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, fontFamily, spacing } from '../../theme';
import { BottomSheet } from '../expenses/BottomSheet';
import { MemberAvatar } from './MemberAvatar';
import { useSplit } from '../../context/SplitContext';
import { useAuth } from '../../context/AuthContext';

interface AddKnownMembersSheetProps {
  visible: boolean;
  onClose: () => void;
  /** The split being built/edited — members get added directly to this group. */
  groupId: string | null;
}

/**
 * Lets the owner add people already known from their other splits straight
 * into this one, with a tap — no invite code needed. People new to MySpace
 * altogether are invited from the split's own dashboard once it exists.
 */
export function AddKnownMembersSheet({ visible, onClose, groupId }: AddKnownMembersSheetProps) {
  const { user } = useAuth();
  const { groups, membersFor, addKnownMember } = useSplit();
  const [addingId, setAddingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const currentMemberIds = new Set(groupId ? membersFor(groupId).map((m) => m.userId) : []);
  const peopleMap = new Map<string, string>();
  for (const g of groups) {
    for (const m of membersFor(g.id)) {
      if (m.userId !== user?.id) peopleMap.set(m.userId, m.name);
    }
  }
  const people = Array.from(peopleMap.entries())
    .map(([userId, name]) => ({ userId, name }))
    .filter((p) => !currentMemberIds.has(p.userId));

  const handleAdd = async (targetUserId: string) => {
    if (!groupId) return;
    setError(null);
    setAddingId(targetUserId);
    const { error: addError } = await addKnownMember(groupId, targetUserId);
    setAddingId(null);
    if (addError) setError(addError);
  };

  return (
    <BottomSheet visible={visible} onClose={onClose} maxHeightRatio={0.7}>
      <Text style={styles.title}>Add members</Text>
      <Text style={styles.hint}>People from your other splits — tap to add them here instantly.</Text>

      {people.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>
            No one else to add yet. Once this split is created, invite new people from its Invite option.
          </Text>
        </View>
      ) : (
        <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
          {people.map((p) => (
            <View key={p.userId} style={styles.row}>
              <View style={styles.rowLeft}>
                <MemberAvatar userId={p.userId} name={p.name} size={40} />
                <Text style={styles.rowName} numberOfLines={1}>
                  {p.name}
                </Text>
              </View>
              <Pressable
                onPress={() => handleAdd(p.userId)}
                disabled={addingId === p.userId}
                accessibilityRole="button"
                accessibilityLabel={`Add ${p.name}`}
              >
                <Text style={styles.addAction}>{addingId === p.userId ? 'Adding…' : 'Add'}</Text>
              </Pressable>
            </View>
          ))}
        </ScrollView>
      )}

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Pressable onPress={onClose} style={styles.doneButton} accessibilityRole="button" accessibilityLabel="Done">
        <Text style={styles.doneLabel}>Done</Text>
      </Pressable>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  title: {
    fontFamily: fontFamily.sans700,
    fontSize: 21,
    color: colors.splitInk,
  },
  hint: {
    fontFamily: fontFamily.sans400,
    fontSize: 13.5,
    lineHeight: 21,
    color: colors.splitInkFaint55,
  },
  empty: {
    paddingVertical: spacing.xl,
    alignItems: 'center',
  },
  emptyText: {
    fontFamily: fontFamily.sans400,
    fontSize: 13.5,
    lineHeight: 20,
    color: colors.splitInkFaint45,
    textAlign: 'center',
  },
  list: {
    maxHeight: 320,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    gap: spacing.ms,
  },
  rowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.ms,
    flex: 1,
    minWidth: 0,
  },
  rowName: {
    flex: 1,
    minWidth: 0,
    fontFamily: fontFamily.sans600,
    fontSize: 14.5,
    color: colors.splitInk,
  },
  addAction: {
    fontFamily: fontFamily.sans700,
    fontSize: 13.5,
    color: colors.splitAccent,
    paddingHorizontal: spacing.ms,
    paddingVertical: spacing.xs,
  },
  error: {
    fontFamily: fontFamily.sans500,
    fontSize: 12.5,
    color: colors.splitDangerFg,
  },
  doneButton: {
    width: '100%',
    alignItems: 'center',
    borderRadius: 999,
    backgroundColor: 'rgba(27,42,99,.06)',
    paddingVertical: 16,
  },
  doneLabel: {
    fontFamily: fontFamily.sans600,
    fontSize: 15.5,
    color: colors.splitInk,
  },
});
