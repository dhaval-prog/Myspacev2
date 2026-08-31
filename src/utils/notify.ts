import { supabase } from '../lib/supabase';
import type { AppNotification } from '../context/NotificationsContext';

/**
 * Inserts a self-directed in-app notification, honoring the user's own
 * preference for that category. `dedupeKey` identifies the underlying event
 * (e.g. "budget_reset:<cardId>:<resetLabel>") — a unique DB constraint on
 * (user_id, dedupe_key) means a still-open notification for that same event
 * is never duplicated, including across app restarts. Once the user reads
 * (and deletes) it, the same key is free again for a future occurrence.
 * `entity` identifies what the notification is about, so tapping it can jump
 * straight there — omit it when there's nothing to focus (e.g. a Home item
 * reminder, which just opens Home).
 */
export async function notifySelf(
  userId: string,
  category: string,
  dedupeKey: string,
  title: string,
  body: string,
  entity?: { type: 'card' | 'group' | 'connection'; id: string },
): Promise<void> {
  const { data } = await supabase.from('user_settings').select('notification_prefs').eq('user_id', userId).maybeSingle();
  const prefs = (data?.notification_prefs ?? null) as Record<string, { inApp?: boolean }> | null;
  const enabled = prefs?.[category]?.inApp ?? true;
  if (!enabled) return;

  const { error } = await supabase
    .from('notifications')
    .insert({ user_id: userId, category, title, body, dedupe_key: dedupeKey, entity_type: entity?.type ?? null, entity_id: entity?.id ?? null });
  // 23505 = unique_violation — a notification for this exact event is
  // already open (unread); not a real error.
  if (error && error.code !== '23505') console.warn('[notify] failed to insert notification:', error.message);
}

export type NotificationTarget =
  | { screen: 'expenses'; cardId: string }
  | { screen: 'split'; groupId: string }
  | { screen: 'friends'; connectionId: string }
  | { screen: 'home' };

/** Where tapping a notification should take you — falls back to Home when it has nothing to focus. */
export function targetForNotification(n: AppNotification): NotificationTarget {
  if (n.entityType === 'card' && n.entityId) return { screen: 'expenses', cardId: n.entityId };
  if (n.entityType === 'group' && n.entityId) return { screen: 'split', groupId: n.entityId };
  if (n.entityType === 'connection' && n.entityId) return { screen: 'friends', connectionId: n.entityId };
  return { screen: 'home' };
}
