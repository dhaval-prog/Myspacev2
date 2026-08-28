import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';

export interface AppNotification {
  id: string;
  category: string;
  title: string;
  body: string;
  read: boolean;
  createdAt: string;
}

interface NotificationRow {
  id: string;
  category: string;
  title: string;
  body: string;
  read: boolean;
  created_at: string;
}

function toNotification(row: NotificationRow): AppNotification {
  return { id: row.id, category: row.category, title: row.title, body: row.body, read: row.read, createdAt: row.created_at };
}

interface NotificationsContextValue {
  notifications: AppNotification[];
  unreadCount: number;
  markRead: (id: string) => void;
  markAllRead: () => void;
  remove: (id: string) => void;
}

const NotificationsContext = createContext<NotificationsContextValue | null>(null);

const MAX_NOTIFICATIONS = 50;

/**
 * Real in-app notification inbox: loads the signed-in user's rows from
 * `public.notifications` and keeps them live via Supabase Realtime, so a
 * notification inserted by another member (a split-expense activity ping,
 * say) shows up without a refresh.
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
      .select('id,category,title,body,read,created_at')
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
          const next = payload.new as NotificationRow;
          setNotifications((prev) => prev.map((n) => (n.id === next.id ? toNotification(next) : n)));
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

  const markRead = (id: string) => {
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

  const markAllRead = () => {
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

  const remove = (id: string) => {
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

  const unreadCount = useMemo(() => notifications.filter((n) => !n.read).length, [notifications]);

  const value = useMemo<NotificationsContextValue>(
    () => ({ notifications, unreadCount, markRead, markAllRead, remove }),
    [notifications, unreadCount],
  );

  return <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>;
}

export function useNotifications(): NotificationsContextValue {
  const ctx = useContext(NotificationsContext);
  if (!ctx) throw new Error('useNotifications must be used within a NotificationsProvider');
  return ctx;
}
