import React from 'react';
import { render } from '@testing-library/react-native';
import { WeatherOverlay } from '../WeatherOverlay';
import { useThrowWeather } from '../../../../context/ThrowWeatherContext';
import { useReducedMotion } from '../../../../hooks/useReducedMotion';
import type { WeatherCondition } from '../../../../types/weather';

jest.mock('../../../../context/ThrowWeatherContext', () => ({ useThrowWeather: jest.fn() }));
jest.mock('../../../../hooks/useReducedMotion', () => ({ useReducedMotion: jest.fn() }));

let mockClearProps: any;
let mockCloudProps: any;
let mockRainProps: any;
let mockSnowProps: any;
let mockWindProps: any;
let mockLightningProps: any;

jest.mock('../ClearOverlay', () => ({ ClearOverlay: (p: any) => { mockClearProps = p; return null; } }));
jest.mock('../CloudOverlay', () => ({ CloudOverlay: (p: any) => { mockCloudProps = p; return null; } }));
jest.mock('../RainOverlay', () => ({ RainOverlay: (p: any) => { mockRainProps = p; return null; } }));
jest.mock('../SnowOverlay', () => ({ SnowOverlay: (p: any) => { mockSnowProps = p; return null; } }));
jest.mock('../WindOverlay', () => ({ WindOverlay: (p: any) => { mockWindProps = p; return null; } }));
jest.mock('../LightningController', () => ({ LightningController: (p: any) => { mockLightningProps = p; return null; } }));

const mockUseThrowWeather = useThrowWeather as jest.Mock;
const mockUseReducedMotion = useReducedMotion as jest.Mock;

function setWeather(weather: WeatherCondition, extra: Partial<{ intensity: string; windSpeedKph: number; windDirectionDeg: number; reducedFlashing: boolean }> = {}) {
  mockUseThrowWeather.mockReturnValue({
    weather,
    intensity: 'medium',
    windSpeedKph: 20,
    windDirectionDeg: 200,
    reducedFlashing: false,
    ...extra,
  });
}

describe('WeatherOverlay orchestration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseReducedMotion.mockReturnValue(false);
    mockClearProps = mockCloudProps = mockRainProps = mockSnowProps = mockWindProps = mockLightningProps = undefined;
  });

  it('clear: only ClearOverlay is active', async () => {
    setWeather('clear');
    await await render(<WeatherOverlay />);
    expect(mockClearProps.active).toBe(true);
    expect(mockCloudProps.active).toBe(false);
    expect(mockRainProps.active).toBe(false);
    expect(mockSnowProps.active).toBe(false);
    expect(mockWindProps.active).toBe(false);
    expect(mockLightningProps.active).toBe(false);
  });

  it('cloudy: only CloudOverlay is active, not the dark variant', async () => {
    setWeather('cloudy');
    await render(<WeatherOverlay />);
    expect(mockClearProps.active).toBe(false);
    expect(mockCloudProps.active).toBe(true);
    expect(mockCloudProps.dark).toBe(false);
    expect(mockRainProps.active).toBe(false);
  });

  it('rain: cloud + rain active, no lightning/wind, no dark clouds', async () => {
    setWeather('rain', { intensity: 'heavy' });
    await render(<WeatherOverlay />);
    expect(mockCloudProps.active).toBe(true);
    expect(mockCloudProps.dark).toBe(false);
    expect(mockRainProps.active).toBe(true);
    expect(mockRainProps.intensity).toBe('heavy');
    expect(mockWindProps.active).toBe(false);
    expect(mockLightningProps.active).toBe(false);
  });

  it('thunderstorm: cloud (dark) + rain (forced heavy) + wind + lightning all active', async () => {
    setWeather('thunderstorm', { intensity: 'light' });
    await render(<WeatherOverlay />);
    expect(mockCloudProps.active).toBe(true);
    expect(mockCloudProps.dark).toBe(true);
    expect(mockRainProps.active).toBe(true);
    // Thunderstorm's own rain is always forced to heavy, regardless of the underlying reading.
    expect(mockRainProps.intensity).toBe('heavy');
    expect(mockWindProps.active).toBe(true);
    expect(mockLightningProps.active).toBe(true);
    expect(mockSnowProps.active).toBe(false);
  });

  it('lightning: cloud (dark) + lightning active, no rain', async () => {
    setWeather('lightning');
    await render(<WeatherOverlay />);
    expect(mockCloudProps.active).toBe(true);
    expect(mockCloudProps.dark).toBe(true);
    expect(mockLightningProps.active).toBe(true);
    expect(mockRainProps.active).toBe(false);
    expect(mockWindProps.active).toBe(false);
  });

  it('wind: only WindOverlay is active', async () => {
    setWeather('wind');
    await render(<WeatherOverlay />);
    expect(mockWindProps.active).toBe(true);
    expect(mockCloudProps.active).toBe(false);
    expect(mockRainProps.active).toBe(false);
    expect(mockClearProps.active).toBe(false);
  });

  it('shares one WindController instance across Wind, Cloud, and Rain', async () => {
    setWeather('thunderstorm');
    await render(<WeatherOverlay />);
    expect(typeof mockWindProps.windController?.subscribe).toBe('function');
    expect(mockCloudProps.windController).toBe(mockWindProps.windController);
    expect(mockRainProps.windController).toBe(mockWindProps.windController);
  });

  it('snow: cloud (light) + snow active', async () => {
    setWeather('snow');
    await render(<WeatherOverlay />);
    expect(mockSnowProps.active).toBe(true);
    expect(mockCloudProps.active).toBe(true);
    expect(mockCloudProps.dark).toBe(false);
    expect(mockRainProps.active).toBe(false);
  });

  it('passes reducedFlashing straight through to LightningController', async () => {
    setWeather('thunderstorm', { reducedFlashing: true });
    await render(<WeatherOverlay />);
    expect(mockLightningProps.reducedFlashing).toBe(true);
  });

  it('disables ClearOverlay animation (but not lightning\'s own internal reduceMotion gate) when the OS prefers reduced motion', async () => {
    mockUseReducedMotion.mockReturnValue(true);
    setWeather('clear');
    await render(<WeatherOverlay />);
    expect(mockClearProps.active).toBe(false);
  });
});
