import React from 'react';
import { WeatherCanvas } from './WeatherCanvas.web';
import { RainOverlay } from './RainOverlay';
import { useThrowWeather } from '../../../context/ThrowWeatherContext';
import type { WeatherIntensity, WeatherQuality } from '../../../types/weather';

/**
 * Web-only override of WeatherOverlay (Metro/Expo picks `.web.tsx` over `.tsx` automatically).
 * Same props and same mount point in ThrowHomeScreen's mapArea — above ThrowMap, below the
 * carousel/letter/plane — so nothing in ThrowHomeScreen or ThrowSettingsScreen changes.
 * Native keeps the existing WeatherOverlay.tsx renderers.
 *
 * Rain is deliberately NOT drawn by WeatherCanvas's own engine — its per-frame streak/splash/lens-
 * droplet system (weatherEngine.ts's own `L.rain` block) reads as less smooth than the original
 * RainOverlay.web.tsx canvas loop and left literal "bubbles" sitting on the map (the lens-droplet
 * effect), per explicit feedback. WeatherCanvas's own `setTargets` never raises `T.rain` any more
 * (see weatherEngine.ts), so that whole block — and the lens droplets, which only spawn while
 * `L.rain > 0` — simply never fires; RainOverlay here is what actually draws rain again, painted on
 * top of WeatherCanvas so it still layers over the engine's own clouds/dark/fog ambiance for rain and
 * thunderstorm. Every other condition (clear/cloudy/snow/wind/lightning) is untouched — still
 * entirely WeatherCanvas.
 */
export function WeatherOverlay({ quality }: { quality?: WeatherQuality }) {
  const { weather, intensity } = useThrowWeather();
  const isStorm = weather === 'thunderstorm';
  const showRain = weather === 'rain' || isStorm;
  // Thunderstorm's own rain is always forced to heavy, regardless of the underlying reading — same
  // rule the native renderer (WeatherOverlay.tsx) already applies.
  const rainIntensity: WeatherIntensity = isStorm ? 'heavy' : intensity;

  return (
    <>
      <WeatherCanvas />
      <RainOverlay active={showRain} intensity={rainIntensity} quality={quality} />
    </>
  );
}
