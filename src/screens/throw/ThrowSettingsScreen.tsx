import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FriendAvatar } from '../../components/friends/FriendAvatar';
import { GlassSurface } from '../../components/friends/GlassSurface';
import { Icon } from '../../components/Icon';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { ThrowGlassBackdrop } from '../../components/throw/ThrowGlassBackdrop';
import { ThrowLocationSetupScreen } from './ThrowLocationSetupScreen';
import { BottomSheet } from '../../components/expenses/BottomSheet';
import { throwColor, throwFont, throwGlass, throwRadius, throwSpace } from '../../theme/throwTokens';
import { useThrow } from '../../context/ThrowContext';
import { useFriends } from '../../context/FriendsContext';
import { useThrowColorMode, type ThrowColorMode } from '../../context/ThrowColorModeContext';
import { useThrowWeather } from '../../context/ThrowWeatherContext';
import type { WeatherMode } from '../../types/weather';

const BACK_ICON = 'M15 18l-6-6 6-6';
const CHECK_ICON = 'M5 13l4 4L19 7';

const COLOR_MODES: { key: ThrowColorMode; label: string; description: string }[] = [
  { key: 'auto', label: 'Auto', description: "Follows your device's clock (day/night)" },
  { key: 'day', label: 'Day', description: 'Always the day look' },
  { key: 'night', label: 'Night', description: 'Always the night look' },
];

// Only two entries today, but the same shape COLOR_MODES already uses (and the same BottomSheet
// list-with-checkmark rendering below) — adding a third mode later, if that ever makes sense,
// wouldn't need a new UI pattern.
const WEATHER_MODES: { key: WeatherMode; label: string; description: string }[] = [
  { key: 'automatic', label: 'Automatic', description: 'Based on your Throw location' },
  { key: 'manual', label: 'Manual', description: 'Pick a weather effect yourself' },
];

interface ThrowSettingsScreenProps {
  onBack: () => void;
}

type Pane = 'settings' | 'editLocation';
type ConfirmTarget = { connectionId: string; name: string; kind: 'remove' | 'block' };

/** Gear-icon destination from ThrowHomeScreen's header: location editing, pending friend
 * requests, and per-friend remove/block, all in one place instead of the gear just reopening
 * location setup. */
export function ThrowSettingsScreen({ onBack }: ThrowSettingsScreenProps) {
  const insets = useSafeAreaInsets();
  const { myLocation } = useThrow();
  const { friends, receivedRequests, sentRequests, acceptRequest, declineRequest, cancelRequest, removeFriend, blockFriend } = useFriends();
  const { mode: colorMode, setMode: setColorMode, mapMode, setMapMode } = useThrowColorMode();
  const { mode: weatherMode, setMode: setWeatherMode, manualCondition, setManualCondition } = useThrowWeather();
  const [pane, setPane] = useState<Pane>('settings');
  const [confirmTarget, setConfirmTarget] = useState<ConfirmTarget | null>(null);
  const [colorModeSheetOpen, setColorModeSheetOpen] = useState(false);
  const [mapModeSheetOpen, setMapModeSheetOpen] = useState(false);
  const [weatherModeSheetOpen, setWeatherModeSheetOpen] = useState(false);
  const colorModeLabel = COLOR_MODES.find((m) => m.key === colorMode)?.label ?? 'Auto';
  const mapModeLabel = COLOR_MODES.find((m) => m.key === mapMode)?.label ?? 'Auto';
  const weatherModeLabel = WEATHER_MODES.find((m) => m.key === weatherMode)?.label ?? 'Automatic';
  const manualRainOn = manualCondition === 'rain';

  if (pane === 'editLocation') {
    return <ThrowLocationSetupScreen mode="edit" onDone={() => setPane('settings')} onBack={() => setPane('settings')} />;
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

        <Text style={styles.eyebrow}>WEATHER</Text>
        <Pressable onPress={() => setWeatherModeSheetOpen(true)}>
          <GlassSurface tint="light" tintColor={throwGlass.tint} style={styles.row}>
            <View style={styles.rowText}>
              <Text style={styles.rowName}>Weather</Text>
              <Text style={styles.rowMeta}>Adds a rain effect over the map when it's actually raining where you are</Text>
            </View>
            <Text style={styles.editLabel}>{weatherModeLabel}</Text>
          </GlassSurface>
        </Pressable>
        {weatherMode === 'manual' && (
          // Only "Rain" exists to pick today (see WeatherCondition's own doc comment for why the
          // type already covers more) — a plain on/off row rather than another BottomSheet list,
          // since there's nothing yet to pick *between*.
          <Pressable onPress={() => setManualCondition(manualRainOn ? 'clear' : 'rain')}>
            <GlassSurface tint="light" tintColor={throwGlass.tint} style={styles.row}>
              <View style={styles.rowText}>
                <Text style={styles.rowName}>Rain</Text>
                <Text style={styles.rowMeta}>Starts right away, regardless of the actual weather</Text>
              </View>
              <Text style={styles.editLabel}>{manualRainOn ? 'On' : 'Off'}</Text>
            </GlassSurface>
          </Pressable>
        )}

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

      <BottomSheet visible={weatherModeSheetOpen} onClose={() => setWeatherModeSheetOpen(false)}>
        <Text style={styles.sheetTitle}>Weather</Text>
        {WEATHER_MODES.map((opt, i) => {
          const active = weatherMode === opt.key;
          return (
            <Pressable
              key={opt.key}
              onPress={() => {
                setWeatherMode(opt.key);
                setWeatherModeSheetOpen(false);
              }}
              accessibilityRole="button"
              accessibilityLabel={`Weather — ${opt.label}`}
              style={[styles.sheetOption, i !== WEATHER_MODES.length - 1 && styles.sheetOptionDivider]}
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
});
