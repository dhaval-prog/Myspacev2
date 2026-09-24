import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';
import { useFriends } from './FriendsContext';
import type { ComposeDraft, ThrowFriend, ThrowLetter, ThrowLocation, ThrowRow } from '../types/throw';

function warn(action: string, error: { message: string } | null) {
  if (error) console.warn(`[Throw] ${action} failed:`, error.message);
}

function toLetter(row: ThrowRow, myId: string, nameFor: (userId: string) => string, avatarFor: (userId: string) => string | null): ThrowLetter {
  const direction: 'sent' | 'received' = row.sender_id === myId ? 'sent' : 'received';
  const counterpartId = direction === 'sent' ? row.recipient_id : row.sender_id;
  return {
    id: row.id,
    senderId: row.sender_id,
    recipientId: row.recipient_id,
    counterpartId,
    counterpartName: nameFor(counterpartId),
    counterpartAvatarUrl: avatarFor(counterpartId),
    direction,
    messageText: row.message_text,
    strokes: row.strokes,
    penColor: row.pen_color,
    senderCity: row.sender_city,
    senderCountry: row.sender_country,
    senderLatitude: row.sender_latitude,
    senderLongitude: row.sender_longitude,
    recipientCity: row.recipient_city,
    recipientCountry: row.recipient_country,
    recipientLatitude: row.recipient_latitude,
    recipientLongitude: row.recipient_longitude,
    distanceMiles: row.distance_miles,
    status: row.status,
    createdAt: row.created_at,
    readAt: row.read_at,
    repliedToThrowId: row.replied_to_throw_id,
  };
}

interface ThrowContextValue {
  loading: boolean;
  myLocation: ThrowLocation | null;
  setMyLocation: (loc: ThrowLocation) => Promise<{ error: string | null }>;
  /** Accepted friends merged with their Throw location, if they've set one. */
  friends: ThrowFriend[];
  /** Every letter involving me, newest first. */
  letters: ThrowLetter[];
  /** Letters I received, newest first. */
  inbox: ThrowLetter[];
  unreadCount: number;
  sendThrow: (draft: ComposeDraft) => Promise<{ error: string | null; letter?: ThrowLetter }>;
  markRead: (throwId: string) => Promise<void>;
  refresh: () => Promise<void>;
}

const ThrowContext = createContext<ThrowContextValue | null>(null);

/** Scoped around just the Throw screen tree (not mounted at app root) — mirrors LocationContext's pattern. */
export function ThrowProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const { friends: fsFriends } = useFriends();
  const myId = user?.id ?? null;

  const [loading, setLoading] = useState(true);
  const [myLocation, setMyLocationState] = useState<ThrowLocation | null>(null);
  const [friendLocations, setFriendLocations] = useState<Record<string, ThrowLocation>>({});
  const [rows, setRows] = useState<ThrowRow[]>([]);

  const nameFor = useCallback((userId: string) => fsFriends.find((f) => f.userId === userId)?.name ?? 'Someone', [fsFriends]);
  const avatarFor = useCallback((userId: string) => fsFriends.find((f) => f.userId === userId)?.avatarUrl ?? null, [fsFriends]);

  const refresh = useCallback(async () => {
    if (!myId) return;
    setLoading(true);
    const [meRes, throwsRes] = await Promise.all([
      supabase.from('throw_profiles').select('city,country,latitude,longitude').eq('user_id', myId).maybeSingle(),
      supabase.from('throws').select('*').or(`sender_id.eq.${myId},recipient_id.eq.${myId}`).order('created_at', { ascending: false }),
    ]);
    warn('load my location', meRes.error);
    warn('load throws', throwsRes.error);

    if (meRes.data) {
      const d = meRes.data as { city: string; country: string; latitude: number; longitude: number };
      setMyLocationState({ city: d.city, country: d.country, latitude: d.latitude, longitude: d.longitude });
    }
    setRows((throwsRes.data as ThrowRow[] | null) ?? []);

    const friendIds = fsFriends.map((f) => f.userId);
    if (friendIds.length > 0) {
      const { data: locRows, error: locErr } = await supabase
        .from('throw_profiles')
        .select('user_id,city,country,latitude,longitude')
        .in('user_id', friendIds);
      warn('load friend locations', locErr);
      const map: Record<string, ThrowLocation> = {};
      for (const r of (locRows as { user_id: string; city: string; country: string; latitude: number; longitude: number }[] | null) ?? []) {
        map[r.user_id] = { city: r.city, country: r.country, latitude: r.latitude, longitude: r.longitude };
      }
      setFriendLocations(map);
    } else {
      setFriendLocations({});
    }
    setLoading(false);
  }, [myId, fsFriends]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (!myId) return;
    const channel = supabase
      .channel(`throws-${myId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'throws', filter: `recipient_id=eq.${myId}` }, () => refresh())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'throws', filter: `sender_id=eq.${myId}` }, () => refresh())
      .subscribe();
    const poll = setInterval(refresh, 15000);
    return () => {
      supabase.removeChannel(channel);
      clearInterval(poll);
    };
  }, [myId, refresh]);

  const setMyLocation = useCallback(
    async (loc: ThrowLocation) => {
      if (!myId) return { error: 'not signed in' };
      const { error } = await supabase
        .from('throw_profiles')
        .upsert({ user_id: myId, city: loc.city, country: loc.country, latitude: loc.latitude, longitude: loc.longitude, updated_at: new Date().toISOString() });
      if (error) return { error: error.message };
      setMyLocationState(loc);
      return { error: null };
    },
    [myId],
  );

  const sendThrow = useCallback(
    async (draft: ComposeDraft) => {
      const { data, error } = await supabase.rpc('send_throw', {
        p_recipient_id: draft.recipientId,
        p_message_text: draft.messageText,
        p_strokes: draft.strokes,
        p_pen_color: draft.penColor,
        p_replied_to_throw_id: draft.repliedToThrowId ?? null,
      });
      if (error) return { error: error.message };
      await refresh();
      return { error: null, letter: toLetter(data as ThrowRow, myId ?? '', nameFor, avatarFor) };
    },
    [myId, nameFor, avatarFor, refresh],
  );

  const markRead = useCallback(
    async (throwId: string) => {
      const { error } = await supabase.rpc('mark_throw_read', { p_throw_id: throwId });
      warn('mark_throw_read', error);
      await refresh();
    },
    [refresh],
  );

  const letters = useMemo(() => rows.map((r) => toLetter(r, myId ?? '', nameFor, avatarFor)), [rows, myId, nameFor, avatarFor]);
  const inbox = useMemo(() => letters.filter((l) => l.direction === 'received'), [letters]);
  const unreadCount = useMemo(() => inbox.filter((l) => l.status === 'thrown').length, [inbox]);

  const friends: ThrowFriend[] = useMemo(
    () => fsFriends.map((f) => ({ userId: f.userId, name: f.name, avatarUrl: f.avatarUrl, location: friendLocations[f.userId] ?? null })),
    [fsFriends, friendLocations],
  );

  const value: ThrowContextValue = { loading, myLocation, setMyLocation, friends, letters, inbox, unreadCount, sendThrow, markRead, refresh };
  return <ThrowContext.Provider value={value}>{children}</ThrowContext.Provider>;
}

export function useThrow(): ThrowContextValue {
  const ctx = useContext(ThrowContext);
  if (!ctx) throw new Error('useThrow must be used within a ThrowProvider');
  return ctx;
}
