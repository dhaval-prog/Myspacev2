import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { dpColor, dpFont, dpRadius } from '../../theme/dropTokens';

interface DropChipProps {
  children: React.ReactNode;
  you?: boolean;
  soft?: boolean;
  selected?: boolean;
  accessibilityLabel?: string;
}

/** Small tag pill — coral for "you", periwinkle for "partner", solid or soft-tinted. */
export function DropChip({ children, you = false, soft = false, selected, accessibilityLabel }: DropChipProps) {
  const deep = you ? dpColor.p1Deep : dpColor.p2Deep;
  const bg = soft ? (you ? 'rgba(255,142,122,0.14)' : 'rgba(157,149,245,0.16)') : deep;
  const fg = soft ? deep : '#fff';

  return (
    <View style={[styles.chip, { backgroundColor: bg }]} accessibilityLabel={accessibilityLabel} accessibilityState={selected !== undefined ? { selected } : undefined}>
      <Text style={[styles.label, { color: fg }]}>{children}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: { flexDirection: 'row', gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: dpRadius.pill, alignSelf: 'flex-start' },
  label: { fontFamily: dpFont.ui600, fontSize: 13.5, lineHeight: 17 },
});
