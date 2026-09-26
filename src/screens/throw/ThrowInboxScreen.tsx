import React, { useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FriendAvatar } from '../../components/friends/FriendAvatar';
import { GlassSurface } from '../../components/friends/GlassSurface';
import { LetterCard } from '../../components/throw/LetterCard';
import { ThrowGlassBackdrop } from '../../components/throw/ThrowGlassBackdrop';
import { throwColor, throwFont, throwGlass, throwRadius, throwSpace } from '../../theme/throwTokens';
import { useThrow } from '../../context/ThrowContext';
import { useThrowAlerts } from '../../context/ThrowAlertsContext';
import { formatAlertSchedule } from '../../utils/throwAlerts';
import type { ThrowLetter } from '../../types/throw';

const REMINDERS_ID = '__reminders__';

interface ThrowInboxScreenProps {
  onBack: () => void;
  onOpenLetter: (throwId: string) => void;
}

interface ContactSummary {
  id: string;
  name: string;
  avatarUrl: string | null;
  count: number;
  latestAt: string;
  latestPreview: string;
}

function previewFor(letter: ThrowLetter): string {
  if (letter.messageText) return letter.messageText;
  if (letter.photoUrls.length > 0) return 'Sent a photo';
  return 'A handwritten letter';
}

/** Letters are grouped by who they're with — tapping a contact drills into just their letters —
 * rather than one long flat list mixing everyone together. */
export function ThrowInboxScreen({ onBack, onOpenLetter }: ThrowInboxScreenProps) {
  const insets = useSafeAreaInsets();
  const { letters, deleteThrow } = useThrow();
  const { alerts, deleteAlert } = useThrowAlerts();
  const [error, setError] = useState<string | null>(null);
  const [selectedContactId, setSelectedContactId] = useState<string | null>(null);

  const contacts = useMemo(() => {
    const map = new Map<string, ContactSummary>();
    for (const l of letters) {
      const existing = map.get(l.counterpartId);
      if (existing) {
        existing.count += 1;
        if (l.createdAt > existing.latestAt) {
          existing.latestAt = l.createdAt;
          existing.latestPreview = previewFor(l);
        }
      } else {
        map.set(l.counterpartId, { id: l.counterpartId, name: l.counterpartName, avatarUrl: l.counterpartAvatarUrl, count: 1, latestAt: l.createdAt, latestPreview: previewFor(l) });
      }
    }
    return Array.from(map.values()).sort((a, b) => (a.latestAt < b.latestAt ? 1 : -1));
  }, [letters]);

  // A pseudo-contact, not backed by any letter at all — every self-reminder created from the
  // Throw home screen's alert-schedule paper (see ThrowHomeScreen/AlertScheduleHeader) shows up
  // here instead, so there's one place to see and cancel them alongside real letters.
  const listData = useMemo<ContactSummary[]>(() => {
    if (alerts.length === 0) return contacts;
    const soonest = alerts[0];
    const reminders: ContactSummary = {
      id: REMINDERS_ID,
      name: 'Reminders',
      avatarUrl: null,
      count: alerts.length,
      latestAt: soonest.nextTriggerAt,
      latestPreview: soonest.messageText,
    };
    return [reminders, ...contacts];
  }, [contacts, alerts]);

  const selectedContact = contacts.find((c) => c.id === selectedContactId) ?? null;
  const contactLetters = useMemo(() => letters.filter((l) => l.counterpartId === selectedContactId), [letters, selectedContactId]);

  const handleDelete = async (throwId: string) => {
    setError(null);
    const { error: err } = await deleteThrow(throwId);
    if (err) setError(err);
  };

  const handleDeleteAlert = async (alertId: string) => {
    setError(null);
    const { error: err } = await deleteAlert(alertId);
    if (err) setError(err);
  };

  if (selectedContactId === REMINDERS_ID) {
    return (
      <View style={[styles.screen, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 20 }]}>
        <ThrowGlassBackdrop heightMultiplier={1.4} />
        <Pressable onPress={() => setSelectedContactId(null)} style={styles.backBtn}>
          <Text style={styles.backLabel}>‹ All contacts</Text>
        </Pressable>
        <Text style={styles.title}>Reminders</Text>
        {error && <Text style={styles.error}>{error}</Text>}

        <FlatList
          data={alerts}
          keyExtractor={(a) => a.id}
          contentContainerStyle={{ paddingTop: 14 }}
          renderItem={({ item }) => (
            <GlassSurface tint="light" tintColor={throwGlass.tint} style={styles.contactRow}>
              <View style={styles.rowText}>
                <Text style={styles.rowName} numberOfLines={1}>
                  {item.messageText}
                </Text>
                <Text style={styles.rowPreview} numberOfLines={1}>
                  {formatAlertSchedule({ recurrence: item.recurrence, hour: item.hour, minute: item.minute, daysOfWeek: item.daysOfWeek, dayOfMonth: item.dayOfMonth ?? 1 })}
                </Text>
              </View>
              <Pressable onPress={() => handleDeleteAlert(item.id)} hitSlop={10} accessibilityRole="button" accessibilityLabel="Delete reminder">
                <Text style={styles.deleteGlyph}>✕</Text>
              </Pressable>
            </GlassSurface>
          )}
          ListEmptyComponent={<Text style={styles.empty}>No reminders yet.</Text>}
        />
      </View>
    );
  }

  if (selectedContactId && selectedContact) {
    return (
      <View style={[styles.screen, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 20 }]}>
        <ThrowGlassBackdrop heightMultiplier={1.4} />
        <Pressable onPress={() => setSelectedContactId(null)} style={styles.backBtn}>
          <Text style={styles.backLabel}>‹ All contacts</Text>
        </Pressable>
        <Text style={styles.title}>{selectedContact.name}</Text>
        {error && <Text style={styles.error}>{error}</Text>}

        <FlatList
          data={contactLetters}
          keyExtractor={(l) => l.id}
          contentContainerStyle={{ paddingTop: 14 }}
          renderItem={({ item }) => <LetterCard letter={item} onPress={() => onOpenLetter(item.id)} onDelete={() => handleDelete(item.id)} />}
        />
      </View>
    );
  }

  return (
    <View style={[styles.screen, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 20 }]}>
      <ThrowGlassBackdrop heightMultiplier={1.4} />
      <Pressable onPress={onBack} style={styles.backBtn}>
        <Text style={styles.backLabel}>‹ Back to map</Text>
      </Pressable>
      <Text style={styles.title}>Throw Inbox</Text>

      <FlatList
        data={listData}
        keyExtractor={(c) => c.id}
        contentContainerStyle={{ paddingTop: 14 }}
        renderItem={({ item }) => (
          <Pressable onPress={() => setSelectedContactId(item.id)}>
            <GlassSurface tint="light" tintColor={throwGlass.tint} style={styles.contactRow}>
              <FriendAvatar userId={item.id} name={item.name} avatarUrl={item.avatarUrl} size={48} initialsFontSize={16} />
              <View style={styles.rowText}>
                <Text style={styles.rowName} numberOfLines={1}>
                  {item.name}
                </Text>
                <Text style={styles.rowPreview} numberOfLines={1}>
                  {item.latestPreview}
                </Text>
              </View>
              <View style={styles.countChip}>
                <Text style={styles.countText}>{item.count}</Text>
              </View>
            </GlassSurface>
          </Pressable>
        )}
        ListEmptyComponent={<Text style={styles.empty}>No letters yet — throw one to start your collection.</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: throwColor.screenBg, paddingHorizontal: throwSpace.gutter },
  backBtn: { marginBottom: 10 },
  backLabel: { fontFamily: throwFont.ui600, fontSize: 13.5, color: throwColor.inkSoft },
  title: { fontFamily: throwFont.hand700, fontSize: 28, color: throwColor.ink },
  error: { fontFamily: throwFont.ui400, fontSize: 12.5, color: '#B3413A', marginTop: 8 },
  empty: { fontFamily: throwFont.ui400, fontSize: 13.5, color: throwColor.inkMute, textAlign: 'center', marginTop: 40 },
  contactRow: {
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
  rowText: { flex: 1, gap: 3, minWidth: 0 },
  rowName: { fontFamily: throwFont.ui700, fontSize: 14.5, color: throwColor.ink },
  deleteGlyph: { fontFamily: throwFont.ui600, fontSize: 15, color: throwColor.inkMute, paddingHorizontal: 4 },
  rowPreview: { fontFamily: throwFont.hand500, fontSize: 15.5, color: throwColor.inkSoft },
  countChip: { minWidth: 22, height: 22, borderRadius: 11, backgroundColor: throwColor.claySoft, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  countText: { fontFamily: throwFont.ui700, fontSize: 11.5, color: throwColor.clayDeep },
});
