import React, { useMemo } from 'react';
import { View } from 'react-native';
import Svg, { Circle, Polyline } from 'react-native-svg';
import type { LatLng } from '../../utils/geo';
import { pointAtProgress, projectPathSegments } from '../../utils/mapProjection';
import { throwColor } from '../../theme/throwTokens';
import { PaperPlane } from './PaperPlane';

interface FlightRouteProps {
  points: LatLng[];
  width: number;
  height: number;
  /** 0..1 — how far along the route the plane currently is. */
  progress: number;
  showPlane?: boolean;
}

/** The dashed route line plus the plane's current position/heading along it. */
export function FlightRoute({ points, width, height, progress, showPlane = true }: FlightRouteProps) {
  const segments = useMemo(() => projectPathSegments(points, width, height), [points, width, height]);
  const planePos = useMemo(() => pointAtProgress(points, width, height, progress), [points, width, height, progress]);

  if (width <= 0 || height <= 0) return null;

  return (
    <View style={{ position: 'absolute', width, height }} pointerEvents="none">
      <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
        {segments.map((seg, i) => (
          <Polyline
            key={i}
            points={seg.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')}
            fill="none"
            stroke={throwColor.clay}
            strokeWidth={2}
            strokeDasharray="1,7"
            strokeLinecap="round"
            opacity={0.75}
          />
        ))}
        <Circle cx={project0(points, width, height).x} cy={project0(points, width, height).y} r={4} fill={throwColor.pinSelf} />
        <Circle cx={projectLast(points, width, height).x} cy={projectLast(points, width, height).y} r={4} fill={throwColor.pinFriend} />
      </Svg>
      {showPlane && (
        <View
          style={{
            position: 'absolute',
            left: planePos.x - 14,
            top: planePos.y - 14,
            transform: [{ rotate: `${planePos.angleDeg}deg` }],
          }}
        >
          <PaperPlane size={28} color={throwColor.clayDeep} />
        </View>
      )}
    </View>
  );
}

function project0(points: LatLng[], width: number, height: number) {
  return pointAtProgress(points, width, height, 0);
}
function projectLast(points: LatLng[], width: number, height: number) {
  return pointAtProgress(points, width, height, 1);
}
