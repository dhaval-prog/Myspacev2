import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';

export interface AppNotification {
  id: string;
  category: string;
  title: string;
  body: string;
  createdAt: string;
  /** What this notification is about — set server-side so a tap can jump straight to it. */
  entityType: 'card' | 'group' | 'connection' | null;
  entityId: string | null;
}

interface NotificationRow {
  id: string;
  category: string;
  title: string;
  body: string;
  created_at: string;
  entity_type: string | null;
  entity_id: string | null;
}

function toNotification(row: NotificationRow): AppNotification {
  return {
    id: row.id,
    category: row.category,
    title: row.title,
    body: row.body,
    createdAt: row.created_at,
    entityType: row.entity_type as AppNotification['entityType'],
    entityId: row.entity_id,
  };
}

interface NotificationsContextValue {
  notifications: AppNotification[];
  /** Every open notification is by definition unread — one is deleted the moment it's acknowledged. */
  unreadCount: number;
  /** Reading a notification consumes it: deletes the row, freeing its dedupe key for a future occurrence of the same event. */
  acknowledge: (id: string) => void;
  clearAll: () => void;
}

const NotificationsContext = createContext<NotificationsContextValue | null>(null);

const MAX_NOTIFICATIONS = 50;

/**
 * Real in-app notification inbox: loads the signed-in user's rows from
 * `public.notifications` and keeps them live via Supabase Realtime, so a
 * notification inserted by another member (a split-expense activity ping,
 * say) shows up without a refresh. Each notification appears only once —
 * reading it deletes it (see `acknowledge`) rather than just flagging it
 * read, so the inbox is always exactly "what still needs your attention."
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
      .select('id,category,title,body,created_at,entity_type,entity_id')
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
    setNotifications((prev) => prev.filter((n) => n.id !== id));
    if (!isSupabaseConfigured) return;
    supabase
      .from('notifications')
      .delete()
      .eq('id', id)
      .then(({ error }) => {
        if (error) console.warn('[notifications] failed to delete:', error.message);
      });
  };

  const clearAll = () => {
    if (!userId) return;
    setNotifications([]);
    if (!isSupabaseConfigured) return;
    supabase
      .from('notifications')
      .delete()
      .eq('user_id', userId)
      .then(({ error }) => {
        if (error) console.warn('[notifications] failed to clear all:', error.message);
      });
  };

  const value = useMemo<NotificationsContextValue>(
    () => ({ notifications, unreadCount: notifications.length, acknowledge, clearAll }),
    [notifications],
  );

  return <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>;
}

export function useNotifications(): NotificationsContextValue {
  const ctx = useContext(NotificationsContext);
  if (!ctx) throw new Error('useNotifications must be used within a NotificationsProvider');
  return ctx;
}
