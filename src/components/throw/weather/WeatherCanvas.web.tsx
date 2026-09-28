import React, { useEffect, useRef } from 'react';
import { AppState, StyleSheet, View } from 'react-native';
import { createWeatherEngine, type WeatherEngine } from './weatherEngine';
import { useThrowWeather } from '../../../context/ThrowWeatherContext';
import { useReducedMotion } from '../../../hooks/useReducedMotion';

/**
 * Web renderer for Throw's weather — replaces the per-condition Clear/Cloud/Rain/Snow/Wind/
 * Lightning overlays on web with the single-canvas engine from the W123 prototype. Reads the same
 * ThrowWeatherContext fields WeatherOverlay already does, so Throw Settings' Automatic toggle,
 * condition grid, Intensity sheet and Reduce Flashing drive it with no settings-side changes.
 * pointerEvents="none" so the map underneath stays pannable.
 */
export function WeatherCanvas() {
  const hostRef = useRef<View | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const engineRef = useRef<WeatherEngine | null>(null);
  const { weather, intensity, reducedFlashing } = useThrowWeather();
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    const host = hostRef.current as unknown as HTMLElement | null;
    if (!host) return;
    const canvas = document.createElement('canvas');
    canvas.style.position = 'absolute';
    canvas.style.inset = '0';
    canvas.style.pointerEvents = 'none';
    host.appendChild(canvas);
    canvasRef.current = canvas;
    const r = host.getBoundingClientRect();
    const engine = createWeatherEngine(canvas, { width: r.width || 390, height: r.height || 844 });
    engineRef.current = engine;

    const ro = new ResizeObserver(([e]) => engine.resize(e.contentRect.width, e.contentRect.height));
    ro.observe(host);
    const sub = AppState.addEventListener('change', (s) => (s === 'active' ? engine.resume() : engine.pause()));
    const onVis = () => (document.hidden ? engine.pause() : engine.resume());
    document.addEventListener('visibilitychange', onVis);

    return () => {
      ro.disconnect();
      sub.remove();
      document.removeEventListener('visibilitychange', onVis);
      engine.destroy();
      canvas.remove();
      engineRef.current = null;
    };
  }, []);

  useEffect(() => { engineRef.current?.setWeather(weather, intensity); }, [weather, intensity]);
  useEffect(() => { engineRef.current?.setReducedFlashing(reducedFlashing); }, [reducedFlashing]);
  useEffect(() => { engineRef.current?.setReduceMotion(reduceMotion); }, [reduceMotion]);

  return <View ref={hostRef} pointerEvents="none" style={StyleSheet.absoluteFill} />;
}
