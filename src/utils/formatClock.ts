/** Milliseconds as a plain "m:ss" clock — "0:07", "1:03" — used everywhere a recording countdown
 * or a video's playback position needs a human-readable guide (StoryCaptureScreen's own recording
 * timer, ContactStoryStack/LetterFoldCard's while-viewing overlay). */
export function formatClockMs(ms: number): string {
  const totalSec = Math.round(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}
