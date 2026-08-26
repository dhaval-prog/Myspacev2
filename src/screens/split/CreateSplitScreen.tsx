import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fontFamily, noOutline, spacing } from '../../theme';
import { Icon } from '../../components/Icon';
import { MemberAvatar } from '../../components/split/MemberAvatar';
import { InviteSplitSheet } from '../../components/split/InviteSplitSheet';
import { useSplit } from '../../context/SplitContext';
import { useAuth } from '../../context/AuthContext';
import { SPLIT_CATEGORIES } from '../../data/splitCategories';
import type { SplitGroup } from '../../types/split';

const BACK_ICON = 'M15 5l-7 7 7 7';
const LINK_ICON = 'M9 15l6-6M10 7l1.3-1.3a3.5 3.5 0 0 1 5 5L15 12M14 17l-1.3 1.3a3.5 3.5 0 0 1-5-5L9 12';
const QR_ICON = 'M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM15 15h2v2h-2zM19 15h1v1M15 19h1v1M19 19h1v1';
const PLUS_ICON = 'M12 6v12M6 12h12';

type SplitMode = 'equal' | 'percentage' | 'custom' | 'shares';
const MODE_CARDS: { key: SplitMode; label: string; note: string }[] = [
  { key: 'equal', label: 'Equal', note: 'Everyone pays the same' },
  { key: 'percentage', label: 'Percentage', note: 'e.g. 50 / 30 / 20' },
  { key: 'custom', label: 'Exact Amount', note: 'Assign amounts yourself' },
  { key: 'shares', label: 'Shares', note: '1 share, 2 shares…' },
];

const CURRENCIES = [
  { symbol: '₹', code: 'INR' },
  { symbol: '$', code: 'USD' },
  { symbol: '€', code: 'EUR' },
];
const WHO_OPTIONS: { key: 'anyone' | 'owner'; label: string }[] = [
  { key: 'anyone', label: 'Everyone' },
  { key: 'owner', label: 'Admin only' },
];

/** Create a new split group — name, category, members, default split rule, and preferences. */
export function CreateSplitScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { createGroup, updateGroup, openGroup, membersFor, goHome } = useSplit();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState(SPLIT_CATEGORIES[0].label);
  const [splitMode, setSplitMode] = useState<SplitMode>('equal');
  const [currency, setCurrency] = useState('₹');
  const [whoCanAdd, setWhoCanAdd] = useState<'anyone' | 'owner'>('anyone');
  const [remind, setRemind] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draftGroup, setDraftGroup] = useState<SplitGroup | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);

  const canCreate = name.trim().length > 0 && !saving;
  const catDef = SPLIT_CATEGORIES.find((c) => c.label === category) ?? SPLIT_CATEGORIES[0];
  const formInput = { name, description, category, currency, splitMode, whoCanAdd, remindSettlements: remind };
  const members = draftGroup ? membersFor(draftGroup.id) : [{ userId: user?.id ?? 'you', name: 'You' }];

  const ensureDraftGroup = async (): Promise<SplitGroup | null> => {
    if (draftGroup) return draftGroup;
    if (!name.trim()) return null;
    const group = await createGroup(formInput);
    if (group) setDraftGroup(group);
    return group;
  };

  const openInvite = async () => {
    const group = await ensureDraftGroup();
    if (group) setInviteOpen(true);
  };

  const create = async () => {
    if (!canCreate) return;
    setSaving(true);
    if (draftGroup) {
      await updateGroup(draftGroup.id, formInput);
      openGroup(draftGroup.id);
    } else {
      const group = await createGroup(formInput);
      if (group) openGroup(group.id);
    }
    setSaving(false);
  };

  const modeDef = MODE_CARDS.find((m) => m.key === splitMode)!;
  const previewValue = (index: number): string => {
    const n = members.length;
    if (splitMode === 'equal') return `1/${n}`;
    if (splitMode === 'percentage') return `${Math.round(100 / n)}%`;
    if (splitMode === 'shares') return '1 share';
    return 'Set later';
  };

  return (
    <View style={styles.screen}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
        <Pressable onPress={goHome} style={styles.iconButton} accessibilityRole="button" accessibilityLabel="Back">
          <Icon path={BACK_ICON} color={colors.splitInk} size={19} strokeWidth={2} />
        </Pressable>
        <View>
          <Text style={styles.headerTitle}>Add New Split</Text>
          <Text style={styles.headerMeta}>A space for shared expenses</Text>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <Text style={styles.label}>SPLIT NAME</Text>
        <View style={styles.nameCard}>
          <LinearGradient colors={colors.splitGradient as [string, string, ...string[]]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.nameIcon}>
            <Icon path={catDef.icon} color="#fff" size={20} strokeWidth={1.8} />
          </LinearGradient>
          <View style={styles.nameInputs}>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="Name this split"
              placeholderTextColor={colors.splitInkFaint45}
              style={[styles.nameInput, noOutline]}
            />
            <TextInput
              value={description}
              onChangeText={setDescription}
              placeholder="Add a description (optional)"
              placeholderTextColor={colors.splitInkFaint45}
              style={[styles.descInput, noOutline]}
            />
          </View>
        </View>

        <Text style={styles.label}>CATEGORY</Text>
        <View style={styles.catRow}>
          {SPLIT_CATEGORIES.map((c) => {
            const on = category === c.label;
            const content = (
              <>
                <Icon path={c.icon} color={on ? '#fff' : colors.splitInk} size={15} strokeWidth={1.8} />
                <Text style={[styles.catChipLabel, on && styles.catChipLabelOn]}>{c.label}</Text>
              </>
            );
            return on ? (
              <Pressable key={c.label} onPress={() => setCategory(c.label)}>
                <LinearGradient colors={colors.splitGradient as [string, string, ...string[]]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.catChip}>
                  {content}
                </LinearGradient>
              </Pressable>
            ) : (
              <Pressable key={c.label} onPress={() => setCategory(c.label)} style={[styles.catChip, styles.catChipOff]}>
                {content}
              </Pressable>
            );
          })}
        </View>

        <View style={styles.membersHeaderRow}>
          <Text style={styles.label}>MEMBERS</Text>
          <Text style={styles.memberCount}>{members.length} {members.length === 1 ? 'person' : 'people'}</Text>
        </View>
        <View style={styles.membersCard}>
          {members.map((m) => {
            const mine = m.userId === (user?.id ?? 'you');
            const content = <Text style={[styles.memberChipLabel, mine && styles.memberChipLabelOn]}>{m.name}</Text>;
            return mine ? (
              <LinearGradient key={m.userId} colors={colors.splitGradient as [string, string, ...string[]]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.memberChip}>
                {content}
              </LinearGradient>
            ) : (
              <View key={m.userId} style={[styles.memberChip, styles.memberChipOff]}>
                {content}
              </View>
            );
          })}
          <Pressable
            onPress={openInvite}
            disabled={!name.trim()}
            style={[styles.addMemberChip, !name.trim() && styles.addMemberChipDisabled]}
            accessibilityRole="button"
            accessibilityLabel="Add a member"
          >
            <Icon path={PLUS_ICON} color={colors.splitAccent} size={13} strokeWidth={2.4} />
            <Text style={styles.addMemberLabel}>Add</Text>
          </Pressable>
        </View>
        <View style={styles.inviteRow}>
          <Pressable
            onPress={openInvite}
            disabled={!name.trim()}
            style={[styles.inviteButton, !name.trim() && styles.inviteButtonDisabled]}
            accessibilityRole="button"
            accessibilityLabel="Invite link"
          >
            <Icon path={LINK_ICON} color={colors.splitAccent} size={17} strokeWidth={1.8} />
            <Text style={styles.inviteButtonLabel}>Invite link</Text>
          </Pressable>
          <Pressable
            onPress={openInvite}
            disabled={!name.trim()}
            style={[styles.inviteButton, !name.trim() && styles.inviteButtonDisabled]}
            accessibilityRole="button"
            accessibilityLabel="QR code"
          >
            <Icon path={QR_ICON} color={colors.splitAccent} size={17} strokeWidth={1.8} />
            <Text style={styles.inviteButtonLabel}>QR code</Text>
          </Pressable>
        </View>

        <Text style={styles.label}>DEFAULT SPLIT</Text>
        <View style={styles.modeGrid}>
          {MODE_CARDS.map((m) => {
            const on = splitMode === m.key;
            const content = (
              <>
                <View style={styles.modeCardTop}>
                  <View style={[styles.modeDot, on && styles.modeDotOn]} />
                  <Text style={[styles.modeCardLabel, on && styles.modeCardLabelOn]}>{m.label}</Text>
                </View>
                <Text style={[styles.modeCardNote, on && styles.modeCardNoteOn]}>{m.note}</Text>
              </>
            );
            return on ? (
              <Pressable key={m.key} onPress={() => setSplitMode(m.key)} style={styles.modeCardWrap}>
                <LinearGradient colors={colors.splitGradient as [string, string, ...string[]]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.modeCard}>
                  {content}
                </LinearGradient>
              </Pressable>
            ) : (
              <Pressable key={m.key} onPress={() => setSplitMode(m.key)} style={[styles.modeCardWrap, styles.modeCard, styles.modeCardOff]}>
                {content}
              </Pressable>
            );
          })}
        </View>

        <View style={styles.previewCard}>
          <View style={styles.previewHeader}>
            <Text style={styles.previewTitle}>{modeDef.label} split</Text>
            <Text style={styles.previewNote}>{modeDef.note}</Text>
          </View>
          <View style={styles.previewRows}>
            {members.map((m, i) => (
              <View key={m.userId} style={styles.previewRow}>
                <MemberAvatar userId={m.userId} name={m.name} size={30} />
                <Text style={styles.previewName} numberOfLines={1}>
                  {m.name}
                </Text>
                <View style={styles.previewValuePill}>
                  <Text style={styles.previewValueText}>{previewValue(i)}</Text>
                </View>
              </View>
            ))}
          </View>
        </View>

        <Text style={styles.label}>PREFERENCES</Text>
        <View style={styles.prefsCard}>
          <View style={styles.prefRow}>
            <Text style={styles.prefLabel}>Currency</Text>
            <View style={styles.prefChips}>
              {CURRENCIES.map((c) => {
                const on = currency === c.symbol;
                const label = `${c.symbol} ${c.code}`;
                return on ? (
                  <Pressable key={c.code} onPress={() => setCurrency(c.symbol)}>
                    <LinearGradient colors={colors.splitGradient as [string, string, ...string[]]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.miniChip}>
                      <Text style={[styles.miniChipLabel, styles.miniChipLabelOn]}>{label}</Text>
                    </LinearGradient>
                  </Pressable>
                ) : (
                  <Pressable key={c.code} onPress={() => setCurrency(c.symbol)} style={styles.miniChip}>
                    <Text style={styles.miniChipLabel}>{label}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
          <View style={[styles.prefRow, styles.prefRowBorder]}>
            <Text style={styles.prefLabel}>Who can add expenses</Text>
            <View style={styles.prefChips}>
              {WHO_OPTIONS.map((w) => {
                const on = whoCanAdd === w.key;
                return on ? (
                  <Pressable key={w.key} onPress={() => setWhoCanAdd(w.key)}>
                    <LinearGradient colors={colors.splitGradient as [string, string, ...string[]]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.miniChip}>
                      <Text style={[styles.miniChipLabel, styles.miniChipLabelOn]}>{w.label}</Text>
                    </LinearGradient>
                  </Pressable>
                ) : (
                  <Pressable key={w.key} onPress={() => setWhoCanAdd(w.key)} style={styles.miniChip}>
                    <Text style={styles.miniChipLabel}>{w.label}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
          <View style={styles.prefRow}>
            <View>
              <Text style={styles.prefLabel}>Settlement reminders</Text>
              <Text style={styles.prefSubNote}>Nudge before month end</Text>
            </View>
            <Pressable onPress={() => setRemind((v) => !v)} accessibilityRole="switch" accessibilityState={{ checked: remind }}>
              {remind ? (
                <LinearGradient colors={colors.splitGradient as [string, string, ...string[]]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.toggleTrack}>
                  <View style={[styles.toggleKnob, styles.toggleKnobOn]} />
                </LinearGradient>
              ) : (
                <View style={styles.toggleTrackOff}>
                  <View style={styles.toggleKnob} />
                </View>
              )}
            </Pressable>
          </View>
        </View>

        <Text style={styles.footnote}>You can change all of this later — create the split and start adding expenses.</Text>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}>
        <Pressable onPress={create} disabled={!canCreate}>
          <LinearGradient
            colors={colors.splitGradient as [string, string, ...string[]]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={[styles.createButton, !canCreate && styles.createButtonDisabled]}
          >
            <Text style={styles.createLabel}>{saving ? 'Creating…' : 'Create Split'}</Text>
          </LinearGradient>
        </Pressable>
      </View>

      <InviteSplitSheet visible={inviteOpen} onClose={() => setInviteOpen(false)} group={draftGroup} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.splitBg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.ms,
    paddingHorizontal: spacing.xxxl,
    paddingBottom: spacing.md,
  },
  iconButton: {
    width: 46,
    height: 46,
    borderRadius: 15,
    backgroundColor: colors.splitSurface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontFamily: fontFamily.sans700,
    fontSize: 21,
    letterSpacing: -0.2,
    color: colors.splitInk,
  },
  headerMeta: {
    fontFamily: fontFamily.sans400,
    fontSize: 12,
    color: colors.splitInkFaint45,
  },
  scroll: {
    paddingHorizontal: spacing.xxxl,
    paddingBottom: 40,
  },
  label: {
    marginTop: spacing.lg,
    marginBottom: spacing.xs,
    fontFamily: fontFamily.sans600,
    fontSize: 12.5,
    letterSpacing: 0.8,
    color: colors.splitInkFaint5,
  },
  nameCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.ms,
    backgroundColor: colors.splitSurface,
    borderRadius: 20,
    padding: spacing.md,
  },
  nameIcon: {
    width: 46,
    height: 46,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nameInputs: {
    flex: 1,
    gap: 2,
  },
  nameInput: {
    fontFamily: fontFamily.sans600,
    fontSize: 16,
    color: colors.splitInk,
    paddingVertical: 2,
  },
  descInput: {
    fontFamily: fontFamily.sans400,
    fontSize: 12.5,
    color: colors.splitInkFaint55,
    paddingVertical: 2,
  },
  catRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
  },
  catChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    paddingVertical: 9,
    paddingHorizontal: 14,
  },
  catChipOff: {
    backgroundColor: colors.splitSurface,
  },
  catChipLabel: {
    fontFamily: fontFamily.sans600,
    fontSize: 13,
    color: colors.splitInk,
  },
  catChipLabelOn: {
    color: '#fff',
  },
  membersHeaderRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
  },
  memberCount: {
    fontFamily: fontFamily.sans600,
    fontSize: 12.5,
    color: colors.splitInkFaint45,
  },
  membersCard: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    backgroundColor: colors.splitSurface,
    borderRadius: 22,
    padding: spacing.md,
  },
  memberChip: {
    borderRadius: 999,
    paddingVertical: 9,
    paddingHorizontal: 15,
  },
  memberChipOff: {
    backgroundColor: colors.splitInkFaint08,
  },
  memberChipLabel: {
    fontFamily: fontFamily.sans600,
    fontSize: 13,
    color: colors.splitInk,
  },
  memberChipLabelOn: {
    color: '#fff',
  },
  addMemberChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: 999,
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderWidth: 1.4,
    borderColor: colors.splitInkFaint30,
    borderStyle: 'dashed',
  },
  addMemberChipDisabled: {
    opacity: 0.4,
  },
  addMemberLabel: {
    fontFamily: fontFamily.sans600,
    fontSize: 12.5,
    color: colors.splitAccent,
  },
  inviteRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  inviteButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    borderRadius: 999,
    backgroundColor: colors.splitSurface,
    paddingVertical: 13,
  },
  inviteButtonDisabled: {
    opacity: 0.4,
  },
  inviteButtonLabel: {
    fontFamily: fontFamily.sans700,
    fontSize: 13.5,
    color: colors.splitAccent,
  },
  modeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  modeCardWrap: {
    flexBasis: '48%',
    flexGrow: 1,
  },
  modeCard: {
    borderRadius: 18,
    padding: spacing.md,
    gap: 4,
  },
  modeCardOff: {
    backgroundColor: colors.splitSurface,
  },
  modeCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  modeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.splitInkFaint30,
  },
  modeDotOn: {
    backgroundColor: '#fff',
  },
  modeCardLabel: {
    fontFamily: fontFamily.sans600,
    fontSize: 14,
    color: colors.splitInk,
  },
  modeCardLabelOn: {
    color: '#fff',
  },
  modeCardNote: {
    fontFamily: fontFamily.sans400,
    fontSize: 11,
    color: colors.splitInkFaint45,
  },
  modeCardNoteOn: {
    color: 'rgba(255,255,255,.75)',
  },
  previewCard: {
    marginTop: spacing.xs,
    backgroundColor: colors.splitSurface,
    borderRadius: 22,
    padding: spacing.md,
    gap: spacing.ms,
  },
  previewHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: spacing.ms,
  },
  previewTitle: {
    fontFamily: fontFamily.sans700,
    fontSize: 14.5,
    color: colors.splitInk,
  },
  previewNote: {
    fontFamily: fontFamily.sans500,
    fontSize: 11.5,
    color: colors.splitInkFaint45,
  },
  previewRows: {
    gap: spacing.sm,
  },
  previewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.ms,
  },
  previewName: {
    flex: 1,
    minWidth: 0,
    fontFamily: fontFamily.sans600,
    fontSize: 14,
    color: colors.splitInk,
  },
  previewValuePill: {
    borderRadius: 999,
    backgroundColor: colors.splitAccentSoftBg,
    paddingVertical: 5,
    paddingHorizontal: 12,
  },
  previewValueText: {
    fontFamily: fontFamily.sans700,
    fontSize: 12.5,
    color: colors.splitAccent,
  },
  prefsCard: {
    backgroundColor: colors.splitSurface,
    borderRadius: 22,
    paddingHorizontal: spacing.lg,
  },
  prefRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
  },
  prefRowBorder: {
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.splitInkFaint07,
  },
  prefLabel: {
    fontFamily: fontFamily.sans600,
    fontSize: 14.5,
    color: colors.splitInk,
  },
  prefSubNote: {
    marginTop: 2,
    fontFamily: fontFamily.sans400,
    fontSize: 11.5,
    color: colors.splitInkFaint45,
  },
  prefChips: {
    flexDirection: 'row',
    gap: 6,
  },
  miniChip: {
    borderRadius: 999,
    paddingVertical: 7,
    paddingHorizontal: 13,
    backgroundColor: colors.splitInkFaint08,
  },
  miniChipLabel: {
    fontFamily: fontFamily.sans600,
    fontSize: 12.5,
    color: colors.splitInk,
  },
  miniChipLabelOn: {
    color: '#fff',
  },
  toggleTrack: {
    width: 46,
    height: 27,
    borderRadius: 999,
    padding: 3,
    justifyContent: 'center',
  },
  toggleTrackOff: {
    width: 46,
    height: 27,
    borderRadius: 999,
    backgroundColor: colors.splitInkFaint09,
    padding: 3,
    justifyContent: 'center',
  },
  toggleKnob: {
    width: 21,
    height: 21,
    borderRadius: 11,
    backgroundColor: '#fff',
  },
  toggleKnobOn: {
    transform: [{ translateX: 19 }],
  },
  footnote: {
    marginTop: spacing.md,
    fontFamily: fontFamily.sans400,
    fontSize: 12.5,
    lineHeight: 20,
    color: colors.splitInkFaint42,
  },
  footer: {
    paddingHorizontal: spacing.xxxl,
    paddingTop: spacing.xs,
    backgroundColor: colors.splitBg,
  },
  createButton: {
    borderRadius: 999,
    paddingVertical: 20,
    alignItems: 'center',
  },
  createButtonDisabled: {
    opacity: 0.45,
  },
  createLabel: {
    fontFamily: fontFamily.sans700,
    fontSize: 16.5,
    color: '#fff',
  },
});
