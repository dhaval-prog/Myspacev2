import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { DirectMessage, Friend, FriendProfile, FriendRequest } from '../types/friends';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';

export type FriendsPage = 'home' | 'add' | 'scan' | 'match' | 'requests' | 'chats' | 'chat';

interface ConnectionRow {
  id: string;
  requester_id: string;
  addressee_id: string;
  status: 'pending' | 'accepted';
  created_at: string;
  responded_at: string | null;
}

interface MessageRow {
  id: string;
  connection_id: string;
  sender_id: string;
  text: string;
  created_at: string;
}

interface ProfileInfo {
  name: string;
  username: string | null;
  avatarUrl: string | null;
}

function warn(action: string, error: { message: string } | null) {
  if (error) console.warn(`[friends] failed to ${action}:`, error.message);
}

function counterpartId(row: ConnectionRow, userId: string): string {
  return row.requester_id === userId ? row.addressee_id : row.requester_id;
}

interface FriendsContextValue {
  page: FriendsPage;
  friendCode: string | null;
  friends: Friend[];
  receivedRequests: FriendRequest[];
  sentRequests: FriendRequest[];
  matchFound: FriendProfile | null;
  focusedConnectionId: string | null;
  focusedFriend: Friend | undefined;
  messages: DirectMessage[];
  loading: boolean;

  goHome: () => void;
  goAdd: () => void;
  goScan: () => void;
  goRequests: () => void;
  goChats: () => void;
  openChat: (connectionId: string) => void;

  lookupCode: (code: string) => Promise<{ error: string | null }>;
  sendRequest: () => Promise<{ error: string | null }>;
  acceptRequest: (connectionId: string) => Promise<void>;
  declineRequest: (connectionId: string) => Promise<void>;
  cancelRequest: (connectionId: string) => Promise<void>;
  removeFriend: (connectionId: string) => Promise<void>;
  sendMessage: (text: string) => Promise<void>;
}

const FriendsContext = createContext<FriendsContextValue | null>(null);

/**
 * Friend requests + direct messaging. A friend connection is one row
 * (`friend_connections`) shared by both accounts — pending until the
 * addressee accepts, at which point its thread in `direct_messages`
 * unlocks (enforced server-side by RLS, not just hidden client-side).
 */
export function FriendsProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const userId = user?.id ?? null;

  const [friendCode, setFriendCode] = useState<string | null>(null);
  const [connectionRows, setConnectionRows] = useState<ConnectionRow[]>([]);
  const [profiles, setProfiles] = useState<Record<string, ProfileInfo>>({});
  const [loading, setLoading] = useState(true);

  const [page, setPage] = useState<FriendsPage>('home');
  const [matchFound, setMatchFound] = useState<FriendProfile | null>(null);
  const [matchCode, setMatchCode] = useState<string | null>(null);
  const [focusedConnectionId, setFocusedConnectionId] = useState<string | null>(null);
  const [messageRows, setMessageRows] = useState<MessageRow[]>([]);

  // Initial load: own code + every connection this account is party to.
  useEffect(() => {
    let cancelled = false;
    if (!userId || !isSupabaseConfigured) {
      setFriendCode(null);
      setConnectionRows([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    (async () => {
      const [profileRes, connRes] = await Promise.all([
        supabase.from('profiles').select('friend_code').eq('id', userId).single(),
        supabase
          .from('friend_connections')
          .select('*')
          .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`)
          .order('created_at', { ascending: false }),
      ]);
      if (cancelled) return;
      warn('load own code', profileRes.error);
      warn('load connections', connRes.error);
      setFriendCode((profileRes.data as { friend_code: string } | null)?.friend_code ?? null);
      setConnectionRows((connRes.data as ConnectionRow[] | null) ?? []);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  // Live updates: a request arriving, being accepted, or being removed by
  // the other side should show up without a reload on either account.
  useEffect(() => {
    if (!userId || !isSupabaseConfigured) return;
    const upsert = (row: ConnectionRow) =>
      setConnectionRows((prev) => (prev.some((c) => c.id === row.id) ? prev.map((c) => (c.id === row.id ? row : c)) : [row, ...prev]));
    const remove = (id: string) => setConnectionRows((prev) => prev.filter((c) => c.id !== id));

    const channel = supabase
      .channel(`friend-connections-${userId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'friend_connections', filter: `requester_id=eq.${userId}` }, (p) =>
        upsert(p.new as ConnectionRow),
      )
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'friend_connections', filter: `addressee_id=eq.${userId}` }, (p) =>
        upsert(p.new as ConnectionRow),
      )
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'friend_connections', filter: `requester_id=eq.${userId}` }, (p) =>
        upsert(p.new as ConnectionRow),
      )
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'friend_connections', filter: `addressee_id=eq.${userId}` }, (p) =>
        upsert(p.new as ConnectionRow),
      )
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'friend_connections', filter: `requester_id=eq.${userId}` }, (p) =>
        remove((p.old as { id: string }).id),
      )
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'friend_connections', filter: `addressee_id=eq.${userId}` }, (p) =>
        remove((p.old as { id: string }).id),
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  // Backfill display info for every counterpart seen across connections.
  useEffect(() => {
    if (!userId || !isSupabaseConfigured) return;
    const ids = Array.from(new Set(connectionRows.map((c) => counterpartId(c, userId)))).filter((id) => !(id in profiles));
    if (ids.length === 0) return;
    supabase
      .from('profiles')
      .select('id, full_name, username, avatar_url')
      .in('id', ids)
      .then(({ data, error }) => {
        warn('load profiles', error);
        if (!data) return;
        setProfiles((prev) => {
          const next = { ...prev };
          for (const row of data as { id: string; full_name: string | null; username: string | null; avatar_url: string | null }[]) {
            next[row.id] = { name: row.full_name || 'Someone', username: row.username, avatarUrl: row.avatar_url };
          }
          return next;
        });
      });
    // profiles deliberately excluded — read to find gaps, not to retrigger on every fill.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connectionRows, userId]);

  const toEntry = (row: ConnectionRow): Friend & FriendRequest => {
    const id = counterpartId(row, userId ?? '');
    const info = profiles[id];
    return {
      connectionId: row.id,
      userId: id,
      name: info?.name ?? 'Someone',
      username: info?.username ?? null,
      avatarUrl: info?.avatarUrl ?? null,
      createdAt: row.created_at,
    };
  };

  const friends = useMemo(() => connectionRows.filter((c) => c.status === 'accepted').map(toEntry), [connectionRows, profiles, userId]);
  const receivedRequests = useMemo(
    () => connectionRows.filter((c) => c.status === 'pending' && c.addressee_id === userId).map(toEntry),
    [connectionRows, profiles, userId],
  );
  const sentRequests = useMemo(
    () => connectionRows.filter((c) => c.status === 'pending' && c.requester_id === userId).map(toEntry),
    [connectionRows, profiles, userId],
  );
  const focusedFriend = friends.find((f) => f.connectionId === focusedConnectionId);

  const goHome = () => setPage('home');
  const goAdd = () => setPage('add');
  const goScan = () => setPage('scan');
  const goRequests = () => setPage('requests');
  const goChats = () => setPage('chats');
  const openChat = (connectionId: string) => {
    setFocusedConnectionId(connectionId);
    setPage('chat');
  };

  const lookupCode = async (code: string): Promise<{ error: string | null }> => {
    const trimmed = code.trim().toUpperCase();
    if (trimmed.length !== 6) return { error: 'Enter the full 6-character code.' };
    if (!userId || !isSupabaseConfigured) return { error: 'Not signed in.' };

    const { data, error } = await supabase.rpc('find_profile_by_friend_code', { p_code: trimmed });
    if (error) return { error: error.message };
    const row = (data as { id: string; full_name: string | null; username: string | null; avatar_url: string | null }[] | null)?.[0];
    if (!row) return { error: 'No one has that code.' };

    setMatchFound({ userId: row.id, name: row.full_name || 'Someone', username: row.username, avatarUrl: row.avatar_url });
    setMatchCode(trimmed);
    setPage('match');
    return { error: null };
  };

  const sendRequest = async (): Promise<{ error: string | null }> => {
    if (!matchCode || !userId || !isSupabaseConfigured) return { error: 'Not signed in.' };
    const { data, error } = await supabase.rpc('send_friend_request', { p_code: matchCode });
    if (error) return { error: error.message };
    const row = data as ConnectionRow;
    setConnectionRows((prev) => (prev.some((c) => c.id === row.id) ? prev.map((c) => (c.id === row.id ? row : c)) : [row, ...prev]));
    setMatchFound(null);
    setMatchCode(null);
    setPage(row.status === 'accepted' ? 'chats' : 'requests');
    return { error: null };
  };

  const acceptRequest = async (connectionId: string) => {
    if (!isSupabaseConfigured) return;
    const { data, error } = await supabase.rpc('respond_friend_request', { p_connection_id: connectionId, p_accept: true });
    warn('accept request', error);
    if (data) {
      const row = data as ConnectionRow;
      setConnectionRows((prev) => prev.map((c) => (c.id === row.id ? row : c)));
    }
  };

  const declineRequest = async (connectionId: string) => {
    if (!isSupabaseConfigured) return;
    const { error } = await supabase.rpc('respond_friend_request', { p_connection_id: connectionId, p_accept: false });
    warn('decline request', error);
    setConnectionRows((prev) => prev.filter((c) => c.id !== connectionId));
  };

  const cancelRequest = async (connectionId: string) => {
    if (!isSupabaseConfigured) return;
    const { error } = await supabase.rpc('remove_friend_connection', { p_connection_id: connectionId });
    warn('cancel request', error);
    setConnectionRows((prev) => prev.filter((c) => c.id !== connectionId));
  };

  const removeFriend = async (connectionId: string) => {
    if (!isSupabaseConfigured) return;
    const { error } = await supabase.rpc('remove_friend_connection', { p_connection_id: connectionId });
    warn('remove friend', error);
    setConnectionRows((prev) => prev.filter((c) => c.id !== connectionId));
    if (focusedConnectionId === connectionId) {
      setFocusedConnectionId(null);
      setPage('chats');
    }
  };

  const messages: DirectMessage[] = useMemo(
    () => messageRows.map((m) => ({ id: m.id, connectionId: m.connection_id, senderId: m.sender_id, text: m.text, createdAt: m.created_at })),
    [messageRows],
  );

  const sendMessage = async (text: string) => {
    if (!focusedConnectionId || !text.trim() || !userId || !isSupabaseConfigured) return;
    const { error } = await supabase.from('direct_messages').insert({ connection_id: focusedConnectionId, sender_id: userId, text: text.trim() });
    warn('send message', error);
    // The row itself arrives back through the Realtime subscription below.
  };

  // Load + subscribe to messages for the focused thread only.
  useEffect(() => {
    if (!focusedConnectionId || !userId || !isSupabaseConfigured) {
      setMessageRows([]);
      return;
    }
    let cancelled = false;
    supabase
      .from('direct_messages')
      .select('*')
      .eq('connection_id', focusedConnectionId)
      .order('created_at', { ascending: true })
      .then(({ data, error }) => {
        warn('load messages', error);
        if (!cancelled) setMessageRows((data as MessageRow[] | null) ?? []);
      });

    const channel = supabase
      .channel(`direct-messages-${focusedConnectionId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'direct_messages', filter: `connection_id=eq.${focusedConnectionId}` },
        (payload) => {
          const row = payload.new as MessageRow;
          setMessageRows((prev) => (prev.some((m) => m.id === row.id) ? prev : [...prev, row]));
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [focusedConnectionId, userId]);

  const value: FriendsContextValue = {
    page,
    friendCode,
    friends,
    receivedRequests,
    sentRequests,
    matchFound,
    focusedConnectionId,
    focusedFriend,
    messages,
    loading,
    goHome,
    goAdd,
    goScan,
    goRequests,
    goChats,
    openChat,
    lookupCode,
    sendRequest,
    acceptRequest,
    declineRequest,
    cancelRequest,
    removeFriend,
    sendMessage,
  };

  return <FriendsContext.Provider value={value}>{children}</FriendsContext.Provider>;
}

export function useFriends(): FriendsContextValue {
  const ctx = useContext(FriendsContext);
  if (!ctx) throw new Error('useFriends must be used within a FriendsProvider');
  return ctx;
}
