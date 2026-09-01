import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { AlertType, DosageType, Item } from '../types/space';
import { CATEGORY_MONO } from '../data/itemCategories';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';

interface NewItemInput {
  name: string;
  category: string;
  room: string;
  expiry: string;
  dosageType?: DosageType;
  dosageAmount?: number;
  remindersEnabled?: boolean;
  dosesPerDay?: number;
  reminderTimes?: string[];
  photoUrl?: string;
  alertType?: AlertType;
}

interface EditItemInput {
  name?: string;
  category?: string;
  room?: string;
  expiry?: string;
  dosageType?: DosageType;
  dosageAmount?: number;
  remindersEnabled?: boolean;
  dosesPerDay?: number;
  reminderTimes?: string[];
  photoUrl?: string;
  alertType?: AlertType;
}

interface SpaceContextValue {
  items: Item[];
  /** True while the initial items fetch for the signed-in user is in flight. */
  loading: boolean;
  addItem: (input: NewItemInput) => void;
  editItem: (index: number, input: EditItemInput) => void;
  removeItem: (index: number) => void;
}

const SpaceContext = createContext<SpaceContextValue | null>(null);

/** Local item state pairs each Item with its Supabase row id, invisible to consumers. */
interface ItemRow {
  id: string;
  item: Item;
}

function warn(action: string, error: { message: string } | null) {
  if (error) console.warn(`[space] failed to ${action}:`, error.message);
}

/**
 * Items for the signed-in user, persisted to Supabase. Each item's `room`
 * is a plain string picked from the fixed default set (see
 * `src/data/rooms.ts`) at add time — there's no separate room entity to
 * manage. State updates optimistically (the UI never waits on a round
 * trip) and mirrors the write to Supabase in the background; a failed
 * write is logged rather than rolled back, matching how the rest of this
 * app treats network errors on non-critical writes.
 */
export function SpaceProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const userId = user?.id ?? null;

  const [itemRows, setItemRows] = useState<ItemRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    if (!userId || !isSupabaseConfigured) {
      setItemRows([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    (async () => {
      const itemsRes = await supabase
        .from('items')
        .select('id,name,category,room,expiry,mono,dosage_type,dosage_amount,reminders_enabled,doses_per_day,reminder_times,photo_url,alert_type')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
      if (cancelled) return;

      warn('load items', itemsRes.error);

      setItemRows(
        (itemsRes.data ?? []).map((row) => ({
          id: row.id as string,
          item: {
            name: row.name as string,
            category: (row.category as string) ?? '',
            room: (row.room as string) ?? '',
            expiry: (row.expiry as string) ?? '',
            mono: row.mono as string,
            dosageType: (row.dosage_type as DosageType | null) ?? undefined,
            dosageAmount: (row.dosage_amount as number | null) ?? undefined,
            remindersEnabled: (row.reminders_enabled as boolean | null) ?? undefined,
            dosesPerDay: (row.doses_per_day as number | null) ?? undefined,
            reminderTimes: (row.reminder_times as string[] | null) ?? undefined,
            photoUrl: (row.photo_url as string | null) || undefined,
            alertType: (row.alert_type as AlertType | null) ?? undefined,
          },
        })),
      );
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [userId]);

  const items = useMemo(() => itemRows.map((r) => r.item), [itemRows]);

  const addItem = useCallback(
    (input: NewItemInput) => {
      const mono = CATEGORY_MONO[input.category] || '▢';
      const item: Item = { ...input, mono };

      if (!userId || !isSupabaseConfigured) {
        setItemRows((prev) => [{ id: `local-${Date.now()}`, item }, ...prev]);
        return;
      }

      supabase
        .from('items')
        .insert({
          user_id: userId,
          name: input.name,
          category: input.category,
          room: input.room,
          expiry: input.expiry || null,
          mono,
          dosage_type: input.dosageType ?? null,
          dosage_amount: input.dosageAmount ?? null,
          reminders_enabled: input.remindersEnabled ?? false,
          doses_per_day: input.dosesPerDay ?? null,
          reminder_times: input.reminderTimes ?? null,
          photo_url: input.photoUrl ?? null,
          alert_type: input.alertType ?? null,
        })
        .select('id')
        .single()
        .then(({ data, error }) => {
          warn('add item', error);
          if (data) setItemRows((prev) => [{ id: data.id as string, item }, ...prev]);
        });
    },
    [userId],
  );

  const editItem = useCallback(
    (index: number, input: EditItemInput) => {
      setItemRows((prev) => {
        const row = prev[index];
        if (!row) return prev;

        const mono = input.category ? CATEGORY_MONO[input.category] || '▢' : row.item.mono;
        const nextItem: Item = { ...row.item, ...input, mono };

        if (userId && isSupabaseConfigured) {
          supabase
            .from('items')
            .update({
              ...(input.name !== undefined && { name: input.name }),
              ...(input.category !== undefined && { category: input.category, mono }),
              ...(input.room !== undefined && { room: input.room }),
              ...(input.expiry !== undefined && { expiry: input.expiry || null }),
              ...(input.dosageType !== undefined && { dosage_type: input.dosageType }),
              ...(input.dosageAmount !== undefined && { dosage_amount: input.dosageAmount }),
              ...(input.remindersEnabled !== undefined && { reminders_enabled: input.remindersEnabled }),
              ...(input.dosesPerDay !== undefined && { doses_per_day: input.dosesPerDay }),
              ...(input.reminderTimes !== undefined && { reminder_times: input.reminderTimes }),
              ...(input.photoUrl !== undefined && { photo_url: input.photoUrl || null }),
              ...(input.alertType !== undefined && { alert_type: input.alertType }),
            })
            .eq('id', row.id)
            .then(({ error }) => warn('update item', error));
        }

        return prev.map((r, i) => (i === index ? { id: r.id, item: nextItem } : r));
      });
    },
    [userId],
  );

  const removeItem = useCallback(
    (index: number) => {
      setItemRows((prev) => {
        const row = prev[index];
        if (row && userId && isSupabaseConfigured) {
          supabase
            .from('items')
            .delete()
            .eq('id', row.id)
            .then(({ error }) => warn('remove item', error));
        }
        return prev.filter((_, i) => i !== index);
      });
    },
    [userId],
  );

  const value = useMemo<SpaceContextValue>(
    () => ({ items, loading, addItem, editItem, removeItem }),
    [items, loading, addItem, editItem, removeItem],
  );

  return <SpaceContext.Provider value={value}>{children}</SpaceContext.Provider>;
}

export function useSpace(): SpaceContextValue {
  const ctx = useContext(SpaceContext);
  if (!ctx) throw new Error('useSpace must be used within a SpaceProvider');
  return ctx;
}
