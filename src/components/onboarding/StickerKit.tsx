import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Circle, Path, Pattern, Rect } from 'react-native-svg';
import { Icon } from '../Icon';
import { obColor, obFont, obRadius, obShadow } from '../../theme/onboardingTokens';

const BACK_PATH = 'M15 5l-7 7 7 7';

/** The cream dot-grid paper every onboarding screen sits on — tiled circles via SVG (not CSS
 * radial-gradient, which react-native-web supports but native doesn't), so it renders identically
 * on both. */
export function DotGridBackground({ color = obColor.ink, opacity = 0.07, size = 18 }: { color?: string; opacity?: number; size?: number }) {
  return (
    <Svg style={[styles.fill]} pointerEvents="none">
      <Pattern id="obDotGrid" x={0} y={0} width={size} height={size} patternUnits="userSpaceOnUse">
        <Circle cx={1} cy={1} r={1} fill={color} opacity={opacity} />
      </Pattern>
      <Rect x={0} y={0} width="100%" height="100%" fill="url(#obDotGrid)" />
    </Svg>
  );
}

interface StickerButtonProps {
  label: string;
  onPress: () => void;
  bg?: string;
  textColor?: string;
  shadowColor?: string;
  loading?: boolean;
  disabled?: boolean;
  icon?: 'forward' | 'none';
  style?: StyleProp<ViewStyle>;
}

/** The pill/rounded-rect CTA used everywhere: 2px ink border, hard offset shadow, Bricolage 800,
 * presses down to meet its own shadow. */
export function StickerButton({ label, onPress, bg = obColor.sunflower, textColor = obColor.ink, shadowColor = obColor.ink, loading, disabled, icon = 'forward', style }: StickerButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [
        styles.stickerButton,
        { backgroundColor: bg, borderColor: obColor.ink },
        pressed ? { transform: [{ translateX: 3 }, { translateY: 3 }], shadowOffset: { width: 1, height: 1 } } : obShadow.color(shadowColor),
        disabled && styles.stickerButtonDisabled,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={textColor} size="small" />
      ) : (
        <>
          <Text style={[styles.stickerButtonLabel, { color: textColor }]}>{label}</Text>
          {icon === 'forward' && (
            <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
              <Path d="M5 12h14M13 6l6 6-6 6" stroke={textColor} strokeWidth={2.8} strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
          )}
        </>
      )}
    </Pressable>
  );
}

/** Small Space-Mono uppercase tag — ink-bordered chip used for step counters, stamps, counts. */
export function MonoTag({ text, bg = obColor.sunflower, color = obColor.ink, rotateDeg = 0 }: { text: string; bg?: string; color?: string; rotateDeg?: number }) {
  return (
    <View style={[styles.monoTag, { backgroundColor: bg, transform: [{ rotate: `${rotateDeg}deg` }] }]}>
      <Text style={[styles.monoTagText, { color }]}>{text}</Text>
    </View>
  );
}

/** The square, ink-bordered, drop-shadowed back button used on every inner onboarding screen. */
export function OnboardingBackButton({ onPress }: { onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel="Back" style={({ pressed }) => [styles.backButton, pressed && styles.backButtonPressed]}>
      <Icon path={BACK_PATH} size={18} color={obColor.ink} strokeWidth={2.6} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fill: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  stickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    borderWidth: 2,
    borderRadius: obRadius.card - 2,
    paddingVertical: 17,
  },
  stickerButtonDisabled: { opacity: 0.5 },
  stickerButtonLabel: { fontFamily: obFont.display800, fontSize: 19 },
  monoTag: {
    alignSelf: 'flex-start',
    borderWidth: 2,
    borderColor: obColor.ink,
    borderRadius: obRadius.pill,
    paddingVertical: 5,
    paddingHorizontal: 10,
  },
  monoTagText: { fontFamily: obFont.mono700, fontSize: 11, letterSpacing: 1 },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: obColor.white,
    borderWidth: 2,
    borderColor: obColor.ink,
    alignItems: 'center',
    justifyContent: 'center',
    ...obShadow.sm,
  },
  backButtonPressed: { transform: [{ translateX: 2 }, { translateY: 2 }], shadowOffset: { width: 0, height: 0 } },
});
