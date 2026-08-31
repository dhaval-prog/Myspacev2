import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { DirectMessage, Friend, FriendProfile, FriendRequest, MatchRelationship } from '../types/friends';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';

export type FriendsPage = 'home' | 'add' | 'scan' | 'match' | 'requests' | 'chats' | 'chat' | 'locked-chat';

interface ConnectionRow {
  id: string;
  requester_id: string;
  addressee_id: string;
  status: 'pending' | 'accepted';
  created_at: string;
  responded_at: string | null;
  intro_message: string | null;
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
  /** Connections that flipped to accepted during this session — surfaced once in Requests, then gone on next load. */
  justAccepted: Friend[];
  matchFound: FriendProfile | null;
  matchRelationship: MatchRelationship;
  focusedConnectionId: string | null;
  focusedFriend: Friend | undefined;
  focusedPendingRequest: FriendRequest | undefined;
  messages: DirectMessage[];
  loading: boolean;
  /** Latest message per accepted connection, for the Chats list preview. */
  lastMessageFor: (connectionId: string) => DirectMessage | undefined;
  isUnread: (connectionId: string) => boolean;

  goHome: () => void;
  goAdd: () => void;
  goScan: () => void;
  goRequests: () => void;
  goChats: () => void;
  /** Opens the right thread view for a connection — the live chat if accepted, the locked view if still pending. */
  openChat: (connectionId: string) => void;
  /** Looks up the connection with this user and opens its thread — used by the "already friends" match state. */
  openChatWithUser: (targetUserId: string) => void;

  lookupCode: (code: string) => Promise<{ error: string | null }>;
  sendRequest: (introMessage: string) => Promise<{ error: string | null }>;
  acceptRequest: (connectionId: string) => Promise<void>;
  declineRequest: (connectionId: string) => Promise<void>;
  cancelRequest: (connectionId: string) => Promise<void>;
  removeFriend: (connectionId: string) => Promise<void>;
  nudge: (connectionId: string) => Promise<void>;
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
  const [justAcceptedIds, setJustAcceptedIds] = useState<string[]>([]);

  const [page, setPage] = useState<FriendsPage>('home');
  const [matchFoundUserId, setMatchFoundUserId] = useState<string | null>(null);
  const [matchProfile, setMatchProfile] = useState<FriendProfile | null>(null);
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
      setConnectionRows((prev) => {
        const existing = prev.find((c) => c.id === row.id);
        if (existing && existing.status === 'pending' && row.status === 'accepted') {
          setJustAcceptedIds((ids) => (ids.includes(row.id) ? ids : [row.id, ...ids]));
        }
        return existing ? prev.map((c) => (c.id === row.id ? row : c)) : [row, ...prev];
      });
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

  const toFriend = (row: ConnectionRow): Friend => {
    const id = counterpartId(row, userId ?? '');
    const info = profiles[id];
    return {
      connectionId: row.id,
      userId: id,
      name: info?.name ?? 'Someone',
      username: info?.username ?? null,
      avatarUrl: info?.avatarUrl ?? null,
      acceptedAt: row.responded_at,
    };
  };

  const toRequest = (row: ConnectionRow): FriendRequest => {
    const id = counterpartId(row, userId ?? '');
    const info = profiles[id];
    return {
      connectionId: row.id,
      userId: id,
      name: info?.name ?? 'Someone',
      username: info?.username ?? null,
      avatarUrl: info?.avatarUrl ?? null,
      createdAt: row.created_at,
      introMessage: row.intro_message,
    };
  };

  const friends = useMemo(() => connectionRows.filter((c) => c.status === 'accepted').map(toFriend), [connectionRows, profiles, userId]);
  const receivedRequests = useMemo(
    () => connectionRows.filter((c) => c.status === 'pending' && c.addressee_id === userId).map(toRequest),
    [connectionRows, profiles, userId],
  );
  const sentRequests = useMemo(
    () => connectionRows.filter((c) => c.status === 'pending' && c.requester_id === userId).map(toRequest),
    [connectionRows, profiles, userId],
  );
  const justAccepted = useMemo(
    () => justAcceptedIds.map((id) => connectionRows.find((c) => c.id === id)).filter((r): r is ConnectionRow => !!r).map(toFriend),
    [justAcceptedIds, connectionRows, profiles, userId],
  );
  const [lastMessages, setLastMessages] = useState<Record<string, MessageRow>>({});
  const [unreadIds, setUnreadIds] = useState<Set<string>>(new Set());

  // Load the latest message per accepted connection, for the Chats list preview.
  useEffect(() => {
    if (!userId || !isSupabaseConfigured || friends.length === 0) {
      setLastMessages({});
      return;
    }
    let cancelled = false;
    supabase
      .from('direct_messages')
      .select('*')
      .in('connection_id', friends.map((f) => f.connectionId))
      .order('created_at', { ascending: false })
      .then(({ data, error }) => {
        warn('load thread previews', error);
        if (cancelled || !data) return;
        const next: Record<string, MessageRow> = {};
        for (const row of data as MessageRow[]) {
          if (!next[row.connection_id]) next[row.connection_id] = row;
        }
        setLastMessages(next);
      });
    return () => {
      cancelled = true;
    };
  }, [userId, friends]);

  // Live preview + unread updates for every accepted thread at once — the
  // Chats list needs to react to a message even while some other screen is open.
  useEffect(() => {
    if (!userId || !isSupabaseConfigured || friends.length === 0) return;
    let channel = supabase.channel(`friend-thread-previews-${userId}`);
    for (const f of friends) {
      channel = channel.on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'direct_messages', filter: `connection_id=eq.${f.connectionId}` },
        (payload) => {
          const row = payload.new as MessageRow;
          setLastMessages((prev) => ({ ...prev, [row.connection_id]: row }));
          if (row.sender_id !== userId && row.connection_id !== focusedConnectionId) {
            setUnreadIds((prev) => new Set(prev).add(row.connection_id));
          }
        },
      );
    }
    channel.subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
    // focusedConnectionId deliberately excluded — this channel shouldn't
    // resubscribe on every thread open, only when the friend list changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, friends]);

  const lastMessageFor = (connectionId: string): DirectMessage | undefined => {
    const row = lastMessages[connectionId];
    if (!row) return undefined;
    return { id: row.id, connectionId: row.connection_id, senderId: row.sender_id, text: row.text, createdAt: row.created_at };
  };
  const isUnread = (connectionId: string) => unreadIds.has(connectionId);

  const focusedConnectionRow = connectionRows.find((c) => c.id === focusedConnectionId);
  const focusedFriend = focusedConnectionRow?.status === 'accepted' ? toFriend(focusedConnectionRow) : undefined;
  const focusedPendingRequest =
    focusedConnectionRow?.status === 'pending' && focusedConnectionRow.requester_id === userId ? toRequest(focusedConnectionRow) : undefined;

  const matchRelationship: MatchRelationship = useMemo(() => {
    if (!matchFoundUserId || !userId) return 'none';
    if (matchFoundUserId === userId) return 'self';
    const row = connectionRows.find(
      (c) => (c.requester_id === userId && c.addressee_id === matchFoundUserId) || (c.requester_id === matchFoundUserId && c.addressee_id === userId),
    );
    if (!row) return 'none';
    if (row.status === 'accepted') return 'already_friends';
    return 'already_pending';
  }, [matchFoundUserId, userId, connectionRows]);

  /** For the "already friends" match state — jumps straight into the existing thread. */
  const openChatWithUser = (targetUserId: string) => {
    const row = connectionRows.find(
      (c) => (c.requester_id === userId && c.addressee_id === targetUserId) || (c.requester_id === targetUserId && c.addressee_id === userId),
    );
    if (row) openChat(row.id);
  };

  const goHome = () => setPage('home');
  const goAdd = () => setPage('add');
  const goScan = () => setPage('scan');
  const goRequests = () => setPage('requests');
  const goChats = () => setPage('chats');
  const openChat = (connectionId: string) => {
    const row = connectionRows.find((c) => c.id === connectionId);
    setFocusedConnectionId(connectionId);
    setPage(row?.status === 'accepted' ? 'chat' : 'locked-chat');
    setUnreadIds((prev) => {
      if (!prev.has(connectionId)) return prev;
      const next = new Set(prev);
      next.delete(connectionId);
      return next;
    });
  };

  const lookupCode = async (code: string): Promise<{ error: string | null }> => {
    const trimmed = code.trim().toUpperCase();
    if (trimmed.length !== 6) return { error: 'Enter the full 6-character code.' };
    if (!userId || !isSupabaseConfigured) return { error: 'Not signed in.' };

    const { data, error } = await supabase.rpc('find_profile_by_friend_code', { p_code: trimmed });
    if (error) return { error: error.message };
    const row = (data as { id: string; full_name: string | null; username: string | null; avatar_url: string | null }[] | null)?.[0];
    if (!row) {
      if (trimmed === friendCode) {
        setMatchFoundUserId(userId);
        setMatchProfile({ userId, name: 'You', username: null, avatarUrl: null });
        setMatchCode(trimmed);
        setPage('match');
        return { error: null };
      }
      return { error: 'No one has that code.' };
    }

    setMatchFoundUserId(row.id);
    setMatchProfile({ userId: row.id, name: row.full_name || 'Someone', username: row.username, avatarUrl: row.avatar_url });
    setMatchCode(trimmed);
    setPage('match');
    return { error: null };
  };

  const sendRequest = async (introMessage: string): Promise<{ error: string | null }> => {
    if (!matchCode || !userId || !isSupabaseConfigured) return { error: 'Not signed in.' };
    const { data, error } = await supabase.rpc('send_friend_request', { p_code: matchCode, p_message: introMessage.trim() || null });
    if (error) return { error: error.message };
    const row = data as ConnectionRow;
    setConnectionRows((prev) => (prev.some((c) => c.id === row.id) ? prev.map((c) => (c.id === row.id ? row : c)) : [row, ...prev]));
    setMatchFoundUserId(null);
    setMatchProfile(null);
    setMatchCode(null);
    setPage(row.status === 'accepted' ? 'chats' : 'home');
    return { error: null };
  };

  const acceptRequest = async (connectionId: string) => {
    if (!isSupabaseConfigured) return;
    const { data, error } = await supabase.rpc('respond_friend_request', { p_connection_id: connectionId, p_accept: true });
    warn('accept request', error);
    if (data) {
      const row = data as ConnectionRow;
      setConnectionRows((prev) => prev.map((c) => (c.id === row.id ? row : c)));
      setJustAcceptedIds((ids) => (ids.includes(row.id) ? ids : [row.id, ...ids]));
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
    if (focusedConnectionId === connectionId) {
      setFocusedConnectionId(null);
      setPage('chats');
    }
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

  const nudge = async (connectionId: string) => {
    if (!isSupabaseConfigured) return;
    const { error } = await supabase.rpc('nudge_friend_request', { p_connection_id: connectionId });
    warn('nudge', error);
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
    justAccepted,
    matchFound: matchProfile,
    matchRelationship,
    focusedConnectionId,
    focusedFriend,
    focusedPendingRequest,
    messages,
    loading,
    lastMessageFor,
    isUnread,
    goHome,
    goAdd,
    goScan,
    goRequests,
    goChats,
    openChat,
    openChatWithUser,
    lookupCode,
    sendRequest,
    acceptRequest,
    declineRequest,
    cancelRequest,
    removeFriend,
    nudge,
    sendMessage,
  };

  return <FriendsContext.Provider value={value}>{children}</FriendsContext.Provider>;
}

export function useFriends(): FriendsContextValue {
  const ctx = useContext(FriendsContext);
  if (!ctx) throw new Error('useFriends must be used within a FriendsProvider');
  return ctx;
}
