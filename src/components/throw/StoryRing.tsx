import React from 'react';
import { View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { throwColor } from '../../theme/throwTokens';

const STROKE_WIDTH = 2.5;
// The visual gap between two adjacent story segments, in px along the ring's circumference —
// fixed regardless of segment count (rather than a fixed angle), so a 2-story ring and an
// 8-story ring both read as "clearly separate arcs" instead of the gaps shrinking to nothing as
// more segments pack onto the same circle.
const GAP_PX = 6;
const PADDING = STROKE_WIDTH + 3;

interface StoryRingProps {
  /** Active story count for this contact — 0 renders `children` completely untouched (no extra
   * size, no ring), so a contact with no stories looks exactly like it did before this existed. */
  count: number;
  /** Diameter of the avatar being wrapped. */
  size: number;
  children: React.ReactNode;
}

/**
 * Wraps a contact's avatar with a green status ring when they have an active (< 24h old) story —
 * a solid circle for one story, split into that many equal arcs (with a small gap between each)
 * for more than one, per the WhatsApp/Instagram status-ring convention shown in the reference
 * screenshot. Pure SVG stroke-dashing (no per-segment arc-path math): a circle's whole
 * circumference divides evenly into `count` [segment, gap] pairs by construction, so a single
 * repeating dash pattern draws all of them at once.
 */
export function StoryRing({ count, size, children }: StoryRingProps) {
  if (count <= 0) return <>{children}</>;

  const outerSize = size + PADDING * 2;
  const radius = outerSize / 2 - STROKE_WIDTH / 2;
  const circumference = 2 * Math.PI * radius;
  const segmentLength = count === 1 ? circumference : Math.max(4, circumference / count - GAP_PX);
  const dashArray = count === 1 ? undefined : `${segmentLength} ${GAP_PX}`;

  return (
    <View style={{ width: outerSize, height: outerSize, alignItems: 'center', justifyContent: 'center' }}>
      <View style={{ position: 'absolute', top: 0, left: 0 }}>
        <Svg
          testID="story-ring-svg"
          width={outerSize}
          height={outerSize}
          // Starts the first segment at the top (12 o'clock) instead of SVG's default 3 o'clock.
          transform={[{ rotate: '-90deg' }]}
        >
          <Circle
            testID="story-ring-circle"
            cx={outerSize / 2}
            cy={outerSize / 2}
            r={radius}
            stroke={throwColor.storyRing}
            strokeWidth={STROKE_WIDTH}
            strokeLinecap="round"
            strokeDasharray={dashArray}
            fill="none"
          />
        </Svg>
      </View>
      {children}
    </View>
  );
}
