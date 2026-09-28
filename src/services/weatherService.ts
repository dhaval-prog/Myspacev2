import type { NormalizedWeather, WeatherCondition, WeatherIntensity } from '../types/weather';

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
  windSpeedKph: number;
  windDirectionDeg: number;
  temperatureC: number;
  humidityPct: number;
  /** Open-Meteo's own `current.is_day` (1 daytime / 0 night) — the one extra field 'sunny'
   * classification needs (see conditionIntensity below), fetched in the same request as everything
   * else so this never costs a second API call. Defaults to false (night) when missing, the more
   * conservative reading — an uncertain daytime call should fall back to the existing 'clear'
   * behavior, never quietly invent a new 'sunny' reading. */
  isDay: boolean;
}

/** WMO weather codes Open-Meteo's `current.weather_code` uses — grouped by which
 * WeatherCondition they map to. Kept as plain arrays (not a switch) so extending any group later is
 * a one-line change. */
const RAIN_CODES = new Set([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82]);
const THUNDERSTORM_CODES = new Set([95, 96, 99]);
const SNOW_CODES = new Set([71, 73, 75, 77, 85, 86]);
const CLOUDY_CODES = new Set([1, 2, 3, 45, 48]);

// Which of each group's own codes count as its lightest/heaviest end — a real measured amount
// (precipitation for rain, wind speed for wind) only ever *upgrades* the intensity this implies,
// never downgrades it (see intensityRank's own use below).
const RAIN_LIGHT_CODES = new Set([51, 56, 61, 80]);
const RAIN_HEAVY_CODES = new Set([55, 65, 66, 67, 82]);
const SNOW_LIGHT_CODES = new Set([71, 77, 85]);
const SNOW_HEAVY_CODES = new Set([75, 86]);
const THUNDERSTORM_HEAVY_CODES = new Set([96, 99]);

// Precipitation-amount fallback/override thresholds (mm, Open-Meteo's `current.precipitation` is
// the last hour's accumulation) — a real measured amount is trusted over the code's own nominal
// bucket when they disagree.
const LIGHT_PRECIP_MAX_MM = 2.5;
const HEAVY_PRECIP_MIN_MM = 7.6;

// Below this, wind is just a number carried along on NormalizedWeather for whatever condition is
// otherwise active (e.g. angling rain/snow, or how fast clouds drift) — at or above it, a
// precipitation-free reading surfaces as its own 'wind' condition instead of plain clear/cloudy,
// per the feature's own "strong wind → wind" mapping.
const STRONG_WIND_KPH = 30;
const HEAVY_WIND_KPH = 55;

function intensityRank(i: WeatherIntensity): number {
  return i === 'light' ? 0 : i === 'medium' ? 1 : 2;
}
function higherIntensity(a: WeatherIntensity, b: WeatherIntensity): WeatherIntensity {
  return intensityRank(b) > intensityRank(a) ? b : a;
}

function intensityFromPrecipitationMm(mm: number): WeatherIntensity {
  if (mm >= HEAVY_PRECIP_MIN_MM) return 'heavy';
  if (mm <= LIGHT_PRECIP_MAX_MM) return 'light';
  return 'medium';
}
function intensityFromWindKph(kph: number): WeatherIntensity {
  if (kph >= HEAVY_WIND_KPH) return 'heavy';
  if (kph < STRONG_WIND_KPH + 10) return 'light';
  return 'medium';
}

function conditionIntensity(weatherCode: number, precipitationMm: number, windSpeedKph: number, isDay: boolean): { condition: WeatherCondition; intensity: WeatherIntensity } {
  if (RAIN_CODES.has(weatherCode)) {
    const fromCode: WeatherIntensity = RAIN_LIGHT_CODES.has(weatherCode) ? 'light' : RAIN_HEAVY_CODES.has(weatherCode) ? 'heavy' : 'medium';
    return { condition: 'rain', intensity: higherIntensity(fromCode, intensityFromPrecipitationMm(precipitationMm)) };
  }
  if (THUNDERSTORM_CODES.has(weatherCode)) {
    return { condition: 'thunderstorm', intensity: THUNDERSTORM_HEAVY_CODES.has(weatherCode) ? 'heavy' : 'medium' };
  }
  if (SNOW_CODES.has(weatherCode)) {
    const fromCode: WeatherIntensity = SNOW_LIGHT_CODES.has(weatherCode) ? 'light' : SNOW_HEAVY_CODES.has(weatherCode) ? 'heavy' : 'medium';
    // Snow + wind → snow with stronger wind parameters, not its own condition (see this feature's
    // own overlap rules) — wind only escalates snow's intensity here, never replaces it.
    return { condition: 'snow', intensity: windSpeedKph >= HEAVY_WIND_KPH ? higherIntensity(fromCode, 'medium') : fromCode };
  }
  // Precipitation-free: strong wind takes over as its own condition; otherwise cloudy/clear as
  // usual (cloudy + strong wind still carries the real wind speed/direction for the cloud layer's
  // own drift, it just isn't strong enough here to become the headline condition).
  if (windSpeedKph >= STRONG_WIND_KPH && (CLOUDY_CODES.has(weatherCode) || weatherCode === 0)) {
    return { condition: 'wind', intensity: intensityFromWindKph(windSpeedKph) };
  }
  if (CLOUDY_CODES.has(weatherCode)) return { condition: 'cloudy', intensity: 'light' };
  // Only a truly clear-sky code (0) reaches here. Daytime reads as genuinely "sunny" (this
  // feature's own Clear-vs-Sunny distinction — see types/weather.ts); the exact same code at night
  // stays 'clear', preserving every existing automatic Clear reading exactly as it was.
  return { condition: isDay ? 'sunny' : 'clear', intensity: 'light' };
}

/**
 * Turns a provider-specific weather reading into the small, stable shape the rest of Throw
 * actually consumes (see NormalizedWeather) — every bit of Open-Meteo's own vocabulary (WMO codes,
 * km/h, etc.) stays inside this function, so swapping providers later only means rewriting
 * getCurrentWeather + this one function, never anything downstream (ThrowWeatherContext,
 * WeatherOverlay, Throw Settings all only ever see NormalizedWeather).
 */
export function normalizeWeatherCondition(raw: RawWeatherData): NormalizedWeather {
  const { weatherCode, precipitationMm, windSpeedKph, windDirectionDeg, temperatureC, humidityPct, isDay } = raw;
  const { condition, intensity } = conditionIntensity(weatherCode, precipitationMm, windSpeedKph, isDay);
  return { condition, intensity, windSpeedKph, windDirectionDeg, precipitationMm, temperatureC, humidityPct };
}

/**
 * Fetches the current weather for one lat/lng from Open-Meteo — returns null (never throws) on any
 * network/parse failure, since a missing weather reading should just mean "fall back to the normal
 * map" (see ThrowWeatherContext), not break anything else in Throw. This is the one function that
 * would need to change to swap providers.
 */
export async function getCurrentWeather(latitude: number, longitude: number): Promise<RawWeatherData | null> {
  try {
    const fields = 'precipitation,weather_code,wind_speed_10m,wind_direction_10m,temperature_2m,relative_humidity_2m,is_day';
    const url = `${OPEN_METEO_BASE_URL}?latitude=${latitude}&longitude=${longitude}&current=${fields}`;
    const response = await fetch(url);
    if (!response.ok) return null;
    const data = await response.json();
    const current = data?.current;
    if (!current || typeof current.weather_code !== 'number') return null;
    const num = (v: unknown, fallback: number) => (typeof v === 'number' && Number.isFinite(v) ? v : fallback);
    return {
      weatherCode: current.weather_code,
      precipitationMm: num(current.precipitation, 0),
      windSpeedKph: num(current.wind_speed_10m, 0),
      windDirectionDeg: num(current.wind_direction_10m, 0),
      temperatureC: num(current.temperature_2m, 20),
      humidityPct: num(current.relative_humidity_2m, 50),
      isDay: current.is_day === 1 || current.is_day === true,
    };
  } catch (e) {
    console.warn('[WeatherService] getCurrentWeather failed:', e instanceof Error ? e.message : e);
    return null;
  }
}
