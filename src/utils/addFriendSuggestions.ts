import { supabase } from '../lib/supabase';

export type ConnectionStatus = 'none' | 'pending_sent' | 'pending_received' | 'accepted' | 'blocked';

export interface ProfileSearchResult {
  userId: string;
  fullName: string | null;
  username: string | null;
  avatarUrl: string | null;
  mutualFriendCount: number;
  connectionStatus: ConnectionStatus;
}

export interface NearbySuggestion {
  userId: string;
  fullName: string | null;
  username: string | null;
  avatarUrl: string | null;
  distanceMeters: number;
  mutualFriendCount: number;
}

/** Searches profiles by name/username for the Add Friend card (see `search_profiles` RPC) —
 * excludes the caller, and tags each result with how you're already connected (if at all) so the
 * card can show the right button state instead of always offering "Add". Empty/whitespace-only
 * queries return no results without a round-trip. */
export async function searchProfiles(query: string): Promise<{ data: ProfileSearchResult[]; error: string | null }> {
  const trimmed = query.trim();
  if (!trimmed) return { data: [], error: null };
  const { data, error } = await supabase.rpc('search_profiles', { p_query: trimmed });
  if (error) return { data: [], error: error.message };
  return {
    data: ((data ?? []) as any[]).map((row) => ({
      userId: row.user_id,
      fullName: row.full_name,
      username: row.username,
      avatarUrl: row.avatar_url,
      mutualFriendCount: row.mutual_friend_count ?? 0,
      connectionStatus: (row.connection_status ?? 'none') as ConnectionStatus,
    })),
    error: null,
  };
}

/** The Add Friend card's own "Suggested Nearby" list — real distance from the caller's own Throw
 * location (see `suggested_nearby_friends` RPC), already excluding anyone already connected in any
 * way (pending, accepted, or blocked). Empty when the caller has no Throw location set yet. */
export async function fetchNearbySuggestions(limit = 10): Promise<{ data: NearbySuggestion[]; error: string | null }> {
  const { data, error } = await supabase.rpc('suggested_nearby_friends', { p_limit: limit });
  if (error) return { data: [], error: error.message };
  return {
    data: ((data ?? []) as any[]).map((row) => ({
      userId: row.user_id,
      fullName: row.full_name,
      username: row.username,
      avatarUrl: row.avatar_url,
      distanceMeters: row.distance_meters ?? 0,
      mutualFriendCount: row.mutual_friend_count ?? 0,
    })),
    error: null,
  };
}

/** "0.8 km" — compact, always in km with one decimal, no "away" suffix, matching the Add Friend
 * card's own reference design exactly (distinct from geo.ts's own formatDistance, which spells out
 * "away" and switches to meters under 1km for a different, sentence-style context elsewhere in the
 * app). */
export function formatSuggestionDistance(meters: number): string {
  return `${(meters / 1000).toFixed(1)} km`;
}
