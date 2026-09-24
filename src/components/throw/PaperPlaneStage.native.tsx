import React, { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { LayoutChangeEvent, StyleSheet, View } from 'react-native';
import { GLView, type ExpoWebGLRenderingContext } from 'expo-gl';
import { Renderer, TextureLoader } from 'expo-three';
import * as THREE from 'three';
import { createPaperPlane } from './paperPlaneEngine';
import { LetterRasterizer, type LetterRasterizerHandle } from './paperContentTexture.native';
import type { PaperPlaneStageHandle, PaperPlaneStageProps } from './paperPlaneTypes';

const paperTextureAsset = require('../../../assets/throw/paper-texture.jpg');

/**
 * Native (iOS/Android): expo-gl's GLView provides the GL context, expo-three's Renderer wires
 * a THREE.WebGLRenderer to it, and expo-three's TextureLoader resolves the bundled paper
 * texture the way native needs (there's no `document`/`Image` to hand a plain URL to).
 */
export const PaperPlaneStage = forwardRef<PaperPlaneStageHandle, PaperPlaneStageProps>(function PaperPlaneStage(
  { onPhase, onProgress, onError },
  ref,
) {
  const engineRef = useRef<ReturnType<typeof createPaperPlane> | null>(null);
  const sizeRef = useRef({ width: 0, height: 0 });
  const rasterizerRef = useRef<LetterRasterizerHandle>(null);

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
        rasterizerRef.current
          ?.capture(content, sourceSize)
          .then((uri) => {
            if (!uri || !engineRef.current) return;
            const texture = new TextureLoader().load({ uri });
            texture.colorSpace = THREE.SRGBColorSpace;
            texture.anisotropy = 8;
            engineRef.current.setTexture(texture);
          })
          .catch((err) => console.warn('[Throw] failed to bake letter texture (native):', err));
      },
    }),
    [],
  );

  useEffect(() => {
    return () => {
      engineRef.current?.dispose();
      engineRef.current = null;
    };
  }, []);

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    sizeRef.current = { width, height };
    engineRef.current?.resize(width, height);
  };

  const onContextCreate = (gl: ExpoWebGLRenderingContext) => {
    try {
      const renderer = new Renderer({ gl, alpha: true, antialias: true });
      renderer.setPixelRatio(1);
      const { width, height } = sizeRef.current;
      const w = width || gl.drawingBufferWidth;
      const h = height || gl.drawingBufferHeight;

      const texture = new TextureLoader().load(paperTextureAsset);
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.anisotropy = 8;

      engineRef.current = createPaperPlane({
        renderer,
        texture,
        width: w,
        height: h,
        onPhase,
        onProgress,
        afterRender: () => gl.endFrameEXP(),
      });
    } catch (err) {
      onError?.(err);
    }
  };

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none" onLayout={onLayout}>
      {/* expo-gl ships both GLView.d.ts and GLView.web.d.ts; this project's tsconfig
          `moduleSuffixes` resolves the bare `expo-gl` import to the `.web` declaration across
          the whole tsc pass (a single-tsc-invocation cross-platform-types limitation, not
          specific to this file), which widens onContextCreate's expected type to also accept a
          plain WebGLRenderingContext. The real runtime value on native is always an
          ExpoWebGLRenderingContext, so this cast is safe. */}
      <GLView style={StyleSheet.absoluteFill} onContextCreate={onContextCreate as any} />
      <LetterRasterizer ref={rasterizerRef} />
    </View>
  );
});
