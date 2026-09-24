import React, { useMemo } from 'react';
import Svg, { Defs, Path, RadialGradient, Rect, Stop } from 'react-native-svg';
import { throwColor } from '../../theme/throwTokens';
import { project } from '../../utils/mapProjection';
import { WORLD_LANDMASSES } from './worldLandmasses';

interface WorldMapBackdropProps {
  width: number;
  height: number;
}

function polygonToPath(points: { latitude: number; longitude: number }[], width: number, height: number): string {
  return points
    .map((p, i) => {
      const { x, y } = project(p, width, height);
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ') + ' Z';
}

// How far the "cutout" shadow sits below each continent — plain Path duplication rather than an
// SVG filter/blur, since react-native-svg's filter support is inconsistent on native.
const SHADOW_OFFSET = 2.5;

// react-native-svg's <Defs> types don't declare `children` even though it renders them fine —
// same workaround already used in GamesDashboardScreen.tsx.
const DefsAny = Defs as unknown as React.ComponentType<{ children?: React.ReactNode }>;

/**
 * The stylized world map — soft sage continents on a dusty-blue ocean, equirectangular
 * projection. The ocean carries a gentle radial gradient for depth, and each continent sits on a
 * faint offset shadow of its own silhouette, like a paper cutout resting on the water — echoing
 * the letter/paper motif the rest of Throw is built on. Still a mood board, not a navigation
 * chart: no graticule, no relief, no real cartographic detail.
 */
export function WorldMapBackdrop({ width, height }: WorldMapBackdropProps) {
  const paths = useMemo(() => WORLD_LANDMASSES.map((poly) => polygonToPath(poly, width, height)), [width, height]);

  if (width <= 0 || height <= 0) return null;

  return (
    <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <DefsAny>
        <RadialGradient id="ocean-depth" cx="50%" cy="42%" r="75%">
          <Stop offset="0%" stopColor={throwColor.ocean} />
          <Stop offset="100%" stopColor={throwColor.oceanDeep} />
        </RadialGradient>
      </DefsAny>
      <Rect x={0} y={0} width={width} height={height} fill="url(#ocean-depth)" />
      {paths.map((d, i) => (
        <Path key={`shadow-${i}`} d={d} fill={throwColor.paperShadow} opacity={0.5} transform={`translate(${SHADOW_OFFSET}, ${SHADOW_OFFSET})`} />
      ))}
      {paths.map((d, i) => (
        <Path key={i} d={d} fill={throwColor.land} stroke={throwColor.landLine} strokeWidth={1.25} strokeLinejoin="round" strokeLinecap="round" />
      ))}
    </Svg>
  );
}
