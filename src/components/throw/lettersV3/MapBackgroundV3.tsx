import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import Svg, { Defs, Line, Path, Pattern, Rect } from 'react-native-svg';
import { v3Color, v3Font } from '../../../theme/throwLettersV3Tokens';
import type { V3Pin } from '../../../hooks/useLettersArrivalV3';

// react-native-svg's web typings omit `children` on Defs (a typing gap, not a runtime issue,
// already worked around the same way in NpatGlassBackdrop) — cast once.
const DefsAny = Defs as unknown as React.ComponentType<{ children?: React.ReactNode }>;

const s = (n: number, scale: number) => n * scale;

// Generously larger than any on-screen pan distance ever reaches (a few hundred reference units
// at most, between neighboring city coordinates) — keeps the grid covering the visible frame at
// every camera position without needing to resize/retile it as the pan target changes.
const FIELD = 4000;

/** A faint, decorative crossed-diagonal street-grid — a stylized backdrop (not real geography),
 * approximating the handoff's own 4-layer `repeating-linear-gradient` hatch with two crossing
 * line families instead (react-native-svg's `Pattern` tiles a repeating fill natively, so this
 * tiles correctly at any size rather than needing the CSS trick ported literally). */
function MapPattern({ scale }: { scale: number }) {
  const tile = s(44, scale);
  const field = s(FIELD, scale);
  return (
    <View style={{ position: 'absolute', left: 0, top: 0, width: field, height: field }}>
      <Svg width={field} height={field}>
        <DefsAny>
          <Pattern id="v3grid" patternUnits="userSpaceOnUse" width={tile} height={tile} patternTransform="rotate(26)">
            <Line x1={0} y1={0} x2={0} y2={tile} stroke="rgba(0,0,0,.05)" strokeWidth={1} />
          </Pattern>
          <Pattern id="v3grid2" patternUnits="userSpaceOnUse" width={tile * 1.3} height={tile * 1.3} patternTransform="rotate(-64)">
            <Line x1={0} y1={0} x2={0} y2={tile * 1.3} stroke="rgba(0,0,0,.04)" strokeWidth={1} />
          </Pattern>
        </DefsAny>
        <Rect x={0} y={0} width="100%" height="100%" fill="url(#v3grid)" />
        <Rect x={0} y={0} width="100%" height="100%" fill="url(#v3grid2)" />
      </Svg>
    </View>
  );
}

function Pin({ pin, scale }: { pin: V3Pin; scale: number }) {
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!pin.active) return;
    pulse.setValue(0);
    const loop = Animated.loop(Animated.timing(pulse, { toValue: 1, duration: 1600, easing: Easing.out(Easing.ease), useNativeDriver: true }));
    loop.start();
    return () => loop.stop();
  }, [pin.active, pulse]);

  const size = s(pin.active ? 24 : 14, scale);
  const off = size / 2 + s(2, scale);
  return (
    <View style={{ position: 'absolute', left: s(pin.x, scale), top: s(pin.y, scale), zIndex: pin.active ? 10 : 1 }}>
      {pin.active && (
        <Animated.View
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: -s(18, scale),
            top: -s(18, scale),
            width: s(36, scale),
            height: s(36, scale),
            borderRadius: s(18, scale),
            backgroundColor: 'rgba(47,107,255,.35)',
            transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.8, 2.4] }) }],
            opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.7, 0] }),
          }}
        />
      )}
      <View
        style={{
          position: 'absolute',
          left: -off,
          top: -off,
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: pin.active ? v3Color.accentBlue : v3Color.ink,
          borderWidth: 3,
          borderColor: '#FFFFFF',
        }}
      />
      {pin.active && (
        <Text style={[styles.pinLabel, { fontSize: s(10, scale), left: s(18, scale), top: -s(11, scale), paddingHorizontal: s(8, scale), paddingVertical: s(4, scale), borderRadius: s(6, scale) }]}>
          {pin.place} · {pin.km}
        </Text>
      )}
    </View>
  );
}

/**
 * The letter card's own map backdrop — a faint street-grid pattern, a dotted route through the
 * current contact's letters (oldest to newest), and a pin per letter (the active one pulsing,
 * labeled) — all panned together so the active letter's own pin always lands on `mapAnchor`,
 * ported from the handoff's own `bgPos`/`camX`/`camY` (both driven by the exact same target, so a
 * single shared translate here does the job of its two separately-named CSS properties).
 */
export function MapBackgroundV3({ camTarget, pins, route, scale }: { camTarget: { x: number; y: number }; pins: V3Pin[]; route: { x: number; y: number }[]; scale: number }) {
  // Scaled, actual-pixel camera offset — animated directly in on-screen units so the transform
  // below is a plain translate, no per-frame Animated.multiply needed.
  const camX = useRef(new Animated.Value(s(camTarget.x, scale))).current;
  const camY = useRef(new Animated.Value(s(camTarget.y, scale))).current;

  useEffect(() => {
    const easing = Easing.bezier(0.3, 0.8, 0.2, 1);
    Animated.timing(camX, { toValue: s(camTarget.x, scale), duration: 1100, easing, useNativeDriver: true }).start();
    Animated.timing(camY, { toValue: s(camTarget.y, scale), duration: 1100, easing, useNativeDriver: true }).start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [camTarget.x, camTarget.y, scale]);

  const routeD = route.length > 1 ? route.map((p, i) => `${i ? 'L' : 'M'}${s(p.x, scale).toFixed(1)} ${s(p.y, scale).toFixed(1)}`).join(' ') : '';

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <View style={[StyleSheet.absoluteFill, { backgroundColor: v3Color.mapBg }]} />
      <Animated.View
        style={{
          position: 'absolute',
          left: -s(FIELD / 2, scale),
          top: -s(FIELD / 2, scale),
          transform: [{ translateX: camX }, { translateY: camY }],
        }}
      >
        <MapPattern scale={scale} />
        {!!routeD && (
          <View style={{ position: 'absolute', left: 0, top: 0, width: s(FIELD, scale), height: s(FIELD, scale) }}>
            <Svg width={s(FIELD, scale)} height={s(FIELD, scale)}>
              <Path d={routeD} fill="none" stroke="rgba(17,17,17,.28)" strokeWidth={2.5} strokeDasharray="2 8" strokeLinecap="round" />
            </Svg>
          </View>
        )}
        {pins.map((pin) => (
          <Pin key={pin.id} pin={pin} scale={scale} />
        ))}
      </Animated.View>
      <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(244,244,242,.28)' }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  pinLabel: {
    position: 'absolute',
    fontFamily: v3Font.mono,
    color: '#FFFFFF',
    backgroundColor: v3Color.ink,
    letterSpacing: 0.6,
    overflow: 'hidden',
  },
});
