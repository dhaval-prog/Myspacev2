import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FriendAvatar } from '../../components/friends/FriendAvatar';
import { GlassSurface } from '../../components/friends/GlassSurface';
import { Icon } from '../../components/Icon';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { ThrowGlassBackdrop } from '../../components/throw/ThrowGlassBackdrop';
import { ThrowLocationSetupScreen } from './ThrowLocationSetupScreen';
import { AccountSettingsScreen } from '../account/AccountSettingsScreen';
import { BottomSheet } from '../../components/expenses/BottomSheet';
import { throwColor, throwFont, throwGlass, throwRadius, throwSpace } from '../../theme/throwTokens';
import { useThrow } from '../../context/ThrowContext';
import { useFriends } from '../../context/FriendsContext';
import { useThrowColorMode, type ThrowColorMode } from '../../context/ThrowColorModeContext';
import { useThrowWeather } from '../../context/ThrowWeatherContext';
import type { LocationVisibility } from '../../types/throw';
import type { WeatherCondition, WeatherIntensity } from '../../types/weather';

const BACK_ICON = 'M15 18l-6-6 6-6';
const CHECK_ICON = 'M5 13l4 4L19 7';

const COLOR_MODES: { key: ThrowColorMode; label: string; description: string }[] = [
  { key: 'auto', label: 'Auto', description: "Follows your device's clock (day/night)" },
  { key: 'day', label: 'Day', description: 'Always the day look' },
  { key: 'night', label: 'Night', description: 'Always the night look' },
];

const VISIBILITY_OPTIONS: { key: LocationVisibility; label: string; description: string }[] = [
  { key: 'friends', label: 'Friends', description: 'Only your friends can see your pin on the map' },
  { key: 'all', label: 'All', description: 'Every MySpace user can see your pin on the map' },
  { key: 'ghost', label: 'Ghost mode', description: "You're hidden from the map entirely — even friends can't see your pin" },
];

// Feather-style icon paths, one per WeatherCondition — small enough to read clearly at card size,
// close enough to their real Feather counterparts (sun/cloud/cloud-drizzle/cloud-lightning/zap/
// wind/asterisk-as-snowflake) that they don't need a design pass of their own.
const WEATHER_ICONS: Record<WeatherCondition, string> = {
  clear: 'M12 17a5 5 0 100-10 5 5 0 000 10zM12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42',
  // Feather "sunrise" — deliberately a different glyph from clear's own sun-with-rays, so the two
  // read as distinct picks in the grid even though both are "sun" themed.
  sunny: 'M17 18a5 5 0 00-10 0 M12 2v7 M4.22 10.22l1.42 1.42 M1 18h2 M21 18h2 M18.36 11.64l1.42-1.42 M23 22H1 M16 6l-4-4-4 4',
  cloudy: 'M18 10h-1.26A8 8 0 109 20h9a5 5 0 000-10z',
  rain: 'M20 16.58A5 5 0 0018 7h-1.26A8 8 0 104 15.25 M8 19v1 M8 14v1 M12 21v1 M12 16v1 M16 19v1 M16 14v1',
  thunderstorm: 'M19 16.9A5 5 0 0018 7h-1.26a8 8 0 10-11.62 9 M13 11l-4 6h6l-4 6',
  lightning: 'M13 2L3 14h9l-1 8 10-12h-9l1-8z',
  wind: 'M9.59 4.59A2 2 0 1111 8H2 M12.59 19.41A2 2 0 1014 16H2 M17.73 7.73A2.5 2.5 0 1119.5 12H2',
  snow: 'M12 2v20 M4.93 4.93l14.14 14.14 M2 12h20 M4.93 19.07L19.07 4.93',
};

const WEATHER_LABELS: Record<WeatherCondition, string> = {
  clear: 'Clear',
  sunny: 'Sunny',
  cloudy: 'Cloudy',
  rain: 'Rain',
  thunderstorm: 'Thunderstorm',
  lightning: 'Lightning',
  wind: 'Wind',
  snow: 'Snow',
};

// Card grid order — matches the feature's own list order. 'sunny' sits right next to 'clear',
// its own closest relative (same "no precipitation" family, different atmosphere).
const MANUAL_WEATHER_OPTIONS: WeatherCondition[] = ['clear', 'sunny', 'cloudy', 'rain', 'thunderstorm', 'lightning', 'wind', 'snow'];

// Only rain/thunderstorm/snow/wind actually have a particle-density/speed dial worth exposing —
// clear/sunny/cloudy/lightning have no "how much" to turn up.
const INTENSITY_RELEVANT: WeatherCondition[] = ['rain', 'thunderstorm', 'wind', 'snow'];

const INTENSITY_LEVELS: { key: WeatherIntensity; label: string }[] = [
  { key: 'light', label: 'Low' },
  { key: 'medium', label: 'Medium' },
  { key: 'heavy', label: 'High' },
];

interface ThrowSettingsScreenProps {
  onBack: () => void;
}

// 'account' folds the previously-separate Account Settings screen in here too, reached from the
// same gear icon as everything else — one settings surface instead of two, per explicit request
// not to leave users guessing which "Settings" has their profile/password vs. their paper color.
type Pane = 'settings' | 'editLocation' | 'account';
type ConfirmTarget = { connectionId: string; name: string; kind: 'remove' | 'block' };

/** Gear-icon destination from ThrowHomeScreen's header: location editing, pending friend
 * requests, per-friend remove/block, and the full Account Settings pane, all in one place instead
 * of the gear only reopening location setup and account stuff living on a separate screen. */
export function ThrowSettingsScreen({ onBack }: ThrowSettingsScreenProps) {
  const insets = useSafeAreaInsets();
  const { myLocation, locationVisibility, setLocationVisibility } = useThrow();
  const { friends, receivedRequests, sentRequests, acceptRequest, declineRequest, cancelRequest, removeFriend, blockFriend } = useFriends();
  const { mode: colorMode, setMode: setColorMode, mapMode, setMapMode, showMapBackground, setShowMapBackground } = useThrowColorMode();
  const {
    mode: weatherMode,
    setMode: setWeatherMode,
    manualCondition,
    setManualCondition,
    manualIntensity,
    setManualIntensity,
    reducedFlashing,
    setReducedFlashing,
  } = useThrowWeather();
  const [pane, setPane] = useState<Pane>('settings');
  const [confirmTarget, setConfirmTarget] = useState<ConfirmTarget | null>(null);
  const [colorModeSheetOpen, setColorModeSheetOpen] = useState(false);
  const [mapModeSheetOpen, setMapModeSheetOpen] = useState(false);
  const [visibilitySheetOpen, setVisibilitySheetOpen] = useState(false);
  const [intensitySheetOpen, setIntensitySheetOpen] = useState(false);
  const colorModeLabel = COLOR_MODES.find((m) => m.key === colorMode)?.label ?? 'Auto';
  const mapModeLabel = COLOR_MODES.find((m) => m.key === mapMode)?.label ?? 'Auto';
  const visibilityLabel = VISIBILITY_OPTIONS.find((v) => v.key === locationVisibility)?.label ?? 'Friends';
  const intensityLabel = INTENSITY_LEVELS.find((l) => l.key === manualIntensity)?.label ?? 'Medium';

  if (pane === 'editLocation') {
    return <ThrowLocationSetupScreen mode="edit" onDone={() => setPane('settings')} onBack={() => setPane('settings')} />;
  }

  if (pane === 'account') {
    return <AccountSettingsScreen onBack={() => setPane('settings')} />;
  }

  const confirm = () => {
    if (!confirmTarget) return;
    if (confirmTarget.kind === 'remove') removeFriend(confirmTarget.connectionId);
    else blockFriend(confirmTarget.connectionId);
    setConfirmTarget(null);
  };

  return (
    <View style={[styles.screen, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 20 }]}>
      <ThrowGlassBackdrop heightMultiplier={1.4} />
      <View style={styles.topRow}>
        <Pressable onPress={onBack} hitSlop={10} accessibilityRole="button" accessibilityLabel="Back">
          <Icon path={BACK_ICON} size={20} color={throwColor.inkSoft} strokeWidth={2} />
        </Pressable>
        <Text style={styles.title}>Throw Settings</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingTop: 14, paddingBottom: 24 }}>
        <Text style={styles.eyebrow}>ACCOUNT</Text>
        <Pressable onPress={() => setPane('account')}>
          <GlassSurface tint="light" tintColor={throwGlass.tint} style={styles.row}>
            <View style={styles.rowText}>
              <Text style={styles.rowName}>Account settings</Text>
              <Text style={styles.rowMeta}>Profile, password, shared spaces & data — not Throw-specific</Text>
            </View>
            <Text style={styles.editLabel}>Edit</Text>
          </GlassSurface>
        </Pressable>

        <Text style={styles.eyebrow}>LOCATION</Text>
        <Pressable onPress={() => setPane('editLocation')}>
          <GlassSurface tint="light" tintColor={throwGlass.tint} style={styles.row}>
            <View style={styles.rowText}>
              <Text style={styles.rowName}>{myLocation ? `${myLocation.city}, ${myLocation.country}` : 'Not set'}</Text>
              <Text style={styles.rowMeta}>Where your letters are thrown from</Text>
            </View>
            <Text style={styles.editLabel}>Edit</Text>
          </GlassSurface>
        </Pressable>
        <Pressable onPress={() => setVisibilitySheetOpen(true)}>
          <GlassSurface tint="light" tintColor={throwGlass.tint} style={styles.row}>
            <View style={styles.rowText}>
              <Text style={styles.rowName}>Who can see my location</Text>
              <Text style={styles.rowMeta}>Controls your pin on the Friends Map</Text>
            </View>
            <Text style={styles.editLabel}>{visibilityLabel}</Text>
          </GlassSurface>
        </Pressable>

        <Text style={styles.eyebrow}>APPEARANCE</Text>
        <Pressable onPress={() => setColorModeSheetOpen(true)}>
          <GlassSurface tint="light" tintColor={throwGlass.tint} style={styles.row}>
            <View style={styles.rowText}>
              <Text style={styles.rowName}>Paper & plane color</Text>
              <Text style={styles.rowMeta}>For the letter's paper and plane only — everywhere else in Throw keeps following the time as usual</Text>
            </View>
            <Text style={styles.editLabel}>{colorModeLabel}</Text>
          </GlassSurface>
        </Pressable>
        <Pressable onPress={() => setMapModeSheetOpen(true)}>
          <GlassSurface tint="light" tintColor={throwGlass.tint} style={styles.row}>
            <View style={styles.rowText}>
              <Text style={styles.rowName}>Map color</Text>
              <Text style={styles.rowMeta}>For the map's basemap and recipient carousel only — the letter's own paper/plane color is separate</Text>
            </View>
            <Text style={styles.editLabel}>{mapModeLabel}</Text>
          </GlassSurface>
        </Pressable>
        <Pressable onPress={() => setShowMapBackground(!showMapBackground)}>
          <GlassSurface tint="light" tintColor={throwGlass.tint} style={styles.row}>
            <View style={styles.rowText}>
              <Text style={styles.rowName}>Show Map Background</Text>
              <Text style={styles.rowMeta}>Uses your live location — costs more battery and data. Off shows a soft day/night background instead</Text>
            </View>
            <View style={[styles.toggleTrack, showMapBackground && styles.toggleTrackOn]}>
              <View style={[styles.toggleThumb, showMapBackground && styles.toggleThumbOn]} />
            </View>
          </GlassSurface>
        </Pressable>

        <Text style={styles.eyebrow}>WEATHER</Text>
        <Pressable onPress={() => setWeatherMode(weatherMode === 'automatic' ? 'manual' : 'automatic')}>
          <GlassSurface tint="light" tintColor={throwGlass.tint} style={styles.row}>
            <View style={styles.rowText}>
              <Text style={styles.rowName}>Automatic Weather</Text>
              <Text style={styles.rowMeta}>Based on the real weather at your Throw location</Text>
            </View>
            <View style={[styles.toggleTrack, weatherMode === 'automatic' && styles.toggleTrackOn]}>
              <View style={[styles.toggleThumb, weatherMode === 'automatic' && styles.toggleThumbOn]} />
            </View>
          </GlassSurface>
        </Pressable>

        {weatherMode === 'manual' && (
          <>
            <View style={styles.weatherGrid}>
              {MANUAL_WEATHER_OPTIONS.map((key) => {
                const selected = manualCondition === key;
                return (
                  <Pressable
                    key={key}
                    onPress={() => setManualCondition(key)}
                    accessibilityRole="button"
                    accessibilityLabel={`Weather — ${WEATHER_LABELS[key]}`}
                    style={[styles.weatherCard, selected && styles.weatherCardSelected]}
                  >
                    <Icon path={WEATHER_ICONS[key]} size={22} color={selected ? throwColor.activeBlue : throwColor.inkSoft} strokeWidth={2} />
                    <Text style={[styles.weatherCardLabel, selected && styles.weatherCardLabelSelected]} numberOfLines={1}>
                      {WEATHER_LABELS[key]}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {INTENSITY_RELEVANT.includes(manualCondition) && (
              <Pressable onPress={() => setIntensitySheetOpen(true)}>
                <GlassSurface tint="light" tintColor={throwGlass.tint} style={styles.row}>
                  <View style={styles.rowText}>
                    <Text style={styles.rowName}>Intensity</Text>
                    <Text style={styles.rowMeta}>How heavy {WEATHER_LABELS[manualCondition].toLowerCase()} looks</Text>
                  </View>
                  <Text style={styles.editLabel}>{intensityLabel}</Text>
                </GlassSurface>
              </Pressable>
            )}
          </>
        )}

        <Pressable onPress={() => setReducedFlashing(!reducedFlashing)}>
          <GlassSurface tint="light" tintColor={throwGlass.tint} style={styles.row}>
            <View style={styles.rowText}>
              <Text style={styles.rowName}>Reduce Flashing</Text>
              <Text style={styles.rowMeta}>Softer, dimmer lightning instead of a bright flash</Text>
            </View>
            <View style={[styles.toggleTrack, reducedFlashing && styles.toggleTrackOn]}>
              <View style={[styles.toggleThumb, reducedFlashing && styles.toggleThumbOn]} />
            </View>
          </GlassSurface>
        </Pressable>

        {(receivedRequests.length > 0 || sentRequests.length > 0) && (
          <>
            <Text style={styles.eyebrow}>FRIEND REQUESTS</Text>
            {receivedRequests.map((r) => (
              <GlassSurface key={r.connectionId} tint="light" tintColor={throwGlass.tint} style={styles.row}>
                <FriendAvatar userId={r.userId} name={r.name} avatarUrl={r.avatarUrl} size={40} />
                <View style={styles.rowText}>
                  <Text style={styles.rowName} numberOfLines={1}>
                    {r.name}
                  </Text>
                  <Text style={styles.rowMeta}>wants to be friends</Text>
                </View>
                <Pressable onPress={() => acceptRequest(r.connectionId)} style={styles.acceptButton} accessibilityRole="button" accessibilityLabel={`Accept ${r.name}`}>
                  <Text style={styles.acceptLabel}>Accept</Text>
                </Pressable>
                <Pressable onPress={() => declineRequest(r.connectionId)} style={styles.xButton} accessibilityRole="button" accessibilityLabel={`Decline ${r.name}`}>
                  <Text style={styles.xLabel}>✕</Text>
                </Pressable>
              </GlassSurface>
            ))}
            {sentRequests.map((r) => (
              <GlassSurface key={r.connectionId} tint="light" tintColor={throwGlass.tint} style={styles.row}>
                <FriendAvatar userId={r.userId} name={r.name} avatarUrl={r.avatarUrl} size={40} />
                <View style={styles.rowText}>
                  <Text style={styles.rowName} numberOfLines={1}>
                    {r.name}
                  </Text>
                  <Text style={styles.rowMeta}>Request sent · pending</Text>
                </View>
                <Pressable onPress={() => cancelRequest(r.connectionId)} style={styles.xButton} accessibilityRole="button" accessibilityLabel={`Cancel request to ${r.name}`}>
                  <Text style={styles.xLabel}>✕</Text>
                </Pressable>
              </GlassSurface>
            ))}
          </>
        )}

        <Text style={styles.eyebrow}>FRIENDS</Text>
        {friends.length === 0 ? (
          <Text style={styles.empty}>No friends yet.</Text>
        ) : (
          friends.map((f) => (
            <GlassSurface key={f.connectionId} tint="light" tintColor={throwGlass.tint} style={styles.row}>
              <FriendAvatar userId={f.userId} name={f.name} avatarUrl={f.avatarUrl} size={40} />
              <View style={styles.rowText}>
                <Text style={styles.rowName} numberOfLines={1}>
                  {f.name}
                </Text>
              </View>
              <Pressable
                onPress={() => setConfirmTarget({ connectionId: f.connectionId, name: f.name, kind: 'remove' })}
                style={styles.actionButton}
                accessibilityRole="button"
                accessibilityLabel={`Remove ${f.name}`}
              >
                <Text style={styles.actionLabel}>Remove</Text>
              </Pressable>
              <Pressable
                onPress={() => setConfirmTarget({ connectionId: f.connectionId, name: f.name, kind: 'block' })}
                style={styles.actionButtonDanger}
                accessibilityRole="button"
                accessibilityLabel={`Block ${f.name}`}
              >
                <Text style={styles.actionLabelDanger}>Block</Text>
              </Pressable>
            </GlassSurface>
          ))
        )}
      </ScrollView>

      <BottomSheet visible={colorModeSheetOpen} onClose={() => setColorModeSheetOpen(false)}>
        <Text style={styles.sheetTitle}>Paper & plane color</Text>
        {COLOR_MODES.map((opt, i) => {
          const active = colorMode === opt.key;
          return (
            <Pressable
              key={opt.key}
              onPress={() => {
                setColorMode(opt.key);
                setColorModeSheetOpen(false);
              }}
              accessibilityRole="button"
              accessibilityLabel={`Paper & plane color — ${opt.label}`}
              style={[styles.sheetOption, i !== COLOR_MODES.length - 1 && styles.sheetOptionDivider]}
            >
              <View style={styles.rowText}>
                <Text style={styles.rowName}>{opt.label}</Text>
                <Text style={styles.rowMeta}>{opt.description}</Text>
              </View>
              {active && <Icon path={CHECK_ICON} size={20} color={throwColor.clayDeep} strokeWidth={2.2} />}
            </Pressable>
          );
        })}
      </BottomSheet>

      <BottomSheet visible={mapModeSheetOpen} onClose={() => setMapModeSheetOpen(false)}>
        <Text style={styles.sheetTitle}>Map color</Text>
        {COLOR_MODES.map((opt, i) => {
          const active = mapMode === opt.key;
          return (
            <Pressable
              key={opt.key}
              onPress={() => {
                setMapMode(opt.key);
                setMapModeSheetOpen(false);
              }}
              accessibilityRole="button"
              accessibilityLabel={`Map color — ${opt.label}`}
              style={[styles.sheetOption, i !== COLOR_MODES.length - 1 && styles.sheetOptionDivider]}
            >
              <View style={styles.rowText}>
                <Text style={styles.rowName}>{opt.label}</Text>
                <Text style={styles.rowMeta}>{opt.description}</Text>
              </View>
              {active && <Icon path={CHECK_ICON} size={20} color={throwColor.clayDeep} strokeWidth={2.2} />}
            </Pressable>
          );
        })}
      </BottomSheet>

      <BottomSheet visible={visibilitySheetOpen} onClose={() => setVisibilitySheetOpen(false)}>
        <Text style={styles.sheetTitle}>Who can see my location</Text>
        {VISIBILITY_OPTIONS.map((opt, i) => {
          const active = locationVisibility === opt.key;
          return (
            <Pressable
              key={opt.key}
              onPress={() => {
                setLocationVisibility(opt.key);
                setVisibilitySheetOpen(false);
              }}
              accessibilityRole="button"
              accessibilityLabel={`Who can see my location — ${opt.label}`}
              style={[styles.sheetOption, i !== VISIBILITY_OPTIONS.length - 1 && styles.sheetOptionDivider]}
            >
              <View style={styles.rowText}>
                <Text style={styles.rowName}>{opt.label}</Text>
                <Text style={styles.rowMeta}>{opt.description}</Text>
              </View>
              {active && <Icon path={CHECK_ICON} size={20} color={throwColor.clayDeep} strokeWidth={2.2} />}
            </Pressable>
          );
        })}
      </BottomSheet>

      <BottomSheet visible={intensitySheetOpen} onClose={() => setIntensitySheetOpen(false)}>
        <Text style={styles.sheetTitle}>Intensity</Text>
        {INTENSITY_LEVELS.map((opt, i) => {
          const active = manualIntensity === opt.key;
          return (
            <Pressable
              key={opt.key}
              onPress={() => {
                setManualIntensity(opt.key);
                setIntensitySheetOpen(false);
              }}
              accessibilityRole="button"
              accessibilityLabel={`Intensity — ${opt.label}`}
              style={[styles.sheetOption, i !== INTENSITY_LEVELS.length - 1 && styles.sheetOptionDivider]}
            >
              <Text style={styles.rowName}>{opt.label}</Text>
              {active && <Icon path={CHECK_ICON} size={20} color={throwColor.clayDeep} strokeWidth={2.2} />}
            </Pressable>
          );
        })}
      </BottomSheet>

      <ConfirmDialog
        visible={confirmTarget !== null}
        title={confirmTarget ? (confirmTarget.kind === 'block' ? `Block ${confirmTarget.name}?` : `Remove ${confirmTarget.name}?`) : ''}
        message={
          confirmTarget?.kind === 'block'
            ? 'They will be removed as a friend and will not be able to send you a new request.'
            : "They'll be removed as a friend. You can add them again later."
        }
        confirmLabel={confirmTarget?.kind === 'block' ? 'Block' : 'Remove'}
        destructive
        onConfirm={confirm}
        onCancel={() => setConfirmTarget(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: throwColor.screenBg, paddingHorizontal: throwSpace.gutter },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  title: { fontFamily: throwFont.hand700, fontSize: 26, color: throwColor.ink },
  eyebrow: {
    marginTop: 22,
    marginBottom: 10,
    fontFamily: throwFont.ui700,
    fontSize: 11,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: throwColor.inkMute,
  },
  empty: { fontFamily: throwFont.ui400, fontSize: 13, color: throwColor.inkMute },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 8,
    borderRadius: throwRadius.card,
    borderWidth: 1,
    borderColor: throwGlass.border,
  },
  rowText: { flex: 1, gap: 2, minWidth: 0 },
  rowName: { fontFamily: throwFont.ui700, fontSize: 14, color: throwColor.ink },
  rowMeta: { fontFamily: throwFont.ui400, fontSize: 12, color: throwColor.inkSoft },
  editLabel: { fontFamily: throwFont.ui700, fontSize: 13, color: throwColor.clayDeep },
  sheetTitle: { fontFamily: throwFont.ui700, fontSize: 17, color: throwColor.ink, marginBottom: 8, textAlign: 'center' },
  sheetOption: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14 },
  sheetOptionDivider: { borderBottomWidth: 1, borderBottomColor: throwColor.cardBorder },
  acceptButton: { borderRadius: 999, backgroundColor: throwColor.clay, paddingVertical: 8, paddingHorizontal: 14 },
  acceptLabel: { fontFamily: throwFont.ui700, fontSize: 12.5, color: '#fff' },
  xButton: { width: 30, height: 30, borderRadius: 15, backgroundColor: throwColor.claySoft, alignItems: 'center', justifyContent: 'center' },
  xLabel: { fontFamily: throwFont.ui700, fontSize: 12.5, color: throwColor.clayDeep },
  actionButton: { borderRadius: 999, backgroundColor: throwColor.claySoft, paddingVertical: 7, paddingHorizontal: 11 },
  actionLabel: { fontFamily: throwFont.ui700, fontSize: 11.5, color: throwColor.clayDeep },
  actionButtonDanger: { borderRadius: 999, backgroundColor: '#B3413A', paddingVertical: 7, paddingHorizontal: 11 },
  actionLabelDanger: { fontFamily: throwFont.ui700, fontSize: 11.5, color: '#fff' },
  // A small pill toggle in Throw's own palette rather than RN's stock Switch, which reads as a
  // generic system control next to the rest of this screen's soft glass rows.
  toggleTrack: {
    width: 44,
    height: 26,
    borderRadius: 13,
    backgroundColor: throwColor.claySoft,
    padding: 2,
    justifyContent: 'center',
  },
  toggleTrackOn: { backgroundColor: throwColor.activeBlue },
  toggleThumb: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#FFFFFF',
    ...throwColor.shadowSoft,
  },
  toggleThumbOn: { alignSelf: 'flex-end' },
  // The manual weather picker — a compact card grid rather than a dropdown/list, per explicit
  // request, with a glowing blue border/icon on whichever card is selected (the same accent
  // RecipientCarousel's own "selected contact" pulse ring already uses, so "this is the active
  // pick" reads consistently across Throw rather than inventing a second accent color).
  weatherGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  weatherCard: {
    width: '22.5%',
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: throwRadius.card,
    borderWidth: 1,
    borderColor: throwGlass.border,
    backgroundColor: 'rgba(251,246,236,.5)',
  },
  weatherCardSelected: {
    borderWidth: 2,
    borderColor: throwColor.activeBlue,
    backgroundColor: throwColor.activeBlueSoft,
    shadowColor: throwColor.activeBlue,
    shadowOpacity: 0.35,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 },
    elevation: 3,
  },
  weatherCardLabel: { fontFamily: throwFont.ui600, fontSize: 10.5, color: throwColor.inkSoft, textAlign: 'center' },
  weatherCardLabelSelected: { color: throwColor.ink, fontFamily: throwFont.ui700 },
});
