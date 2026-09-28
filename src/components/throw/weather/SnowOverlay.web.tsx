import React, { useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { generateFallingParticles, type ParticleTuning } from './weatherParticles';
import type { RainConfig, WeatherIntensity, WeatherQuality } from '../../../types/weather';

const BASE_LOOP_MS = 5200;
const DEFAULT_ANGLE_DEG = 4;
const PRESENCE_DURATION_MS = 1600;
const SNOW_RGB = '255,255,255';
const SWAY_CYCLES_PER_FALL = 2.2;

const SNOW_TUNING: ParticleTuning = {
  layerSpeedMultiplier: [0.4, 0.6, 0.85],
  layerBaseOpacity: [0.45, 0.65, 0.9],
  layerBaseLength: [4, 6.5, 9.5],
  layerBaseThickness: [4, 6.5, 9.5],
  qualityLayerCounts: { high: [20, 16, 11], medium: [13, 10, 7], low: [6, 5, 3] },
  swayAmplitudeFactor: 3.2,
};

interface SnowOverlayProps {
  active: boolean;
  intensity: WeatherIntensity;
  quality?: WeatherQuality;
  config?: Partial<RainConfig>;
}

/** Web sibling of SnowOverlay.native.tsx — same canvas + requestAnimationFrame approach
 * RainOverlay.web.tsx uses (see its own doc comment for why), drawing soft circles instead of
 * streaks and adding the sideways sway native's own version approximates with a sine lookup table;
 * here it's just Math.sin() directly, since nothing here needs to go through Animated at all. */
export function SnowOverlay({ active, intensity, quality = 'high', config }: SnowOverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const particlesRef = useRef(generateFallingParticles(quality, intensity, SNOW_TUNING));
  const yPositionsRef = useRef<number[]>(particlesRef.current.map((p) => p.phase));
  const presenceRef = useRef(0);
  const targetRef = useRef(active ? 1 : 0);
  const sizeRef = useRef({ width: 0, height: 0 });

  useEffect(() => {
    targetRef.current = active ? 1 : 0;
  }, [active]);

  useEffect(() => {
    particlesRef.current = generateFallingParticles(quality, intensity, SNOW_TUNING);
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

    let paused = typeof document !== 'undefined' && document.visibilityState === 'hidden';
    let lastTime = 0;
    const onVisibility = () => {
      paused = document.visibilityState === 'hidden';
      if (!paused) lastTime = 0;
    };
    document.addEventListener('visibilitychange', onVisibility);

    const angleDeg = config?.angle ?? DEFAULT_ANGLE_DEG;
    const angleRad = (angleDeg * Math.PI) / 180;
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

      const particles = particlesRef.current;
      const yPositions = yPositionsRef.current;
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        const travel = height + p.length * 2;
        let y = yPositions[i] ?? p.phase;
        y = (y + (dt / BASE_LOOP_MS) * SNOW_TUNING.layerSpeedMultiplier[p.layer] * speed) % 1;
        yPositions[i] = y;

        const revealFrom = Math.min(p.revealAt, 0.85);
        const revealOpacity = presence >= 1 ? 1 : Math.max(0, Math.min(1, (presence - revealFrom) / 0.15));
        if (revealOpacity <= 0) continue;

        const headY = -p.length + y * travel;
        const sway = Math.sin(y * SWAY_CYCLES_PER_FALL * Math.PI * 2 + p.swayPhase * Math.PI * 2) * p.swayAmplitude;
        const headX = p.x * width + y * travel * Math.tan(angleRad) + sway;

        ctx.fillStyle = `rgba(${SNOW_RGB},${revealOpacity * p.opacity * opacityMultiplier})`;
        ctx.beginPath();
        ctx.arc(headX, headY, p.length / 2, 0, Math.PI * 2);
        ctx.fill();
      }

      if (presence > 0.001) {
        const grad = ctx.createLinearGradient(0, height - 90, 0, height);
        grad.addColorStop(0, 'rgba(255,255,255,0)');
        grad.addColorStop(1, `rgba(255,255,255,${0.16 * presence})`);
        ctx.fillStyle = grad;
        ctx.fillRect(0, height - 90, width, 90);
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
