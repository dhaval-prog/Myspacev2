import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { throwColor, throwFont, throwRadius } from '../../theme/throwTokens';
import type { ThrowLetter } from '../../types/throw';

interface LetterCardProps {
  letter: ThrowLetter;
  onPress: () => void;
}

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const min = Math.floor(ms / 60000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const days = Math.floor(hr / 24);
  return `${days}d ago`;
}

export function LetterCard({ letter, onPress }: LetterCardProps) {
  const unread = letter.direction === 'received' && letter.status === 'thrown';
  const preview = letter.messageText ? `"${letter.messageText.slice(0, 60)}${letter.messageText.length > 60 ? '…' : ''}"` : 'A handwritten letter';
  const directionLabel = letter.direction === 'sent' ? `To ${letter.counterpartName}` : `From ${letter.counterpartName}`;

  return (
    <Pressable onPress={onPress}>
      <View style={[styles.card, unread && styles.cardUnread]}>
        <View style={styles.foldIcon}>
          <View style={styles.foldLine} />
        </View>
        <View style={{ flex: 1 }}>
          <View style={styles.headerRow}>
            <Text style={styles.name}>{directionLabel}</Text>
            {unread && <View style={styles.unreadDot} />}
          </View>
          <Text style={styles.preview} numberOfLines={1}>
            {preview}
          </Text>
          <Text style={styles.meta}>
            {letter.direction === 'sent' ? letter.recipientCity : letter.senderCity} · {timeAgo(letter.createdAt)}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    marginBottom: 10,
    backgroundColor: throwColor.cardBg,
    borderRadius: throwRadius.card,
    borderWidth: 1,
    borderColor: throwColor.cardBorder,
  },
  cardUnread: { borderColor: throwColor.clay, borderWidth: 1.5 },
  foldIcon: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: throwColor.claySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  foldLine: {
    width: 18,
    height: 12,
    borderTopWidth: 1.5,
    borderColor: throwColor.clayDeep,
    transform: [{ rotate: '0deg' }],
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  name: { fontFamily: throwFont.ui700, fontSize: 14.5, color: throwColor.ink },
  unreadDot: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: throwColor.unread },
  preview: { fontFamily: throwFont.hand500, fontSize: 16, color: throwColor.inkSoft, marginTop: 2 },
  meta: { fontFamily: throwFont.ui400, fontSize: 11, color: throwColor.inkMute, marginTop: 3 },
});
