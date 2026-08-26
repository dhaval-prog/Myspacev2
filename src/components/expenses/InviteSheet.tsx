import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { colors, fontFamily, noOutline, spacing } from '../../theme';
import { BottomSheet } from './BottomSheet';
import { useExpenses } from '../../context/ExpensesContext';
import { formatJoinId } from '../../utils/expensesFormat';

type Tab = 'QR code' | 'Email' | 'Join ID';
const TABS: Tab[] = ['QR code', 'Email', 'Join ID'];

const QR_BOX = 196;

/** Invite sheet — QR code / email / join-ID tabs for adding someone to a card. */
export function InviteSheet() {
  const { inviteOpen, closeInvite, focusedCard } = useExpenses();
  const [tab, setTab] = useState<Tab>('QR code');
  const [mail, setMail] = useState('');
  const [sent, setSent] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (inviteOpen) {
      setTab('QR code');
      setMail('');
      setSent(false);
      setCopied(false);
    }
  }, [inviteOpen]);

  const joinId = focusedCard ? formatJoinId(focusedCard.rid) : '—';
  const mailValid = mail.includes('@');

  return (
    <BottomSheet visible={inviteOpen} onClose={closeInvite}>
      <Text style={styles.title}>Invite to {focusedCard?.label ?? ''}</Text>

      <View style={styles.tabRow}>
        {TABS.map((t) => {
          const on = t === tab;
          return (
            <Pressable
              key={t}
              onPress={() => {
                setTab(t);
                setSent(false);
                setCopied(false);
              }}
              style={[styles.tab, on && styles.tabOn]}
            >
              <Text style={[styles.tabLabel, on && styles.tabLabelOn]}>{t}</Text>
            </Pressable>
          );
        })}
      </View>

      {tab === 'QR code' && (
        <View style={styles.qrWrap}>
          <Text style={styles.qrHint}>Scan this code to join this card instantly.</Text>
          <View style={styles.qrBox}>
            <QRCode value={focusedCard?.rid ?? '10000000001'} size={QR_BOX - spacing.ms * 2} color="#111" backgroundColor="transparent" />
          </View>
          <Text style={styles.qrId}>{joinId}</Text>
        </View>
      )}

      {tab === 'Email' && (
        <View style={{ gap: spacing.sm }}>
          <Text style={styles.hint}>We'll email the join ID and a link to open this card.</Text>
          <Text style={styles.label}>Email</Text>
          <View style={styles.emailField}>
            <TextInput
              value={mail}
              onChangeText={(v) => {
                setMail(v);
                setSent(false);
              }}
              placeholder="contact@example.com"
              placeholderTextColor={colors.walletSheetTextFaint}
              autoCapitalize="none"
              keyboardType="email-address"
              style={[styles.emailInput, noOutline]}
            />
            <Pressable
              onPress={() => mailValid && setSent(true)}
              style={[styles.sendButton, { backgroundColor: mailValid ? '#111' : 'rgba(0,0,0,.35)' }]}
            >
              <Text style={styles.sendLabel}>{sent ? 'Sent ✓' : 'Send Invite'}</Text>
            </Pressable>
          </View>
        </View>
      )}

      {tab === 'Join ID' && (
        <View style={{ gap: spacing.ms }}>
          <Text style={styles.hint}>Share this join ID. Anyone who enters it can add expenses to this card only.</Text>
          <View style={styles.idBox}>
            <Text style={styles.idValue}>{joinId}</Text>
            <Text style={styles.idCaption}>JOIN ID</Text>
          </View>
          <Pressable onPress={() => setCopied(true)} style={styles.copyButton}>
            <Text style={styles.copyLabel}>{copied ? 'Copied ✓' : 'Copy join ID'}</Text>
          </Pressable>
        </View>
      )}

      <Pressable onPress={closeInvite} style={styles.doneButton}>
        <Text style={styles.doneLabel}>Done</Text>
      </Pressable>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  title: {
    fontFamily: fontFamily.sans700,
    fontSize: 21,
    color: colors.walletSheetTextPrimary,
  },
  tabRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    backgroundColor: colors.walletSheetMuted,
    borderRadius: 16,
    padding: 5,
  },
  tab: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 11,
    alignItems: 'center',
  },
  tabOn: {
    backgroundColor: '#111',
  },
  tabLabel: {
    fontFamily: fontFamily.sans500,
    fontSize: 13,
    color: colors.walletSheetTextSecondary,
  },
  tabLabelOn: {
    fontFamily: fontFamily.sans600,
    color: '#fff',
  },
  qrWrap: {
    alignItems: 'center',
    gap: spacing.ms,
  },
  qrHint: {
    textAlign: 'center',
    fontFamily: fontFamily.sans400,
    fontSize: 13.5,
    lineHeight: 21,
    color: colors.walletSheetTextSecondary,
  },
  qrBox: {
    width: QR_BOX,
    height: QR_BOX,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.ms,
    backgroundColor: colors.walletSheetFaint,
    borderRadius: 20,
    overflow: 'hidden',
  },
  qrId: {
    fontFamily: fontFamily.sans500,
    fontSize: 11.5,
    letterSpacing: 1.6,
    color: colors.walletSheetTextFaint,
  },
  hint: {
    fontFamily: fontFamily.sans400,
    fontSize: 13.5,
    lineHeight: 21,
    color: colors.walletSheetTextSecondary,
  },
  label: {
    fontFamily: fontFamily.sans500,
    fontSize: 12.5,
    color: colors.walletSheetTextSecondary,
  },
  emailField: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.walletSheetFaint,
    borderWidth: 1,
    borderColor: colors.walletSheetBorder,
    borderRadius: 16,
    paddingVertical: 6,
    paddingLeft: 16,
    paddingRight: 6,
  },
  emailInput: {
    flex: 1,
    minWidth: 0,
    fontFamily: fontFamily.sans500,
    fontSize: 14,
    color: colors.walletSheetTextPrimary,
    paddingVertical: 8,
  },
  sendButton: {
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  sendLabel: {
    fontFamily: fontFamily.sans600,
    fontSize: 13,
    color: '#fff',
  },
  idBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.walletSheetMuted,
    borderRadius: 18,
    paddingVertical: 16,
    paddingHorizontal: 18,
  },
  idValue: {
    fontFamily: fontFamily.mono500,
    fontSize: 19,
    letterSpacing: 1.9,
    color: colors.walletSheetTextPrimary,
  },
  idCaption: {
    fontFamily: fontFamily.sans500,
    fontSize: 11.5,
    letterSpacing: 1.6,
    color: colors.walletSheetTextFaint,
  },
  copyButton: {
    width: '100%',
    borderRadius: 999,
    backgroundColor: colors.walletSheetMuted,
    paddingVertical: 15,
    alignItems: 'center',
  },
  copyLabel: {
    fontFamily: fontFamily.sans600,
    fontSize: 14.5,
    color: colors.walletSheetTextPrimary,
  },
  doneButton: {
    width: '100%',
    borderRadius: 999,
    backgroundColor: colors.walletAccentBlue,
    paddingVertical: 16,
    alignItems: 'center',
  },
  doneLabel: {
    fontFamily: fontFamily.sans600,
    fontSize: 15.5,
    color: '#fff',
  },
});
