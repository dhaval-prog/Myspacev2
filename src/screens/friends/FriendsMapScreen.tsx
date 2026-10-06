import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Linking, StyleSheet, View, useWindowDimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ThrowProvider, useThrow } from '../../context/ThrowContext';
import { useFriends } from '../../context/FriendsContext';
import { useThrowColorMode } from '../../context/ThrowColorModeContext';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import { timeAgo } from '../../utils/relativeTime';
import type { LatLng } from '../../utils/geo';
import {
  clusterPins,
  distanceKm,
  etaLabel,
  filterContacts,
  fitViewport,
  focusCamera,
  formatDistanceKm,
  isLive,
  type MapFilter,
} from '../../utils/friendsMapMath';
import { fmColor, fmLayout } from '../../theme/friendsMapTokens';
import { ChatsBottomBar } from '../../components/friends/ChatsBottomBar';
import { FriendsMapCanvas } from '../../components/friends/map/FriendsMapCanvas';
import type { FriendsMapCameraCommand, FriendsMapCanvasPin } from '../../components/friends/map/friendsMapCanvasTypes';
import { FriendsMapSearchRow } from '../../components/friends/map/FriendsMapSearchRow';
import { FriendsMapFilterChips } from '../../components/friends/map/FriendsMapFilterChips';
import { FriendsMapControls } from '../../components/friends/map/FriendsMapControls';
import { FriendsMapSheet, type FriendsMapListCard } from '../../components/friends/map/FriendsMapSheet';
import { FriendsMapPinGlyph } from '../../components/friends/map/FriendsMapPinGlyph';
import { FriendsMapClusterGlyph } from '../../components/friends/map/FriendsMapClusterGlyph';
import { FriendsMapMeGlyph } from '../../components/friends/map/FriendsMapMeGlyph';
import { FriendsMapPinAnchor } from '../../components/friends/map/FriendsMapPinAnchor';

interface MapContact {
  userId: string;
  connectionId: string | null;
  name: string;
  avatarUrl: string | null;
  lat: number;
  lon: number;
  locationLabel: string;
  live: boolean;
  agoLabel: string;
  distanceKm: number;
}

interface FriendsMapScreenProps {
  onOpenAccount: () => void;
  /** Opens Throw, pre-addressed to a contact when given — the Map screen's own "Throw" action on a
   * friend's detail sheet. */
  onOpenThrow: (focusContactId?: string) => void;
}

const DEFAULT_CAMERA: { zoom: number; center: LatLng } = { zoom: 4, center: { latitude: 21.5, longitude: 79.5 } };

/** Chats "Map" tab — every friend who's shared a Throw location, pinned on one real map. Ported
 * from the design handoff (`MySpace Friends Map`), driven by this app's own ThrowContext/
 * FriendsContext data instead of the handoff's own hardcoded `CONTACTS` seed array. The handoff's
 * "area" (neighborhood) level of detail has no equivalent in this app's location data (just
 * city/country), so cards/detail show "City, Country" where the handoff shows "Area, City". */
export function FriendsMapScreen(props: FriendsMapScreenProps) {
  return (
    <ThrowProvider>
      <FriendsMapScreenInner {...props} />
    </ThrowProvider>
  );
}

/** Mounts its own `ThrowProvider` (same "each screen that needs Throw data wraps its own" pattern
 * `ThrowReceivedLettersScreen` already uses) since the Chats list's own screens sit outside
 * Throw's own navigator/provider tree. */
function FriendsMapScreenInner({ onOpenAccount, onOpenThrow }: FriendsMapScreenProps) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const scale = width / fmLayout.phone.width;
  const reduceMotion = useReducedMotion();
  const { isDay } = useThrowColorMode();
  const { myLocation, friends: throwFriends } = useThrow();
  const { friends: fsFriends, openChat, goChats } = useFriends();

  const [filter, setFilter] = useState<MapFilter>('all');
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [camera, setCamera] = useState(DEFAULT_CAMERA);
  const [cameraCommand, setCameraCommand] = useState<FriendsMapCameraCommand | null>(null);
  const commandTokenRef = useRef(0);
  const didInitialFitRef = useRef(false);

  const me: LatLng | null = myLocation ? { latitude: myLocation.latitude, longitude: myLocation.longitude } : null;

  const contacts: MapContact[] = useMemo(() => {
    if (!me) return [];
    return throwFriends
      .filter((f) => f.location != null)
      .map((f) => {
        const loc = f.location!;
        const live = isLive(loc.updatedAt);
        return {
          userId: f.userId,
          connectionId: fsFriends.find((x) => x.userId === f.userId)?.connectionId ?? null,
          name: f.name,
          avatarUrl: f.avatarUrl,
          lat: loc.latitude,
          lon: loc.longitude,
          locationLabel: `${loc.city}, ${loc.country}`,
          live,
          agoLabel: live ? 'LIVE' : loc.updatedAt ? `${timeAgo(loc.updatedAt)} ago` : 'offline',
          distanceKm: distanceKm(me, { latitude: loc.latitude, longitude: loc.longitude }),
        };
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [throwFriends, fsFriends, me?.latitude, me?.longitude]);

  const visibleContacts = useMemo(
    () => filterContacts(contacts.map((c) => ({ ...c, area: '', city: c.locationLabel })), { filter, query }),
    [contacts, filter, query],
  );
  const visibleIds = useMemo(() => new Set(visibleContacts.map((c) => c.userId)), [visibleContacts]);

  const jumpTo = (center: LatLng, zoom: number) => {
    commandTokenRef.current += 1;
    setCameraCommand({ token: commandTokenRef.current, kind: 'jump', center, zoom });
  };
  const fitTo = (points: LatLng[]) => {
    const fit = fitViewport(points);
    if (!fit) return;
    commandTokenRef.current += 1;
    setCameraCommand({ token: commandTokenRef.current, kind: 'fit', points });
    setCamera(fit);
  };
  const fitAllVisible = () => fitTo([...visibleContacts.map((c): LatLng => ({ latitude: c.lat, longitude: c.lon })), ...(me ? [me] : [])]);

  // Frames every shared friend (+ me) once real data is in, instead of sitting on the handoff's
  // own India-wide default forever — only ever runs once, so a background location refresh never
  // yanks the camera away from wherever the user has since panned/selected.
  useEffect(() => {
    if (didInitialFitRef.current || !me) return;
    didInitialFitRef.current = true;
    if (contacts.length > 0) fitTo([...contacts.map((c): LatLng => ({ latitude: c.lat, longitude: c.lon })), me]);
    else jumpTo(me, 12);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me?.latitude, me?.longitude, contacts.length]);

  const groups = useMemo(
    () => clusterPins(visibleContacts.map((c) => ({ id: c.userId, lat: c.lat, lon: c.lon })), { zoom: camera.zoom, selectedId }),
    [visibleContacts, camera.zoom, selectedId],
  );

  const focus = (contact: { lat: number; lon: number; userId: string }) => {
    setSelectedId(contact.userId);
    const { zoom, center } = focusCamera({ latitude: contact.lat, longitude: contact.lon }, camera.zoom);
    jumpTo(center, zoom);
  };

  const onClusterTap = (memberIds: string[]) => {
    const members = visibleContacts.filter((c) => memberIds.includes(c.userId));
    const lats = members.map((c) => c.lat);
    const lons = members.map((c) => c.lon);
    jumpTo({ latitude: (Math.min(...lats) + Math.max(...lats)) / 2, longitude: (Math.min(...lons) + Math.max(...lons)) / 2 }, Math.min(15, camera.zoom + 2));
  };

  const closeDetail = () => {
    setSelectedId(null);
    fitAllVisible();
  };

  const groupById = useMemo(() => {
    const map = new Map<string, (typeof groups)[number]>();
    for (const [i, g] of groups.entries()) map.set(g.items.length > 1 ? `cluster-${i}` : g.items[0].id, g);
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groups]);
  // A selected pin must paint over an unselected neighbor a few meters away (e.g. right after
  // focusing one of two nearly-coincident contacts) — matches the handoff's own explicit z values
  // (selected single pin 5, default single pin 4, cluster 3).
  const pins: FriendsMapCanvasPin[] = [...groupById.entries()].map(([id, g]) => ({
    id,
    latitude: g.lat,
    longitude: g.lon,
    zIndex: g.items.length > 1 ? 3 : g.items[0].id === selectedId ? 5 : 4,
  }));

  const renderPin = (pin: FriendsMapCanvasPin) => {
    const group = groupById.get(pin.id);
    if (!group) return null;
    if (group.items.length > 1) {
      const members = group.items.map((it) => visibleContacts.find((c) => c.userId === it.id)!).filter(Boolean);
      return (
        <FriendsMapPinAnchor width={110 * scale} tipOffset={24 * scale} onPress={() => onClusterTap(group.items.map((it) => it.id))}>
          <FriendsMapClusterGlyph count={group.items.length} members={members} scale={scale} />
        </FriendsMapPinAnchor>
      );
    }
    const contact = visibleContacts.find((c) => c.userId === group.items[0].id);
    if (!contact) return null;
    const selected = contact.userId === selectedId;
    const showTag = camera.zoom >= 7 || selected;
    const size = selected ? fmLayout.pinSelectedSize : fmLayout.pinDefaultSize;
    return (
      <FriendsMapPinAnchor width={110 * scale} tipOffset={size * scale} onPress={() => focus(contact)}>
        <FriendsMapPinGlyph
          userId={contact.userId}
          name={contact.name}
          avatarUrl={contact.avatarUrl}
          live={contact.live}
          selected={selected}
          agoLabel={contact.agoLabel}
          showTag={showTag}
          scale={scale}
          reduceMotion={reduceMotion}
        />
      </FriendsMapPinAnchor>
    );
  };

  const sortedCards = useMemo(() => [...visibleContacts].sort((a, b) => a.distanceKm - b.distanceKm), [visibleContacts]);
  const liveCount = contacts.filter((c) => c.live).length;
  const nearbyCount = contacts.filter((c) => c.distanceKm < 60).length;
  const listTitle = visibleContacts.length === contacts.length ? `${contacts.length} friends · ${liveCount} live` : `${visibleContacts.length} of ${contacts.length} friends`;

  const listCards: FriendsMapListCard[] = sortedCards.map((c) => ({
    userId: c.userId,
    name: c.name,
    avatarUrl: c.avatarUrl,
    subtitle: c.locationLabel,
    live: c.live,
    distanceLabel: formatDistanceKm(c.distanceKm),
    agoLabel: c.agoLabel,
    onPress: () => focus(c),
  }));

  const selectedContact = selectedId ? (contacts.find((c) => c.userId === selectedId) ?? null) : null;
  const detail = selectedContact
    ? {
        userId: selectedContact.userId,
        name: selectedContact.name,
        avatarUrl: selectedContact.avatarUrl,
        live: selectedContact.live,
        area: selectedContact.locationLabel,
        statusLabel: selectedContact.live ? `SHARING LIVE · UPDATED ${selectedContact.agoLabel === 'LIVE' ? 'JUST NOW' : selectedContact.agoLabel.toUpperCase()}` : `LAST SEEN ${selectedContact.agoLabel.toUpperCase()}`,
        distanceLabel: formatDistanceKm(selectedContact.distanceKm),
        etaLabel: etaLabel(selectedContact.distanceKm),
        onThrow: () => onOpenThrow(selectedContact.userId),
        onChat: () => {
          if (selectedContact.connectionId) openChat(selectedContact.connectionId);
        },
        onDirections: () => {
          Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${selectedContact.lat},${selectedContact.lon}`).catch(() => {});
        },
      }
    : null;

  const sidePad = 16 * scale;
  const topBarTop = insets.top + fmLayout.searchRowY * scale;

  return (
    <View style={styles.screen}>
      <FriendsMapCanvas
        me={me}
        pins={pins}
        renderPin={renderPin}
        renderMe={() => <FriendsMapMeGlyph scale={scale} reduceMotion={reduceMotion} />}
        cameraCommand={cameraCommand}
        onCameraChange={setCamera}
      />
      <LinearGradient
        pointerEvents="none"
        colors={[fmColor.mapFadeTop, 'rgba(221,237,223,0)']}
        style={[styles.topFade, { height: 190 * scale }]}
      />

      <View style={[styles.topBar, { left: sidePad, right: sidePad, top: topBarTop }]}>
        <FriendsMapSearchRow query={query} onChangeQuery={(q) => { setQuery(q); setSelectedId(null); }} onAddFriend={() => {}} />
        <View style={{ height: 10 * scale }} />
        <FriendsMapFilterChips
          filter={filter}
          onSelect={(f) => { setFilter(f); setSelectedId(null); }}
          totalCount={contacts.length}
          liveCount={liveCount}
          nearbyCount={nearbyCount}
        />
      </View>

      <FriendsMapControls
        top={(selectedId ? 300 : 340) * scale}
        onZoomIn={() => jumpTo(camera.center, Math.min(15, camera.zoom + 1))}
        onZoomOut={() => jumpTo(camera.center, Math.max(3, camera.zoom - 1))}
        onFitAll={fitAllVisible}
        onLocateMe={() => me && jumpTo(me, 12)}
      />

      <View style={[styles.bottomStack, { bottom: 84 * scale }]}>
        <FriendsMapSheet listTitle={listTitle} cards={listCards} detail={detail} onCloseDetail={closeDetail} />
      </View>

      <View style={styles.navBarWrap}>
        <ChatsBottomBar
          isDay={isDay}
          activeTab="map"
          showQuickActions={false}
          onOpenChats={goChats}
          onOpenThrow={() => onOpenThrow()}
          onOpenMap={() => {}}
          onOpenAccount={onOpenAccount}
          onOpenExpenses={() => {}}
          onOpenGames={() => {}}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: fmColor.mapBase },
  topFade: { position: 'absolute', left: 0, right: 0, top: 0 },
  topBar: { position: 'absolute' },
  bottomStack: { position: 'absolute', left: 0, right: 0 },
  navBarWrap: { position: 'absolute', left: 0, right: 0, bottom: 0 },
});
