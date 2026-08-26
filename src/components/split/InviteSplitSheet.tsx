import React, { useEffect, useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { colors, fontFamily, spacing } from '../../theme';
import { BottomSheet } from '../expenses/BottomSheet';
import { useSplit } from '../../context/SplitContext';
import { formatJoinId } from '../../utils/expensesFormat';
import type { SplitGroup } from '../../types/split';

const QR_BOX = 196;

type Tab = 'QR code' | 'Email' | 'WhatsApp';
const TABS: Tab[] = ['QR code', 'Email', 'WhatsApp'];

interface InviteSplitSheetProps {
  visible: boolean;
  onClose: () => void;
  /** Overrides the context's focused group — needed on the Create screen, which invites for a draft group before ever focusing it. */
  group?: SplitGroup | null;
  /** Skip the tabs and share options, showing just the QR — for the hero card's scan-frame shortcut. */
  qrOnly?: boolean;
}

/** Owner-only invite sheet for a split group — QR code, plus sharing the join code via email or WhatsApp. */
export function InviteSplitSheet({ visible, onClose, group, qrOnly }: InviteSplitSheetProps) {
  const { focusedGroup } = useSplit();
  const target = group ?? focusedGroup;
  const joinId = target ? formatJoinId(target.rid) : '—';
  const [tab, setTab] = useState<Tab>('QR code');

  useEffect(() => {
    if (visible) setTab('QR code');
  }, [visible]);

  const shareMessage = `Join "${target?.name ?? 'my split'}" on MySpace — use code ${joinId} or scan the QR to join instantly.`;

  const shareViaEmail = () => {
    Linking.openURL(`mailto:?subject=${encodeURIComponent(`Join ${target?.name ?? 'my split'} on MySpace`)}&body=${encodeURIComponent(shareMessage)}`);
  };

  const shareViaWhatsApp = () => {
    Linking.openURL(`https://wa.me/?text=${encodeURIComponent(shareMessage)}`);
  };

  return (
    <BottomSheet visible={visible} onClose={onClose}>
      <Text style={styles.title}>Invite to {target?.name ?? ''}</Text>

      {!qrOnly && (
        <View style={styles.tabRow}>
          {TABS.map((t) => {
            const on = t === tab;
            return (
              <Pressable key={t} onPress={() => setTab(t)} style={[styles.tab, on && styles.tabOn]}>
                <Text style={[styles.tabLabel, on && styles.tabLabelOn]}>{t}</Text>
              </Pressable>
            );
          })}
        </View>
      )}

      {(qrOnly || tab === 'QR code') && (
        <View style={styles.qrWrap}>
          {!qrOnly && <Text style={styles.hint}>Scan this code to join this split instantly, or share the code below.</Text>}
          <View style={styles.qrBox}>
            <QRCode value={target?.rid ?? '10000000001'} size={QR_BOX - spacing.ms * 2} color={colors.splitInk} backgroundColor="transparent" />
          </View>
          <Text style={styles.qrId}>{joinId}</Text>
        </View>
      )}

      {!qrOnly && tab === 'Email' && (
        <View style={{ gap: spacing.ms }}>
          <Text style={styles.hint}>Open your email app with the join code and a link ready to send.</Text>
          <Pressable onPress={shareViaEmail} style={styles.shareButton}>
            <Text style={styles.shareLabel}>Share via Email</Text>
          </Pressable>
        </View>
      )}

      {!qrOnly && tab === 'WhatsApp' && (
        <View style={{ gap: spacing.ms }}>
          <Text style={styles.hint}>Open WhatsApp with the join code and a link ready to send.</Text>
          <Pressable onPress={shareViaWhatsApp} style={styles.shareButton}>
            <Text style={styles.shareLabel}>Share via WhatsApp</Text>
          </Pressable>
        </View>
      )}

      {!qrOnly && (
        <Pressable onPress={onClose} style={styles.doneButton}>
          <Text style={styles.doneLabel}>Done</Text>
        </Pressable>
      )}
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
  tabRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    backgroundColor: '#F3F3F8',
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
    backgroundColor: colors.splitInk,
  },
  tabLabel: {
    fontFamily: fontFamily.sans500,
    fontSize: 13,
    color: colors.splitInkFaint55,
  },
  tabLabelOn: {
    fontFamily: fontFamily.sans600,
    color: '#fff',
  },
  qrWrap: {
    alignItems: 'center',
    gap: spacing.ms,
  },
  qrBox: {
    width: QR_BOX,
    height: QR_BOX,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.ms,
    backgroundColor: '#F3F3F8',
    borderRadius: 20,
  },
  qrId: {
    fontFamily: fontFamily.sans500,
    fontSize: 11.5,
    letterSpacing: 1.6,
    color: colors.splitInkFaint42,
  },
  shareButton: {
    width: '100%',
    borderRadius: 999,
    backgroundColor: colors.splitAccent,
    paddingVertical: 16,
    alignItems: 'center',
  },
  shareLabel: {
    fontFamily: fontFamily.sans600,
    fontSize: 15.5,
    color: '#fff',
  },
  doneButton: {
    width: '100%',
    borderRadius: 999,
    backgroundColor: 'rgba(27,42,99,.06)',
    paddingVertical: 16,
    alignItems: 'center',
  },
  doneLabel: {
    fontFamily: fontFamily.sans600,
    fontSize: 15.5,
    color: colors.splitInk,
  },
});
