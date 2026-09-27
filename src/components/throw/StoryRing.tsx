import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { throwColor } from '../../theme/throwTokens';

// The fixed clearance between the ring's innermost possible point and the avatar's own edge —
// enforced structurally below (see minRingRadius), not just as a typical/average distance, so the
// wave can never visually touch or overlap the photo no matter how its noise happens to combine
// at a given instant. Exported so tests can verify the guarantee numerically rather than trusting
// the formula by inspection.
export const STORY_RING_AVATAR_GAP = 4;
const AVATAR_GAP = STORY_RING_AVATAR_GAP;
const STROKE_BASE = 2.3;
const STROKE_VAR = 0.5;
const MAX_STROKE = STROKE_BASE + STROKE_VAR;
// How far the wave can push outward from its own inner floor — itself slowly breathing between
// roughly half and its full value (see waveDepthAt) rather than a fixed distance, so the ripple's
// own "reach" feels alive too, not just its wobble.
const WAVE_DEPTH_BASE = 6;
const WAVE_DEPTH_VAR = 2;
const MAX_WAVE_DEPTH = WAVE_DEPTH_BASE + WAVE_DEPTH_VAR;
// Generous enough that the SVG canvas always contains the wave at its widest + thickest reach.
const PADDING = AVATAR_GAP + MAX_STROKE + MAX_WAVE_DEPTH + 2;
// A closed polygon of this many points, straight segments only (no bezier smoothing) — at this
// small a ring (avatar-sized, ~50-90px across) individual segments are only a few degrees apart
// and read as a smooth, hand-drawn wave without needing curve math.
const POINTS = 64;
// How often the animation advances — cheap enough for several of these to run at once (one per
// contact with an active story in the carousel), and fast enough to read as continuous motion.
const TICK_MS = 50;
const DT = 0.05;

// Three sine components at different angular frequencies (how many bumps around the circle) and
// different, independent temporal speeds/phase offsets — summed, this is what keeps the ripple
// reading as an organic, non-repeating wobble rather than a fixed scalloped shape simply spinning
// in place (a single sine's phase shift is indistinguishable from rigid rotation; three
// independently-drifting ones never realign into the same relative shape twice). Weights sum to
// 1, so the combined noise is bounded to exactly [-1, 1] regardless of how the phases line up.
const HARMONICS = [
  { n: 3, speed: 0.5, phase: 0, weight: 0.5 },
  { n: 5, speed: -0.8, phase: 1.7, weight: 0.3 },
  { n: 2, speed: 0.3, phase: 3.4, weight: 0.2 },
] as const;

function noiseAt(theta: number, t: number): number {
  let sum = 0;
  for (const h of HARMONICS) sum += h.weight * Math.sin(h.n * theta + h.speed * t + h.phase);
  return sum;
}

function waveDepthAt(t: number): number {
  return WAVE_DEPTH_BASE + WAVE_DEPTH_VAR * Math.sin(0.2 * t + 0.5);
}

function strokeWidthAt(t: number): number {
  return STROKE_BASE + STROKE_VAR * Math.sin(0.35 * t + 0.7);
}

function wavePath(center: number, minRingRadius: number, t: number): string {
  const depth = waveDepthAt(t);
  const segments: string[] = [];
  for (let i = 0; i <= POINTS; i++) {
    const theta = (i / POINTS) * Math.PI * 2;
    // noiseAt is in [-1, 1] — remapped to [0, 1] so the radius only ever adds on top of the floor
    // below, never subtracts past it.
    const r = minRingRadius + ((noiseAt(theta, t) + 1) / 2) * depth;
    const x = center + r * Math.cos(theta);
    const y = center + r * Math.sin(theta);
    segments.push(`${i === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`);
  }
  return `${segments.join(' ')} Z`;
}

interface StoryRingProps {
  /** Active story count for this contact — 0 renders `children` completely untouched (no extra
   * size, no ring), so a contact with no stories looks exactly like it did before this existed.
   * Any count above 0 shows the same single ripple — it doesn't indicate *how many* stories are
   * active (see this component's own history for the earlier segmented-arc-per-count design,
   * replaced per explicit request/reference screenshots). */
  count: number;
  /** Diameter of the avatar being wrapped. */
  size: number;
  children: React.ReactNode;
}

/**
 * Wraps a contact's avatar with an animated blue ripple when they have an active (< 24h old)
 * story — a soft, hand-drawn, continuously undulating outline that stays strictly outside the
 * photo with a fixed minimum gap (see AVATAR_GAP/minRingRadius below), per explicit request that
 * it read as a "perimeter ripple" around the photo rather than a rigid ring rotating past it.
 * Driven by a plain JS interval recomputing the SVG path's `d` string each tick (Animated can't
 * morph an arbitrary path shape) — the same "no native driver for this, so tick a plain timer"
 * tradeoff already used elsewhere in Throw (e.g. WheelPicker's scroll-settle timer). `t` grows
 * unbounded rather than wrapping — sin() is exactly continuous across any wrap point anyway, so
 * there's nothing to gain from resetting it, and unbounded avoids ever having to reason about a
 * seam.
 */
export function StoryRing({ count, size, children }: StoryRingProps) {
  const [t, setT] = useState(0);

  useEffect(() => {
    if (count <= 0) return;
    const id = setInterval(() => setT((prev) => prev + DT), TICK_MS);
    return () => clearInterval(id);
  }, [count]);

  if (count <= 0) return <>{children}</>;

  const outerSize = size + PADDING * 2;
  const avatarRadius = size / 2;
  // The ring's radius never drops below this, however its noise/depth combine at a given instant
  // — so the stroke's own inner edge (radius minus half its thickness, at the thickest the stroke
  // ever gets) never comes closer than AVATAR_GAP to the photo's edge.
  const minRingRadius = avatarRadius + AVATAR_GAP + MAX_STROKE / 2;

  return (
    <View style={{ width: outerSize, height: outerSize, alignItems: 'center', justifyContent: 'center' }}>
      <View style={{ position: 'absolute', top: 0, left: 0 }}>
        <Svg testID="story-ring-svg" width={outerSize} height={outerSize}>
          <Path
            testID="story-ring-path"
            d={wavePath(outerSize / 2, minRingRadius, t)}
            stroke={throwColor.activeBlue}
            strokeWidth={strokeWidthAt(t)}
            strokeLinejoin="round"
            strokeLinecap="round"
            fill="none"
          />
        </Svg>
      </View>
      {children}
    </View>
  );
}
