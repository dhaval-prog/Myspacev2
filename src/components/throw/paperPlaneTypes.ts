export interface PaperPlaneProgress {
  step: number;
  total: number;
  label: string;
  progress: number;
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
}

export interface PaperPlaneStageProps {
  onPhase?: (phase: string) => void;
  onProgress?: (p: PaperPlaneProgress) => void;
  /** WebGL/GL context creation or engine setup failed — caller should fall back gracefully. */
  onError?: (err: unknown) => void;
}
