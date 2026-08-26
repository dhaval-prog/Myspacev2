import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fontFamily, noOutline, spacing } from '../../theme';
import { Icon } from '../../components/Icon';
import { useSplit } from '../../context/SplitContext';
import { SPLIT_CATEGORIES } from '../../data/splitCategories';

const BACK_ICON = 'M15 5l-7 7 7 7';

type SplitMode = 'equal' | 'percentage' | 'custom';
const MODE_CARDS: { key: SplitMode; label: string; note: string }[] = [
  { key: 'equal', label: 'Equally', note: 'Same share for everyone' },
  { key: 'percentage', label: 'Percentage', note: 'Set a % per person' },
  { key: 'custom', label: 'Custom', note: 'Enter exact amounts' },
];

const CURRENCIES = ['₹', '$', '€'];
const WHO_OPTIONS: { key: 'anyone' | 'owner'; label: string }[] = [
  { key: 'anyone', label: 'Anyone' },
  { key: 'owner', label: 'Just me' },
];

/** Create a new split group — name, category, default split rule, and preferences. */
export function CreateSplitScreen() {
  const insets = useSafeAreaInsets();
  const { createGroup, goHome } = useSplit();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState(SPLIT_CATEGORIES[0].label);
  const [splitMode, setSplitMode] = useState<SplitMode>('equal');
  const [currency, setCurrency] = useState('₹');
  const [whoCanAdd, setWhoCanAdd] = useState<'anyone' | 'owner'>('anyone');
  const [remind, setRemind] = useState(false);
  const [saving, setSaving] = useState(false);

  const canCreate = name.trim().length > 0 && !saving;
  const catDef = SPLIT_CATEGORIES.find((c) => c.label === category) ?? SPLIT_CATEGORIES[0];

  const create = async () => {
    if (!canCreate) return;
    setSaving(true);
    await createGroup({ name, description, category, currency, splitMode, whoCanAdd, remindSettlements: remind });
    setSaving(false);
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
          <View style={[styles.nameIcon, { backgroundColor: catDef.tile }]}>
            <Icon path={catDef.icon} color={colors.splitInk} size={20} strokeWidth={1.8} />
          </View>
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
            return (
              <Pressable key={c.label} onPress={() => setCategory(c.label)} style={[styles.catChip, on && styles.catChipOn]}>
                <Icon path={c.icon} color={on ? '#fff' : colors.splitInk} size={15} strokeWidth={1.8} />
                <Text style={[styles.catChipLabel, on && styles.catChipLabelOn]}>{c.label}</Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={styles.label}>MEMBERS</Text>
        <View style={styles.membersCard}>
          <Text style={styles.membersNote}>You'll be the owner. Invite others from this split's dashboard once it's created — they join instantly with a code or QR.</Text>
        </View>

        <Text style={styles.label}>DEFAULT SPLIT</Text>
        <View style={styles.modeGrid}>
          {MODE_CARDS.map((m) => {
            const on = splitMode === m.key;
            return (
              <Pressable key={m.key} onPress={() => setSplitMode(m.key)} style={[styles.modeCard, on && styles.modeCardOn]}>
                <View style={styles.modeCardTop}>
                  <View style={[styles.modeDot, on && styles.modeDotOn]} />
                  <Text style={[styles.modeCardLabel, on && styles.modeCardLabelOn]}>{m.label}</Text>
                </View>
                <Text style={[styles.modeCardNote, on && styles.modeCardNoteOn]}>{m.note}</Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={styles.label}>PREFERENCES</Text>
        <View style={styles.prefsCard}>
          <View style={styles.prefRow}>
            <Text style={styles.prefLabel}>Currency</Text>
            <View style={styles.prefChips}>
              {CURRENCIES.map((c) => {
                const on = currency === c;
                return (
                  <Pressable key={c} onPress={() => setCurrency(c)} style={[styles.miniChip, on && styles.miniChipOn]}>
                    <Text style={[styles.miniChipLabel, on && styles.miniChipLabelOn]}>{c}</Text>
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
                return (
                  <Pressable key={w.key} onPress={() => setWhoCanAdd(w.key)} style={[styles.miniChip, on && styles.miniChipOn]}>
                    <Text style={[styles.miniChipLabel, on && styles.miniChipLabelOn]}>{w.label}</Text>
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
            <Pressable
              onPress={() => setRemind((v) => !v)}
              style={[styles.toggleTrack, remind && styles.toggleTrackOn]}
              accessibilityRole="switch"
              accessibilityState={{ checked: remind }}
            >
              <View style={[styles.toggleKnob, remind && styles.toggleKnobOn]} />
            </Pressable>
          </View>
        </View>

        <Text style={styles.footnote}>You can change all of this later — create the split and start adding expenses.</Text>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}>
        <Pressable onPress={create} disabled={!canCreate} style={[styles.createButton, !canCreate && styles.createButtonDisabled]}>
          <Text style={styles.createLabel}>{saving ? 'Creating…' : 'Create Split'}</Text>
        </Pressable>
      </View>
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
    backgroundColor: colors.splitSurface,
  },
  catChipOn: {
    backgroundColor: colors.splitInk,
  },
  catChipLabel: {
    fontFamily: fontFamily.sans600,
    fontSize: 13,
    color: colors.splitInk,
  },
  catChipLabelOn: {
    color: '#fff',
  },
  membersCard: {
    backgroundColor: colors.splitSurface,
    borderRadius: 22,
    padding: spacing.lg,
  },
  membersNote: {
    fontFamily: fontFamily.sans400,
    fontSize: 12.5,
    lineHeight: 19,
    color: colors.splitInkFaint55,
  },
  modeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  modeCard: {
    flexBasis: '48%',
    flexGrow: 1,
    borderRadius: 18,
    backgroundColor: colors.splitSurface,
    padding: spacing.md,
    gap: 4,
  },
  modeCardOn: {
    backgroundColor: colors.splitInk,
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
    backgroundColor: colors.splitAccent,
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
    color: 'rgba(255,255,255,.6)',
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
  miniChipOn: {
    backgroundColor: colors.splitInk,
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
    backgroundColor: colors.splitInkFaint09,
    padding: 3,
    justifyContent: 'center',
  },
  toggleTrackOn: {
    backgroundColor: colors.splitAccent,
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
    backgroundColor: colors.splitAccent,
    paddingVertical: 20,
    alignItems: 'center',
  },
  createButtonDisabled: {
    backgroundColor: 'rgba(250,46,110,.4)',
  },
  createLabel: {
    fontFamily: fontFamily.sans700,
    fontSize: 16.5,
    color: '#fff',
  },
});
