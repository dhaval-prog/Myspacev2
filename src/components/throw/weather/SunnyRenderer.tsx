import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';
import { sunConfigForHour } from './sunConfig';

// react-native-svg's web typings omit `children` on Defs (a typing gap, not a runtime issue, see
// ThrowGlassBackdrop.tsx's own identical cast).
const DefsAny = Defs as unknown as React.ComponentType<{ children?: React.ReactNode }>;

// Slow enough to read as "sunlight naturally changing" rather than an obvious animation loop, per
// this feature's own explicit "do not create a pulsing effect" note — roughly double ClearOverlay's
// own 9s breathe, since Sunny's own spec calls for even slower movement than Clear's already-subtle
// one.
const BREATHE_MS = 18000;
const PRESENCE_DURATION_MS = 2200;
// The wash/glow/ray opacity range the breathe loop moves between — kept low enough that even at its
// peak this never washes out the map, matching this feature's own "brightness ≈ 1.05–1.12, not an
// aggressive overlay" guidance.
const WASH_MIN = 0.05;
const WASH_MAX = 0.13;
const GLOW_MIN = 0.16;
const GLOW_MAX = 0.3;
const RAY_MIN = 0.03;
const RAY_MAX = 0.07;
// Held here (rather than animating) whenever reduceMotion is on — a fixed, still-visible mid value
// so Sunny stays present and readable, never fully static-black-and-white nor pulsing.
const REDUCE_MOTION_BREATHE = 0.55;

interface SunnyRendererProps {
  active: boolean;
  /** Internal gate (unlike ClearOverlay's external `active={show && !reduceMotion}` pattern) — per
   * this feature's own explicit "reduced motion must dampen Sunny's movement, never disable Sunny
   * entirely" requirement, so the warm wash/glow stay visible and only the breathing/ray animation
   * is what backs off. */
  reduceMotion?: boolean;
}

/**
 * Sunny's own visual identity — deliberately not ClearOverlay with different numbers: a warm
 * ambient wash + a soft, genuinely radial (react-native-svg RadialGradient, not a flat circle) sun
 * glow + two extremely subtle directional ray gradients, all breathing together on one slow shared
 * loop. Positioned toward the top-right corner (ClearOverlay's own wash sits top-left) purely so the
 * two would never visually collide if ever compared side by side — the two conditions are mutually
 * exclusive at runtime, so this never actually matters, but keeps them looking like clearly separate
 * treatments rather than palette swaps of the same shape.
 *
 * No particle system here (native's own scope decision for this round — see the PR description);
 * the wash/glow/rays alone already read as a clearly different atmosphere from Clear's plain
 * moonless-daylight neutrality, which is the one hard requirement this component exists to satisfy.
 */
export function SunnyRenderer({ active, reduceMotion }: SunnyRendererProps) {
  const presence = useRef(new Animated.Value(0)).current;
  const breathe = useRef(new Animated.Value(REDUCE_MOTION_BREATHE)).current;
  const loopRef = useRef<Animated.CompositeAnimation | null>(null);
  const cfg = useMemo(() => sunConfigForHour(new Date().getHours()), []);

  useEffect(() => {
    Animated.timing(presence, { toValue: active ? 1 : 0, duration: PRESENCE_DURATION_MS, easing: Easing.inOut(Easing.quad), useNativeDriver: true }).start();
  }, [active, presence]);

  useEffect(() => {
    if (reduceMotion) {
      loopRef.current?.stop();
      breathe.setValue(REDUCE_MOTION_BREATHE);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(breathe, { toValue: 1, duration: BREATHE_MS / 2, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(breathe, { toValue: 0, duration: BREATHE_MS / 2, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]),
    );
    loopRef.current = loop;
    loop.start();
    return () => loop.stop();
  }, [reduceMotion, breathe]);

  const intensity = cfg.intensity;
  const washOpacity = Animated.multiply(presence, breathe.interpolate({ inputRange: [0, 1], outputRange: [WASH_MIN * intensity, WASH_MAX * intensity] }));
  const glowOpacity = Animated.multiply(presence, breathe.interpolate({ inputRange: [0, 1], outputRange: [GLOW_MIN * intensity, GLOW_MAX * intensity] }));
  const rayOpacity = Animated.multiply(presence, breathe.interpolate({ inputRange: [0, 1], outputRange: [RAY_MIN * intensity, RAY_MAX * intensity] }));
  const glowSize = 260 * cfg.glowRadius;
  // Warmer (more orange) at low elevation/golden hour, whiter-gold near midday — a plain lerp
  // between two warm tones rather than a heavy saturated yellow, per this feature's own "warm, not
  // a yellow filter" note.
  const warmColor = cfg.warmth > 0.7 ? '255,214,150' : cfg.warmth > 0.45 ? '255,222,170' : '255,236,200';

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {/* Ambient warm wash — top-right, mirrors ClearOverlay's own top-left placement. */}
      <Animated.View pointerEvents="none" style={[styles.washWrap, { opacity: washOpacity }]}>
        <LinearGradient colors={[`rgba(${warmColor},0.9)`, `rgba(${warmColor},0)`]} start={{ x: 1, y: 0 }} end={{ x: 0, y: 1 }} style={StyleSheet.absoluteFill} />
      </Animated.View>

      {/* Soft radial sun glow — genuinely radial (not a flat circle), no hard edge. */}
      <Animated.View pointerEvents="none" style={[styles.glowWrap, { width: glowSize, height: glowSize, opacity: glowOpacity }]}>
        <Svg width={glowSize} height={glowSize}>
          <DefsAny>
            <RadialGradient id="sunnyGlow" cx="50%" cy="50%" r="50%">
              <Stop offset="0" stopColor={`rgb(${warmColor})`} stopOpacity={0.85} />
              <Stop offset="0.55" stopColor={`rgb(${warmColor})`} stopOpacity={0.35} />
              <Stop offset="1" stopColor={`rgb(${warmColor})`} stopOpacity={0} />
            </RadialGradient>
          </DefsAny>
          <Circle cx={glowSize / 2} cy={glowSize / 2} r={glowSize / 2} fill="url(#sunnyGlow)" />
        </Svg>
      </Animated.View>

      {/* Two very soft directional rays, angled off the glow's own corner. */}
      <Animated.View pointerEvents="none" style={[styles.rayWrap, { opacity: rayOpacity, transform: [{ rotate: `${140 + cfg.angle}deg` }] }]}>
        <LinearGradient colors={[`rgba(${warmColor},0.5)`, `rgba(${warmColor},0)`]} style={StyleSheet.absoluteFill} />
      </Animated.View>
      <Animated.View pointerEvents="none" style={[styles.rayWrap, styles.rayWrapWide, { opacity: rayOpacity, transform: [{ rotate: `${162 + cfg.angle}deg` }] }]}>
        <LinearGradient colors={[`rgba(${warmColor},0.4)`, `rgba(${warmColor},0)`]} style={StyleSheet.absoluteFill} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  washWrap: { position: 'absolute', top: -60, right: -60, width: '75%', height: '48%' },
  glowWrap: { position: 'absolute', top: -40, right: -40 },
  // A tall thin strip pivoted from its own top-right corner so rotating it fans the "ray" out from
  // roughly the glow's own position rather than the screen center.
  rayWrap: { position: 'absolute', top: -20, right: 40, width: 46, height: 420, transformOrigin: 'top right' },
  rayWrapWide: { width: 64, right: 10 },
});
