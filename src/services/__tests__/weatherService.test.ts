import { getCurrentWeather, normalizeWeatherCondition } from '../weatherService';

function raw(overrides: Partial<{ weatherCode: number; precipitationMm: number; windSpeedKph: number; windDirectionDeg: number; temperatureC: number; humidityPct: number; isDay: boolean }> = {}) {
  return {
    weatherCode: 0,
    precipitationMm: 0,
    windSpeedKph: 8,
    windDirectionDeg: 180,
    temperatureC: 22,
    humidityPct: 55,
    isDay: true,
    ...overrides,
  };
}

describe('normalizeWeatherCondition', () => {
  it('maps a light-rain WMO code to rain/light', () => {
    expect(normalizeWeatherCondition(raw({ weatherCode: 51, precipitationMm: 0.2 }))).toMatchObject({ condition: 'rain', intensity: 'light' });
    expect(normalizeWeatherCondition(raw({ weatherCode: 61, precipitationMm: 0.4 }))).toMatchObject({ condition: 'rain', intensity: 'light' });
  });

  it('maps a moderate-rain WMO code to rain/medium', () => {
    expect(normalizeWeatherCondition(raw({ weatherCode: 63, precipitationMm: 4 }))).toMatchObject({ condition: 'rain', intensity: 'medium' });
  });

  it('maps a heavy-rain WMO code to rain/heavy', () => {
    expect(normalizeWeatherCondition(raw({ weatherCode: 65, precipitationMm: 9 }))).toMatchObject({ condition: 'rain', intensity: 'heavy' });
    expect(normalizeWeatherCondition(raw({ weatherCode: 82, precipitationMm: 12 }))).toMatchObject({ condition: 'rain', intensity: 'heavy' });
  });

  it('lets an unusually heavy measured precipitation upgrade a nominally-light rain code', () => {
    expect(normalizeWeatherCondition(raw({ weatherCode: 51, precipitationMm: 9 }))).toMatchObject({ condition: 'rain', intensity: 'heavy' });
  });

  it('never lets a light measured amount downgrade a nominally-heavy rain code', () => {
    expect(normalizeWeatherCondition(raw({ weatherCode: 65, precipitationMm: 0.1 }))).toMatchObject({ condition: 'rain', intensity: 'heavy' });
  });

  it('maps thunderstorm codes to thunderstorm, escalating intensity with hail codes', () => {
    expect(normalizeWeatherCondition(raw({ weatherCode: 95 }))).toMatchObject({ condition: 'thunderstorm', intensity: 'medium' });
    expect(normalizeWeatherCondition(raw({ weatherCode: 96 }))).toMatchObject({ condition: 'thunderstorm', intensity: 'heavy' });
    expect(normalizeWeatherCondition(raw({ weatherCode: 99 }))).toMatchObject({ condition: 'thunderstorm', intensity: 'heavy' });
  });

  it('maps snow codes to snow at their own nominal intensity', () => {
    expect(normalizeWeatherCondition(raw({ weatherCode: 71 }))).toMatchObject({ condition: 'snow', intensity: 'light' });
    expect(normalizeWeatherCondition(raw({ weatherCode: 73 }))).toMatchObject({ condition: 'snow', intensity: 'medium' });
    expect(normalizeWeatherCondition(raw({ weatherCode: 75 }))).toMatchObject({ condition: 'snow', intensity: 'heavy' });
  });

  it('escalates snow intensity when wind is heavy, without changing the condition', () => {
    expect(normalizeWeatherCondition(raw({ weatherCode: 71, windSpeedKph: 60 }))).toMatchObject({ condition: 'snow', intensity: 'medium' });
  });

  it('maps a cloudy code to cloudy when wind is unremarkable', () => {
    expect(normalizeWeatherCondition(raw({ weatherCode: 2, windSpeedKph: 10 }))).toMatchObject({ condition: 'cloudy', intensity: 'light' });
  });

  it('maps a clear code at night to clear when wind is unremarkable', () => {
    expect(normalizeWeatherCondition(raw({ weatherCode: 0, windSpeedKph: 10, isDay: false }))).toMatchObject({ condition: 'clear', intensity: 'light' });
  });

  it('maps a clear code during the day to sunny (the same code stays clear at night) when wind is unremarkable', () => {
    expect(normalizeWeatherCondition(raw({ weatherCode: 0, windSpeedKph: 10, isDay: true }))).toMatchObject({ condition: 'sunny', intensity: 'light' });
  });

  it('surfaces strong wind on an otherwise clear/cloudy reading as its own "wind" condition', () => {
    expect(normalizeWeatherCondition(raw({ weatherCode: 0, windSpeedKph: 35 }))).toMatchObject({ condition: 'wind', intensity: 'light' });
    expect(normalizeWeatherCondition(raw({ weatherCode: 2, windSpeedKph: 60 }))).toMatchObject({ condition: 'wind', intensity: 'heavy' });
  });

  it('never lets wind override an active rain/snow/thunderstorm condition', () => {
    expect(normalizeWeatherCondition(raw({ weatherCode: 61, windSpeedKph: 60 })).condition).toBe('rain');
    expect(normalizeWeatherCondition(raw({ weatherCode: 95, windSpeedKph: 60 })).condition).toBe('thunderstorm');
  });

  it('falls back to clear for an unrecognized code rather than throwing', () => {
    expect(normalizeWeatherCondition(raw({ weatherCode: 9999, isDay: false }))).toMatchObject({ condition: 'clear', intensity: 'light' });
  });

  it('carries wind/precipitation/temperature/humidity straight through, unmodified', () => {
    const result = normalizeWeatherCondition(raw({ weatherCode: 61, precipitationMm: 3, windSpeedKph: 14, windDirectionDeg: 240, temperatureC: 27, humidityPct: 84 }));
    expect(result).toMatchObject({ windSpeedKph: 14, windDirectionDeg: 240, precipitationMm: 3, temperatureC: 27, humidityPct: 84 });
  });
});

describe('getCurrentWeather', () => {
  const originalFetch = globalThis.fetch;
  afterEach(() => {
    globalThis.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('returns every field from a successful response', async () => {
    globalThis.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        current: { weather_code: 61, precipitation: 1.2, wind_speed_10m: 18, wind_direction_10m: 245, temperature_2m: 27, relative_humidity_2m: 84, is_day: 1 },
      }),
    }) as unknown as typeof fetch;

    const result = await getCurrentWeather(19.07, 72.87);
    expect(result).toEqual({ weatherCode: 61, precipitationMm: 1.2, windSpeedKph: 18, windDirectionDeg: 245, temperatureC: 27, humidityPct: 84, isDay: true });
    expect(globalThis.fetch).toHaveBeenCalledWith(expect.stringContaining('latitude=19.07'));
    expect(globalThis.fetch).toHaveBeenCalledWith(expect.stringContaining('longitude=72.87'));
    expect(globalThis.fetch).toHaveBeenCalledWith(expect.stringContaining('is_day'));
  });

  it('defaults every optional field (including isDay, to false) when the response omits them', async () => {
    globalThis.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ current: { weather_code: 0 } }),
    }) as unknown as typeof fetch;

    expect(await getCurrentWeather(0, 0)).toEqual({ weatherCode: 0, precipitationMm: 0, windSpeedKph: 0, windDirectionDeg: 0, temperatureC: 20, humidityPct: 50, isDay: false });
  });

  it('returns null (never throws) on a non-OK response', async () => {
    globalThis.fetch = jest.fn().mockResolvedValue({ ok: false, json: async () => ({}) }) as unknown as typeof fetch;
    expect(await getCurrentWeather(0, 0)).toBeNull();
  });

  it('returns null (never throws) when the network request itself fails', async () => {
    globalThis.fetch = jest.fn().mockRejectedValue(new Error('offline')) as unknown as typeof fetch;
    await expect(getCurrentWeather(0, 0)).resolves.toBeNull();
  });

  it('returns null when the response is missing a usable weather_code', async () => {
    globalThis.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ current: {} }) }) as unknown as typeof fetch;
    expect(await getCurrentWeather(0, 0)).toBeNull();
  });
});
