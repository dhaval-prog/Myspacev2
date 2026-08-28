import { supabase } from '../lib/supabase';

/** Inserts a self-directed in-app notification, honoring the user's own preference for that category. Silently no-ops when the category is off. */
export async function notifySelf(userId: string, category: string, title: string, body: string): Promise<void> {
  const { data } = await supabase.from('user_settings').select('notification_prefs').eq('user_id', userId).maybeSingle();
  const prefs = (data?.notification_prefs ?? null) as Record<string, { inApp?: boolean }> | null;
  const enabled = prefs?.[category]?.inApp ?? true;
  if (!enabled) return;
  const { error } = await supabase.from('notifications').insert({ user_id: userId, category, title, body });
  if (error) console.warn('[notify] failed to insert notification:', error.message);
}
