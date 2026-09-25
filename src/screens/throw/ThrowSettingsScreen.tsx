import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FriendAvatar } from '../../components/friends/FriendAvatar';
import { GlassSurface } from '../../components/friends/GlassSurface';
import { Icon } from '../../components/Icon';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { ThrowGlassBackdrop } from '../../components/throw/ThrowGlassBackdrop';
import { ThrowLocationSetupScreen } from './ThrowLocationSetupScreen';
import { throwColor, throwFont, throwGlass, throwRadius, throwSpace } from '../../theme/throwTokens';
import { useThrow } from '../../context/ThrowContext';
import { useFriends } from '../../context/FriendsContext';

const BACK_ICON = 'M15 18l-6-6 6-6';

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
  const [pane, setPane] = useState<Pane>('settings');
  const [confirmTarget, setConfirmTarget] = useState<ConfirmTarget | null>(null);

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
  acceptButton: { borderRadius: 999, backgroundColor: throwColor.clay, paddingVertical: 8, paddingHorizontal: 14 },
  acceptLabel: { fontFamily: throwFont.ui700, fontSize: 12.5, color: '#fff' },
  xButton: { width: 30, height: 30, borderRadius: 15, backgroundColor: throwColor.claySoft, alignItems: 'center', justifyContent: 'center' },
  xLabel: { fontFamily: throwFont.ui700, fontSize: 12.5, color: throwColor.clayDeep },
  actionButton: { borderRadius: 999, backgroundColor: throwColor.claySoft, paddingVertical: 7, paddingHorizontal: 11 },
  actionLabel: { fontFamily: throwFont.ui700, fontSize: 11.5, color: throwColor.clayDeep },
  actionButtonDanger: { borderRadius: 999, backgroundColor: '#B3413A', paddingVertical: 7, paddingHorizontal: 11 },
  actionLabelDanger: { fontFamily: throwFont.ui700, fontSize: 11.5, color: '#fff' },
});
