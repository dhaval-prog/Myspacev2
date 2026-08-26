import React, { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fontFamily, spacing } from '../../theme';
import { Icon } from '../../components/Icon';
import { initialsOf } from '../../components/split/MemberAvatar';
import { AddSpotSheet } from '../../components/split/AddSpotSheet';
import { FullScreenMapModal } from '../../components/split/FullScreenMapModal';
import { useSplit } from '../../context/SplitContext';
import { relativeDateLabel } from '../../utils/expensesFormat';
import { useAuth } from '../../context/AuthContext';
import { SPOT_ICON_DEFAULT, SPOT_ICON_MAP } from '../../data/spotIcons';
import type { PlannedSpot } from '../../types/split';

const BACK_ICON = 'M15 5l-7 7 7 7';
const PLUS_ICON = 'M12 6v12M6 12h12';
const EXPAND_ICON = 'M4 10V4h6M20 14v6h-6M4 4l6.5 6.5M20 20l-6.5-6.5';
const TRASH_ICON = 'M5 7h14M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2m-9 0 1 13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1l1-13';

const GRADIENT_PROPS = {
  colors: colors.splitGradient as [string, string, ...string[]],
  start: { x: 0, y: 0 },
  end: { x: 1, y: 1 },
};

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
  const { focusedGroup, membersFor, locationsFor, spotsFor, deleteSpot, toggleSpotVisited, locationSharing, toggleLocationSharing, goDashboard } =
    useSplit();
  const [addSpotOpen, setAddSpotOpen] = useState(false);
  const [mapExpanded, setMapExpanded] = useState(false);
  const [deleteSpotTarget, setDeleteSpotTarget] = useState<PlannedSpot | null>(null);

  if (!focusedGroup) return null;

  const allMembers = membersFor(focusedGroup.id);
  const orderedMembers = [...allMembers.filter((m) => m.userId === user?.id), ...allMembers.filter((m) => m.userId !== user?.id)];
  const locations = locationsFor(focusedGroup.id);
  const sharedLocations = locations.filter((l) => l.shared && l.lat !== null && l.lng !== null);
  const myLoc = locations.find((l) => l.userId === user?.id && l.shared && l.lat !== null && l.lng !== null);
  const spots = spotsFor(focusedGroup.id);

  const confirmDeleteSpot = async () => {
    if (!deleteSpotTarget) return;
    await deleteSpot(deleteSpotTarget.id);
    setDeleteSpotTarget(null);
  };

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
        <Pressable
          onPress={() => setMapExpanded(true)}
          style={styles.expandButton}
          accessibilityRole="button"
          accessibilityLabel="View full map"
        >
          <Icon path={EXPAND_ICON} color={colors.splitInk} size={16} strokeWidth={2} />
        </Pressable>
        <View style={styles.mapBadge}>
          <Text style={styles.mapBadgeText}>Live · updated moments ago</Text>
        </View>
        {sharedLocations.map((l) => {
          const member = allMembers.find((m) => m.userId === l.userId);
          if (!member) return null;
          const isSelf = l.userId === user?.id;
          return (
            <View key={l.userId} style={[styles.pin, pinPosition(l.userId)]}>
              {isSelf ? (
                <LinearGradient {...GRADIENT_PROPS} style={styles.pinTile}>
                  <Text style={styles.pinInitials}>{initialsOf(member.name)}</Text>
                </LinearGradient>
              ) : (
                <View style={[styles.pinTile, styles.pinTileOff]}>
                  <Text style={styles.pinInitials}>{initialsOf(member.name)}</Text>
                </View>
              )}
            </View>
          );
        })}
        {spots.map((s) => (
          <View key={s.id} style={[styles.spotPin, { left: `${s.posX}%`, top: `${s.posY}%` }]}>
            <View style={styles.spotPinTile}>
              <Icon path={SPOT_ICON_MAP[s.icon] ?? SPOT_ICON_DEFAULT} color={colors.splitAccent} size={13} strokeWidth={1.8} />
            </View>
            <View style={styles.spotPinTail} />
          </View>
        ))}
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <View style={styles.shareRow}>
          <View style={styles.shareTextCol}>
            <Text style={styles.shareTitle}>Share my location</Text>
            <Text style={styles.shareNote}>Only inside this trip space</Text>
          </View>
          <Pressable
            onPress={toggleLocationSharing}
            style={styles.toggleTrackShape}
            accessibilityRole="switch"
            accessibilityState={{ checked: locationSharing }}
          >
            {locationSharing ? (
              <LinearGradient {...GRADIENT_PROPS} style={[styles.toggleTrack, styles.toggleTrackOn]}>
                <View style={styles.toggleKnob} />
              </LinearGradient>
            ) : (
              <View style={styles.toggleTrack}>
                <View style={styles.toggleKnob} />
              </View>
            )}
          </Pressable>
        </View>

        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>Planned spots</Text>
          <Pressable onPress={() => setAddSpotOpen(true)} style={styles.addSpotButton} accessibilityRole="button" accessibilityLabel="Add a planned spot">
            <Icon path={PLUS_ICON} color={colors.splitAccent} size={14} strokeWidth={2.4} />
            <Text style={styles.addSpotLabel}>Add spot</Text>
          </Pressable>
        </View>
        <View style={styles.rows}>
          {spots.length === 0 ? (
            <Text style={styles.emptyNote}>No spots planned yet — add the first place you want to hit.</Text>
          ) : (
            spots.map((s) => {
              const canDelete = s.createdBy === user?.id || focusedGroup.isOwner;
              return (
                <View key={s.id} style={styles.spotRow}>
                  <View style={styles.spotIconTile}>
                    <Icon path={SPOT_ICON_MAP[s.icon] ?? SPOT_ICON_DEFAULT} color={colors.splitAccent} size={18} strokeWidth={1.8} />
                  </View>
                  <View style={styles.spotTextCol}>
                    <Text style={styles.spotName} numberOfLines={1}>
                      {s.name}
                    </Text>
                    {s.note ? (
                      <Text style={styles.spotNote} numberOfLines={1}>
                        {s.note}
                      </Text>
                    ) : null}
                  </View>
                  <Pressable
                    onPress={() => toggleSpotVisited(s.id)}
                    style={[styles.visitedPill, s.visited && styles.visitedPillOn]}
                    accessibilityRole="button"
                    accessibilityLabel={s.visited ? 'Mark not visited' : 'Mark visited'}
                  >
                    <Text style={[styles.visitedPillLabel, s.visited && styles.visitedPillLabelOn]}>{s.visited ? 'Visited' : 'Mark visited'}</Text>
                  </Pressable>
                  {canDelete && (
                    <Pressable
                      onPress={() => setDeleteSpotTarget(s)}
                      style={styles.spotDeleteButton}
                      accessibilityRole="button"
                      accessibilityLabel={`Delete ${s.name}`}
                    >
                      <Icon path={TRASH_ICON} color={colors.splitInkFaint45} size={15} strokeWidth={1.8} />
                    </Pressable>
                  )}
                </View>
              );
            })
          )}
        </View>

        <Text style={styles.sectionTitle}>Who's where</Text>
        <View style={styles.rows}>
          {orderedMembers.length === 0 ? (
            <Text style={styles.emptyNote}>No one else has joined this split yet.</Text>
          ) : (
            orderedMembers.map((m) => {
              const isSelf = m.userId === user?.id;
              const loc = locations.find((l) => l.userId === m.userId);
              const isSharing = Boolean(loc?.shared && loc.lat !== null && loc.lng !== null);
              const place = isSharing ? 'Sharing live location' : 'Location off';
              const dist = isSelf
                ? isSharing
                  ? 'here'
                  : '—'
                : isSharing && myLoc
                  ? `${distanceKm({ lat: myLoc.lat!, lng: myLoc.lng! }, { lat: loc!.lat!, lng: loc!.lng! }).toFixed(1)} km`
                  : isSharing
                    ? relativeDateLabel(new Date(loc!.updatedAt))
                    : 'Not sharing';
              return (
                <View key={m.userId} style={styles.locRow}>
                  {isSelf ? (
                    <LinearGradient {...GRADIENT_PROPS} style={styles.locTile}>
                      <Text style={[styles.locTileText, styles.locTileTextOn]}>{initialsOf(m.name)}</Text>
                    </LinearGradient>
                  ) : (
                    <View style={[styles.locTile, styles.locTileOff]}>
                      <Text style={styles.locTileText}>{initialsOf(m.name)}</Text>
                    </View>
                  )}
                  <View style={styles.locTextCol}>
                    <Text style={styles.locName}>{m.name}</Text>
                    <Text style={styles.locPlace}>
                      {place}
                      {isSelf ? ' · you' : ''}
                    </Text>
                  </View>
                  <Text style={[styles.locDist, isSelf && isSharing && styles.locDistHere]}>{dist}</Text>
                </View>
              );
            })
          )}
        </View>
      </ScrollView>

      <AddSpotSheet visible={addSpotOpen} onClose={() => setAddSpotOpen(false)} nextIndex={spots.length} />

      <FullScreenMapModal
        visible={mapExpanded}
        onClose={() => setMapExpanded(false)}
        members={allMembers}
        locations={locations}
        spots={spots}
        userId={user?.id ?? null}
      />

      <Modal visible={!!deleteSpotTarget} transparent animationType="fade" onRequestClose={() => setDeleteSpotTarget(null)}>
        <View style={styles.deleteModalWrap}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setDeleteSpotTarget(null)} accessibilityRole="button" accessibilityLabel="Dismiss" />
          <View style={styles.deleteModalCard}>
            <Text style={styles.deleteModalTitle}>Delete {deleteSpotTarget?.name}?</Text>
            <Text style={styles.deleteModalBody}>This spot will be removed from the trip map for everyone.</Text>
            <View style={styles.deleteModalActions}>
              <Pressable onPress={() => setDeleteSpotTarget(null)} style={styles.deleteModalCancel}>
                <Text style={styles.deleteModalCancelLabel}>Cancel</Text>
              </Pressable>
              <Pressable onPress={confirmDeleteSpot} style={styles.deleteModalConfirm}>
                <Text style={styles.deleteModalConfirmLabel}>Delete</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
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
    shadowColor: colors.splitInk,
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 18,
    elevation: 2,
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
  expandButton: {
    position: 'absolute',
    left: 18,
    top: 18,
    width: 34,
    height: 34,
    borderRadius: 12,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.splitInk,
    shadowOpacity: 0.14,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 12,
    elevation: 3,
  },
  pin: {
    position: 'absolute',
  },
  pinTile: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#fff',
    shadowColor: colors.splitInk,
    shadowOpacity: 0.22,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 18,
    elevation: 4,
  },
  pinTileOff: {
    backgroundColor: colors.splitInk,
  },
  pinInitials: {
    fontFamily: fontFamily.sans700,
    fontSize: 12,
    color: '#fff',
  },
  spotPin: {
    position: 'absolute',
    alignItems: 'center',
  },
  spotPinTile: {
    width: 30,
    height: 30,
    borderRadius: 10,
    backgroundColor: colors.splitSurface,
    borderWidth: 2,
    borderColor: colors.splitAccent,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.splitInk,
    shadowOpacity: 0.18,
    shadowOffset: { width: 0, height: 5 },
    shadowRadius: 10,
    elevation: 3,
  },
  spotPinTail: {
    width: 8,
    height: 8,
    borderRadius: 2,
    backgroundColor: colors.splitSurface,
    borderRightWidth: 2,
    borderBottomWidth: 2,
    borderColor: colors.splitAccent,
    transform: [{ rotate: '45deg' }],
    marginTop: -4,
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
    paddingVertical: 16,
    paddingHorizontal: 18,
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
  toggleTrackShape: {
    borderRadius: 999,
  },
  toggleTrack: {
    width: 52,
    height: 30,
    borderRadius: 999,
    backgroundColor: '#E7E7EF',
    padding: 3,
    justifyContent: 'center',
  },
  toggleTrackOn: {
    alignItems: 'flex-end',
  },
  toggleKnob: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#fff',
    shadowColor: colors.splitInk,
    shadowOpacity: 0.2,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6,
    elevation: 2,
  },
  sectionTitle: {
    marginTop: spacing.md,
    fontFamily: fontFamily.sans700,
    fontSize: 17,
    color: colors.splitInk,
  },
  sectionHeaderRow: {
    marginTop: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  addSpotButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 8,
    paddingHorizontal: 13,
    borderRadius: 999,
    backgroundColor: colors.splitAccentSoftBg,
  },
  addSpotLabel: {
    fontFamily: fontFamily.sans600,
    fontSize: 12.5,
    color: colors.splitAccent,
  },
  rows: {
    gap: spacing.xs,
  },
  spotRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.ms,
    backgroundColor: colors.splitSurface,
    borderRadius: 20,
    paddingVertical: 12,
    paddingHorizontal: spacing.lg,
  },
  spotIconTile: {
    width: 40,
    height: 40,
    flexShrink: 0,
    borderRadius: 14,
    backgroundColor: colors.splitAccentSoftBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  spotTextCol: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  spotName: {
    fontFamily: fontFamily.sans600,
    fontSize: 15,
    color: colors.splitInk,
  },
  spotNote: {
    fontFamily: fontFamily.sans400,
    fontSize: 12,
    color: colors.splitInkFaint45,
  },
  visitedPill: {
    flexShrink: 0,
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: '#F2F2F7',
  },
  visitedPillOn: {
    backgroundColor: colors.splitPositiveBg,
  },
  visitedPillLabel: {
    fontFamily: fontFamily.sans600,
    fontSize: 11.5,
    color: colors.splitInkFaint5,
  },
  visitedPillLabelOn: {
    color: colors.splitPositiveFg,
  },
  spotDeleteButton: {
    flexShrink: 0,
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
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
    paddingHorizontal: spacing.lg,
  },
  locTile: {
    width: 40,
    height: 40,
    flexShrink: 0,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  locTileOff: {
    backgroundColor: '#E9EAFB',
  },
  locTileText: {
    fontFamily: fontFamily.sans700,
    fontSize: 12.5,
    color: colors.splitInk,
  },
  locTileTextOn: {
    color: '#fff',
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
    color: colors.splitInkFaint5,
  },
  locDistHere: {
    color: colors.splitPositiveFg,
  },
  deleteModalWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.organic,
    backgroundColor: 'rgba(27,42,99,.35)',
  },
  deleteModalCard: {
    width: '100%',
    backgroundColor: colors.splitBg,
    borderRadius: 28,
    padding: spacing.xxl,
    gap: spacing.ms,
  },
  deleteModalTitle: {
    fontFamily: fontFamily.sans700,
    fontSize: 18,
    color: colors.splitInk,
    textAlign: 'center',
  },
  deleteModalBody: {
    fontFamily: fontFamily.sans400,
    fontSize: 13.5,
    lineHeight: 20,
    color: colors.splitInkFaint55,
    textAlign: 'center',
  },
  deleteModalActions: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginTop: spacing.xxs,
  },
  deleteModalCancel: {
    flex: 1,
    borderRadius: 999,
    paddingVertical: 15,
    alignItems: 'center',
    backgroundColor: 'rgba(27,42,99,.06)',
  },
  deleteModalCancelLabel: {
    fontFamily: fontFamily.sans600,
    fontSize: 15,
    color: colors.splitInk,
  },
  deleteModalConfirm: {
    flex: 1,
    borderRadius: 999,
    paddingVertical: 15,
    alignItems: 'center',
    backgroundColor: colors.splitDangerFg,
  },
  deleteModalConfirmLabel: {
    fontFamily: fontFamily.sans600,
    fontSize: 15,
    color: '#fff',
  },
});
