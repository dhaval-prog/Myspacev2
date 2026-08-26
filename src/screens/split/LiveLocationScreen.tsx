import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fontFamily, spacing } from '../../theme';
import { Icon } from '../../components/Icon';
import { MemberAvatar } from '../../components/split/MemberAvatar';
import { useSplit } from '../../context/SplitContext';
import { relativeDateLabel } from '../../utils/expensesFormat';
import { useAuth } from '../../context/AuthContext';

const BACK_ICON = 'M15 5l-7 7 7 7';

/** Haversine distance in km between two lat/lng points. */
function distanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 + Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
}

/** Deterministic pseudo-position on the stylized map area, purely decorative (not a real projection). */
function pinPosition(userId: string): { left: `${number}%`; top: `${number}%` } {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) hash = (hash * 31 + userId.charCodeAt(i)) >>> 0;
  const left = 12 + (hash % 76);
  const top = 14 + ((hash >> 8) % 62);
  return { left: `${left}%`, top: `${top}%` };
}

export function LiveLocationScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { focusedGroup, membersFor, locationsFor, locationSharing, toggleLocationSharing, goDashboard } = useSplit();

  if (!focusedGroup) return null;

  const members = membersFor(focusedGroup.id).filter((m) => m.userId !== user?.id);
  const locations = locationsFor(focusedGroup.id);
  const sharedLocations = locations.filter((l) => l.shared && l.lat !== null && l.lng !== null);
  const myLoc = locations.find((l) => l.userId === user?.id && l.shared && l.lat !== null && l.lng !== null);

  return (
    <View style={styles.screen}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
        <Pressable onPress={goDashboard} style={styles.iconButton} accessibilityRole="button" accessibilityLabel="Back">
          <Icon path={BACK_ICON} color={colors.splitInk} size={19} strokeWidth={2} />
        </Pressable>
        <View>
          <Text style={styles.headerTitle}>Live Location</Text>
          <Text style={styles.headerMeta}>{sharedLocations.length} sharing right now</Text>
        </View>
      </View>

      <View style={styles.mapBox}>
        <View style={[StyleSheet.absoluteFill, styles.mapGrid]}>
          <View style={styles.roadA} />
          <View style={styles.roadB} />
        </View>
        <View style={styles.mapBadge}>
          <Text style={styles.mapBadgeText}>Live · updated moments ago</Text>
        </View>
        {sharedLocations.map((l) => {
          if (l.userId === user?.id) return null;
          const member = membersFor(focusedGroup.id).find((m) => m.userId === l.userId);
          if (!member) return null;
          return (
            <View key={l.userId} style={[styles.pin, pinPosition(l.userId)]}>
              <MemberAvatar userId={l.userId} name={member.name} size={34} />
            </View>
          );
        })}
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <View style={styles.shareRow}>
          <View style={styles.shareTextCol}>
            <Text style={styles.shareTitle}>Share my location</Text>
            <Text style={styles.shareNote}>Only inside this split</Text>
          </View>
          <Pressable
            onPress={toggleLocationSharing}
            style={[styles.toggleTrack, locationSharing && styles.toggleTrackOn]}
            accessibilityRole="switch"
            accessibilityState={{ checked: locationSharing }}
          >
            <View style={[styles.toggleKnob, locationSharing && styles.toggleKnobOn]} />
          </Pressable>
        </View>

        <Text style={styles.sectionTitle}>Who's where</Text>
        <View style={styles.rows}>
          {members.length === 0 ? (
            <Text style={styles.emptyNote}>No one else has joined this split yet.</Text>
          ) : (
            members.map((m) => {
              const loc = locations.find((l) => l.userId === m.userId);
              const isSharing = Boolean(loc?.shared && loc.lat !== null && loc.lng !== null);
              const dist =
                isSharing && myLoc
                  ? `${distanceKm({ lat: myLoc.lat!, lng: myLoc.lng! }, { lat: loc!.lat!, lng: loc!.lng! }).toFixed(1)} km`
                  : isSharing
                    ? relativeDateLabel(new Date(loc!.updatedAt))
                    : 'Not sharing';
              return (
                <View key={m.userId} style={styles.locRow}>
                  <MemberAvatar userId={m.userId} name={m.name} size={40} />
                  <View style={styles.locTextCol}>
                    <Text style={styles.locName}>{m.name}</Text>
                    <Text style={styles.locPlace}>{isSharing ? 'Sharing live location' : 'Location off'}</Text>
                  </View>
                  <Text style={[styles.locDist, !isSharing && styles.locDistOff]}>{dist}</Text>
                </View>
              );
            })
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.splitBg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.ms,
    paddingHorizontal: spacing.xxxl,
    paddingBottom: spacing.md,
  },
  iconButton: {
    width: 46,
    height: 46,
    borderRadius: 15,
    backgroundColor: colors.splitSurface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontFamily: fontFamily.sans700,
    fontSize: 21,
    letterSpacing: -0.2,
    color: colors.splitInk,
  },
  headerMeta: {
    fontFamily: fontFamily.sans400,
    fontSize: 12,
    color: colors.splitInkFaint45,
  },
  mapBox: {
    marginHorizontal: spacing.xxxl,
    height: 280,
    borderRadius: 30,
    overflow: 'hidden',
    backgroundColor: '#EDEEF6',
  },
  mapGrid: {
    backgroundColor: '#EDEEF6',
  },
  roadA: {
    position: 'absolute',
    left: -40,
    top: 120,
    width: 340,
    height: 34,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,.85)',
    transform: [{ rotate: '-14deg' }],
  },
  roadB: {
    position: 'absolute',
    left: 120,
    top: -30,
    width: 26,
    height: 340,
    backgroundColor: 'rgba(255,255,255,.7)',
    transform: [{ rotate: '9deg' }],
  },
  mapBadge: {
    position: 'absolute',
    right: 18,
    bottom: 18,
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: '#fff',
  },
  mapBadgeText: {
    fontFamily: fontFamily.sans600,
    fontSize: 11,
    color: colors.splitInkFaint5,
  },
  pin: {
    position: 'absolute',
  },
  scroll: {
    paddingHorizontal: spacing.xxxl,
    paddingTop: spacing.lg,
    paddingBottom: 40,
    gap: spacing.ms,
  },
  shareRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.splitSurface,
    borderRadius: 22,
    padding: spacing.lg,
  },
  shareTextCol: {
    gap: 3,
  },
  shareTitle: {
    fontFamily: fontFamily.sans600,
    fontSize: 15,
    color: colors.splitInk,
  },
  shareNote: {
    fontFamily: fontFamily.sans400,
    fontSize: 12,
    color: colors.splitInkFaint45,
  },
  toggleTrack: {
    width: 46,
    height: 27,
    borderRadius: 999,
    backgroundColor: colors.splitInkFaint09,
    padding: 3,
    justifyContent: 'center',
  },
  toggleTrackOn: {
    backgroundColor: colors.splitAccent,
  },
  toggleKnob: {
    width: 21,
    height: 21,
    borderRadius: 11,
    backgroundColor: '#fff',
  },
  toggleKnobOn: {
    transform: [{ translateX: 19 }],
  },
  sectionTitle: {
    marginTop: spacing.md,
    fontFamily: fontFamily.sans700,
    fontSize: 17,
    color: colors.splitInk,
  },
  rows: {
    gap: spacing.xs,
  },
  emptyNote: {
    fontFamily: fontFamily.sans400,
    fontSize: 13,
    color: colors.splitInkFaint45,
  },
  locRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.ms,
    backgroundColor: colors.splitSurface,
    borderRadius: 20,
    paddingVertical: 13,
    paddingHorizontal: spacing.md,
  },
  locTextCol: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  locName: {
    fontFamily: fontFamily.sans600,
    fontSize: 15,
    color: colors.splitInk,
  },
  locPlace: {
    fontFamily: fontFamily.sans400,
    fontSize: 12,
    color: colors.splitInkFaint45,
  },
  locDist: {
    fontFamily: fontFamily.sans600,
    fontSize: 13,
    color: colors.splitAccent,
  },
  locDistOff: {
    color: colors.splitInkFaint45,
  },
});
