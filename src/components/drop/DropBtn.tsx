import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { DropPress } from './DropPress';
import { dpColor, dpFont, dpGradient, dpRadius, dpShadow } from '../../theme/dropTokens';

type BtnKind = 'ink' | 'us' | 'coral' | 'soft';

interface DropBtnProps {
  children: React.ReactNode;
  onPress?: () => void;
  kind?: BtnKind;
  sub?: string;
  disabled?: boolean;
  style?: object;
  accessibilityLabel?: string;
}

/** Faithful port of Parallax's Btn.tsx — 4 palettes, min-height 58, pill radius, haptic tick on every press. */
export function DropBtn({ children, onPress, kind = 'ink', sub, disabled, style, accessibilityLabel }: DropBtnProps) {
  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    onPress?.();
  };

  const bg = disabled ? dpColor.sunken : kind === 'ink' ? dpColor.ink : kind === 'coral' ? dpColor.p1Deep : kind === 'soft' ? dpColor.surface : undefined;
  const fg = disabled ? dpColor.inkMute : kind === 'soft' ? dpColor.ink : '#fff';

  const inner = (
    <View
      style={[
        styles.inner,
        bg ? { backgroundColor: bg } : null,
        kind === 'soft' && !disabled ? { borderWidth: 1, borderColor: dpColor.line } : null,
      ]}
    >
      <Text style={[styles.label, { color: fg }]}>{children}</Text>
      {sub ? <Text style={[styles.sub, { color: fg, opacity: 0.8 }]}>{sub}</Text> : null}
    </View>
  );

  return (
    <DropPress
      onPress={disabled ? undefined : handlePress}
      disabled={disabled}
      accessibilityLabel={accessibilityLabel}
      style={[kind === 'us' && !disabled ? styles.gradientWrap : !disabled ? dpShadow.shadowSoft : null, style]}
    >
      {kind === 'us' && !disabled ? (
        <View style={styles.gradientWrap}>
          <LinearGradient colors={dpGradient.us.colors} locations={dpGradient.us.locations} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
          {inner}
        </View>
      ) : (
        inner
      )}
    </DropPress>
  );
}

const styles = StyleSheet.create({
  gradientWrap: { borderRadius: dpRadius.pill, overflow: 'hidden' },
  inner: {
    minHeight: 58,
    borderRadius: dpRadius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 12,
    gap: 2,
  },
  label: { fontFamily: dpFont.ui700, fontSize: 16.5, lineHeight: 20 },
  sub: { fontFamily: dpFont.mono, fontSize: 9.5, letterSpacing: 1.2, textTransform: 'uppercase' },
});
