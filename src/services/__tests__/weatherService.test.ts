import { getCurrentWeather, normalizeWeatherCondition } from '../weatherService';

describe('normalizeWeatherCondition', () => {
  it('maps a light-rain WMO code to rain/light', () => {
    expect(normalizeWeatherCondition({ weatherCode: 51, precipitationMm: 0.2 })).toEqual({ condition: 'rain', intensity: 'light' });
    expect(normalizeWeatherCondition({ weatherCode: 61, precipitationMm: 0.4 })).toEqual({ condition: 'rain', intensity: 'light' });
  });

  it('maps a moderate-rain WMO code to rain/medium', () => {
    expect(normalizeWeatherCondition({ weatherCode: 63, precipitationMm: 4 })).toEqual({ condition: 'rain', intensity: 'medium' });
  });

  it('maps a heavy-rain WMO code to rain/heavy', () => {
    expect(normalizeWeatherCondition({ weatherCode: 65, precipitationMm: 9 })).toEqual({ condition: 'rain', intensity: 'heavy' });
    expect(normalizeWeatherCondition({ weatherCode: 82, precipitationMm: 12 })).toEqual({ condition: 'rain', intensity: 'heavy' });
  });

  it('lets an unusually heavy measured precipitation upgrade a nominally-light rain code', () => {
    // Code 51 ("light drizzle") on its own would read as light — a real 9mm reading is a stronger
    // signal than the code's own nominal bucket, so intensity should still come out heavy.
    expect(normalizeWeatherCondition({ weatherCode: 51, precipitationMm: 9 })).toEqual({ condition: 'rain', intensity: 'heavy' });
  });

  it('never lets a light measured amount downgrade a nominally-heavy rain code', () => {
    // The higher of the two signals always wins, never the lower one.
    expect(normalizeWeatherCondition({ weatherCode: 65, precipitationMm: 0.1 })).toEqual({ condition: 'rain', intensity: 'heavy' });
  });

  it('maps thunderstorm/snow/cloudy/clear codes to their own condition, none of them rain', () => {
    expect(normalizeWeatherCondition({ weatherCode: 95, precipitationMm: 5 }).condition).toBe('thunderstorm');
    expect(normalizeWeatherCondition({ weatherCode: 75, precipitationMm: 2 }).condition).toBe('snow');
    expect(normalizeWeatherCondition({ weatherCode: 2, precipitationMm: 0 }).condition).toBe('cloudy');
    expect(normalizeWeatherCondition({ weatherCode: 0, precipitationMm: 0 }).condition).toBe('clear');
  });

  it('falls back to clear for an unrecognized code rather than throwing', () => {
    expect(normalizeWeatherCondition({ weatherCode: 9999, precipitationMm: 0 })).toEqual({ condition: 'clear', intensity: 'light' });
  });
});

describe('getCurrentWeather', () => {
  const originalFetch = globalThis.fetch;
  afterEach(() => {
    globalThis.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('returns the weather code and precipitation from a successful response', async () => {
    globalThis.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ current: { weather_code: 61, precipitation: 1.2 } }),
    }) as unknown as typeof fetch;

    const result = await getCurrentWeather(19.07, 72.87);
    expect(result).toEqual({ weatherCode: 61, precipitationMm: 1.2 });
    expect(globalThis.fetch).toHaveBeenCalledWith(expect.stringContaining('latitude=19.07'));
    expect(globalThis.fetch).toHaveBeenCalledWith(expect.stringContaining('longitude=72.87'));
  });

  it('defaults precipitation to 0 when the response omits it', async () => {
    globalThis.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ current: { weather_code: 0 } }),
    }) as unknown as typeof fetch;

    expect(await getCurrentWeather(0, 0)).toEqual({ weatherCode: 0, precipitationMm: 0 });
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
