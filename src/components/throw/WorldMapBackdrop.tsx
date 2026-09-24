import React, { useMemo } from 'react';
import Svg, { ClipPath, Defs, G, Line, Path, RadialGradient, Rect, Stop } from 'react-native-svg';
import { throwColor } from '../../theme/throwTokens';
import { project } from '../../utils/mapProjection';
import { WORLD_LANDMASSES } from './worldLandmasses';
import { buildStreetGrid } from './mapStreetGrid';

interface WorldMapBackdropProps {
  width: number;
  height: number;
}

function projectPolygon(points: { latitude: number; longitude: number }[], width: number, height: number) {
  return points.map((p) => project(p, width, height));
}

function pointsToPath(points: { x: number; y: number }[]): string {
  return points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ') + ' Z';
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
 * chart: no relief, no real cartographic detail — but once a landmass is zoomed in enough to fill
 * a good chunk of the view (Throw home's "city block" zoom), it gets a light street grid and
 * scattered buildings (see mapStreetGrid.ts), clipped to that landmass's own silhouette so it
 * only ever touches land, never the ocean.
 */
export function WorldMapBackdrop({ width, height }: WorldMapBackdropProps) {
  const landPolygons = useMemo(() => WORLD_LANDMASSES.map((poly) => projectPolygon(poly, width, height)), [width, height]);
  const paths = useMemo(() => landPolygons.map(pointsToPath), [landPolygons]);
  const { roads, buildings } = useMemo(() => buildStreetGrid(landPolygons), [landPolygons]);

  if (width <= 0 || height <= 0) return null;

  return (
    <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <DefsAny>
        <RadialGradient id="ocean-depth" cx="50%" cy="42%" r="75%">
          <Stop offset="0%" stopColor={throwColor.ocean} />
          <Stop offset="100%" stopColor={throwColor.oceanDeep} />
        </RadialGradient>
        <ClipPath id="land-mask">
          {paths.map((d, i) => (
            <Path key={i} d={d} />
          ))}
        </ClipPath>
      </DefsAny>
      <Rect x={0} y={0} width={width} height={height} fill="url(#ocean-depth)" />
      {paths.map((d, i) => (
        <Path key={`shadow-${i}`} d={d} fill={throwColor.paperShadow} opacity={0.5} transform={`translate(${SHADOW_OFFSET}, ${SHADOW_OFFSET})`} />
      ))}
      {paths.map((d, i) => (
        <Path key={i} d={d} fill={throwColor.land} stroke={throwColor.landLine} strokeWidth={1.25} strokeLinejoin="round" strokeLinecap="round" />
      ))}
      <G clipPath="url(#land-mask)">
        {roads.map((r, i) => (
          <Line
            key={`road-${i}`}
            x1={r.x1}
            y1={r.y1}
            x2={r.x2}
            y2={r.y2}
            stroke={r.major ? throwColor.road : throwColor.roadMinor}
            strokeWidth={r.major ? 1.6 : 1}
            strokeLinecap="round"
          />
        ))}
        {buildings.map((b, i) => (
          <Rect
            key={`bldg-${i}`}
            x={b.x}
            y={b.y}
            width={b.w}
            height={b.h}
            fill={throwColor.building}
            stroke={throwColor.buildingLine}
            strokeWidth={0.5}
          />
        ))}
      </G>
    </Svg>
  );
}
