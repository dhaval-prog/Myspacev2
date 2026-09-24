import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { dpColor, dpFont, dpRadius, dpShadow } from '../../theme/dropTokens';

interface DropTokProps {
  who: { initial: string; name?: string };
  size?: number;
  ring?: boolean;
  you?: boolean;
  decorative?: boolean;
}

/** Circular initial-avatar, used everywhere in place of a photo. */
export function DropTok({ who, size = 30, ring = false, you = false, decorative = false }: DropTokProps) {
  return (
    <View
      style={[
        {
          width: size,
          height: size,
          borderRadius: dpRadius.pill,
          backgroundColor: you ? dpColor.p1 : dpColor.p2,
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        },
        ring ? { borderWidth: 3, borderColor: dpColor.surface, ...dpShadow.shadow } : dpShadow.shadowSoft,
      ]}
      accessibilityRole={decorative ? undefined : 'image'}
      accessibilityLabel={decorative ? undefined : who.name ? `${who.name}'s avatar` : who.initial}
    >
      <Text style={[styles.initial, { fontSize: size * 0.5, lineHeight: size * 0.625 }]}>{who.initial}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  initial: { fontFamily: dpFont.disp, color: '#FFFFFF', includeFontPadding: false },
});
