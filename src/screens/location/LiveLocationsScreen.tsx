import React, { useEffect, useRef, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as Location from 'expo-location';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fontFamily, spacing } from '../../theme';
import { Icon } from '../../components/Icon';
import { BottomSheet } from '../../components/expenses/BottomSheet';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { FriendAvatar } from '../../components/friends/FriendAvatar';
import { MapCanvas } from '../../components/location/MapCanvas';
import type { MapCanvasHandle } from '../../components/location/mapTypes';
import { PinPreviewCard } from '../../components/location/PinPreviewCard';
import { useAuth } from '../../context/AuthContext';
import { useFriends } from '../../context/FriendsContext';
import { LocationProvider, useLocationData } from '../../context/LocationContext';
import type { ShareDurationKey } from '../../types/location';
import { haversineMeters, formatDistance } from '../../utils/geo';
import { LocationPrivacyScreen } from './LocationPrivacyScreen';

const BACK_ICON = 'M15 5l-7 7 7 7';
const GEAR_ICON =
  'M12 15.5a3.5 3.5 0 100-7 3.5 3.5 0 000 7z M19 12a7 7 0 00-.1-1.1l1.8-1.4-1.5-2.6-2.1.6a7 7 0 00-1.9-1.1L16.5 5h-3l-.4 2.4a7 7 0 00-1.9 1.1l-2.1-.6-1.5 2.6 1.8 1.4A7 7 0 008.3 12a7 7 0 00.1 1.1l-1.8 1.4 1.5 2.6 2.1-.6a7 7 0 001.9 1.1l.4 2.4h3l.4-2.4a7 7 0 001.9-1.1l2.1.6 1.5-2.6-1.8-1.4c.1-.3.1-.7.1-1.1z';
const RECENTER_ICON = 'M12 3v3M12 18v3M3 12h3M18 12h3M12 8a4 4 0 100 8 4 4 0 000-8z';
const PIN_ICON = 'M12 21s7-6.5 7-11a7 7 0 10-14 0c0 4.5 7 11 7 11z M12 12a2 2 0 100-4 2 2 0 000 4z';
const CHEVRON_ICON = 'M9 6l6 6-6 6';
const CLOSE_ICON = 'M6 6l12 12M18 6L6 18';
const CHAT_ICON = 'M4 4h16v12H8l-4 4z';
const DIRECTIONS_ICON = 'M3 12l18-9-9 18-2-7-7-2z';

const DURATIONS: { key: ShareDurationKey; label: string }[] = [
  { key: '15m', label: '15 min' },
  { key: '1h', label: '1 hour' },
  { key: '2h', label: '2 hours' },
  { key: 'off', label: 'Until I turn it off' },
];

function timeAgoLabel(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 60000) return 'just now';
  const mins = Math.round(ms / 60000);
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs} hr${hrs === 1 ? '' : 's'} ago`;
  const days = Math.round(hrs / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
}

function timeLeftLabel(expiresAt: string | null): string {
  if (!expiresAt) return '';
  const ms = new Date(expiresAt).getTime() - Date.now();
  if (ms <= 0) return 'ending…';
  const mins = Math.round(ms / 60000);
  if (mins < 60) return `${mins} min left`;
  const hrs = Math.round(mins / 60);
  return `${hrs} hr${hrs === 1 ? '' : 's'} left`;
}

interface LiveLocationsScreenProps {
  onBack: () => void;
}

/**
 * Friends' locations on a map — opt-in, time-boxed live sharing plus a
 * lightweight automatic "last seen" while MySpace is open, backed by
 * real Supabase tables (RLS-scoped to accepted friends) and Realtime.
 * The map itself is platform-split: react-native-maps natively on iOS/
 * Android (MapCanvas.native.tsx), Leaflet + OpenStreetMap on web
 * (MapCanvas.web.tsx) — expo-location works on both via the browser's
 * geolocation API on web, so capture isn't gated by platform.
 */
export function LiveLocationsScreen({ onBack }: LiveLocationsScreenProps) {
  const [page, setPage] = useState<'map' | 'privacy'>('map');

  return (
    <LocationProvider>
      {page === 'privacy' ? <LocationPrivacyScreen onBack={() => setPage('map')} /> : <MapPage onBack={onBack} onOpenPrivacy={() => setPage('privacy')} />}
    </LocationProvider>
  );
}

function MapPage({ onBack, onOpenPrivacy }: { onBack: () => void; onOpenPrivacy: () => void }) {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const { friends } = useFriends();
  const { lastSeenFor, shareFor, upsertLastSeen, startShare, pingShare, stopShare } = useLocationData();

  const [sheetView, setSheetView] = useState<'none' | 'share' | 'detail'>('none');
  const [detailFriendId, setDetailFriendId] = useState<string | null>(null);
  const [previewFriendId, setPreviewFriendId] = useState<string | null>(null);
  const [shareDurationKey, setShareDurationKey] = useState<ShareDurationKey>('1h');
  const [myPosition, setMyPosition] = useState<{ latitude: number; longitude: number } | null>(null);
  const [myAccuracy, setMyAccuracy] = useState<number | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [sheetHeight, setSheetHeight] = useState(0);
  const mapRef = useRef<MapCanvasHandle>(null);

  const ownShare = userId ? shareFor(userId) : undefined;
  const sharing = !!ownShare;

  // Radar is pointless without your own position, so it asks up front —
  // approve and you're pinned on the map immediately; decline (or it's
  // already denied at the OS level) and there's nothing useful to show, so
  // the permissionDenied dialog below sends the user straight back home.
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        if (!cancelled) setPermissionDenied(true);
        return;
      }
      const pos = await Location.getCurrentPositionAsync({});
      if (cancelled) return;
      const coords = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
      setMyPosition(coords);
      setMyAccuracy(pos.coords.accuracy ?? null);
      upsertLastSeen(coords.latitude, coords.longitude);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  // While actively sharing, keep pinging the share row with fresh
  // coordinates. Stops the moment `sharing` goes false — no lingering watch.
  useEffect(() => {
    if (!sharing) return;
    let sub: Location.LocationSubscription | null = null;
    let cancelled = false;
    (async () => {
      sub = await Location.watchPositionAsync({ accuracy: Location.Accuracy.Balanced, timeInterval: 15000, distanceInterval: 25 }, (pos) => {
        if (cancelled) return;
        const coords = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
        setMyPosition(coords);
        setMyAccuracy(pos.coords.accuracy ?? null);
        pingShare(coords.latitude, coords.longitude);
      });
    })();
    return () => {
      cancelled = true;
      sub?.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sharing]);

  const rows = friends.map((f) => {
    const share = shareFor(f.userId);
    const seen = lastSeenFor(f.userId);
    const live = !!share;
    const coord = share ?? seen;
    const statusText = live ? 'Live · updating now' : seen ? `Last seen ${timeAgoLabel(seen.updatedAt)}` : 'No location shared yet';
    const distanceMeters =
      myPosition && coord && coord.latitude !== null && coord.longitude !== null
        ? haversineMeters(myPosition, { latitude: coord.latitude, longitude: coord.longitude })
        : null;
    const distanceText = distanceMeters !== null ? formatDistance(distanceMeters) : null;
    return { ...f, live, latitude: coord?.latitude ?? null, longitude: coord?.longitude ?? null, statusText, distanceText };
  });
  const detailFriend = rows.find((f) => f.userId === detailFriendId) ?? rows[0];
  const previewFriend = rows.find((f) => f.userId === previewFriendId) ?? null;

  const closeSheet = () => {
    setSheetView('none');
    setDetailFriendId(null);
  };
  const openDetail = (userId: string) => {
    setPreviewFriendId(null);
    setDetailFriendId(userId);
    setSheetView('detail');
  };
  const togglePreview = (userId: string) => {
    setPreviewFriendId((current) => (current === userId ? null : userId));
  };

  const handleStartSharing = async () => {
    if (!myPosition) {
      setLocationError('Still finding your location — try again in a moment.');
      return;
    }
    await startShare(shareDurationKey, myPosition.latitude, myPosition.longitude);
    setSheetView('none');
  };

  return (
    <View style={styles.screen}>
      <View style={StyleSheet.absoluteFill}>
        <MapCanvas ref={mapRef} pins={rows} myPosition={myPosition} amSharing={sharing} myAccuracy={myAccuracy} onSelectPin={togglePreview} />
      </View>

      {previewFriend ? (
        <PinPreviewCard
          userId={previewFriend.userId}
          name={previewFriend.name}
          statusText={previewFriend.statusText}
          distanceText={previewFriend.distanceText}
          live={previewFriend.live}
          onOpen={() => openDetail(previewFriend.userId)}
          onClose={() => setPreviewFriendId(null)}
          style={[styles.previewCard, { bottom: sheetHeight + spacing.md }]}
        />
      ) : null}

      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
        <View style={styles.headerLeft}>
          <Pressable onPress={onBack} style={styles.iconButton} accessibilityRole="button" accessibilityLabel="Back to Home">
            <Icon path={BACK_ICON} color={colors.textPrimary} size={18} strokeWidth={2.2} />
          </Pressable>
          <View>
            <Text style={styles.title}>Nearby friends</Text>
            <Text style={styles.sub}>{rows.length} friend{rows.length === 1 ? '' : 's'}</Text>
          </View>
        </View>
        <Pressable onPress={onOpenPrivacy} style={styles.iconButton} accessibilityRole="button" accessibilityLabel="Location & privacy settings">
          <Icon path={GEAR_ICON} color={colors.textPrimary} size={18} strokeWidth={1.7} />
        </Pressable>
      </View>

      {Platform.OS === 'android' ? (
        <View style={styles.previewNote}>
          <Text style={styles.previewNoteText}>Add a Google Maps API key to app.json to see the real map.</Text>
        </View>
      ) : locationError ? (
        <View style={styles.previewNote}>
          <Text style={styles.previewNoteText}>{locationError}</Text>
        </View>
      ) : null}

      {/* Recenter */}
      <Pressable onPress={() => mapRef.current?.recenter()} style={styles.recenterFab} accessibilityRole="button" accessibilityLabel="Recenter map">
        <Icon path={RECENTER_ICON} color={colors.textPrimary} size={19} strokeWidth={1.9} />
      </Pressable>

      {/* Bottom sheet peek */}
      <View
        style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, spacing.md) + spacing.md }]}
        onLayout={(e) => setSheetHeight(e.nativeEvent.layout.height)}
      >
        <View style={styles.sheetHandle} />

        {sharing ? (
          <Pressable onPress={() => stopShare()} style={styles.liveBanner}>
            <View style={styles.liveBannerDot} />
            <Text style={styles.liveBannerText}>Sharing your location · {timeLeftLabel(ownShare?.expiresAt ?? null)}</Text>
            <Text style={styles.liveBannerStop}>Stop</Text>
          </Pressable>
        ) : (
          <Pressable onPress={() => setSheetView('share')} style={styles.shareButton}>
            <Icon path={PIN_ICON} color={colors.lime} size={17} strokeWidth={2} />
            <Text style={styles.shareButtonLabel}>Share my location</Text>
          </Pressable>
        )}

        <Text style={styles.eyebrow}>NEARBY</Text>
        {rows.length === 0 ? (
          <Text style={styles.emptyText}>Add friends to see them here.</Text>
        ) : (
          <ScrollView showsVerticalScrollIndicator={false} style={styles.list}>
            {rows.map((f) => (
              <Pressable key={f.userId} onPress={() => openDetail(f.userId)} style={styles.row} accessibilityRole="button" accessibilityLabel={`${f.name} — ${f.statusText}`}>
                <FriendAvatar userId={f.userId} name={f.name} size={42} online={f.live} />
                <View style={styles.rowText}>
                  <Text style={styles.rowName}>{f.name}</Text>
                  <Text style={styles.rowStatus}>{f.statusText}</Text>
                </View>
                {f.distanceText ? <Text style={styles.rowDistance}>{f.distanceText}</Text> : null}
                <Icon path={CHEVRON_ICON} color={colors.textFaint} size={15} strokeWidth={2} />
              </Pressable>
            ))}
          </ScrollView>
        )}
      </View>

      {/* Share sheet */}
      <BottomSheet visible={sheetView === 'share'} onClose={closeSheet}>
        <Text style={styles.sheetTitle}>Share my location</Text>
        <Text style={styles.sheetBody}>
          Friends you choose can see where you are, live, until this ends. It never runs in the background — sharing stops
          automatically.
        </Text>
        <Text style={[styles.sheetLabel, { marginTop: spacing.sm }]}>For how long</Text>
        <View style={styles.chipRow}>
          {DURATIONS.map((d) => {
            const selected = d.key === shareDurationKey;
            return (
              <Pressable key={d.key} onPress={() => setShareDurationKey(d.key)} style={[styles.chip, selected && styles.chipSelected]}>
                <Text style={[styles.chipLabel, selected && styles.chipLabelSelected]}>{d.label}</Text>
              </Pressable>
            );
          })}
        </View>
        <View style={styles.visibleRow}>
          <Text style={styles.visibleLabel}>Visible to</Text>
          <View style={styles.visibleValue}>
            <Text style={styles.visibleValueText}>All friends</Text>
            <Icon path={CHEVRON_ICON} color={colors.textFaint} size={14} strokeWidth={2} />
          </View>
        </View>
        {locationError ? <Text style={styles.errorText}>{locationError}</Text> : null}
        <View style={styles.sheetActions}>
          <Pressable onPress={closeSheet} style={[styles.sheetButton, styles.sheetButtonSecondary]}>
            <Text style={styles.sheetButtonLabelSecondary}>Cancel</Text>
          </Pressable>
          <Pressable onPress={handleStartSharing} style={[styles.sheetButton, styles.sheetButtonPrimary]}>
            <Text style={styles.sheetButtonLabelPrimary}>Start sharing</Text>
          </Pressable>
        </View>
      </BottomSheet>

      {/* Friend detail sheet */}
      <BottomSheet visible={sheetView === 'detail'} onClose={closeSheet}>
        {detailFriend ? (
          <>
            <View style={styles.detailHeader}>
              <FriendAvatar userId={detailFriend.userId} name={detailFriend.name} size={58} online={detailFriend.live} />
              <View style={styles.detailTextCol}>
                <Text style={styles.detailName}>{detailFriend.name}</Text>
                <Text style={styles.detailStatus}>{detailFriend.statusText}</Text>
              </View>
              <Pressable onPress={closeSheet} style={styles.closeButton} accessibilityRole="button" accessibilityLabel="Close">
                <Icon path={CLOSE_ICON} color={colors.textPrimary} size={14} strokeWidth={2.2} />
              </Pressable>
            </View>
            <View style={styles.detailNote}>
              <Text style={styles.detailNoteText}>
                {detailFriend.live
                  ? `${detailFriend.name.split(' ')[0]} is sharing their live location with you.`
                  : detailFriend.latitude !== null
                    ? `This is where ${detailFriend.name.split(' ')[0]} last had MySpace open — not a live position.`
                    : `${detailFriend.name.split(' ')[0]} hasn't shared their location yet.`}
              </Text>
            </View>
            <View style={styles.sheetActions}>
              <Pressable style={[styles.sheetButton, styles.sheetButtonPrimary]}>
                <Icon path={CHAT_ICON} color={colors.lime} size={16} strokeWidth={1.8} />
                <Text style={styles.sheetButtonLabelPrimary}>Message</Text>
              </Pressable>
              <Pressable style={[styles.sheetButton, styles.sheetButtonSecondary]}>
                <Icon path={DIRECTIONS_ICON} color={colors.textPrimary} size={16} strokeWidth={1.8} />
                <Text style={styles.sheetButtonLabelSecondary}>Directions</Text>
              </Pressable>
            </View>
          </>
        ) : null}
      </BottomSheet>

      <ConfirmDialog
        visible={permissionDenied}
        title="Location access needed"
        message="Radar shows you and your friends on a map, so it needs your location to work. Enable it to use Radar."
        confirmLabel="OK"
        hideCancel
        onConfirm={onBack}
        onCancel={onBack}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#EDF2EA',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xxxl,
    paddingBottom: spacing.sm,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.ms,
  },
  iconButton: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.ink,
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 14,
    elevation: 2,
  },
  title: {
    fontFamily: fontFamily.sans700,
    fontSize: 20,
    letterSpacing: -0.4,
    color: colors.textPrimary,
  },
  sub: {
    fontFamily: fontFamily.sans400,
    fontSize: 12.5,
    color: colors.textSecondary,
    marginTop: 2,
  },
  previewNote: {
    alignSelf: 'center',
    backgroundColor: 'rgba(22,33,12,0.78)',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 7,
    marginTop: 4,
  },
  previewNoteText: {
    fontFamily: fontFamily.sans600,
    fontSize: 11,
    color: colors.lime,
  },
  errorText: {
    fontFamily: fontFamily.sans500,
    fontSize: 12,
    color: colors.danger,
    marginTop: spacing.xs,
  },
  recenterFab: {
    position: 'absolute',
    right: 28,
    bottom: 424,
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.ink,
    shadowOpacity: 0.14,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 18,
    elevation: 3,
  },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#fff',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingHorizontal: spacing.xxxl,
    paddingTop: spacing.ms,
    gap: spacing.md,
    maxHeight: 400,
    shadowColor: colors.ink,
    shadowOpacity: 0.12,
    shadowOffset: { width: 0, height: -14 },
    shadowRadius: 30,
    elevation: 6,
  },
  sheetHandle: {
    alignSelf: 'center',
    width: 44,
    height: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(22,33,12,0.16)',
  },
  liveBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: 'rgba(255,138,107,0.14)',
    borderRadius: 999,
    paddingVertical: 12,
    paddingHorizontal: spacing.lg,
  },
  liveBannerDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.coral,
  },
  liveBannerText: {
    flex: 1,
    fontFamily: fontFamily.sans600,
    fontSize: 13,
    color: colors.textPrimary,
  },
  liveBannerStop: {
    fontFamily: fontFamily.sans600,
    fontSize: 12.5,
    color: colors.textPrimary,
    textDecorationLine: 'underline',
  },
  shareButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    backgroundColor: colors.ink,
    borderRadius: 999,
    paddingVertical: 15,
  },
  shareButtonLabel: {
    fontFamily: fontFamily.sans600,
    fontSize: 14.5,
    color: colors.lime,
  },
  eyebrow: {
    fontFamily: fontFamily.mono500,
    fontSize: 10.5,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: colors.textMuted,
  },
  emptyText: {
    fontFamily: fontFamily.sans400,
    fontSize: 13,
    color: colors.textFaint,
    paddingBottom: spacing.md,
  },
  list: {
    gap: spacing.xs,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.ms,
    backgroundColor: 'rgba(22,33,12,0.04)',
    borderRadius: 18,
    paddingVertical: 10,
    paddingHorizontal: spacing.ms,
    marginBottom: spacing.xs,
  },
  rowText: {
    flex: 1,
    minWidth: 0,
  },
  rowName: {
    fontFamily: fontFamily.sans600,
    fontSize: 14.5,
    color: colors.textPrimary,
  },
  rowStatus: {
    fontFamily: fontFamily.sans400,
    fontSize: 12,
    color: colors.textMuted,
  },
  rowDistance: {
    fontFamily: fontFamily.mono500,
    fontSize: 10.5,
    color: colors.textFaint,
  },
  previewCard: {
    position: 'absolute',
    left: spacing.xxxl,
    right: spacing.xxxl,
  },
  sheetTitle: {
    fontFamily: fontFamily.sans700,
    fontSize: 19,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  sheetBody: {
    fontFamily: fontFamily.sans400,
    fontSize: 13,
    lineHeight: 19,
    color: colors.textSecondary,
  },
  sheetLabel: {
    fontFamily: fontFamily.mono500,
    fontSize: 9.5,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: colors.textMuted,
    marginBottom: spacing.xs,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  chip: {
    backgroundColor: 'rgba(22,33,12,0.06)',
    borderRadius: 999,
    paddingHorizontal: spacing.lg,
    paddingVertical: 10,
  },
  chipSelected: {
    backgroundColor: colors.ink,
  },
  chipLabel: {
    fontFamily: fontFamily.sans600,
    fontSize: 12.5,
    color: colors.textPrimary,
  },
  chipLabelSelected: {
    color: colors.lime,
  },
  visibleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(22,33,12,0.04)',
    borderRadius: 16,
    paddingHorizontal: spacing.lg,
    paddingVertical: 14,
    marginTop: spacing.sm,
  },
  visibleLabel: {
    fontFamily: fontFamily.sans500,
    fontSize: 13.5,
    color: colors.textPrimary,
  },
  visibleValue: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  visibleValueText: {
    fontFamily: fontFamily.sans600,
    fontSize: 13.5,
    color: colors.textMuted,
  },
  sheetActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  sheetButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    borderRadius: 999,
    paddingVertical: 15,
  },
  sheetButtonPrimary: {
    backgroundColor: colors.ink,
  },
  sheetButtonSecondary: {
    backgroundColor: 'rgba(22,33,12,0.06)',
  },
  sheetButtonLabelPrimary: {
    fontFamily: fontFamily.sans600,
    fontSize: 14,
    color: colors.lime,
  },
  sheetButtonLabelSecondary: {
    fontFamily: fontFamily.sans600,
    fontSize: 14,
    color: colors.textPrimary,
  },
  detailHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  detailTextCol: {
    flex: 1,
    minWidth: 0,
  },
  detailName: {
    fontFamily: fontFamily.sans700,
    fontSize: 18,
    color: colors.textPrimary,
  },
  detailStatus: {
    fontFamily: fontFamily.sans500,
    fontSize: 13,
    color: colors.textMuted,
    marginTop: 2,
  },
  closeButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(22,33,12,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailNote: {
    backgroundColor: 'rgba(22,33,12,0.04)',
    borderRadius: 18,
    padding: spacing.lg,
    marginTop: spacing.md,
  },
  detailNoteText: {
    fontFamily: fontFamily.sans400,
    fontSize: 12.5,
    lineHeight: 18,
    color: colors.textSecondary,
  },
});
