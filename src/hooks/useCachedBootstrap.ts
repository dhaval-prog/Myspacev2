import { useEffect, useRef, useState } from 'react';
import { readCache } from '../utils/persistedCache';

/**
 * Hydrates a context's own state from a previously cached snapshot (if any) before its network
 * refresh runs, so reopening the app shows real content instantly instead of a blank/loading
 * screen while that first round-trip is still in flight — the server data arrives moments later
 * and quietly replaces it (see each caller's own cache-write, right after a successful fetch).
 *
 * Returns `ready`, which the caller's own load-triggering effect should wait on: this guarantees
 * the cache check (hit or miss) always finishes before that effect decides whether a first-ever
 * load (no cache yet) should still show its normal loading state.
 */
export function useCachedBootstrap<T>(userId: string | null, key: string, onHit: (value: T) => void): boolean {
  const [ready, setReady] = useState(false);
  const checkedForRef = useRef<string | null>(null);

  useEffect(() => {
    if (!userId) {
      setReady(true);
      return;
    }
    if (checkedForRef.current === userId) return;
    checkedForRef.current = userId;
    setReady(false);
    let cancelled = false;
    readCache<T>(userId, key).then((cached) => {
      if (cancelled) return;
      if (cached != null) onHit(cached);
      setReady(true);
    });
    return () => {
      cancelled = true;
    };
    // onHit deliberately excluded — callers pass a fresh closure every render, and only
    // userId/key should ever re-trigger a cache read.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, key]);

  return ready;
}
