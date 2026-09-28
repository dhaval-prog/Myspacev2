import type { NormalizedWeather, WeatherIntensity } from '../types/weather';

/** Open-Meteo (open-meteo.com) — chosen specifically because its current-weather endpoint needs no
 * API key/account at all, so there's no secret to keep out of the client and nothing for the user
 * to sign up for. Overridable via env the same way Throw's Mapbox style URL already is, e.g. to
 * point at a self-hosted instance, but ships with a working default out of the box. */
const OPEN_METEO_BASE_URL = process.env.EXPO_PUBLIC_OPEN_METEO_BASE_URL ?? 'https://api.open-meteo.com/v1/forecast';

/** Only the fields normalizeWeatherCondition actually reads — Open-Meteo's real response has much
 * more (hourly/daily blocks, units, etc.) that this app has no use for. */
export interface RawWeatherData {
  weatherCode: number;
  precipitationMm: number;
}

/** WMO weather codes Open-Meteo's `current.weather_code` uses — grouped by which
 * WeatherCondition they map to. Kept as plain arrays (not a switch) so extending any group later
 * (or adding a new one, e.g. for wind) is a one-line change. */
const RAIN_CODES = new Set([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82]);
const THUNDERSTORM_CODES = new Set([95, 96, 99]);
const SNOW_CODES = new Set([71, 73, 75, 77, 85, 86]);
const CLOUDY_CODES = new Set([1, 2, 3, 45, 48]);

// Which of each group's own codes count as its lightest/heaviest end — used only for rain today
// (see intensityFromRaw below), kept per-group so thunderstorm/snow can reuse the same shape once
// those are actually rendered.
const RAIN_LIGHT_CODES = new Set([51, 56, 61, 80]);
const RAIN_HEAVY_CODES = new Set([55, 65, 66, 67, 82]);

// Precipitation-amount fallback/override thresholds (mm, Open-Meteo's `current.precipitation` is
// the last hour's accumulation) — a real measured amount is trusted over the code's own nominal
// bucket when they disagree, since the code is just Open-Meteo's own summary of the same data.
const LIGHT_PRECIP_MAX_MM = 2.5;
const HEAVY_PRECIP_MIN_MM = 7.6;

function intensityRank(i: WeatherIntensity): number {
  return i === 'light' ? 0 : i === 'medium' ? 1 : 2;
}

function intensityFromCode(code: number): WeatherIntensity {
  if (RAIN_LIGHT_CODES.has(code)) return 'light';
  if (RAIN_HEAVY_CODES.has(code)) return 'heavy';
  return 'medium';
}

function intensityFromPrecipitationMm(mm: number): WeatherIntensity {
  if (mm >= HEAVY_PRECIP_MIN_MM) return 'heavy';
  if (mm <= LIGHT_PRECIP_MAX_MM) return 'light';
  return 'medium';
}

/**
 * Turns a provider-specific weather reading into the small, stable shape the rest of Throw
 * actually consumes (see NormalizedWeather) — every bit of Open-Meteo's own vocabulary (WMO codes,
 * mm of precipitation) stays inside this function, so swapping providers later only means rewriting
 * getCurrentWeather + this one function, never anything downstream (ThrowWeatherContext,
 * WeatherOverlay, Throw Settings all only ever see NormalizedWeather).
 */
export function normalizeWeatherCondition(raw: RawWeatherData): NormalizedWeather {
  const { weatherCode, precipitationMm } = raw;

  if (RAIN_CODES.has(weatherCode)) {
    // The higher of the two signals wins — real measured precipitation is only a *stronger* signal
    // than the code's own nominal bucket, never a weaker one (e.g. a "slight rain" code with an
    // unusually heavy measured accumulation should still read as heavy).
    const fromCode = intensityFromCode(weatherCode);
    const fromPrecip = intensityFromPrecipitationMm(precipitationMm);
    const intensity = intensityRank(fromPrecip) > intensityRank(fromCode) ? fromPrecip : fromCode;
    return { condition: 'rain', intensity };
  }
  if (THUNDERSTORM_CODES.has(weatherCode)) return { condition: 'thunderstorm', intensity: 'heavy' };
  if (SNOW_CODES.has(weatherCode)) return { condition: 'snow', intensity: 'medium' };
  if (CLOUDY_CODES.has(weatherCode)) return { condition: 'cloudy', intensity: 'light' };
  return { condition: 'clear', intensity: 'light' };
}

/**
 * Fetches the current weather for one lat/lng from Open-Meteo — returns null (never throws) on any
 * network/parse failure, since a missing weather reading should just mean "fall back to the normal
 * map" (see ThrowWeatherContext), not break anything else in Throw. This is the one function that
 * would need to change to swap providers.
 */
export async function getCurrentWeather(latitude: number, longitude: number): Promise<RawWeatherData | null> {
  try {
    const url = `${OPEN_METEO_BASE_URL}?latitude=${latitude}&longitude=${longitude}&current=precipitation,weather_code`;
    const response = await fetch(url);
    if (!response.ok) return null;
    const data = await response.json();
    const current = data?.current;
    if (!current || typeof current.weather_code !== 'number') return null;
    return {
      weatherCode: current.weather_code,
      precipitationMm: typeof current.precipitation === 'number' ? current.precipitation : 0,
    };
  } catch (e) {
    console.warn('[WeatherService] getCurrentWeather failed:', e instanceof Error ? e.message : e);
    return null;
  }
}
