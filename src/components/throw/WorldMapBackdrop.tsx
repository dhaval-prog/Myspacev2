import React, { useMemo } from 'react';
import Svg, { Path, Rect } from 'react-native-svg';
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

/** The stylized world map — soft sage continents on a dusty-blue ocean, equirectangular projection. */
export function WorldMapBackdrop({ width, height }: WorldMapBackdropProps) {
  const paths = useMemo(() => WORLD_LANDMASSES.map((poly) => polygonToPath(poly, width, height)), [width, height]);

  if (width <= 0 || height <= 0) return null;

  return (
    <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <Rect x={0} y={0} width={width} height={height} fill={throwColor.ocean} />
      {paths.map((d, i) => (
        <Path key={i} d={d} fill={throwColor.land} stroke={throwColor.landLine} strokeWidth={1} />
      ))}
    </Svg>
  );
}
