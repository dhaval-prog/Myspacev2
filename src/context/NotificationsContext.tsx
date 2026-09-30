import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';

export interface AppNotification {
  id: string;
  category: string;
  title: string;
  body: string;
  createdAt: string;
  read: boolean;
  /** What this notification is about — set server-side so a tap can jump straight to it. */
  entityType: 'card' | 'connection' | 'throw' | 'story' | null;
  entityId: string | null;
  /** The other person this notification is about (sender, poster, requester) — lets a row render
   * their real avatar without a separate lookup. Null for notifications with no single
   * counterpart (budget/split activity, etc). */
  relatedUserId: string | null;
}

interface NotificationRow {
  id: string;
  category: string;
  title: string;
  body: string;
  created_at: string;
  read: boolean;
  entity_type: string | null;
  entity_id: string | null;
  related_user_id: string | null;
}

function toNotification(row: NotificationRow): AppNotification {
  return {
    id: row.id,
    category: row.category,
    title: row.title,
    body: row.body,
    createdAt: row.created_at,
    read: row.read,
    entityType: row.entity_type as AppNotification['entityType'],
    entityId: row.entity_id,
    relatedUserId: row.related_user_id,
  };
}

interface NotificationsContextValue {
  /** The signed-in user's full notification history (read and unread), newest first. */
  notifications: AppNotification[];
  unreadCount: number;
  /** Marks one notification read — it stays in the list (see `notifications`), just without its
   * unread dot, rather than disappearing the way a delete would. */
  acknowledge: (id: string) => void;
  /** Marks every notification read at once. */
  clearAll: () => void;
}

const NotificationsContext = createContext<NotificationsContextValue | null>(null);

const MAX_NOTIFICATIONS = 100;

/**
 * Real in-app notification inbox: loads the signed-in user's rows from
 * `public.notifications` and keeps them live via Supabase Realtime, so a
 * notification inserted by another member (a shared budget card's activity
 * ping, say) shows up without a refresh. Reading one flips its own `read`
 * column instead of deleting the row, so the full history stays browsable
 * (see NotificationsScreen's TODAY/EARLIER list) while `unreadCount` still
 * reflects only what's actually new.
 */
export function NotificationsProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const [notifications, setNotifications] = useState<AppNotification[]>([]);

  useEffect(() => {
    if (!userId || !isSupabaseConfigured) {
      setNotifications([]);
      return;
    }
    let cancelled = false;

    supabase
      .from('notifications')
      .select('id,category,title,body,created_at,read,entity_type,entity_id,related_user_id')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(MAX_NOTIFICATIONS)
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          console.warn('[notifications] failed to load:', error.message);
          return;
        }
        setNotifications(((data as NotificationRow[] | null) ?? []).map(toNotification));
      });

    const channel = supabase
      .channel(`notifications-${userId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` },
        (payload) => {
          setNotifications((prev) => [toNotification(payload.new as NotificationRow), ...prev].slice(0, MAX_NOTIFICATIONS));
        },
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` },
        (payload) => {
          const updated = toNotification(payload.new as NotificationRow);
          setNotifications((prev) => prev.map((n) => (n.id === updated.id ? updated : n)));
        },
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` },
        (payload) => {
          const gone = payload.old as { id: string };
          setNotifications((prev) => prev.filter((n) => n.id !== gone.id));
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [userId]);

  const acknowledge = (id: string) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
    if (!isSupabaseConfigured) return;
    supabase
      .from('notifications')
      .update({ read: true })
      .eq('id', id)
      .then(({ error }) => {
        if (error) console.warn('[notifications] failed to mark read:', error.message);
      });
  };

  const clearAll = () => {
    if (!userId) return;
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    if (!isSupabaseConfigured) return;
    supabase
      .from('notifications')
      .update({ read: true })
      .eq('user_id', userId)
      .eq('read', false)
      .then(({ error }) => {
        if (error) console.warn('[notifications] failed to mark all read:', error.message);
      });
  };

  const value = useMemo<NotificationsContextValue>(
    () => ({ notifications, unreadCount: notifications.filter((n) => !n.read).length, acknowledge, clearAll }),
    [notifications],
  );

  return <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>;
}

export function useNotifications(): NotificationsContextValue {
  const ctx = useContext(NotificationsContext);
  if (!ctx) throw new Error('useNotifications must be used within a NotificationsProvider');
  return ctx;
}
