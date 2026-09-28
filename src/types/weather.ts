/** Every weather condition Throw's weather system supports. Every one of these actually renders
 * now (see WeatherOverlay) — 'lightning' is reachable manually as its own standalone look (dark,
 * cloudy, occasional flashes, no rain) as well as automatically as part of 'thunderstorm'. */
export type WeatherCondition = 'clear' | 'cloudy' | 'rain' | 'thunderstorm' | 'lightning' | 'wind' | 'snow';

/** How Throw decides what the weather currently is — 'automatic' asks WeatherService using the
 * existing Throw location; 'manual' is whatever the user picked in Throw Settings, independent of
 * any real weather. */
export type WeatherMode = 'automatic' | 'manual';

/** How heavy the active condition is. Automatic mode derives this from real precipitation/wind
 * (see weatherService.ts); manual mode uses ThrowWeatherState.manualIntensity, settable in Throw
 * Settings (Low/Medium/High in the UI). */
export type WeatherIntensity = 'light' | 'medium' | 'heavy';

/** The result of asking WeatherService what the weather actually is, already reduced to just what
 * Throw's UI needs — everything provider-specific (raw codes, units) stays inside
 * weatherService.ts and never reaches a component. Wind/precipitation/temperature/humidity are
 * always present (0 where not applicable, e.g. precipitationMm on a clear day) so every renderer
 * can read them unconditionally rather than null-checking. */
export interface NormalizedWeather {
  condition: WeatherCondition;
  intensity: WeatherIntensity;
  /** km/h. */
  windSpeedKph: number;
  /** Degrees, meteorological convention (0 = wind blowing FROM the north, 90 = from the east) —
   * same convention Open-Meteo's own wind_direction_10m uses, converted to "blowing toward" degrees
   * for rendering in weatherWind.ts (particles should drift the direction the wind blows *toward*,
   * not the direction it blows *from*). */
  windDirectionDeg: number;
  precipitationMm: number;
  temperatureC: number;
  humidityPct: number;
}

/** Centralized weather state for the whole Throw feature (see ThrowWeatherContext) — nothing about
 * how any of this renders lives here, just what's currently true. */
export interface ThrowWeatherState {
  mode: WeatherMode;
  manualCondition: WeatherCondition;
  /** Only meaningful when mode is 'manual' — Low/Medium/High in Throw Settings. Automatic mode
   * always derives its own intensity from the real reading instead (see `intensity` below). */
  manualIntensity: WeatherIntensity;
  /** What's actually active right now — automatic mode's own latest normalized reading's
   * condition, or manualCondition verbatim when mode is 'manual'. This, not mode/manualCondition
   * individually, is what WeatherOverlay renders from. */
  weather: WeatherCondition;
  intensity: WeatherIntensity;
  windSpeedKph: number;
  windDirectionDeg: number;
  /** Removes bright lightning flashes in favor of a subtle brightness change instead (see
   * LightningController) — independent of the OS's own reduce-motion setting, which
   * WeatherOverlay/every renderer already respects separately. Persisted the same way
   * mode/manualCondition are. */
  reducedFlashing: boolean;
  isLoading: boolean;
  lastUpdated?: number;
}

/** The fully-resolved configuration WeatherOverlay hands its renderers — matches what the feature
 * request itself calls WeatherConfig. Distinct from ThrowWeatherState: this is "what to render right
 * now", already collapsed from mode/manualCondition/automaticWeather into one concrete shape. */
export interface WeatherConfig {
  state: WeatherCondition;
  /** 0–1 — WeatherOverlay's own numeric translation of WeatherIntensity, what every renderer's
   * particle-density math actually multiplies by. */
  intensity: number;
  windSpeed: number;
  windDirection: number;
  precipitation: number;
}

/** Tunable rain/snow/wind-particle parameters — shared by every falling/drifting-particle renderer
 * (see weatherParticles.ts) rather than each inventing its own. `angleDeg` is a plain configurable
 * number specifically so wind can push it around (see windAngleDeg in weatherWind.ts) without any
 * renderer's own math changing. */
export interface RainConfig {
  /** 0 (nothing) – 1 (the heaviest this device/quality tier ever renders). */
  intensity: number;
  /** Multiplies every particle's fall speed — 1 is a renderer's own default per-layer pace. */
  speed: number;
  /** Degrees off vertical the particles fall at (positive = leaning right). */
  angle: number;
  /** Multiplies every particle's own opacity. */
  opacity: number;
}

/** How many particles/layers WeatherOverlay's renderers actually draw — independent of
 * WeatherIntensity (a fact about the weather); this is a fact about performance. Defaults per
 * platform in weatherParticles.ts's own QUALITY_LAYER_COUNTS; overridable for a future settings
 * toggle or device-tier check. */
export type WeatherQuality = 'high' | 'medium' | 'low';
