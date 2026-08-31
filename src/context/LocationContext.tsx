import React, { createContext, useContext, useEffect, useState } from 'react';
import type { LastSeen, LocationShare, ShareDurationKey } from '../types/location';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';

interface LastSeenRow {
  user_id: string;
  latitude: number;
  longitude: number;
  updated_at: string;
}

interface ShareRow {
  user_id: string;
  status: 'active' | 'ended';
  started_at: string | null;
  expires_at: string | null;
  last_latitude: number | null;
  last_longitude: number | null;
  last_updated_at: string | null;
}

// "Until I turn it off" still carries a safety-net expiry — the real end
// is always an explicit stopShare(), this just guards against a share
// silently running forever if the app is killed before that happens.
const DURATION_MS: Record<ShareDurationKey, number> = {
  '15m': 15 * 60 * 1000,
  '1h': 60 * 60 * 1000,
  '2h': 2 * 60 * 60 * 1000,
  off: 24 * 60 * 60 * 1000,
};

function toLastSeen(row: LastSeenRow): LastSeen {
  return { userId: row.user_id, latitude: row.latitude, longitude: row.longitude, updatedAt: row.updated_at };
}

function toShare(row: ShareRow): LocationShare {
  return {
    userId: row.user_id,
    status: row.status,
    startedAt: row.started_at,
    expiresAt: row.expires_at,
    latitude: row.last_latitude,
    longitude: row.last_longitude,
    lastUpdatedAt: row.last_updated_at,
  };
}

function warn(action: string, error: { message: string } | null) {
  if (error) console.warn(`[location] failed to ${action}:`, error.message);
}

interface LocationContextValue {
  lastSeenFor: (userId: string) => LastSeen | undefined;
  /** Only returns a share if it's actually active and not yet expired. */
  shareFor: (userId: string) => LocationShare | undefined;
  isSharingLive: (userId: string) => boolean;
  myShare: LocationShare | undefined;
  upsertLastSeen: (latitude: number, longitude: number) => Promise<void>;
  startShare: (duration: ShareDurationKey, latitude: number, longitude: number) => Promise<void>;
  pingShare: (latitude: number, longitude: number) => Promise<void>;
  stopShare: () => Promise<void>;
}

const LocationContext = createContext<LocationContextValue | null>(null);

/**
 * Last-seen + live-share state for the signed-in account and its friends.
 * Scoped locally to the Live Locations screen (like SplitProvider is to
 * Split) rather than mounted globally — nothing outside that screen needs
 * this data or the permission prompts that come with it.
 */
export function LocationProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const [lastSeenRows, setLastSeenRows] = useState<LastSeenRow[]>([]);
  const [shareRows, setShareRows] = useState<ShareRow[]>([]);

  useEffect(() => {
    if (!userId || !isSupabaseConfigured) {
      setLastSeenRows([]);
      setShareRows([]);
      return;
    }
    let cancelled = false;
    (async () => {
      const [lastSeenRes, sharesRes] = await Promise.all([
        supabase.from('user_last_seen').select('*'),
        supabase.from('location_shares').select('*'),
      ]);
      if (cancelled) return;
      warn('load last seen', lastSeenRes.error);
      warn('load shares', sharesRes.error);
      setLastSeenRows((lastSeenRes.data as LastSeenRow[] | null) ?? []);
      setShareRows((sharesRes.data as ShareRow[] | null) ?? []);
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  // RLS already limits what actually arrives here to self + accepted
  // friends, same pattern as the UPI feature's payment_attempts feed.
  useEffect(() => {
    if (!userId || !isSupabaseConfigured) return;
    const channel = supabase
      .channel('location-all')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'user_last_seen' }, (payload) => {
        if (payload.eventType === 'DELETE') return;
        const row = payload.new as LastSeenRow;
        setLastSeenRows((prev) => [row, ...prev.filter((r) => r.user_id !== row.user_id)]);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'location_shares' }, (payload) => {
        if (payload.eventType === 'DELETE') return;
        const row = payload.new as ShareRow;
        setShareRows((prev) => [row, ...prev.filter((r) => r.user_id !== row.user_id)]);
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  const lastSeenFor = (id: string): LastSeen | undefined => {
    const row = lastSeenRows.find((r) => r.user_id === id);
    return row ? toLastSeen(row) : undefined;
  };

  const shareFor = (id: string): LocationShare | undefined => {
    const row = shareRows.find((r) => r.user_id === id);
    if (!row || row.status !== 'active' || !row.expires_at) return undefined;
    if (new Date(row.expires_at).getTime() <= Date.now()) return undefined;
    return toShare(row);
  };

  const isSharingLive = (id: string) => shareFor(id) !== undefined;
  const myShare = userId ? shareFor(userId) : undefined;

  const upsertLastSeen = async (latitude: number, longitude: number) => {
    if (!userId || !isSupabaseConfigured) return;
    const { data, error } = await supabase
      .from('user_last_seen')
      .upsert({ user_id: userId, latitude, longitude, updated_at: new Date().toISOString() }, { onConflict: 'user_id' })
      .select('*')
      .single();
    warn('upsert last seen', error);
    if (data) setLastSeenRows((prev) => [data as LastSeenRow, ...prev.filter((r) => r.user_id !== userId)]);
  };

  const startShare = async (duration: ShareDurationKey, latitude: number, longitude: number) => {
    if (!userId || !isSupabaseConfigured) return;
    const now = new Date();
    const expiresAt = new Date(now.getTime() + DURATION_MS[duration]);
    const { data, error } = await supabase
      .from('location_shares')
      .upsert(
        {
          user_id: userId,
          status: 'active',
          started_at: now.toISOString(),
          expires_at: expiresAt.toISOString(),
          last_latitude: latitude,
          last_longitude: longitude,
          last_updated_at: now.toISOString(),
        },
        { onConflict: 'user_id' },
      )
      .select('*')
      .single();
    warn('start share', error);
    if (data) setShareRows((prev) => [data as ShareRow, ...prev.filter((r) => r.user_id !== userId)]);
  };

  const pingShare = async (latitude: number, longitude: number) => {
    if (!userId || !isSupabaseConfigured) return;
    const { data, error } = await supabase
      .from('location_shares')
      .update({ last_latitude: latitude, last_longitude: longitude, last_updated_at: new Date().toISOString() })
      .eq('user_id', userId)
      .select('*')
      .single();
    warn('ping share', error);
    if (data) setShareRows((prev) => [data as ShareRow, ...prev.filter((r) => r.user_id !== userId)]);
  };

  const stopShare = async () => {
    if (!userId || !isSupabaseConfigured) return;
    const { data, error } = await supabase.from('location_shares').update({ status: 'ended' }).eq('user_id', userId).select('*').single();
    warn('stop share', error);
    if (data) setShareRows((prev) => [data as ShareRow, ...prev.filter((r) => r.user_id !== userId)]);
  };

  const value: LocationContextValue = {
    lastSeenFor,
    shareFor,
    isSharingLive,
    myShare,
    upsertLastSeen,
    startShare,
    pingShare,
    stopShare,
  };

  return <LocationContext.Provider value={value}>{children}</LocationContext.Provider>;
}

export function useLocationData(): LocationContextValue {
  const ctx = useContext(LocationContext);
  if (!ctx) throw new Error('useLocationData must be used within a LocationProvider');
  return ctx;
}
