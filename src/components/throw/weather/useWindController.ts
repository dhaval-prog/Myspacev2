import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { WindController, type WindConfig } from './windController';

/**
 * Creates (once) and drives a WindController via a single shared `requestAnimationFrame` loop —
 * the one rAF every wind-aware renderer (LeafRenderer, CloudOverlay, RainOverlay's own lean)
 * subscribes to instead of each running its own, per this feature's own "shared animation loops"
 * requirement. Pauses while the app is backgrounded (resumes with a fresh delta so a long gap
 * doesn't fast-forward through several gusts at once — see WindSimulation.tick's own clamp) and
 * passes `reduceMotion` straight through to the simulation, which is what actually dampens
 * turbulence/suppresses gusts (see windController.ts) — the controller keeps running either way so
 * subscribers always get a sample, just a much calmer one.
 */
export function useWindController(config: WindConfig, reduceMotion: boolean): WindController {
  const controllerRef = useRef<WindController | null>(null);
  if (!controllerRef.current) {
    controllerRef.current = new WindController(config, reduceMotion);
  }
  const controller = controllerRef.current;

  // Config can change (e.g. a fresh automatic-weather reading) without recreating the controller —
  // recreating it would reset every subscriber's own accumulated leaf/cloud state for no reason.
  useEffect(() => {
    controller.setConfig(config);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config.speed, config.direction, config.gustStrength, config.turbulence]);

  useEffect(() => {
    controller.setReduceMotion(reduceMotion);
  }, [controller, reduceMotion]);

  useEffect(() => {
    let rafId = 0;
    let lastTime = 0;
    let paused = AppState.currentState !== 'active';

    const loop = (time: number) => {
      rafId = requestAnimationFrame(loop);
      if (paused) {
        lastTime = time;
        return;
      }
      const dt = lastTime ? time - lastTime : 16;
      lastTime = time;
      controller.tick(dt);
    };
    rafId = requestAnimationFrame(loop);

    const sub = AppState.addEventListener('change', (state) => {
      paused = state !== 'active';
      if (!paused) lastTime = 0;
    });

    return () => {
      cancelAnimationFrame(rafId);
      sub.remove();
    };
  }, [controller]);

  return controller;
}
