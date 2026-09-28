import React from 'react';
import { RainOverlay } from './RainOverlay';
import { useThrowWeather } from '../../../context/ThrowWeatherContext';
import type { RainConfig, WeatherQuality } from '../../../types/weather';

interface WeatherOverlayProps {
  quality?: WeatherQuality;
  rainConfig?: Partial<RainConfig>;
}

/**
 * Sits above ThrowMap, below the recipient carousel/letter/plane (see ThrowHomeScreen's own
 * mapArea) — the one place that decides *which* weather renderer, if any, should currently be
 * showing, reading purely off ThrowWeatherContext's own `weather`/`intensity`. Only rain is
 * actually implemented today; every other WeatherCondition (including 'clear') renders nothing.
 * Adding a future condition means adding its own renderer + branch here — RainOverlay stays
 * permanently mounted (see its own `active` prop) so its start/stop density transition can always
 * play in both directions rather than the whole thing popping in/out with the weather.
 */
export function WeatherOverlay({ quality, rainConfig }: WeatherOverlayProps) {
  const { weather, intensity } = useThrowWeather();
  return <RainOverlay active={weather === 'rain'} intensity={intensity} quality={quality} config={rainConfig} />;
}
