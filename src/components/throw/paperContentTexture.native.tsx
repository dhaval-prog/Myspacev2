import React, { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { G, Image as SvgImage, Path, Rect, Text as SvgText, TSpan } from 'react-native-svg';
import * as FileSystem from 'expo-file-system/legacy';
import { throwFont } from '../../theme/throwTokens';
import type { PaperPlaneLetterContent } from './paperPlaneTypes';

const paperTextureAsset = require('../../../assets/throw/paper-texture.jpg');
const RASTER_SIZE = 1024; // matches paper-texture.jpg's own pixel dimensions (square)

// Mirrors FoldingLetter's photoChip geometry (top: 16, right: 14, 100x100, -4deg) — kept in sync
// by hand so the baked plane shows the photo in roughly the same spot it sat on the flat paper.
const PHOTO_TOP = 16;
const PHOTO_RIGHT = 14;
const PHOTO_SIZE = 100;
const PHOTO_PAD = 6;

export interface LetterRasterizerHandle {
  /**
   * Rasterizes the given letter content over the same paper-grain background the plane uses, to
   * a local PNG file, and resolves its `file://` URI — null if rasterizing failed.
   */
  capture: (content: PaperPlaneLetterContent, sourceSize: { width: number; height: number }) => Promise<string | null>;
}

function strokeToPathD(points: { x: number; y: number }[], sx: number, sy: number): string {
  if (points.length === 0) return '';
  return points.map((p, i) => `${i === 0 ? 'M' : 'L'}${(p.x * sx).toFixed(1)},${(p.y * sy).toFixed(1)}`).join(' ');
}

// No Canvas2D/text-measurement API on native, so wrapping is an approximation by character
// count rather than by measured pixel width (see paperPlaneEngine.ts's header comment on why
// native can't share the web Canvas2D path at all).
function wrapApprox(text: string, maxChars: number): string[] {
  const lines: string[] = [];
  for (const paragraph of text.split('\n')) {
    const words = paragraph.split(' ');
    let line = '';
    for (const word of words) {
      const test = line ? `${line} ${word}` : word;
      if (line && test.length > maxChars) {
        lines.push(line);
        line = word;
      } else {
        line = test;
      }
    }
    lines.push(line);
  }
  return lines;
}

/**
 * Native counterpart to paperContentTexture.web.ts. There's no Canvas2D/document on native, so
 * this rasterizes an off-screen react-native-svg tree — the same paper-grain image plus the
 * user's strokes/typed text as SVG — via RNSVG's native `toDataURL`, then writes the PNG to a
 * cache file expo-three's TextureLoader can load (it needs a real file URI, not a data URI —
 * expo-asset's downloader doesn't resolve those). Kept mounted off-screen (far outside the
 * viewport, not zero-opacity, since some native rasterizers skip invisible views) so it's ready
 * whenever FoldingLetter's fold gesture calls PaperPlaneStage's setContent.
 */
export const LetterRasterizer = forwardRef<LetterRasterizerHandle>(function LetterRasterizer(_props, ref) {
  const svgRef = useRef<Svg>(null);
  const imageReady = useRef(false);
  const [draft, setDraft] = useState<{ content: PaperPlaneLetterContent; sx: number; sy: number; sourceWidth: number } | null>(null);
  const pendingRef = useRef<((uri: string | null) => void) | null>(null);

  useEffect(() => {
    if (!draft || !pendingRef.current) return;
    let cancelled = false;
    (async () => {
      for (let i = 0; i < 40 && !imageReady.current && !cancelled; i++) {
        await new Promise((r) => setTimeout(r, 50));
      }
      if (cancelled) return;
      requestAnimationFrame(() => {
        if (cancelled) return;
        svgRef.current?.toDataURL(
          async (base64: string) => {
            const resolve = pendingRef.current;
            pendingRef.current = null;
            try {
              const uri = `${FileSystem.cacheDirectory}throw-letter-${Date.now()}.png`;
              await FileSystem.writeAsStringAsync(uri, base64, { encoding: FileSystem.EncodingType.Base64 });
              resolve?.(uri);
            } catch (err) {
              console.warn('[Throw] failed to write rasterized letter texture:', err);
              resolve?.(null);
            }
          },
          { width: RASTER_SIZE, height: RASTER_SIZE },
        );
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [draft]);

  useImperativeHandle(ref, () => ({
    capture: (content, sourceSize) =>
      new Promise((resolve) => {
        pendingRef.current = resolve;
        const sx = sourceSize.width > 0 ? RASTER_SIZE / sourceSize.width : 1;
        const sy = sourceSize.height > 0 ? RASTER_SIZE / sourceSize.height : 1;
        setDraft({ content, sx, sy, sourceWidth: sourceSize.width || RASTER_SIZE });
      }),
  }));

  const lines = draft?.content.messageText ? wrapApprox(draft.content.messageText, 30) : [];

  // Photo geometry in raster space, mirroring paperContentTexture.web.ts's drawPhoto — computed
  // from the same source-space constants (PHOTO_TOP/RIGHT/SIZE/PAD) scaled by sx/sy.
  const photoScale = (d: { sx: number; sy: number }) => (d.sx + d.sy) / 2;
  const photoSize = (d: { sx: number; sy: number }) => PHOTO_SIZE * photoScale(d);
  const photoPad = (d: { sx: number; sy: number }) => PHOTO_PAD * photoScale(d);
  const photoCx = (d: { sx: number; sy: number; sourceWidth: number }) => d.sourceWidth * d.sx - PHOTO_RIGHT * d.sx - photoSize(d) / 2;
  const photoCy = (d: { sx: number; sy: number }) => PHOTO_TOP * d.sy + photoSize(d) / 2;

  // The strokes/text, as one reusable node list — stamped into all four canvas quadrants below
  // (see paperContentTexture.web.ts's doc comment: the fold turns this flat canvas into several
  // stacked layers, and a single natural-position copy can land entirely on a hidden face).
  const contentNodes = (keyPrefix: string) => (
    <>
      {draft?.content.strokes?.map((s, i) => (
        <Path
          key={`${keyPrefix}-s${i}`}
          d={strokeToPathD(s.points, draft.sx, draft.sy)}
          stroke={s.color}
          strokeWidth={Math.max(1, s.width * ((draft.sx + draft.sy) / 2))}
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ))}
      {lines.length > 0 && draft && (
        <SvgText x={44} y={90} fontSize={46} fontFamily={throwFont.hand500} fill={draft.content.penColor}>
          {lines.map((line, i) => (
            <TSpan key={`${keyPrefix}-t${i}`} x={44} dy={i === 0 ? 0 : 54}>
              {line}
            </TSpan>
          ))}
        </SvgText>
      )}
      {draft?.content.photoUri && (
        <G transform={`translate(${photoCx(draft)}, ${photoCy(draft)}) rotate(-4)`}>
          <Rect x={-photoSize(draft) / 2 - photoPad(draft)} y={-photoSize(draft) / 2 - photoPad(draft)} width={photoSize(draft) + photoPad(draft) * 2} height={photoSize(draft) + photoPad(draft) * 2} fill="#FBF6EC" />
          <SvgImage
            href={draft.content.photoUri}
            x={-photoSize(draft) / 2}
            y={-photoSize(draft) / 2}
            width={photoSize(draft)}
            height={photoSize(draft)}
            preserveAspectRatio="xMidYMid slice"
          />
        </G>
      )}
    </>
  );
  const half = RASTER_SIZE / 2;

  return (
    <View style={styles.offscreen} pointerEvents="none">
      <Svg ref={svgRef} width={RASTER_SIZE} height={RASTER_SIZE} viewBox={`0 0 ${RASTER_SIZE} ${RASTER_SIZE}`}>
        <SvgImage
          href={paperTextureAsset}
          x={0}
          y={0}
          width={RASTER_SIZE}
          height={RASTER_SIZE}
          preserveAspectRatio="xMidYMid slice"
          onLoad={() => {
            imageReady.current = true;
          }}
        />
        <G>{contentNodes('full')}</G>
        <G transform={`translate(${half}, 0) scale(0.5)`}>{contentNodes('q2')}</G>
        <G transform={`translate(0, ${half}) scale(0.5)`}>{contentNodes('q3')}</G>
        <G transform={`translate(${half}, ${half}) scale(0.5)`}>{contentNodes('q4')}</G>
      </Svg>
    </View>
  );
});

const styles = StyleSheet.create({
  offscreen: { position: 'absolute', top: -100000, left: -100000, width: RASTER_SIZE, height: RASTER_SIZE },
});
