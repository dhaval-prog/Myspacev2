import React, { useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DropBackdrop } from '../../components/drop/DropBackdrop';
import { DropCard } from '../../components/drop/DropCard';
import { DropPress } from '../../components/drop/DropPress';
import { DropBtn } from '../../components/drop/DropBtn';
import { DropTok } from '../../components/drop/DropTok';
import { Kick, Serif } from '../../components/drop/DropText';
import { useDrop } from '../../context/DropContext';
import { dpColor, dpFont, dpGradient, dpSpace } from '../../theme/dropTokens';

interface DropPairingScreenProps {
  onHome: () => void;
  onPaired: () => void;
}

/** Replaces Parallax's invite-code pairing with a friend picker, since MySpace already has a friend graph. */
export function DropPairingScreen({ onHome, onPaired }: DropPairingScreenProps) {
  const insets = useSafeAreaInsets();
  const { incomingProposals, outgoingProposal, eligibleFriends, proposePartner, acceptProposal, declineProposal } = useDrop();
  const [busyId, setBusyId] = useState<string | null>(null);

  const handlePropose = async (friendUserId: string) => {
    setBusyId(friendUserId);
    await proposePartner(friendUserId);
    setBusyId(null);
  };

  const handleAccept = async (pairId: string) => {
    setBusyId(pairId);
    const { error } = await acceptProposal(pairId);
    setBusyId(null);
    if (!error) onPaired();
  };

  const handleDecline = async (pairId: string) => {
    setBusyId(pairId);
    await declineProposal(pairId);
    setBusyId(null);
  };

  return (
    <LinearGradient colors={dpGradient.dawn.colors} locations={dpGradient.dawn.locations} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.screen}>
      <DropBackdrop />
      <FlatList
        style={{ paddingTop: insets.top + 24 }}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 40 }]}
        ListHeaderComponent={
          <>
            <Kick>drop</Kick>
            <Serif s={34} style={{ marginTop: 4, marginBottom: 10 }}>
              Choose your person.
            </Serif>
            <Text style={styles.subhead}>Every day you'll get the same 3 prompts — answer for yourself, guess theirs. Pick one friend to Drop with.</Text>

            {incomingProposals.length > 0 && (
              <View style={{ marginTop: 24, gap: 10 }}>
                <Kick>waiting on you</Kick>
                {incomingProposals.map((p) => (
                  <DropCard key={p.id} style={styles.row}>
                    <DropTok who={{ initial: p.other.initial, name: p.other.name }} size={40} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.rowTitle}>{p.other.name} wants to Drop with you</Text>
                    </View>
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                      <DropPress onPress={() => handleDecline(p.id)} style={styles.smallBtnSoft} disabled={busyId === p.id}>
                        <Text style={styles.smallBtnSoftLabel}>Decline</Text>
                      </DropPress>
                      <DropPress onPress={() => handleAccept(p.id)} style={styles.smallBtnDeep} disabled={busyId === p.id}>
                        <Text style={styles.smallBtnDeepLabel}>Accept</Text>
                      </DropPress>
                    </View>
                  </DropCard>
                ))}
              </View>
            )}

            {outgoingProposal && (
              <DropCard style={[styles.row, { marginTop: 24 }]}>
                <DropTok who={{ initial: outgoingProposal.other.initial, name: outgoingProposal.other.name }} size={40} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowTitle}>Waiting for {outgoingProposal.other.name}</Text>
                  <Text style={styles.rowSub}>They'll see your invite the next time they open Drop.</Text>
                </View>
                <DropPress onPress={() => handleDecline(outgoingProposal.id)} style={styles.smallBtnSoft}>
                  <Text style={styles.smallBtnSoftLabel}>Cancel</Text>
                </DropPress>
              </DropCard>
            )}

            {!outgoingProposal && <Kick style={{ marginTop: 24, marginBottom: 4 }}>your friends</Kick>}
          </>
        }
        data={outgoingProposal ? [] : eligibleFriends}
        keyExtractor={(item) => item.userId}
        renderItem={({ item }) => (
          <DropPress onPress={() => handlePropose(item.userId)} disabled={busyId === item.userId}>
            <DropCard style={[styles.row, { marginBottom: 10 }]}>
              <DropTok who={{ initial: (item.name.trim()[0] ?? '?').toUpperCase(), name: item.name }} size={40} />
              <Text style={[styles.rowTitle, { flex: 1 }]}>{item.name}</Text>
              <Text style={styles.propose}>{busyId === item.userId ? '...' : 'Invite'}</Text>
            </DropCard>
          </DropPress>
        )}
        ListEmptyComponent={
          !outgoingProposal ? (
            <Text style={styles.emptyText}>No friends to invite yet — add friends in Orbit first, then come back here.</Text>
          ) : null
        }
        ListFooterComponent={<DropBtn kind="soft" onPress={onHome} style={{ marginTop: 24 }}>Back to home</DropBtn>}
      />
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { paddingHorizontal: dpSpace.gutter },
  subhead: { fontFamily: dpFont.ui400, fontSize: 14.5, color: dpColor.inkSoft, lineHeight: 14.5 * 1.5 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 20 },
  rowTitle: { fontFamily: dpFont.ui700, fontSize: 14.5, color: dpColor.ink },
  rowSub: { fontFamily: dpFont.ui400, fontSize: 12, color: dpColor.inkSoft, marginTop: 2 },
  propose: { fontFamily: dpFont.ui700, fontSize: 13, color: dpColor.p2Deep },
  smallBtnSoft: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 999, backgroundColor: dpColor.sunken },
  smallBtnSoftLabel: { fontFamily: dpFont.ui600, fontSize: 12.5, color: dpColor.ink },
  smallBtnDeep: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 999, backgroundColor: dpColor.p2Deep },
  smallBtnDeepLabel: { fontFamily: dpFont.ui600, fontSize: 12.5, color: '#fff' },
  emptyText: { fontFamily: dpFont.ui400, fontSize: 13.5, color: dpColor.inkSoft, textAlign: 'center', marginTop: 20, lineHeight: 13.5 * 1.5 },
});
