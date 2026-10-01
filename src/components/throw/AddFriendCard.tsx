import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { Icon } from '../Icon';
import { FriendAvatar } from '../friends/FriendAvatar';
import { throwColor, throwFont, throwRadius } from '../../theme/throwTokens';
import { useFriends } from '../../context/FriendsContext';
import {
  fetchNearbySuggestions,
  formatSuggestionDistance,
  searchProfiles,
  type NearbySuggestion,
  type ProfileSearchResult,
} from '../../utils/addFriendSuggestions';

const CLOSE_ICON = 'M18 6 6 18M6 6l12 12';
const SEARCH_ICON = 'M11 19a8 8 0 100-16 8 8 0 000 16z M21 21l-4.35-4.35';
const LINK_ICON = 'M9 17H7a5 5 0 010-10h2 M15 7h2a5 5 0 010 10h-2 M8 12h8';

// Debounce delay for the search box — long enough that normal typing doesn't fire a request per
// keystroke, short enough that it still feels live.
const SEARCH_DEBOUNCE_MS = 350;

type Row = {
  userId: string;
  name: string;
  avatarUrl: string | null;
  mutualFriendCount: number;
  distanceMeters?: number;
  /** Absent for a nearby suggestion (the RPC already excludes anyone connected) — present for a
   * search result, which can surface someone you're already friends with or already asked. */
  connectionStatus?: ProfileSearchResult['connectionStatus'];
};

function toRow(n: NearbySuggestion): Row {
  return { userId: n.userId, name: n.fullName || n.username || 'Someone', avatarUrl: n.avatarUrl, mutualFriendCount: n.mutualFriendCount, distanceMeters: n.distanceMeters };
}
function toSearchRow(n: ProfileSearchResult): Row {
  return { userId: n.userId, name: n.fullName || n.username || 'Someone', avatarUrl: n.avatarUrl, mutualFriendCount: n.mutualFriendCount, connectionStatus: n.connectionStatus };
}

interface AddFriendCardProps {
  onClose: () => void;
}

/** "Add friend" — search by name/username, or a Suggested Nearby list (real distance from the
 * caller's own Throw location, via the `suggested_nearby_friends`/`search_profiles` RPCs), plus a
 * one-tap invite link. An opaque card (not glass, per explicit request), sitting directly below
 * ProfileCard while the recipient carousel's Add Status slot is selected — see ThrowHomeScreen's
 * own isCardsMode for when both show/hide together. */
export function AddFriendCard({ onClose }: AddFriendCardProps) {
  const { friendCode, sendRequestToUser } = useFriends();
  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Row[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [nearby, setNearby] = useState<Row[]>([]);
  const [nearbyLoading, setNearbyLoading] = useState(true);
  const [requestedIds, setRequestedIds] = useState<Set<string>>(new Set());
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchNearbySuggestions(10).then(({ data }) => {
      if (!cancelled) {
        setNearby(data.map(toRow));
        setNearbyLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      setSearchResults(null);
      setSearching(false);
      return;
    }
    setSearching(true);
    let cancelled = false;
    const id = setTimeout(() => {
      searchProfiles(trimmed).then(({ data }) => {
        if (!cancelled) {
          setSearchResults(data.map(toSearchRow));
          setSearching(false);
        }
      });
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      cancelled = true;
      clearTimeout(id);
    };
  }, [query]);

  const rows = useMemo(() => (searchResults !== null ? searchResults : nearby), [searchResults, nearby]);
  const isSearching = query.trim().length > 0;

  const handleAdd = async (userId: string) => {
    setRequestedIds((prev) => new Set(prev).add(userId));
    const { error } = await sendRequestToUser(userId);
    if (error) setRequestedIds((prev) => { const next = new Set(prev); next.delete(userId); return next; });
  };

  const shareInviteLink = async () => {
    if (!friendCode) return;
    await Clipboard.setStringAsync(`Add me on MySpace — my invite code is ${friendCode} (myspace://add/${friendCode})`);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  const renderRow = (row: Row) => {
    const requested = requestedIds.has(row.userId);
    const status = row.connectionStatus ?? (requested ? 'pending_sent' : 'none');
    const buttonLabel = status === 'accepted' ? 'Friends' : status === 'blocked' ? null : status !== 'none' ? 'Pending' : 'Add';
    return (
      <View key={row.userId} style={styles.row}>
        <FriendAvatar userId={row.userId} name={row.name} avatarUrl={row.avatarUrl} size={40} />
        <View style={styles.rowBody}>
          <Text style={styles.rowName} numberOfLines={1}>
            {row.name}
          </Text>
          <Text style={styles.rowMeta} numberOfLines={1}>
            {[row.distanceMeters != null ? formatSuggestionDistance(row.distanceMeters) : null, `${row.mutualFriendCount} mutual`].filter(Boolean).join(' · ')}
          </Text>
        </View>
        {buttonLabel && (
          <Pressable
            onPress={buttonLabel === 'Add' ? () => handleAdd(row.userId) : undefined}
            disabled={buttonLabel !== 'Add'}
            style={[styles.addBtn, buttonLabel !== 'Add' && styles.addBtnDisabled]}
            accessibilityRole="button"
            accessibilityLabel={`${buttonLabel} ${row.name}`}
          >
            <Text style={[styles.addBtnLabel, buttonLabel !== 'Add' && styles.addBtnLabelDisabled]}>{buttonLabel}</Text>
          </Pressable>
        )}
      </View>
    );
  };

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>Add friend</Text>
        <Pressable onPress={onClose} hitSlop={10} accessibilityRole="button" accessibilityLabel="Close">
          <Icon path={CLOSE_ICON} size={20} color={throwColor.inkFaint} strokeWidth={2.2} />
        </Pressable>
      </View>

      <View style={styles.searchBox}>
        <Icon path={SEARCH_ICON} size={16} color={throwColor.inkFaint} strokeWidth={2} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search by name or username"
          placeholderTextColor={throwColor.inkFaint}
          style={styles.searchInput}
          autoCapitalize="none"
          autoCorrect={false}
        />
      </View>

      <Text style={styles.sectionLabel}>{isSearching ? 'RESULTS' : 'SUGGESTED NEARBY'}</Text>

      <View style={styles.list}>
        {isSearching && searching ? (
          <ActivityIndicator color={throwColor.inkFaint} style={styles.loading} />
        ) : !isSearching && nearbyLoading ? (
          <ActivityIndicator color={throwColor.inkFaint} style={styles.loading} />
        ) : rows.length === 0 ? (
          <Text style={styles.empty}>{isSearching ? 'No one matches that search.' : 'No nearby suggestions right now.'}</Text>
        ) : (
          rows.map(renderRow)
        )}
      </View>

      <Pressable onPress={shareInviteLink} disabled={!friendCode} style={styles.shareBtn} accessibilityRole="button" accessibilityLabel="Share invite link">
        <Icon path={LINK_ICON} size={16} color="#FFFFFF" strokeWidth={2} />
        <Text style={styles.shareLabel}>{copied ? 'Link copied!' : 'Share invite link'}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: throwColor.cardBg,
    borderRadius: throwRadius.card,
    borderWidth: 1,
    borderColor: throwColor.cardBorder,
    padding: 16,
    gap: 12,
    ...throwColor.shadowSoft,
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontFamily: throwFont.ui700, fontSize: 17, color: throwColor.ink },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 42,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: throwColor.screenBg,
  },
  searchInput: { flex: 1, fontFamily: throwFont.ui400, fontSize: 14, color: throwColor.ink },
  sectionLabel: { fontFamily: throwFont.ui600, fontSize: 11, letterSpacing: 1, color: throwColor.inkFaint, textTransform: 'uppercase' },
  list: { gap: 2, minHeight: 40 },
  loading: { paddingVertical: 12 },
  empty: { fontFamily: throwFont.ui400, fontSize: 13, color: throwColor.inkFaint, paddingVertical: 10 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 },
  rowBody: { flex: 1, minWidth: 0, gap: 1 },
  rowName: { fontFamily: throwFont.ui700, fontSize: 14.5, color: throwColor.ink },
  rowMeta: { fontFamily: throwFont.ui400, fontSize: 12.5, color: throwColor.inkFaint },
  addBtn: { height: 32, paddingHorizontal: 16, borderRadius: throwRadius.pill, backgroundColor: throwColor.ink, alignItems: 'center', justifyContent: 'center' },
  addBtnDisabled: { backgroundColor: throwColor.screenBg },
  addBtnLabel: { fontFamily: throwFont.ui700, fontSize: 13, color: '#FFFFFF' },
  addBtnLabelDisabled: { color: throwColor.inkFaint },
  shareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 44,
    borderRadius: throwRadius.pill,
    backgroundColor: throwColor.ink,
  },
  shareLabel: { fontFamily: throwFont.ui700, fontSize: 14, color: '#FFFFFF' },
});
