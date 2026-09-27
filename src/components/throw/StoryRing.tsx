import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { throwColor } from '../../theme/throwTokens';

const STROKE_WIDTH = 2.5;
const PADDING = STROKE_WIDTH + 4;
// How many bumps the wave has around the full circle, and how far each one pushes the radius
// in/out — both fixed regardless of ring size, matching the reference screenshot's scallop
// density rather than scaling with the (fairly narrow) range of avatar sizes this actually wraps.
const WAVE_COUNT = 8;
const WAVE_AMPLITUDE = 3;
// A closed polygon of this many points, straight segments only (no bezier smoothing) — at this
// small a ring (avatar-sized, ~50-90px across) individual segments are only a couple of degrees
// apart and read as a smooth wave without needing curve math.
const POINTS = 48;
// How often the phase advances — cheap enough for several of these to animate at once (one per
// contact with an active story in the carousel), and fast enough that the wave still reads as
// continuous motion rather than a slideshow.
const TICK_MS = 60;
const PHASE_STEP = 0.15;

function wavePath(center: number, baseRadius: number, phase: number): string {
  const segments: string[] = [];
  for (let i = 0; i <= POINTS; i++) {
    const theta = (i / POINTS) * Math.PI * 2;
    const r = baseRadius + WAVE_AMPLITUDE * Math.sin(WAVE_COUNT * theta + phase);
    const x = center + r * Math.cos(theta);
    const y = center + r * Math.sin(theta);
    segments.push(`${i === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`);
  }
  return `${segments.join(' ')} Z`;
}

interface StoryRingProps {
  /** Active story count for this contact — 0 renders `children` completely untouched (no extra
   * size, no ring), so a contact with no stories looks exactly like it did before this existed.
   * Any count above 0 shows the same single wavy ring — it no longer indicates *how many* stories
   * are active (see this component's own history for the earlier segmented-arc-per-count design;
   * replaced per explicit request/reference screenshot, which shows one continuous wave, not
   * arcs-with-gaps). */
  count: number;
  /** Diameter of the avatar being wrapped. */
  size: number;
  children: React.ReactNode;
}

/**
 * Wraps a contact's avatar with an animated blue "wave" ring when they have an active (< 24h
 * old) story — a continuously undulating scalloped border, per the reference screenshot, rather
 * than a plain static circle. Driven by a plain JS interval recomputing the SVG path's `d` string
 * (not Animated, which can't morph an arbitrary path shape) — the same "no native driver for this
 * kind of change, so tick a plain timer" tradeoff already used elsewhere in Throw (e.g.
 * WheelPicker's scroll-settle timer).
 */
export function StoryRing({ count, size, children }: StoryRingProps) {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    if (count <= 0) return;
    const id = setInterval(() => setPhase((p) => (p + PHASE_STEP) % (Math.PI * 2)), TICK_MS);
    return () => clearInterval(id);
  }, [count]);

  if (count <= 0) return <>{children}</>;

  const outerSize = size + PADDING * 2;
  const baseRadius = outerSize / 2 - STROKE_WIDTH / 2 - WAVE_AMPLITUDE;

  return (
    <View style={{ width: outerSize, height: outerSize, alignItems: 'center', justifyContent: 'center' }}>
      <View style={{ position: 'absolute', top: 0, left: 0 }}>
        <Svg testID="story-ring-svg" width={outerSize} height={outerSize}>
          <Path
            testID="story-ring-path"
            d={wavePath(outerSize / 2, baseRadius, phase)}
            stroke={throwColor.activeBlue}
            strokeWidth={STROKE_WIDTH}
            strokeLinejoin="round"
            fill="none"
          />
        </Svg>
      </View>
      {children}
    </View>
  );
}
