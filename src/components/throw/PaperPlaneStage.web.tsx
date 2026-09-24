import React, { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import * as THREE from 'three';
import { createPaperPlane } from './paperPlaneEngine';
import { bakeLetterTexture } from './paperContentTexture.web';
import type { PaperPlaneStageHandle, PaperPlaneStageProps } from './paperPlaneTypes';

const paperTextureAsset = require('../../../assets/throw/paper-texture.jpg');

/**
 * Web: a real `<canvas>` via a plain WebGLRenderer, mounted into a `<div>` escape hatch inside
 * the RN tree — the same pattern MapCanvas.web.tsx already uses for Leaflet.
 */
export const PaperPlaneStage = forwardRef<PaperPlaneStageHandle, PaperPlaneStageProps>(function PaperPlaneStage(
  { onPhase, onProgress, onError },
  ref,
) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const engineRef = useRef<ReturnType<typeof createPaperPlane> | null>(null);
  const sizeRef = useRef({ width: 0, height: 0 });
  const [ready, setReady] = useState(false);
  // TEMPORARY diagnostic overlay — see onDebugFrame in paperPlaneEngine.ts. Remove once the
  // still-flat-plane bug on mobile Safari is confirmed fixed.
  const [debugText, setDebugText] = useState('');

  useImperativeHandle(
    ref,
    () => ({
      fold: () => engineRef.current?.fold(),
      fly: () => engineRef.current?.fly(),
      reset: () => engineRef.current?.reset(),
      holdReady: () => engineRef.current?.holdReady(),
      seek: (t: number) => engineRef.current?.seek(t),
      setOptions: (o) => engineRef.current?.setOptions(o),
      setContent: (content, sourceSize) => {
        bakeLetterTexture(content, sourceSize)
          .then((texture) => engineRef.current?.setTexture(texture))
          .catch((err) => console.warn('[Throw] failed to bake letter texture (web):', err));
      },
    }),
    [],
  );

  // Waits for the first non-zero layout, then creates the engine exactly once; later resizes
  // just call engine.resize() directly rather than tearing the whole scene down.
  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      sizeRef.current = { width, height };
      if (width > 0 && height > 0) {
        if (!ready) setReady(true);
        else engineRef.current?.resize(width, height);
      }
    });
    ro.observe(containerRef.current);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!ready || !containerRef.current) return;
    const node = containerRef.current;
    const { width, height } = sizeRef.current;
    let renderer: THREE.WebGLRenderer | null = null;
    let engine: ReturnType<typeof createPaperPlane> | null = null;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.domElement.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block';
      node.appendChild(renderer.domElement);

      const texture = new THREE.TextureLoader().load(paperTextureAsset);
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.anisotropy = 8;

      engine = createPaperPlane({ renderer, texture, width, height, onPhase, onProgress, onError, onDebugFrame: setDebugText });
      engineRef.current = engine;
    } catch (err) {
      onError?.(err);
    }
    return () => {
      engineRef.current = null;
      engine?.dispose();
      if (renderer && renderer.domElement.parentNode === node) node.removeChild(renderer.domElement);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <div ref={containerRef} style={{ position: 'absolute', inset: 0 }} />
      {!!debugText && (
        <View style={styles.debugBar}>
          <Text style={styles.debugText}>{debugText}</Text>
        </View>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  debugBar: { position: 'absolute', top: 4, left: 4, right: 4, backgroundColor: 'rgba(0,0,0,0.75)', borderRadius: 6, padding: 4 },
  debugText: { color: '#0f0', fontSize: 10, fontFamily: 'monospace' },
});
