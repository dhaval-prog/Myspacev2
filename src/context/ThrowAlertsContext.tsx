import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';
import { computeNextTrigger } from '../utils/throwAlerts';
import { FullScreenAlertOverlay } from '../components/throw/FullScreenAlertOverlay';
import type { AlertSchedule, StrokePath, ThrowAlert, ThrowAlertRow } from '../types/throw';

function warn(action: string, error: { message: string } | null) {
  if (error) console.warn(`[ThrowAlerts] ${action} failed:`, error.message);
}

function toAlert(row: ThrowAlertRow): ThrowAlert {
  return {
    id: row.id,
    messageText: row.message_text,
    strokes: row.strokes,
    penColor: row.pen_color,
    recurrence: row.recurrence_type,
    daysOfWeek: row.days_of_week ?? [],
    dayOfMonth: row.day_of_month,
    hour: row.hour,
    minute: row.minute,
    nextTriggerAt: row.next_trigger_at,
    active: row.active,
  };
}

const NOTIFICATION_CHANNEL_ID = 'throw-alerts';

interface ThrowAlertsContextValue {
  /** Every active self-alert, soonest first. */
  alerts: ThrowAlert[];
  /** The alert currently due — non-null exactly while the full-screen overlay should be showing. */
  dueAlert: ThrowAlert | null;
  createAlert: (
    schedule: AlertSchedule,
    content: { messageText: string; strokes: StrokePath[] | null; penColor: string },
  ) => Promise<{ error: string | null }>;
  deleteAlert: (id: string) => Promise<{ error: string | null }>;
  snoozeDueAlert: () => Promise<void>;
  dismissDueAlert: () => Promise<void>;
}

const ThrowAlertsContext = createContext<ThrowAlertsContextValue | null>(null);

/**
 * Root-mounted (see App.tsx, right alongside CallProvider/CallOverlay) rather than scoped to the
 * Throw screen tree like ThrowProvider — the full-screen alert overlay has to be able to
 * interrupt the user anywhere in the app, not just while they're on the Throw tab.
 *
 * Only a "foreground + notification tap" alarm is implemented here, by explicit user choice: a
 * scheduled alert fires straight into the full-screen overlay while the app is open; if the app
 * is backgrounded or closed, a normal OS notification fires instead, and tapping it opens the app
 * straight into the same overlay. A true background/locked-screen full-screen alarm would need
 * native full-screen-intent/critical-alert entitlements and a custom dev build, which is out of
 * scope for this managed Expo app.
 */
export function ThrowAlertsProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const myId = user?.id ?? null;

  const [alerts, setAlerts] = useState<ThrowAlert[]>([]);
  const [dueAlert, setDueAlert] = useState<ThrowAlert | null>(null);
  const alertsRef = useRef<ThrowAlert[]>([]);
  alertsRef.current = alerts;
  // Local-only bookkeeping (never persisted): which native notification id is currently
  // scheduled for a given alert, so it can be cancelled/replaced when the alert's next_trigger_at
  // changes instead of leaving a stale duplicate scheduled.
  const notificationIdsRef = useRef<Record<string, string>>({});

  const refresh = useCallback(async () => {
    if (!myId) {
      setAlerts([]);
      return;
    }
    const { data, error } = await supabase
      .from('throw_alerts')
      .select('*')
      .eq('user_id', myId)
      .eq('active', true)
      .order('next_trigger_at', { ascending: true });
    warn('load alerts', error);
    setAlerts(((data as ThrowAlertRow[] | null) ?? []).map(toAlert));
  }, [myId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (!myId) return;
    const channel = supabase
      .channel(`throw_alerts-${myId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'throw_alerts', filter: `user_id=eq.${myId}` }, () => refresh())
      .subscribe();
    const poll = setInterval(refresh, 30000);
    return () => {
      supabase.removeChannel(channel);
      clearInterval(poll);
    };
  }, [myId, refresh]);

  // Permission + Android channel setup — best-effort. A denied permission only affects the
  // background/notification-tap path; the foreground overlay below doesn't depend on it.
  useEffect(() => {
    if (Platform.OS === 'web') return;
    Notifications.requestPermissionsAsync().catch(() => {});
    if (Platform.OS === 'android') {
      Notifications.setNotificationChannelAsync(NOTIFICATION_CHANNEL_ID, {
        name: 'Throw reminders',
        importance: Notifications.AndroidImportance.HIGH,
      }).catch(() => {});
    }
  }, []);

  useEffect(() => {
    if (Platform.OS === 'web') return;
    // While the app is foregrounded, a scheduled alert fires straight into the full-screen
    // overlay (via the received-listener below) instead of showing a banner.
    Notifications.setNotificationHandler({
      handleNotification: async () => ({ shouldShowBanner: false, shouldShowList: false, shouldPlaySound: true, shouldSetBadge: false }),
    });
    const onReceived = Notifications.addNotificationReceivedListener((n) => {
      const alertId = n.request.content.data?.alertId as string | undefined;
      const found = alertId ? alertsRef.current.find((a) => a.id === alertId) : null;
      if (found) setDueAlert((prev) => prev ?? found);
    });
    // Backgrounded/closed app: the OS shows a plain notification instead (the handler above only
    // runs in foreground); tapping it delivers this response once the app opens, which is the
    // cue to jump straight into the full-screen overlay for that same alert.
    const onResponse = Notifications.addNotificationResponseReceivedListener((r) => {
      const alertId = r.notification.request.content.data?.alertId as string | undefined;
      const found = alertId ? alertsRef.current.find((a) => a.id === alertId) : null;
      if (found) setDueAlert(found);
    });
    return () => {
      onReceived.remove();
      onResponse.remove();
    };
  }, []);

  // Web has no local-notification support at all — this in-app poll is what makes the
  // foreground overlay still fire on time in the react-native-web build.
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const id = setInterval(() => {
      const now = Date.now();
      const due = alertsRef.current.find((a) => new Date(a.nextTriggerAt).getTime() <= now);
      if (due) setDueAlert((prev) => prev ?? due);
    }, 5000);
    return () => clearInterval(id);
  }, []);

  const scheduleNotification = useCallback(async (alert: ThrowAlert) => {
    if (Platform.OS === 'web') return;
    const fireAt = new Date(alert.nextTriggerAt).getTime();
    // Never hand a past instant to the OS — it would fire again immediately. A due alert either
    // is already showing, or is about to be rescheduled by a snooze/dismiss.
    if (fireAt <= Date.now()) return;
    const existing = notificationIdsRef.current[alert.id];
    if (existing) await Notifications.cancelScheduledNotificationAsync(existing).catch(() => {});
    const id = await Notifications.scheduleNotificationAsync({
      content: { title: 'A letter has arrived', body: alert.messageText, data: { alertId: alert.id }, sound: true },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: new Date(fireAt), channelId: NOTIFICATION_CHANNEL_ID },
    }).catch((e) => {
      console.warn('[ThrowAlerts] schedule failed:', e instanceof Error ? e.message : e);
      return null;
    });
    if (id) notificationIdsRef.current[alert.id] = id;
  }, []);

  useEffect(() => {
    for (const alert of alerts) scheduleNotification(alert);
  }, [alerts, scheduleNotification]);

  const createAlert = useCallback(
    async (schedule: AlertSchedule, content: { messageText: string; strokes: StrokePath[] | null; penColor: string }) => {
      if (!myId) return { error: 'Not signed in.' };
      const nextTrigger = computeNextTrigger(schedule);
      const { error } = await supabase.from('throw_alerts').insert({
        user_id: myId,
        message_text: content.messageText,
        strokes: content.strokes,
        pen_color: content.penColor,
        recurrence_type: schedule.recurrence,
        days_of_week: schedule.recurrence === 'weekly' ? schedule.daysOfWeek : null,
        day_of_month: schedule.recurrence === 'monthly' ? schedule.dayOfMonth : null,
        hour: schedule.hour,
        minute: schedule.minute,
        next_trigger_at: nextTrigger.toISOString(),
      });
      if (error) return { error: error.message };
      await refresh();
      return { error: null };
    },
    [myId, refresh],
  );

  const deleteAlert = useCallback(
    async (id: string): Promise<{ error: string | null }> => {
      const existing = notificationIdsRef.current[id];
      if (existing && Platform.OS !== 'web') await Notifications.cancelScheduledNotificationAsync(existing).catch(() => {});
      delete notificationIdsRef.current[id];
      const { error } = await supabase.from('throw_alerts').delete().eq('id', id);
      if (error) return { error: error.message };
      await refresh();
      return { error: null };
    },
    [refresh],
  );

  const rescheduleAfterFire = useCallback(
    async (alert: ThrowAlert) => {
      if (alert.recurrence === 'once') {
        await deleteAlert(alert.id);
        return;
      }
      const schedule: AlertSchedule = {
        recurrence: alert.recurrence,
        hour: alert.hour,
        minute: alert.minute,
        daysOfWeek: alert.daysOfWeek,
        dayOfMonth: alert.dayOfMonth ?? 1,
      };
      // A minute of headroom so the freshly-computed instant is unambiguously in the future even
      // if this runs a beat late.
      const next = computeNextTrigger(schedule, new Date(Date.now() + 60000));
      const { error } = await supabase
        .from('throw_alerts')
        .update({ next_trigger_at: next.toISOString(), updated_at: new Date().toISOString() })
        .eq('id', alert.id);
      warn('reschedule alert', error);
      await refresh();
    },
    [deleteAlert, refresh],
  );

  const snoozeDueAlert = useCallback(async () => {
    const alert = dueAlert;
    setDueAlert(null);
    if (!alert) return;
    const snoozeAt = new Date(Date.now() + 5 * 60000);
    const { error } = await supabase
      .from('throw_alerts')
      .update({ next_trigger_at: snoozeAt.toISOString(), updated_at: new Date().toISOString() })
      .eq('id', alert.id);
    warn('snooze alert', error);
    await refresh();
  }, [dueAlert, refresh]);

  const dismissDueAlert = useCallback(async () => {
    const alert = dueAlert;
    setDueAlert(null);
    if (alert) await rescheduleAfterFire(alert);
  }, [dueAlert, rescheduleAfterFire]);

  const value = useMemo<ThrowAlertsContextValue>(
    () => ({ alerts, dueAlert, createAlert, deleteAlert, snoozeDueAlert, dismissDueAlert }),
    [alerts, dueAlert, createAlert, deleteAlert, snoozeDueAlert, dismissDueAlert],
  );

  return <ThrowAlertsContext.Provider value={value}>{children}</ThrowAlertsContext.Provider>;
}

export function useThrowAlerts(): ThrowAlertsContextValue {
  const ctx = useContext(ThrowAlertsContext);
  if (!ctx) throw new Error('useThrowAlerts must be used within a ThrowAlertsProvider');
  return ctx;
}

/** Sibling to the provider (see App.tsx, next to CallOverlay) — reads the context itself rather
 * than the provider rendering its own JSX, the same split CallProvider/CallOverlay already use. */
export function ThrowAlertsOverlay() {
  const { dueAlert, snoozeDueAlert, dismissDueAlert } = useThrowAlerts();
  if (!dueAlert) return null;
  return <FullScreenAlertOverlay alert={dueAlert} onSnooze={snoozeDueAlert} onDismiss={dismissDueAlert} />;
}
