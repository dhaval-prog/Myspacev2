import React, { useMemo } from 'react';
import { ClearOverlay } from './ClearOverlay';
import { CloudOverlay } from './CloudOverlay';
import { RainOverlay } from './RainOverlay';
import { SnowOverlay } from './SnowOverlay';
import { WindOverlay } from './WindOverlay';
import { LightningController } from './LightningController';
import { useThrowWeather } from '../../../context/ThrowWeatherContext';
import { useReducedMotion } from '../../../hooks/useReducedMotion';
import type { WeatherIntensity, WeatherQuality } from '../../../types/weather';

// How far off vertical wind can push rain/snow (see windAngleDeg below) — capped well short of
// horizontal so it still reads as rain/snow, not wind, per this feature's own "do not make the
// rain excessively diagonal" note.
const MAX_WIND_LEAN_DEG = 22;
const WIND_LEAN_SPEED_CAP_KPH = 60;

function windAngleDeg(windDirectionDeg: number, windSpeedKph: number): number {
  // Meteorological "from" → "toward" (+180°); only the horizontal component decides lean
  // direction/magnitude, same simplification WindOverlay's own crossing direction uses.
  const towardRad = ((windDirectionDeg + 180) * Math.PI) / 180;
  const horizontal = Math.sin(towardRad);
  const magnitude = Math.min(1, windSpeedKph / WIND_LEAN_SPEED_CAP_KPH);
  return horizontal * magnitude * MAX_WIND_LEAN_DEG;
}

interface WeatherOverlayProps {
  quality?: WeatherQuality;
}

/**
 * Sits above ThrowMap, below the recipient carousel/letter/plane (see ThrowHomeScreen's own
 * mapArea) — the one place that decides *which* combination of weather renderers should currently
 * be visible, reading purely off ThrowWeatherContext's own resolved `weather`/`intensity`/wind.
 * Every renderer below stays permanently mounted, each independently toggled via its own `active`
 * prop (all already fade in/out over ~1.4–1.8s on their own) rather than this component
 * mounting/unmounting them — that's what turns a plain condition switch into the layered, gradual
 * transition the feature itself asks for (clouds arriving before rain reaches full density, wind
 * fading out as a storm clears, etc.) for free, with no extra transition-sequencing code needed
 * here. Reduce-motion is read once here and threaded to LightningController, the one renderer with
 * an actual flash rather than just continuous movement.
 */
export function WeatherOverlay({ quality }: WeatherOverlayProps) {
  const { weather, intensity, windSpeedKph, windDirectionDeg, reducedFlashing } = useThrowWeather();
  const reduceMotion = useReducedMotion();

  const isStorm = weather === 'thunderstorm';
  const isLightningOnly = weather === 'lightning';
  const showClear = weather === 'clear';
  const showCloud = weather === 'cloudy' || weather === 'rain' || weather === 'snow' || isStorm || isLightningOnly;
  const cloudDark = isStorm || isLightningOnly;
  const showRain = weather === 'rain' || isStorm;
  const showSnow = weather === 'snow';
  const showWind = weather === 'wind' || isStorm;
  const showLightning = isStorm || isLightningOnly;

  const rainIntensity: WeatherIntensity = isStorm ? 'heavy' : intensity;
  const angle = useMemo(() => windAngleDeg(windDirectionDeg, windSpeedKph), [windDirectionDeg, windSpeedKph]);
  const rainConfig = useMemo(
    () => ({ angle, speed: isStorm ? 1.35 : 1 + Math.min(1, windSpeedKph / WIND_LEAN_SPEED_CAP_KPH) * 0.3 }),
    [angle, isStorm, windSpeedKph],
  );
  const snowConfig = useMemo(() => ({ angle }), [angle]);

  return (
    <>
      <ClearOverlay active={showClear && !reduceMotion} />
      <CloudOverlay active={showCloud} dark={cloudDark} windSpeedKph={windSpeedKph} blobCount={cloudDark ? 5 : 4} />
      <RainOverlay active={showRain} intensity={rainIntensity} quality={quality} config={rainConfig} />
      <SnowOverlay active={showSnow} intensity={intensity} quality={quality} config={snowConfig} />
      <WindOverlay active={showWind} intensity={isStorm ? 'medium' : intensity} quality={quality} windSpeedKph={windSpeedKph} windDirectionDeg={windDirectionDeg} />
      <LightningController active={showLightning} reducedFlashing={reducedFlashing} reduceMotion={reduceMotion} />
    </>
  );
}
