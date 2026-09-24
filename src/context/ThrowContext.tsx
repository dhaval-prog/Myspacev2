import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';
import { useFriends } from './FriendsContext';
import type { ComposeDraft, ThrowFriend, ThrowLetter, ThrowLocation, ThrowRow } from '../types/throw';

function warn(action: string, error: { message: string } | null) {
  if (error) console.warn(`[Throw] ${action} failed:`, error.message);
}

/** Same reasoning as FriendsContext's own copy: a naive "everything after the last dot" breaks on
 * web, where expo-image-picker hands back an extension-less `blob:` URI. */
function extFromBlob(localUri: string, mimeType: string): string {
  const mimeExt = mimeType.split('/')[1]?.split('+')[0];
  if (mimeExt && /^[a-z0-9]{2,5}$/i.test(mimeExt)) return mimeExt.toLowerCase() === 'jpeg' ? 'jpg' : mimeExt.toLowerCase();
  const match = localUri.split('?')[0].match(/\.([a-z0-9]{2,5})$/i);
  return match ? match[1].toLowerCase() : 'jpg';
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
    photoUrl: row.photo_url,
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
  /** Uploads a local photo (camera or library) to this user's own throw-media folder, returning
   * its public URL for inclusion in a ComposeDraft. Separate from sendThrow itself since the
   * photo is picked/previewed before the user actually throws. */
  uploadPhoto: (localUri: string) => Promise<{ url: string | null; error: string | null }>;
  markRead: (throwId: string) => Promise<void>;
  /** Removes a letter from my own view (inbox or sent list, whichever it's in) — the other
   * party's copy is untouched until they delete it too. */
  deleteThrow: (throwId: string) => Promise<{ error: string | null }>;
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
  const hasLoadedRef = useRef(false);

  const nameFor = useCallback((userId: string) => fsFriends.find((f) => f.userId === userId)?.name ?? 'Someone', [fsFriends]);
  const avatarFor = useCallback((userId: string) => fsFriends.find((f) => f.userId === userId)?.avatarUrl ?? null, [fsFriends]);

  const refresh = useCallback(async () => {
    if (!myId) return;
    // Only the very first load blanks the screen — a poll or realtime-triggered refresh updates
    // data quietly in the background so it never interrupts whatever's on screen (mid-gesture
    // composing, an in-progress flight animation, etc.).
    if (!hasLoadedRef.current) setLoading(true);
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
    // A letter deleted from "my" side (sender or recipient, whichever I am) stays in the shared
    // row for the other person until they've deleted it too (see delete_throw) — so filtering it
    // out of my own list happens here, client-side, rather than in the query itself.
    const visibleRows = ((throwsRes.data as ThrowRow[] | null) ?? []).filter((r) => {
      if (r.sender_id === myId && r.deleted_by_sender) return false;
      if (r.recipient_id === myId && r.deleted_by_recipient) return false;
      return true;
    });
    setRows(visibleRows);

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
    hasLoadedRef.current = true;
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
        p_photo_url: draft.photoUrl,
      });
      if (error) return { error: error.message };
      await refresh();
      return { error: null, letter: toLetter(data as ThrowRow, myId ?? '', nameFor, avatarFor) };
    },
    [myId, nameFor, avatarFor, refresh],
  );

  const uploadPhoto = useCallback(
    async (localUri: string): Promise<{ url: string | null; error: string | null }> => {
      if (!myId) return { url: null, error: 'Not signed in.' };
      try {
        const response = await fetch(localUri);
        const blob = await response.blob();
        const ext = extFromBlob(localUri, blob.type || 'image/jpeg');
        const path = `${myId}/${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage.from('throw-media').upload(path, blob, { contentType: blob.type || 'image/jpeg' });
        if (upErr) return { url: null, error: upErr.message };
        const { data: pub } = supabase.storage.from('throw-media').getPublicUrl(path);
        return { url: pub.publicUrl, error: null };
      } catch (e) {
        return { url: null, error: e instanceof Error ? e.message : 'Could not upload that photo.' };
      }
    },
    [myId],
  );

  const markRead = useCallback(
    async (throwId: string) => {
      const { error } = await supabase.rpc('mark_throw_read', { p_throw_id: throwId });
      warn('mark_throw_read', error);
      await refresh();
    },
    [refresh],
  );

  const deleteThrow = useCallback(
    async (throwId: string): Promise<{ error: string | null }> => {
      const { error } = await supabase.rpc('delete_throw', { p_throw_id: throwId });
      if (error) return { error: error.message };
      await refresh();
      return { error: null };
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

  const value: ThrowContextValue = { loading, myLocation, setMyLocation, friends, letters, inbox, unreadCount, sendThrow, uploadPhoto, markRead, deleteThrow, refresh };
  return <ThrowContext.Provider value={value}>{children}</ThrowContext.Provider>;
}

export function useThrow(): ThrowContextValue {
  const ctx = useContext(ThrowContext);
  if (!ctx) throw new Error('useThrow must be used within a ThrowProvider');
  return ctx;
}
