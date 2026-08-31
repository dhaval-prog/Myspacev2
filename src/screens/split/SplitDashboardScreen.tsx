import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fontFamily, spacing } from '../../theme';
import { Icon } from '../../components/Icon';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { initialsOf } from '../../components/split/MemberAvatar';
import { InviteSplitSheet } from '../../components/split/InviteSplitSheet';
import { SplitMembersSheet } from '../../components/split/SplitMembersSheet';
import { useSplit } from '../../context/SplitContext';
import { SPLIT_EXPENSE_ICON_DEFAULT, SPLIT_EXPENSE_ICON_MAP } from '../../data/splitExpenseCategories';

const SCAN_ICON = 'M4 8V5.6A1.6 1.6 0 0 1 5.6 4H8M16 4h2.4A1.6 1.6 0 0 1 20 5.6V8M20 16v2.4a1.6 1.6 0 0 1-1.6 1.6H16M8 20H5.6A1.6 1.6 0 0 1 4 18.4V16M7 12h10';
const BACK_ICON = 'M15 5l-7 7 7 7';
const CHAT_ICON = 'M4 4h16v12H8l-4 4z';

/** One split group's dashboard: totals, balances, recent expenses. */
export function SplitDashboardScreen() {
  const insets = useSafeAreaInsets();
  const {
    focusedGroup,
    membersFor,
    expensesFor,
    balancesFor,
    goHome,
    goAdd,
    goItems,
    goSettle,
    goChat,
    askLeave,
    cancelLeave,
    leaveGroup,
    confirmLeaveOpen,
    deleteGroup,
  } = useSplit();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);
  const [membersOpen, setMembersOpen] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

  if (!focusedGroup) return null;

  const members = membersFor(focusedGroup.id);
  const expenses = expensesFor(focusedGroup.id);
  const totalSpent = expenses.reduce((s, e) => s + e.amount, 0);
  const balances = balancesFor(focusedGroup.id);
  const owed = balances.filter((b) => b.net > 0).reduce((s, b) => s + b.net, 0);
  const owe = balances.filter((b) => b.net < 0).reduce((s, b) => s - b.net, 0);
  const recent = expenses.slice(0, 6);

  return (
    <View style={styles.screen}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
        <Pressable onPress={goHome} style={styles.iconButton} accessibilityRole="button" accessibilityLabel="Back">
          <Icon path={BACK_ICON} color={colors.splitInk} size={19} strokeWidth={2} />
        </Pressable>
        <View style={styles.headerText}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {focusedGroup.name}
          </Text>
          <Text style={styles.headerMeta}>
            {members.length} {members.length === 1 ? 'person' : 'people'} · {focusedGroup.category || 'Split'}
          </Text>
        </View>
        <Pressable onPress={goChat} style={styles.iconButton} accessibilityRole="button" accessibilityLabel="Chat">
          <Icon path={CHAT_ICON} color={colors.splitInk} size={18} strokeWidth={1.8} />
        </Pressable>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <LinearGradient
          colors={colors.splitGradient as [string, string, ...string[]]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.hero}
        >
          <View style={styles.heroBlob} />
          {focusedGroup.isOwner && (
            <Pressable
              onPress={() => setQrOpen(true)}
              style={styles.scanButton}
              accessibilityRole="button"
              accessibilityLabel="Show invite QR code"
            >
              <Icon path={SCAN_ICON} color="#fff" size={21} strokeWidth={1.9} />
            </Pressable>
          )}
          <Text style={styles.heroLabel}>Total spent</Text>
          <Text style={styles.heroAmount}>₹{Math.round(totalSpent).toLocaleString('en-IN')}</Text>
          <View style={styles.heroTiles}>
            <View style={[styles.heroTile, { backgroundColor: 'rgba(255,255,255,.22)' }]}>
              <Text style={styles.heroTileLabel}>You are owed</Text>
              <Text style={styles.heroTileValue}>₹{Math.round(owed).toLocaleString('en-IN')}</Text>
            </View>
            <View style={[styles.heroTile, { backgroundColor: 'rgba(27,42,99,.22)' }]}>
              <Text style={styles.heroTileLabel}>You owe</Text>
              <Text style={styles.heroTileValue}>₹{Math.round(owe).toLocaleString('en-IN')}</Text>
            </View>
          </View>
        </LinearGradient>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
          <Pressable onPress={() => setMembersOpen(true)} style={styles.chip}>
            <Text style={styles.chipLabel}>Members</Text>
          </Pressable>
          <Pressable onPress={goChat} style={styles.chip}>
            <Text style={styles.chipLabel}>Chat</Text>
          </Pressable>
          <Pressable style={[styles.chip, styles.chipActive]}>
            <Text style={[styles.chipLabel, styles.chipLabelActive]}>Let's Split</Text>
          </Pressable>
          <Pressable onPress={() => setInviteOpen(true)} style={styles.chip}>
            <Text style={styles.chipLabel}>Invite</Text>
          </Pressable>
          {focusedGroup.isOwner ? (
            <Pressable onPress={() => setConfirmDeleteOpen(true)} style={styles.chip}>
              <Text style={styles.chipLabel}>Delete</Text>
            </Pressable>
          ) : (
            <Pressable onPress={askLeave} style={styles.chip}>
              <Text style={styles.chipLabel}>Leave</Text>
            </Pressable>
          )}
        </ScrollView>

        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>People</Text>
          <Pressable onPress={goSettle} accessibilityRole="button" accessibilityLabel="Settle up">
            <Text style={styles.settleLink}>Settle up</Text>
          </Pressable>
        </View>

        <View style={styles.rows}>
          {balances.length === 0 ? (
            <Text style={styles.emptyNote}>Everyone's settled up.</Text>
          ) : (
            balances.map((b) => {
              const owed = b.net > 0;
              return (
                <Pressable key={b.userId} onPress={goSettle} style={styles.personRow}>
                  {owed ? (
                    <LinearGradient
                      colors={colors.splitGradient as [string, string, ...string[]]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.personTile}
                    >
                      <Text style={[styles.personTileText, styles.personTileTextOn]}>{initialsOf(b.name)}</Text>
                    </LinearGradient>
                  ) : (
                    <View style={[styles.personTile, styles.personTileOff]}>
                      <Text style={styles.personTileText}>{initialsOf(b.name)}</Text>
                    </View>
                  )}
                  <View style={styles.personTextCol}>
                    <Text style={styles.personName}>{b.name}</Text>
                    <Text style={[styles.personNote, owed ? styles.notePositive : styles.noteNegative]}>{owed ? 'owes you' : 'you owe'}</Text>
                  </View>
                  <Text style={[styles.personAmt, owed ? styles.notePositive : styles.noteNegative]}>
                    ₹{Math.round(Math.abs(b.net)).toLocaleString('en-IN')}
                  </Text>
                </Pressable>
              );
            })
          )}
        </View>

        <Text style={[styles.sectionTitle, styles.sectionSpacer]}>Recent expenses</Text>
        <View style={styles.rows}>
          {recent.length === 0 ? (
            <Text style={styles.emptyNote}>No expenses yet. Add the first one below.</Text>
          ) : (
            recent.map((e) => {
              const iconPath = SPLIT_EXPENSE_ICON_MAP[e.category] ?? SPLIT_EXPENSE_ICON_DEFAULT;
              return (
                <View key={e.id} style={styles.expenseRow}>
                  <View style={styles.expenseIcon}>
                    <Icon path={iconPath} color={colors.splitAccent} size={18} strokeWidth={1.8} />
                  </View>
                  <View style={styles.expenseTextCol}>
                    <Text style={styles.expenseTitle} numberOfLines={1}>
                      {e.title}
                    </Text>
                    <Text style={styles.expenseMeta}>Paid by you</Text>
                  </View>
                  <Text style={styles.expenseAmt}>₹{Math.round(e.amount).toLocaleString('en-IN')}</Text>
                </View>
              );
            })
          )}
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}>
        <View style={styles.footerRow}>
          <Pressable onPress={goAdd} style={styles.addButton}>
            <Text style={styles.addButtonLabel}>+ Add Expense</Text>
          </Pressable>
          <Pressable onPress={goItems} style={styles.itemsButton}>
            <Text style={styles.itemsButtonLabel}>By items</Text>
          </Pressable>
        </View>
      </View>

      <InviteSplitSheet visible={inviteOpen} onClose={() => setInviteOpen(false)} />
      <InviteSplitSheet visible={qrOpen} onClose={() => setQrOpen(false)} qrOnly />
      <SplitMembersSheet visible={membersOpen} onClose={() => setMembersOpen(false)} groupName={focusedGroup.name} members={members} />
      <ConfirmDialog
        visible={confirmLeaveOpen}
        title="Leave split?"
        message={`You'll lose access to "${focusedGroup.name}" and its expenses. You can rejoin later with an invite code.`}
        confirmLabel="Leave"
        cancelLabel="Cancel"
        destructive
        onConfirm={leaveGroup}
        onCancel={cancelLeave}
      />
      <ConfirmDialog
        visible={confirmDeleteOpen}
        title={`Delete ${focusedGroup.name}?`}
        message="All expenses, chat, and history in this split will be deleted permanently for everyone. This can't be undone."
        confirmLabel="Delete"
        cancelLabel="Cancel"
        destructive
        onConfirm={() => {
          setConfirmDeleteOpen(false);
          deleteGroup(focusedGroup.id);
        }}
        onCancel={() => setConfirmDeleteOpen(false)}
      />
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
    shadowColor: colors.splitInk,
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 18,
    elevation: 2,
  },
  headerText: {
    flex: 1,
    gap: 2,
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
    paddingBottom: 140,
    gap: spacing.xxl,
  },
  hero: {
    borderRadius: 32,
    padding: spacing.xxl,
    overflow: 'hidden',
    gap: 4,
    shadowColor: colors.splitAccent,
    shadowOpacity: 0.32,
    shadowOffset: { width: 0, height: 20 },
    shadowRadius: 44,
    elevation: 6,
  },
  heroBlob: {
    position: 'absolute',
    right: -40,
    top: -44,
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: 'rgba(255,255,255,.16)',
  },
  scanButton: {
    position: 'absolute',
    top: 18,
    right: 18,
    width: 44,
    height: 44,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,.26)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroLabel: {
    fontFamily: fontFamily.sans500,
    fontSize: 13,
    color: 'rgba(255,255,255,.8)',
  },
  heroAmount: {
    fontFamily: fontFamily.sans700,
    fontSize: 38,
    letterSpacing: -1,
    color: '#fff',
  },
  heroTiles: {
    marginTop: spacing.lg,
    flexDirection: 'row',
    gap: 10,
  },
  heroTile: {
    flex: 1,
    borderRadius: 20,
    padding: 14,
    gap: 4,
  },
  heroTileLabel: {
    fontFamily: fontFamily.sans500,
    fontSize: 11.5,
    color: 'rgba(255,255,255,.82)',
  },
  heroTileValue: {
    fontFamily: fontFamily.sans700,
    fontSize: 19,
    color: '#fff',
  },
  chipRow: {
    flexDirection: 'row',
    gap: 8,
  },
  chip: {
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderRadius: 999,
    backgroundColor: colors.splitSurface,
    shadowColor: colors.splitInk,
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 18,
    elevation: 1,
  },
  chipActive: {
    backgroundColor: colors.splitInk,
    shadowOpacity: 0,
    elevation: 0,
  },
  chipLabel: {
    fontFamily: fontFamily.sans600,
    fontSize: 12.5,
    color: colors.splitInkFaint5,
  },
  chipLabelActive: {
    color: '#fff',
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
  },
  sectionSpacer: {
    marginTop: -spacing.md,
  },
  sectionTitle: {
    fontFamily: fontFamily.sans700,
    fontSize: 17,
    color: colors.splitInk,
  },
  settleLink: {
    fontFamily: fontFamily.sans600,
    fontSize: 13,
    color: colors.splitAccent,
  },
  rows: {
    gap: spacing.xs,
  },
  emptyNote: {
    fontFamily: fontFamily.sans400,
    fontSize: 13,
    color: colors.splitInkFaint45,
  },
  personRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: colors.splitSurface,
    borderRadius: 22,
    padding: spacing.md,
  },
  personTile: {
    width: 46,
    height: 46,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  personTileOff: {
    backgroundColor: '#E9EAFB',
  },
  personTileText: {
    fontFamily: fontFamily.sans700,
    fontSize: 13.5,
    color: colors.splitInk,
  },
  personTileTextOn: {
    color: '#fff',
  },
  personTextCol: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  personName: {
    fontFamily: fontFamily.sans600,
    fontSize: 15,
    color: colors.splitInk,
  },
  personNote: {
    fontFamily: fontFamily.sans500,
    fontSize: 12,
  },
  notePositive: {
    color: colors.splitPositiveFg,
  },
  noteNegative: {
    color: colors.splitDangerFg,
  },
  personAmt: {
    fontFamily: fontFamily.sans700,
    fontSize: 15,
    color: colors.splitInk,
  },
  expenseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.ms,
    backgroundColor: colors.splitSurface,
    borderRadius: 22,
    padding: spacing.md,
  },
  expenseIcon: {
    width: 44,
    height: 44,
    borderRadius: 16,
    backgroundColor: colors.splitAccentSoftBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  expenseTextCol: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  expenseTitle: {
    fontFamily: fontFamily.sans600,
    fontSize: 15,
    color: colors.splitInk,
  },
  expenseMeta: {
    fontFamily: fontFamily.sans400,
    fontSize: 12,
    color: colors.splitInkFaint45,
  },
  expenseAmt: {
    fontFamily: fontFamily.sans700,
    fontSize: 15,
    color: colors.splitInk,
  },
  footer: {
    backgroundColor: colors.splitBg,
    paddingHorizontal: spacing.xxxl,
    paddingTop: spacing.ms,
  },
  footerRow: {
    flexDirection: 'row',
    gap: spacing.ms,
  },
  addButton: {
    flex: 1,
    borderRadius: 999,
    backgroundColor: colors.splitAccent,
    paddingVertical: 19,
    alignItems: 'center',
    shadowColor: colors.splitAccent,
    shadowOpacity: 0.34,
    shadowOffset: { width: 0, height: 14 },
    shadowRadius: 30,
    elevation: 4,
  },
  addButtonLabel: {
    fontFamily: fontFamily.sans700,
    fontSize: 15.5,
    color: '#fff',
  },
  itemsButton: {
    borderRadius: 999,
    backgroundColor: colors.splitSurface,
    paddingVertical: 19,
    paddingHorizontal: 22,
    shadowColor: colors.splitInk,
    shadowOpacity: 0.09,
    shadowOffset: { width: 0, height: 10 },
    shadowRadius: 24,
    elevation: 2,
  },
  itemsButtonLabel: {
    fontFamily: fontFamily.sans600,
    fontSize: 15.5,
    color: colors.splitInk,
  },
});
