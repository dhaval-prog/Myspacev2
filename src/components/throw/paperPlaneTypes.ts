import type { StrokePath } from '../../types/throw';

export interface PaperPlaneProgress {
  step: number;
  total: number;
  label: string;
  progress: number;
}

export interface PaperPlaneLetterContent {
  strokes: StrokePath[] | null;
  messageText: string | null;
  penColor: string;
  /** A locally-picked photo (camera or library), not yet uploaded — stamped onto the baked
   * texture alongside the text/strokes so the folded/flying plane carries it too, instead of it
   * only showing while the letter is still flat (see FoldingLetter's photoChip). */
  photoUri: string | null;
}

export interface PaperPlaneStageHandle {
  /** Starts the autoplay fold timeline (unused by the gesture-driven flow — kept for parity with the reference). */
  fold: () => void;
  /** Plays the local liftoff-and-off-screen flight. Only takes effect from the 'ready' phase. */
  fly: () => void;
  reset: () => void;
  /** Sets phase to 'ready' directly, for a caller that reached t = FOLD_END via seek() rather than fold(). */
  holdReady: () => void;
  /** 0..1 — maps directly onto the fold timeline (0 = flat sheet, 1 = fully folded plane). */
  seek: (progress: number) => void;
  setOptions: (o: { speed?: number; trail?: boolean; follow?: boolean }) => void;
  /**
   * Bakes the user's handwritten strokes or typed text onto the plane's texture, so the folded
   * plane shows the actual letter instead of blank paper. `sourceSize` is the pixel box the
   * strokes were captured in (the writing surface's own measured layout), used to scale points
   * onto the baked texture. Fire-and-forget — swaps the texture in whenever baking finishes.
   */
  setContent: (content: PaperPlaneLetterContent, sourceSize: { width: number; height: number }) => void;
}

export interface PaperPlaneStageProps {
  onPhase?: (phase: string) => void;
  onProgress?: (p: PaperPlaneProgress) => void;
  /** WebGL/GL context creation or engine setup failed — caller should fall back gracefully. */
  onError?: (err: unknown) => void;
}
