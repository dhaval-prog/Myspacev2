import AsyncStorage from '@react-native-async-storage/async-storage';

// Bumped if a cached shape ever changes incompatibly — stale entries under the old prefix are
// simply never read again rather than needing an explicit migration.
const PREFIX = 'cache:v1:';

/** Reads a previously cached JSON snapshot, namespaced per account so one person's cached data
 * never bleeds into another's session after a sign-out/sign-in on the same device. Returns null
 * on a miss, a parse failure, or any storage error — every caller already has a real network
 * fetch to fall back on, so this never needs to surface a failure of its own. */
export async function readCache<T>(userId: string, key: string): Promise<T | null> {
  try {
    const raw = await AsyncStorage.getItem(`${PREFIX}${userId}:${key}`);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

/** Best-effort — a write failure (storage full, a serialization edge case) should never interrupt
 * the caller's own already-successful network load, so this swallows its own errors too. */
export async function writeCache<T>(userId: string, key: string, value: T): Promise<void> {
  try {
    await AsyncStorage.setItem(`${PREFIX}${userId}:${key}`, JSON.stringify(value));
  } catch {
    // best-effort
  }
}
