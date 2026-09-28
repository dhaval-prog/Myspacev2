import React from 'react';
import { LeafRenderer } from './LeafRenderer';
import type { WindController } from './windController';
import type { WeatherIntensity, WeatherQuality } from '../../../types/weather';

interface WindOverlayProps {
  active: boolean;
  intensity: WeatherIntensity;
  quality?: WeatherQuality;
  windController: WindController;
}

/**
 * Wind's own visible surface — per this feature's own "wind itself should generally be invisible,
 * only its environmental effects communicate it" note, that's leaves (real, varied silhouettes,
 * curved wind-driven flight paths, low density — see LeafRenderer.tsx) rather than any dust-mote/
 * arrow visualization. A single cross-platform file (react-native-svg + Animated already render
 * consistently on both platforms via react-native-web, same as every other Icon in this app) rather
 * than the previous native/web split, since LeafRenderer's own pooled-Animated.Value architecture
 * doesn't need a platform-specific implementation the way RainOverlay/SnowOverlay's canvas vs.
 * native-driver split does.
 */
export function WindOverlay({ active, intensity, quality, windController }: WindOverlayProps) {
  return <LeafRenderer active={active} intensity={intensity} quality={quality} windController={windController} />;
}
