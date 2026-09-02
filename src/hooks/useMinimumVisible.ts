import { useEffect, useRef, useState } from 'react';

/**
 * Holds a loading state visible for at least `minMs` once it goes true, so a
 * query that resolves almost instantly doesn't flash a loader for a few tens
 * of milliseconds — which reads as a glitch, not a fast load. Turning true
 * always shows immediately; turning false is delayed until the minimum has
 * elapsed since it last turned true.
 */
export function useMinimumVisible(isLoading: boolean, minMs: number): boolean {
  const [visible, setVisible] = useState(isLoading);
  const shownAtRef = useRef<number | null>(isLoading ? Date.now() : null);

  useEffect(() => {
    if (isLoading) {
      shownAtRef.current = Date.now();
      setVisible(true);
      return;
    }

    const shownAt = shownAtRef.current;
    if (shownAt === null) {
      setVisible(false);
      return;
    }
    const elapsed = Date.now() - shownAt;
    if (elapsed >= minMs) {
      setVisible(false);
      return;
    }
    const timer = setTimeout(() => setVisible(false), minMs - elapsed);
    return () => clearTimeout(timer);
  }, [isLoading, minMs]);

  return visible;
}
