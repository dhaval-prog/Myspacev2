import React, { useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { generateWindParticles } from './windParticles';
import type { WeatherIntensity, WeatherQuality } from '../../../types/weather';

const PRESENCE_DURATION_MS = 1600;
const BASE_CROSSING_MS = 5200;
const BASE_SPEED_KPH = 20;
const SWAY_CYCLES = 1.6;
const WIND_RGB = '226,222,204';

interface WindOverlayProps {
  active: boolean;
  intensity: WeatherIntensity;
  quality?: WeatherQuality;
  windSpeedKph: number;
  windDirectionDeg: number;
}

/** Web sibling of WindOverlay.native.tsx — same canvas + requestAnimationFrame loop every other
 * weather renderer here uses on web (see RainOverlay.web.tsx's own doc comment for why), drawing
 * small rotating capsule shapes drifting across the screen in the wind's own direction. */
export function WindOverlay({ active, intensity, quality = 'high', windSpeedKph, windDirectionDeg }: WindOverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const particlesRef = useRef(generateWindParticles(quality, intensity));
  const progressRef = useRef<number[]>(particlesRef.current.map((p) => p.phase));
  const presenceRef = useRef(0);
  const targetRef = useRef(active ? 1 : 0);
  const sizeRef = useRef({ width: 0, height: 0 });

  useEffect(() => {
    targetRef.current = active ? 1 : 0;
  }, [active]);

  useEffect(() => {
    particlesRef.current = generateWindParticles(quality, intensity);
    progressRef.current = particlesRef.current.map((p) => p.phase);
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

    const presenceRatePerMs = 1 / PRESENCE_DURATION_MS;
    const speedKph = Math.max(4, windSpeedKph || BASE_SPEED_KPH);
    const towardRad = ((windDirectionDeg + 180) * Math.PI) / 180;
    const goingRight = Math.sin(towardRad) >= 0;
    const crossingMs = Math.max(1400, BASE_CROSSING_MS * (BASE_SPEED_KPH / speedKph));

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
      const progressArr = progressRef.current;
      const travel = width + 80;
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        let progress = progressArr[i] ?? p.phase;
        progress = (progress + (dt / crossingMs) * p.speedFactor) % 1;
        progressArr[i] = progress;

        const revealFrom = Math.min(p.revealAt, 0.85);
        const revealOpacity = presence >= 1 ? 1 : Math.max(0, Math.min(1, (presence - revealFrom) / 0.15));
        const edgeOpacity = progress < 0.08 ? progress / 0.08 : progress > 0.92 ? (1 - progress) / 0.08 : 1;
        const alpha = revealOpacity * edgeOpacity * p.opacity;
        if (alpha <= 0) continue;

        const x = goingRight ? -40 + progress * travel : travel - 40 - progress * travel;
        const sway = Math.sin(progress * SWAY_CYCLES * Math.PI * 2 + p.swayPhase * Math.PI * 2) * p.swayAmplitude;
        const y = p.y * height + sway;
        const rotation = (progress * p.rotationDeg * Math.PI) / 180;

        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(rotation);
        ctx.fillStyle = `rgba(${WIND_RGB},${alpha})`;
        const w = p.size * 1.8;
        const h = p.size * 0.7;
        ctx.beginPath();
        // A capsule (rounded-rect-ish) shape via a simple ellipse — reads as a small leaf/fleck
        // without needing an actual leaf path.
        ctx.ellipse(0, 0, w / 2, h / 2, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    };
    rafId = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(rafId);
      resizeObserver?.disconnect();
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [windSpeedKph, windDirectionDeg]);

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions */}
      <canvas ref={canvasRef} style={webCanvasStyle} />
    </View>
  );
}

const webCanvasStyle: React.CSSProperties = { position: 'absolute', inset: 0, width: '100%', height: '100%' };
