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
  /** Bakes the plane's own solid dark colour (throwNightColor.planePaper) in place of the cream
   * paper-grain texture, matching FoldingLetter's isNight skin — only ever set when the
   * destination currently reads as nighttime, never a whole-app dark mode. */
  isNight?: boolean;
}

export interface PaperPlaneStageHandle {
  /** Starts the autoplay fold timeline (unused by the gesture-driven flow — kept for parity with the reference). */
  fold: () => void;
  /** Plays the local liftoff-and-off-screen flight. Only takes effect from the 'ready' phase. */
  fly: () => void;
  reset: () => void;
  /** Sets phase to 'ready' directly, for a caller that reached t = FOLD_END via seek() rather than fold(). */
  holdReady: () => void;
  /** -1 (full left) .. 1 (full right) — banks the held 'ready' plane in place, without moving it,
   * for a caller driving this from a live horizontal drag. Only takes effect during 'ready'. */
  setReadyBank: (fraction: number) => void;
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
