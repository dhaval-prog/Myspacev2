import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { colors, fontFamily, spacing } from '../../theme';
import { BottomSheet } from '../expenses/BottomSheet';
import { useSplit } from '../../context/SplitContext';
import { formatJoinId } from '../../utils/expensesFormat';
import type { SplitGroup } from '../../types/split';

const QR_BOX = 196;

interface InviteSplitSheetProps {
  visible: boolean;
  onClose: () => void;
  /** Overrides the context's focused group — needed on the Create screen, which invites for a draft group before ever focusing it. */
  group?: SplitGroup | null;
}

/** Owner-only invite sheet for a split group — a real, scannable QR encoding the group's join code. */
export function InviteSplitSheet({ visible, onClose, group }: InviteSplitSheetProps) {
  const { focusedGroup } = useSplit();
  const target = group ?? focusedGroup;
  const joinId = target ? formatJoinId(target.rid) : '—';

  return (
    <BottomSheet visible={visible} onClose={onClose}>
      <Text style={styles.title}>Invite to {target?.name ?? ''}</Text>
      <Text style={styles.hint}>Scan this code to join this split instantly, or share the code below.</Text>
      <View style={styles.qrWrap}>
        <View style={styles.qrBox}>
          <QRCode value={target?.rid ?? '10000000001'} size={QR_BOX - spacing.ms * 2} color={colors.splitInk} backgroundColor="transparent" />
        </View>
        <Text style={styles.qrId}>{joinId}</Text>
      </View>
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
});
