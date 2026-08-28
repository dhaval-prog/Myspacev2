import { supabase } from '../lib/supabase';

/**
 * Inserts a self-directed in-app notification, honoring the user's own
 * preference for that category. `dedupeKey` identifies the underlying event
 * (e.g. "budget_reset:<cardId>:<resetLabel>") — a unique DB constraint on
 * (user_id, dedupe_key) means a still-open notification for that same event
 * is never duplicated, including across app restarts. Once the user reads
 * (and deletes) it, the same key is free again for a future occurrence.
 */
export async function notifySelf(userId: string, category: string, dedupeKey: string, title: string, body: string): Promise<void> {
  const { data } = await supabase.from('user_settings').select('notification_prefs').eq('user_id', userId).maybeSingle();
  const prefs = (data?.notification_prefs ?? null) as Record<string, { inApp?: boolean }> | null;
  const enabled = prefs?.[category]?.inApp ?? true;
  if (!enabled) return;

  const { error } = await supabase.from('notifications').insert({ user_id: userId, category, title, body, dedupe_key: dedupeKey });
  // 23505 = unique_violation — a notification for this exact event is
  // already open (unread); not a real error.
  if (error && error.code !== '23505') console.warn('[notify] failed to insert notification:', error.message);
}
