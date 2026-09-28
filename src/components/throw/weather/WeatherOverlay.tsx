import React, { useMemo } from 'react';
import { ClearOverlay } from './ClearOverlay';
import { SunnyRenderer } from './SunnyRenderer';
import { CloudOverlay } from './CloudOverlay';
import { RainOverlay } from './RainOverlay';
import { SnowOverlay } from './SnowOverlay';
import { WindOverlay } from './WindOverlay';
import { LightningController } from './LightningController';
import { useWindController } from './useWindController';
import { useThrowWeather } from '../../../context/ThrowWeatherContext';
import { useReducedMotion } from '../../../hooks/useReducedMotion';
import type { WeatherIntensity, WeatherQuality } from '../../../types/weather';

// Baseline gust/turbulence WeatherOverlay feeds WindController with — ThrowWeatherContext only
// tracks a steady windSpeedKph/windDirectionDeg (a single reading, real or manual), not gustiness,
// so these are fixed per weather condition rather than derived from anything in context. Storms get
// a livelier wind than an ordinary breezy day (per this feature's own "storm intensifies everything
// a little" note), everything else shares one calm-but-alive baseline.
const BASE_GUST_STRENGTH = 0.35;
const BASE_TURBULENCE = 0.4;
const STORM_GUST_STRENGTH = 0.6;
const STORM_TURBULENCE = 0.55;

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
  const showSunny = weather === 'sunny';
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

  // One shared WindController per mount (see useWindController's own doc comment on why it's never
  // recreated on a config change) — Wind/Leaves, Clouds, and Rain's own gust-lean all subscribe to
  // this single instance rather than each running independent wind math, per this feature's own
  // "shared animation loops" requirement. Config values are read continuously (windSpeedKph/
  // windDirectionDeg already update on their own whenever ThrowWeatherContext gets a fresh reading);
  // only gustStrength/turbulence step between the two fixed baselines above.
  const windConfig = useMemo(
    () => ({
      speed: windSpeedKph,
      direction: windDirectionDeg,
      gustStrength: isStorm ? STORM_GUST_STRENGTH : BASE_GUST_STRENGTH,
      turbulence: isStorm ? STORM_TURBULENCE : BASE_TURBULENCE,
    }),
    [windSpeedKph, windDirectionDeg, isStorm],
  );
  const windController = useWindController(windConfig, reduceMotion);

  return (
    <>
      <ClearOverlay active={showClear && !reduceMotion} />
      <SunnyRenderer active={showSunny} reduceMotion={reduceMotion} />
      <CloudOverlay active={showCloud} dark={cloudDark} windController={windController} />
      <RainOverlay active={showRain} intensity={rainIntensity} quality={quality} config={rainConfig} windController={windController} />
      <SnowOverlay active={showSnow} intensity={intensity} quality={quality} config={snowConfig} />
      <WindOverlay active={showWind} intensity={isStorm ? 'medium' : intensity} quality={quality} windController={windController} />
      <LightningController active={showLightning} reducedFlashing={reducedFlashing} reduceMotion={reduceMotion} />
    </>
  );
}
