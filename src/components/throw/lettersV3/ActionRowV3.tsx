import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import { Icon } from '../../Icon';
import { v3Color, v3Font } from '../../../theme/throwLettersV3Tokens';
import type { V3LetterCardData } from '../../../hooks/useLettersArrivalV3';

const BELL_ICON = 'M6 16v-5a6 6 0 1 1 12 0v5l1.5 2h-15z M10 20.5a2 2 0 0 0 4 0';
const CHECK_ICON = 'M5 12.5l4.5 4.5L19 7.5';
const IMAGE_ICON = 'M19 3H5a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2V5a2 2 0 00-2-2z M8.5 10a1.5 1.5 0 100-3 1.5 1.5 0 000 3z M21 15l-5-5L5 21';

const s = (n: number, scale: number) => n * scale;

function PressableScale({ onPress, scaleTo, children, style, accessibilityLabel }: { onPress: () => void; scaleTo: number; children: React.ReactNode; style?: object; accessibilityLabel: string }) {
  const pressed = useRef(new Animated.Value(1)).current;
  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => Animated.timing(pressed, { toValue: scaleTo, duration: 90, useNativeDriver: true }).start()}
      onPressOut={() => Animated.timing(pressed, { toValue: 1, duration: 120, useNativeDriver: true }).start()}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={style}
    >
      <Animated.View style={{ transform: [{ scale: pressed }] }}>{children}</Animated.View>
    </Pressable>
  );
}

/** Confirm/Media — the letter card's own action row, visible only once the letter is fully open
 * and no delete-drag is armed, fading/sliding in per the handoff's own `actOp`/`actY`. No Reply
 * button, per the pixel spec's own explicit rule. */
export function ActionRowV3({
  visible,
  letter,
  onConfirm,
  onOpenMedia,
  scale,
}: {
  visible: boolean;
  letter: V3LetterCardData | null;
  onConfirm: () => void;
  onOpenMedia: () => void;
  scale: number;
}) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(10)).current;

  useEffect(() => {
    Animated.timing(opacity, { toValue: visible ? 1 : 0, duration: 300, easing: Easing.linear, useNativeDriver: true }).start();
    Animated.timing(translateY, { toValue: visible ? 0 : 10, duration: 400, easing: Easing.bezier(0.3, 1.3, 0.5, 1), useNativeDriver: true }).start();
  }, [visible, opacity, translateY]);

  const hasAlert = !!letter?.alertSchedule;
  const confirmed = !!letter?.alertConfirmed;
  const hasMedia = !!letter?.photoUrls.length;
  const h = s(48, scale);

  return (
    <Animated.View pointerEvents={visible ? 'auto' : 'none'} style={{ flexDirection: 'row', gap: s(10, scale), opacity, transform: [{ translateY }] }}>
      {hasAlert && (
        <PressableScale onPress={onConfirm} scaleTo={0.97} accessibilityLabel={confirmed ? 'Alert set' : 'Confirm reminder'} style={{ flex: 1 }}>
          <View style={[styles.confirmBtn, { height: h, borderRadius: h / 2, gap: s(8, scale), backgroundColor: confirmed ? 'rgba(255,255,255,.85)' : v3Color.accentBlue }]}>
            <Icon path={confirmed ? CHECK_ICON : BELL_ICON} size={s(18, scale)} color={confirmed ? v3Color.accentBlue : '#FFFFFF'} strokeWidth={confirmed ? 2.6 : 2.2} />
            <Text style={[styles.confirmLabel, { fontSize: s(15, scale), color: confirmed ? v3Color.accentBlue : '#FFFFFF' }]}>{confirmed ? 'Alert set' : 'Confirm'}</Text>
          </View>
        </PressableScale>
      )}

      {hasMedia && (
        <PressableScale onPress={onOpenMedia} scaleTo={0.94} accessibilityLabel="View attached photos or videos">
          <View style={[styles.mediaBtn, { width: h, height: h, borderRadius: h / 2 }]}>
            <Icon path={IMAGE_ICON} size={s(22, scale)} color={v3Color.ink} strokeWidth={2} />
            <View style={[styles.mediaBadge, { minWidth: s(20, scale), height: s(20, scale), borderRadius: s(10, scale), paddingHorizontal: s(5, scale), borderWidth: s(2, scale) }]}>
              <Text style={[styles.mediaBadgeText, { fontSize: s(10.5, scale) }]}>{letter?.photoUrls.length}</Text>
            </View>
          </View>
        </PressableScale>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  confirmBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  confirmLabel: { fontFamily: v3Font.ui700 },
  mediaBtn: { backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  mediaBadge: {
    position: 'absolute',
    right: -3,
    top: -3,
    backgroundColor: v3Color.accentBlue,
    borderColor: '#F4F4F2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mediaBadgeText: { fontFamily: v3Font.ui800, color: '#FFFFFF' },
});
