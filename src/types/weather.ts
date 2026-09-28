/** Every weather condition Throw's weather system is meant to eventually support — only 'rain' is
 * actually implemented right now (see WeatherOverlay); the rest exist purely so the normalized
 * shape, the settings UI, and WeatherOverlay's own renderer slots don't need reworking later to
 * add them. Anything the real API/manual selection resolves to that isn't 'rain' behaves exactly
 * like 'clear' today: the normal map, no overlay. */
export type WeatherCondition = 'clear' | 'cloudy' | 'rain' | 'thunderstorm' | 'lightning' | 'wind' | 'snow';

/** How Throw decides what the weather currently is — 'automatic' asks WeatherService using the
 * existing Throw location; 'manual' is whatever the user picked in Throw Settings, independent of
 * any real weather. */
export type WeatherMode = 'automatic' | 'manual';

/** How heavy the active condition is — currently only meaningful for 'rain' (see
 * intensityFromPrecipitationMm in weatherService.ts for how automatic mode derives it from real
 * precipitation, and RainOverlay's own per-intensity particle-count table). */
export type WeatherIntensity = 'light' | 'medium' | 'heavy';

/** The result of asking WeatherService what the weather actually is, already reduced to just what
 * Throw's UI needs — everything provider-specific (raw codes, units, forecast fields) stays inside
 * weatherService.ts and never reaches a component. */
export interface NormalizedWeather {
  condition: WeatherCondition;
  intensity: WeatherIntensity;
}

/** Centralized weather state for the whole Throw feature (see ThrowWeatherContext) — nothing about
 * how any of this renders lives here, just what's currently true. */
export interface ThrowWeatherState {
  mode: WeatherMode;
  /** Only 'clear' or 'rain' is ever selectable from Settings today (see ManualCondition in
   * ThrowSettingsScreen), but this stays the full union so a future manual weather picker doesn't
   * need a type change. */
  manualCondition: WeatherCondition;
  /** What's actually active right now — automatic mode's own latest normalized reading, or
   * manualCondition verbatim when mode is 'manual'. This, not mode/manualCondition individually, is
   * what WeatherOverlay renders from. */
  weather: WeatherCondition;
  intensity: WeatherIntensity;
  isLoading: boolean;
  lastUpdated?: number;
}

/** Tunable rain-specific parameters — deliberately separate from WeatherIntensity/WeatherQuality
 * (which are about density/perf), this is about *feel*. `angle`'s own doc comment has the reason
 * it's a plain number now rather than something wind derives later. */
export interface RainConfig {
  /** 0 (nothing) – 1 (the heaviest this device/quality tier ever renders) — RainOverlay maps its
   * own WeatherIntensity prop to a value in this range internally; exposed here mainly so a
   * future caller (e.g. a debug/dev tool) could override it directly. */
  intensity: number;
  /** Multiplies every particle's fall speed — 1 is RainOverlay's own default per-layer pace. */
  speed: number;
  /** Degrees off vertical the rain falls at (positive = leaning right) — kept a plain configurable
   * number, not hardcoded, specifically so a future WindRenderer/wind reading can push this around
   * without RainOverlay's own math changing. */
  angle: number;
  /** Multiplies every particle's own opacity — separate from `intensity` (which is about *how much*
   * rain, not how see-through each drop is) so a future "haze" condition could dim rain further
   * without changing its density. */
  opacity: number;
}

/** How many particles/layers WeatherOverlay's renderers actually draw — independent of
 * WeatherIntensity (which is "how much is it raining", a fact about the weather); this is "how much
 * can this device afford to render", a fact about performance. Defaults per platform in
 * RainOverlay's own QUALITY_PARTICLE_COUNTS; overridable via WeatherOverlay's own quality prop for
 * a future settings toggle or device-tier check. */
export type WeatherQuality = 'high' | 'medium' | 'low';
