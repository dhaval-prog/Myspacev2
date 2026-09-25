import * as THREE from 'three';
import { throwFont } from '../../theme/throwTokens';
import type { PaperPlaneLetterContent } from './paperPlaneTypes';

const paperTextureAsset = require('../../../assets/throw/paper-texture.jpg');

let cachedBase: HTMLImageElement | null = null;
function loadBaseImage(): Promise<HTMLImageElement> {
  if (cachedBase) return Promise.resolve(cachedBase);
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      cachedBase = img;
      resolve(img);
    };
    img.onerror = reject;
    img.src = paperTextureAsset;
  });
}

function loadPhotoImage(uri: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = uri;
  });
}

// Mirrors FoldingLetter's photoChip geometry (top: 16, right: 14, 100x100, -4deg) — kept in sync
// by hand so the baked plane shows the photo in roughly the same spot it sat on the flat paper.
const PHOTO_TOP = 16;
const PHOTO_RIGHT = 14;
const PHOTO_SIZE = 100;
const PHOTO_ROTATE_RAD = (-4 * Math.PI) / 180;

function drawPhoto(ctx: CanvasRenderingContext2D, img: HTMLImageElement, sx: number, sy: number, canvasWidth: number) {
  const scale = (sx + sy) / 2;
  const size = PHOTO_SIZE * scale;
  const pad = 6 * scale;
  const x = canvasWidth - PHOTO_RIGHT * sx - size;
  const y = PHOTO_TOP * sy;

  ctx.save();
  ctx.translate(x + size / 2, y + size / 2);
  ctx.rotate(PHOTO_ROTATE_RAD);
  ctx.fillStyle = '#FBF6EC';
  ctx.fillRect(-size / 2 - pad, -size / 2 - pad, size + pad * 2, size + pad * 2);

  // Cover-fit crop to a square, same as the on-paper thumbnail (Image's resizeMode="cover").
  let sW = img.naturalWidth || img.width;
  let sH = img.naturalHeight || img.height;
  let sX0 = 0;
  let sY0 = 0;
  if (sW > sH) {
    sX0 = (sW - sH) / 2;
    sW = sH;
  } else if (sH > sW) {
    sY0 = (sH - sW) / 2;
    sH = sW;
  }
  ctx.drawImage(img, sX0, sY0, sW, sH, -size / 2, -size / 2, size, size);
  ctx.restore();
}

function drawContent(ctx: CanvasRenderingContext2D, content: PaperPlaneLetterContent, sx: number, sy: number, canvasWidth: number) {
  if (content.strokes && content.strokes.length > 0) {
    const scale = (sx + sy) / 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (const stroke of content.strokes) {
      if (stroke.points.length < 2) continue;
      ctx.strokeStyle = stroke.color;
      ctx.lineWidth = Math.max(1, stroke.width * scale);
      ctx.beginPath();
      stroke.points.forEach((p, i) => {
        const x = p.x * sx;
        const y = p.y * sy;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();
    }
  } else if (content.messageText) {
    const fontSize = Math.round(42 * sy);
    ctx.fillStyle = content.penColor;
    ctx.font = `${fontSize}px "${throwFont.hand500}"`;
    ctx.textBaseline = 'top';
    const padX = 44 * sx;
    const padY = 44 * sy;
    const maxWidth = canvasWidth - padX * 2;
    const lineHeight = fontSize * 1.2;
    let y = padY;
    for (const paragraph of content.messageText.split('\n')) {
      const words = paragraph.split(' ');
      let line = '';
      for (const word of words) {
        const test = line ? `${line} ${word}` : word;
        if (line && ctx.measureText(test).width > maxWidth) {
          ctx.fillText(line, padX, y);
          line = word;
          y += lineHeight;
        } else {
          line = test;
        }
      }
      ctx.fillText(line, padX, y);
      y += lineHeight;
    }
  }
}

/**
 * Bakes the user's handwritten strokes or typed text — plus any attached photo — onto the same
 * paper-grain image the plane uses as its base texture, so the folded/flying plane shows the
 * actual letter rather than blank paper. Web-only (Canvas2D) — the native counterpart
 * (paperContentTexture.native.tsx) rasterizes an off-screen react-native-svg tree instead, since
 * native has no Canvas2D/document.
 *
 * `sourceSize` is the pixel box the strokes were captured in — LetterCanvas now fills its whole
 * component (no stacked toolbar pushing it down), so this is simply the writing surface's own
 * measured layout, used to scale stroke points onto the baked canvas.
 *
 * The origami fold folds this whole flat texture into several stacked layers, only some of which
 * end up outward-facing on the finished plane — a single natural-position copy of the ink can
 * easily land entirely on a hidden face (confirmed empirically: a full-bleed test pattern showed
 * through fine, a single corner-placed one didn't). So the content is stamped into all four
 * canvas quadrants (one full-scale copy plus three half-scale copies) rather than drawn once, to
 * make sure at least one copy survives on whichever patch of the sheet stays visible.
 */
export async function bakeLetterTexture(content: PaperPlaneLetterContent, sourceSize: { width: number; height: number }): Promise<THREE.Texture> {
  const base = await loadBaseImage();
  const canvas = document.createElement('canvas');
  canvas.width = base.naturalWidth || base.width || 1024;
  canvas.height = base.naturalHeight || base.height || 1024;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(base, 0, 0, canvas.width, canvas.height);

  const sx = sourceSize.width > 0 ? canvas.width / sourceSize.width : 1;
  const sy = sourceSize.height > 0 ? canvas.height / sourceSize.height : 1;

  const overlay = document.createElement('canvas');
  overlay.width = canvas.width;
  overlay.height = canvas.height;
  const octx = overlay.getContext('2d')!;
  drawContent(octx, content, sx, sy, overlay.width);

  if (content.photoUri) {
    try {
      const photo = await loadPhotoImage(content.photoUri);
      drawPhoto(octx, photo, sx, sy, overlay.width);
    } catch (err) {
      console.warn('[Throw] failed to load attached photo for the plane texture:', err);
    }
  }

  const half = { w: canvas.width / 2, h: canvas.height / 2 };
  const quadrants = [
    { x: 0, y: 0, w: canvas.width, h: canvas.height }, // full-scale, natural position
    { x: half.w, y: 0, w: half.w, h: half.h },
    { x: 0, y: half.h, w: half.w, h: half.h },
    { x: half.w, y: half.h, w: half.w, h: half.h },
  ];
  for (const q of quadrants) {
    ctx.drawImage(overlay, 0, 0, overlay.width, overlay.height, q.x, q.y, q.w, q.h);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  texture.needsUpdate = true;
  return texture;
}
