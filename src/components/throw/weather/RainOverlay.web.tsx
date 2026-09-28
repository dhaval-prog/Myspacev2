import React, { useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { generateRainParticles, RAIN_LAYER_SPEED_MULTIPLIER } from './rainParticles';
import type { WindController } from './windController';
import type { RainConfig, WeatherIntensity, WeatherQuality } from '../../../types/weather';

const BASE_LOOP_MS = 2400;
const DEFAULT_ANGLE_DEG = 8;
const PRESENCE_DURATION_MS = 1400;
const RAIN_DROP_RGB = '214,226,240';
const ATMOSPHERE_RGB = '18,26,38';
const ATMOSPHERE_MAX_OPACITY = 0.12;
// Same scoped, rotate-only wind connection as RainOverlay.native.tsx (see its own doc comment) —
// read every frame from a ref a separate effect updates, so it never needs to restart the main tick
// loop (and therefore never touches the fall-speed math) just because the wind sample changed.
const GUST_LEAN_SCALE_DEG = 14;

interface RainOverlayProps {
  active: boolean;
  intensity: WeatherIntensity;
  /** Web defaults higher than native's own default — a raw canvas `requestAnimationFrame` loop
   * (see this file's own doc comment on why that's what's used here instead of Animated/DOM nodes)
   * affords noticeably more particles for the same cost. */
  quality?: WeatherQuality;
  config?: Partial<RainConfig>;
  /** Optional — when given, a gust nudges rain's own lean angle a little more diagonal for the
   * gust's duration (see GUST_LEAN_SCALE_DEG). Omit to keep rain wind-independent. */
  windController?: WindController;
}

/**
 * Rain rendered on a single `<canvas>`, redrawn every frame via `requestAnimationFrame` — the
 * "canvas-based rendering" this feature's own performance notes ask for. Deliberately not RN's own
 * Animated here: react-native-web's Animated has no real native driver (falls back to JS-driven
 * style updates — confirmed directly via its own console warning), so hundreds of Animated nodes
 * updating every frame would burden the JS thread exactly the way this is trying to avoid; a plain
 * canvas loop instead does one clear + a few dozen `stroke()` calls per frame, no React
 * re-rendering and no per-particle DOM nodes at all (see rainParticles.ts's own particle model,
 * shared with the native renderer).
 *
 * Screen-space only, same as the native renderer — this canvas is a plain absolutely-positioned
 * overlay, never touching Mapbox's own coordinate system, so panning/zooming/rotating the map
 * underneath doesn't affect it at all; it just keeps falling across whatever's on screen.
 */
export function RainOverlay({ active, intensity, quality = 'high', config, windController }: RainOverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  // Mutable, per-frame state that must NOT live in React state (that would mean a re-render every
  // frame, exactly what this canvas approach is meant to avoid) — refs instead.
  const particlesRef = useRef(generateRainParticles(quality, intensity));
  const yPositionsRef = useRef<number[]>(particlesRef.current.map((p) => p.phase));
  const presenceRef = useRef(0);
  const targetRef = useRef(active ? 1 : 0);
  const sizeRef = useRef({ width: 0, height: 0 });
  const gustLeanDegRef = useRef(0);

  useEffect(() => {
    targetRef.current = active ? 1 : 0;
  }, [active]);

  useEffect(() => {
    if (!windController) return;
    return windController.subscribe((wind) => {
      const towardRad = (wind.directionDeg * Math.PI) / 180;
      const horizontal = Math.sin(towardRad);
      gustLeanDegRef.current = horizontal * (wind.gustFactor - 1) * GUST_LEAN_SCALE_DEG;
    });
  }, [windController]);

  useEffect(() => {
    particlesRef.current = generateRainParticles(quality, intensity);
    yPositionsRef.current = particlesRef.current.map((p) => p.phase);
  }, [quality, intensity]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    const resize = () => {
      const parent = canvas.parentElement;
      if (!parent) return;
      const rect = parent.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.max(1, rect.width * dpr);
      canvas.height = Math.max(1, rect.height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      sizeRef.current = { width: rect.width, height: rect.height };
    };
    resize();
    let resizeObserver: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined' && canvas.parentElement) {
      resizeObserver = new ResizeObserver(resize);
      resizeObserver.observe(canvas.parentElement);
    }

    // Pauses the falling animation while the tab/app isn't visible (per explicit request) — the
    // presence ramp is left exactly where it was, so rain resumes without replaying its own start
    // transition once the tab is visible again.
    let paused = typeof document !== 'undefined' && document.visibilityState === 'hidden';
    let lastTime = 0;
    const onVisibility = () => {
      paused = document.visibilityState === 'hidden';
      if (!paused) lastTime = 0;
    };
    document.addEventListener('visibilitychange', onVisibility);

    const baseAngleDeg = config?.angle ?? DEFAULT_ANGLE_DEG;
    const speed = config?.speed ?? 1;
    const opacityMultiplier = config?.opacity ?? 1;
    const presenceRatePerMs = 1 / PRESENCE_DURATION_MS;

    let rafId = 0;
    const tick = (time: number) => {
      rafId = requestAnimationFrame(tick);
      if (paused) {
        lastTime = time;
        return;
      }
      const dt = lastTime ? Math.min(48, time - lastTime) : 16;
      lastTime = time;

      const target = targetRef.current;
      const delta = target - presenceRef.current;
      const maxStep = presenceRatePerMs * dt;
      presenceRef.current += Math.sign(delta) * Math.min(Math.abs(delta), maxStep);
      const presence = presenceRef.current;

      const { width, height } = sizeRef.current;
      ctx.clearRect(0, 0, width, height);
      if (presence <= 0.0005) return;

      if (presence > 0.001) {
        ctx.fillStyle = `rgba(${ATMOSPHERE_RGB},${ATMOSPHERE_MAX_OPACITY * presence})`;
        ctx.fillRect(0, 0, width, height);
      }

      // Recomputed every frame (cheap — a handful of trig calls, dwarfed by the per-particle loop
      // below) rather than once per effect run, so a gust's own lean can nudge this without
      // restarting the loop or touching yPositions/fall speed at all.
      const angleDeg = baseAngleDeg + gustLeanDegRef.current;
      const angleRad = (angleDeg * Math.PI) / 180;
      const sinA = Math.sin(angleRad);
      const cosA = Math.cos(angleRad);

      const particles = particlesRef.current;
      const yPositions = yPositionsRef.current;
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        const travel = height + p.length * 2;
        let y = yPositions[i] ?? p.phase;
        y = (y + (dt / BASE_LOOP_MS) * RAIN_LAYER_SPEED_MULTIPLIER[p.layer] * speed) % 1;
        yPositions[i] = y;

        const revealFrom = Math.min(p.revealAt, 0.85);
        const revealOpacity = presence >= 1 ? 1 : Math.max(0, Math.min(1, (presence - revealFrom) / 0.15));
        if (revealOpacity <= 0) continue;

        const headY = -p.length + y * travel;
        const headX = p.x * width + y * travel * Math.tan(angleRad);
        const tailX = headX - p.length * sinA;
        const tailY = headY - p.length * cosA;

        ctx.strokeStyle = `rgba(${RAIN_DROP_RGB},${revealOpacity * p.opacity * opacityMultiplier})`;
        ctx.lineWidth = p.thickness;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(headX, headY);
        ctx.lineTo(tailX, tailY);
        ctx.stroke();
      }
    };
    rafId = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(rafId);
      resizeObserver?.disconnect();
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [config?.angle, config?.speed, config?.opacity]);

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions */}
      <canvas ref={canvasRef} style={webCanvasStyle} />
    </View>
  );
}

const webCanvasStyle: React.CSSProperties = { position: 'absolute', inset: 0, width: '100%', height: '100%' };
