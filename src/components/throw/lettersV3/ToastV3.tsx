import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { Icon } from '../../Icon';
import { v3Color, v3Font } from '../../../theme/throwLettersV3Tokens';

const CHECK_ICON = 'M5 12.5l4.5 4.5L19 7.5';

const s = (n: number, scale: number) => n * scale;

/** The "Alert set · …" confirmation pill — fades/slides in while `text` is set, out when it goes
 * back to null (the caller already handles its own 2.4s auto-dismiss timer). `top` is the caller's
 * own absolute y (already including any safe-area offset) — kept a plain prop rather than baked
 * in so this stays reusable wherever a toast like this is needed. */
export function ToastV3({ text, scale, top }: { text: string | null; scale: number; top: number }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(-8)).current;

  useEffect(() => {
    const shown = !!text;
    Animated.timing(opacity, { toValue: shown ? 1 : 0, duration: 250, easing: Easing.linear, useNativeDriver: true }).start();
    Animated.timing(translateY, { toValue: shown ? 0 : -8, duration: 350, easing: Easing.bezier(0.3, 1.4, 0.5, 1), useNativeDriver: true }).start();
  }, [text, opacity, translateY]);

  return (
    <View pointerEvents="none" style={[styles.wrap, { top }]}>
      <Animated.View style={[styles.pill, { height: s(36, scale), paddingLeft: s(8, scale), paddingRight: s(16, scale), borderRadius: s(18, scale), gap: s(8, scale), opacity, transform: [{ translateY }] }]}>
        <View style={[styles.checkDot, { width: s(22, scale), height: s(22, scale), borderRadius: s(11, scale) }]}>
          <Icon path={CHECK_ICON} size={s(12, scale)} color="#FFFFFF" strokeWidth={3} />
        </View>
        <Text style={[styles.text, { fontSize: s(13, scale) }]} numberOfLines={1}>
          {text}
        </Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  pill: { flexDirection: 'row', alignItems: 'center', backgroundColor: v3Color.ink },
  checkDot: { backgroundColor: v3Color.accentBlue, alignItems: 'center', justifyContent: 'center' },
  text: { fontFamily: v3Font.ui700, color: '#FFFFFF' },
});
