import React, { useRef, useState } from 'react';
import { Animated, Modal, PanResponder, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { PanResponderGestureState } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fontFamily, spacing } from '../../theme';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import { AccountBadge } from '../../components/AccountBadge';
import { NotificationsBell } from '../../components/NotificationsBell';
import { NotificationsSheet } from '../../components/NotificationsSheet';
import { Icon } from '../../components/Icon';
import { initialsOf } from '../../components/split/MemberAvatar';
import { JoinSplitSheet } from '../../components/split/JoinSplitSheet';
import { BottomNav } from '../../components/BottomNav';
import { useAuth } from '../../context/AuthContext';
import { useSplit } from '../../context/SplitContext';
import { SPLIT_CATEGORY_MAP } from '../../data/splitCategories';

const DELETE_ICON = 'M4 7h16M9.5 7V4.5h5V7M6.5 7l1 13h9l1-13M10.5 10.5v6.5M13.5 10.5v6.5';
const REVEAL_WIDTH = 84;

interface SplitHomeScreenProps {
  onHome: () => void;
  onOpenExpenses: () => void;
  onOpenAccount: () => void;
}

/** The Split home: total balance across every split, then the list of your splits. */
export function SplitHomeScreen({ onHome, onOpenExpenses, onOpenAccount }: SplitHomeScreenProps) {
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const { user } = useAuth();
  const { groups, membersFor, expensesFor, balancesFor, goCreate, openGroup, deleteGroup } = useSplit();
  const [joinOpen, setJoinOpen] = useState(false);
  const [friendsOpen, setFriendsOpen] = useState(false);
  const [friendsTab, setFriendsTab] = useState<'nearby' | 'recent'>('nearby');
  const [revealedGroupId, setRevealedGroupId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const revealedGroupIdRef = useRef<string | null>(null);
  const dragXMap = useRef(new Map<string, Animated.Value>()).current;
  const responderCache = useRef(new Map<string, ReturnType<typeof PanResponder.create>>()).current;

  const dragXFor = (id: string) => {
    let v = dragXMap.get(id);
    if (!v) {
      v = new Animated.Value(0);
      dragXMap.set(id, v);
    }
    return v;
  };

  const closeRevealed = () => {
    if (revealedGroupIdRef.current) {
      Animated.spring(dragXFor(revealedGroupIdRef.current), { toValue: 0, useNativeDriver: true, bounciness: 0 }).start();
    }
    revealedGroupIdRef.current = null;
    setRevealedGroupId(null);
  };

  /** One PanResponder per group, cached for its lifetime so a re-render never hands react-native-web a fresh callback mid-gesture. */
  const panResponderFor = (id: string) => {
    const cached = responderCache.get(id);
    if (cached) return cached;

    let startValue = 0;
    const responder = PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_e, g: PanResponderGestureState) => Math.abs(g.dx) > 6 && Math.abs(g.dx) > Math.abs(g.dy),
      onPanResponderGrant: () => {
        if (revealedGroupIdRef.current && revealedGroupIdRef.current !== id) {
          Animated.spring(dragXFor(revealedGroupIdRef.current), { toValue: 0, useNativeDriver: true, bounciness: 0 }).start();
        }
        dragXFor(id).stopAnimation((v) => {
          startValue = v;
        });
      },
      onPanResponderMove: (_e, g: PanResponderGestureState) => {
        dragXFor(id).setValue(Math.min(0, Math.max(-REVEAL_WIDTH, startValue + g.dx)));
      },
      onPanResponderRelease: (_e, g: PanResponderGestureState) => {
        const next = Math.min(0, Math.max(-REVEAL_WIDTH, startValue + g.dx));
        const reveal = next < -REVEAL_WIDTH / 2;
        Animated.spring(dragXFor(id), { toValue: reveal ? -REVEAL_WIDTH : 0, useNativeDriver: true, bounciness: 0 }).start();
        revealedGroupIdRef.current = reveal ? id : null;
        setRevealedGroupId(reveal ? id : null);
      },
      onPanResponderTerminate: () => {
        Animated.spring(dragXFor(id), { toValue: 0, useNativeDriver: true, bounciness: 0 }).start();
      },
    });
    responderCache.set(id, responder);
    return responder;
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    const { id } = deleteTarget;
    setDeleteTarget(null);
    closeRevealed();
    await deleteGroup(id);
  };

  const totalBalance = groups.reduce((sum, g) => sum + balancesFor(g.id).reduce((s, b) => s + b.net, 0), 0);

  const peopleIds = new Set<string>();
  for (const g of groups) for (const m of membersFor(g.id)) if (m.userId !== user?.id) peopleIds.add(m.userId);
  const allPeople = Array.from(peopleIds).map((id) => groups.flatMap((g) => membersFor(g.id)).find((m) => m.userId === id)!);
  const people = allPeople.slice(0, 5);

  return (
    <View style={styles.screen}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + spacing.md }]}
      >
        <View style={styles.topRow}>
          <View style={styles.headerActions}>
            <NotificationsBell onPress={() => setNotificationsOpen(true)} bg={colors.splitSurface} tint={colors.splitInk} />
            <AccountBadge onPress={onOpenAccount} />
          </View>
        </View>

        <LinearGradient
          colors={colors.splitGradient as [string, string, ...string[]]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.hero}
        >
          <View style={styles.heroBlob} />
          <Text style={styles.heroLabel}>Total Balance</Text>
          <View style={styles.heroAmountRow}>
            <Text style={styles.heroCurrency}>₹</Text>
            <Text style={styles.heroAmount}>{Math.round(Math.abs(totalBalance)).toLocaleString('en-IN')}</Text>
          </View>
          {people.length > 0 && (
            <View style={styles.heroPeople}>
              {people.map((m, i) => (
                <View key={m.userId} style={[styles.heroPeopleTile, i > 0 && styles.heroPeopleTileStack]}>
                  <Text style={styles.heroPeopleInitials}>{initialsOf(m.name)}</Text>
                </View>
              ))}
              <Pressable
                onPress={() => setFriendsOpen((v) => !v)}
                style={[styles.heroPeopleTile, styles.heroPeopleTileStack, styles.heroPeoplePlus]}
                accessibilityRole="button"
                accessibilityLabel="Show members in this space"
              >
                <Text style={styles.heroPeoplePlusLabel}>+</Text>
              </Pressable>
            </View>
          )}
          <Pressable onPress={goCreate} style={({ pressed }) => [styles.heroCta, pressed && styles.heroCtaPressed]}>
            <Text style={styles.heroCtaLabel}>Let's Split</Text>
          </Pressable>
        </LinearGradient>

        {friendsOpen && (
          <View style={styles.friendsSection}>
            <View style={styles.friendsTabs}>
              <Pressable onPress={() => setFriendsTab('nearby')} accessibilityRole="button" accessibilityLabel="Member's In this Space">
                <Text style={[styles.friendsTab, friendsTab === 'nearby' && styles.friendsTabActive]}>Member's In this Space</Text>
              </Pressable>
              <Pressable onPress={() => setFriendsTab('recent')} accessibilityRole="button" accessibilityLabel="Recent">
                <Text style={[styles.friendsTab, friendsTab === 'recent' && styles.friendsTabActive]}>Recent</Text>
              </Pressable>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.friendsRow}>
              <Pressable
                onPress={() => setJoinOpen(true)}
                style={styles.friendItem}
                accessibilityRole="button"
                accessibilityLabel="Join a split with an invite code"
              >
                <View style={styles.friendAddTile}>
                  <Icon path="M12 6v12M6 12h12" color={colors.splitInk} size={26} strokeWidth={2} />
                </View>
                <Text style={styles.friendAddLabel}>Add</Text>
              </Pressable>
              {allPeople.map((m, i) => (
                <View key={m.userId} style={styles.friendItem}>
                  <View style={[styles.friendTile, i % 2 ? styles.friendTileB : styles.friendTileA]}>
                    <Text style={styles.friendTileText}>{initialsOf(m.name)}</Text>
                  </View>
                  <Text style={styles.friendName} numberOfLines={2}>
                    {m.name}
                  </Text>
                </View>
              ))}
            </ScrollView>
          </View>
        )}

        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>Your splits</Text>
          <Pressable onPress={() => setJoinOpen(true)} accessibilityRole="button" accessibilityLabel="Join a split with an invite code or scan a QR code">
            <Text style={styles.joinLink}>Have an invite code / Scan code?</Text>
          </Pressable>
        </View>

        {groups.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>No splits yet</Text>
            <Text style={styles.emptyBody}>Create one to start sharing expenses with people.</Text>
          </View>
        ) : (
          <View style={styles.list}>
            {groups.map((g, i) => {
              const featured = i === 0;
              const total = expensesFor(g.id).reduce((s, e) => s + e.amount, 0);
              const net = balancesFor(g.id).reduce((s, b) => s + b.net, 0);
              const memberCount = membersFor(g.id).length;
              const cat = SPLIT_CATEGORY_MAP[g.category] ?? SPLIT_CATEGORY_MAP.Custom;
              const statusLabel =
                net > 0.5 ? `You are owed ₹${Math.round(net).toLocaleString('en-IN')}` : net < -0.5 ? `You owe ₹${Math.round(-net).toLocaleString('en-IN')}` : 'All square';

              const content = (
                <>
                  <View style={styles.cardTopRow}>
                    <View style={[styles.cardIcon, featured ? styles.cardIconOn : styles.cardIconOff]}>
                      <Icon path={cat.icon} color={featured ? '#fff' : colors.splitAccent} size={20} strokeWidth={1.8} />
                    </View>
                    <Text style={[styles.cardName, featured && styles.cardNameOn]} numberOfLines={1}>
                      {g.name}
                    </Text>
                    <View style={[styles.cardBadge, featured && styles.cardBadgeOn]}>
                      <Text style={[styles.cardBadgeText, featured && styles.cardBadgeTextOn]}>
                        {memberCount} {memberCount === 1 ? 'member' : 'members'}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.cardBottomRow}>
                    <View>
                      <Text style={[styles.cardCaption, featured && styles.cardCaptionOn]}>Total spent</Text>
                      <Text style={[styles.cardTotal, featured && styles.cardTotalOn]}>₹{Math.round(total).toLocaleString('en-IN')}</Text>
                    </View>
                    <Text
                      style={[
                        styles.cardStatus,
                        featured
                          ? styles.cardStatusOn
                          : net > 0.5
                            ? styles.cardStatusPositive
                            : net < -0.5
                              ? styles.cardStatusNegative
                              : styles.cardStatusNeutral,
                      ]}
                    >
                      {statusLabel}
                    </Text>
                  </View>
                </>
              );

              const isRevealed = revealedGroupId === g.id;
              const handlePress = () => {
                if (isRevealed) closeRevealed();
                else openGroup(g.id);
              };
              const handleLongPress = g.isOwner ? () => setDeleteTarget({ id: g.id, name: g.name }) : undefined;

              const cardBody = featured ? (
                <Pressable
                  onPress={handlePress}
                  onLongPress={handleLongPress}
                  delayLongPress={450}
                  style={({ pressed }) => [pressed && !reduceMotion && styles.cardPressed]}
                >
                  <LinearGradient
                    colors={colors.splitGradient as [string, string, ...string[]]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={[styles.card, styles.cardFeatured]}
                  >
                    {content}
                  </LinearGradient>
                </Pressable>
              ) : (
                <Pressable
                  onPress={handlePress}
                  onLongPress={handleLongPress}
                  delayLongPress={450}
                  style={({ pressed }) => [styles.card, styles.cardPlain, pressed && !reduceMotion && styles.cardPressed]}
                >
                  {content}
                </Pressable>
              );

              if (!g.isOwner) {
                return <View key={g.id}>{cardBody}</View>;
              }

              return (
                <View key={g.id} style={styles.swipeWrap}>
                  <Pressable
                    onPress={() => setDeleteTarget({ id: g.id, name: g.name })}
                    style={styles.swipeDelete}
                    accessibilityRole="button"
                    accessibilityLabel={`Delete ${g.name}`}
                  >
                    <Icon path={DELETE_ICON} color="#fff" size={19} strokeWidth={2} />
                    <Text style={styles.swipeDeleteLabel}>Delete</Text>
                  </Pressable>
                  <Animated.View style={{ transform: [{ translateX: dragXFor(g.id) }] }} {...panResponderFor(g.id).panHandlers}>
                    {cardBody}
                  </Animated.View>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>

      <BottomNav
        activeId="split"
        onSelect={(id) => {
          if (id === 'home') onHome();
          if (id === 'expenses') onOpenExpenses();
        }}
        onAdd={goCreate}
        bottomInset={insets.bottom}
        reduceMotion={reduceMotion}
      />
      <JoinSplitSheet visible={joinOpen} onClose={() => setJoinOpen(false)} />
      <NotificationsSheet visible={notificationsOpen} onClose={() => setNotificationsOpen(false)} />

      <Modal visible={!!deleteTarget} transparent animationType="fade" onRequestClose={() => setDeleteTarget(null)}>
        <View style={styles.deleteModalWrap}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setDeleteTarget(null)} accessibilityRole="button" accessibilityLabel="Dismiss" />
          <View style={styles.deleteModalCard}>
            <Text style={styles.deleteModalTitle}>Delete {deleteTarget?.name}?</Text>
            <Text style={styles.deleteModalBody}>
              All expenses, chat, and history in this split will be deleted permanently for everyone. This can't be undone.
            </Text>
            <View style={styles.deleteModalActions}>
              <Pressable onPress={() => setDeleteTarget(null)} style={styles.deleteModalCancel}>
                <Text style={styles.deleteModalCancelLabel}>Cancel</Text>
              </Pressable>
              <Pressable onPress={confirmDelete} style={styles.deleteModalConfirm}>
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
  scroll: {
    paddingHorizontal: spacing.xxxl,
    paddingBottom: 120,
    gap: spacing.xxl,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.ms,
  },
  hero: {
    borderRadius: 34,
    paddingHorizontal: spacing.xxl,
    paddingTop: spacing.xxl,
    paddingBottom: spacing.xl,
    alignItems: 'center',
    gap: 9,
    overflow: 'hidden',
    shadowColor: colors.splitAccent,
    shadowOpacity: 0.35,
    shadowOffset: { width: 0, height: 20 },
    shadowRadius: 44,
    elevation: 6,
  },
  heroBlob: {
    position: 'absolute',
    right: -46,
    top: -40,
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: 'rgba(255,255,255,.24)',
  },
  heroLabel: {
    fontFamily: fontFamily.sans500,
    fontSize: 15,
    color: 'rgba(255,255,255,.82)',
  },
  heroAmountRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
  },
  heroCurrency: {
    fontFamily: fontFamily.sans500,
    fontSize: 24,
    color: '#fff',
  },
  heroAmount: {
    fontFamily: fontFamily.sans700,
    fontSize: 38,
    letterSpacing: -1,
    color: '#fff',
  },
  heroPeople: {
    flexDirection: 'row',
    marginTop: 4,
  },
  heroPeopleTile: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,.92)',
    borderWidth: 2.5,
    borderColor: colors.splitAccent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroPeopleTileStack: {
    marginLeft: -13,
  },
  heroPeopleInitials: {
    fontFamily: fontFamily.sans600,
    fontSize: 12.5,
    color: colors.splitInk,
  },
  heroPeoplePlus: {
    backgroundColor: colors.splitAccent,
  },
  heroPeoplePlusLabel: {
    fontFamily: fontFamily.sans400,
    fontSize: 18,
    color: '#fff',
  },
  heroCta: {
    marginTop: 2,
    width: 196,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,.26)',
    paddingVertical: 13,
    alignItems: 'center',
  },
  heroCtaPressed: {
    backgroundColor: 'rgba(255,255,255,.36)',
  },
  heroCtaLabel: {
    fontFamily: fontFamily.sans600,
    fontSize: 16,
    color: '#fff',
  },
  friendsSection: {
    gap: 14,
  },
  friendsTabs: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 20,
  },
  friendsTab: {
    fontFamily: fontFamily.sans500,
    fontSize: 16,
    letterSpacing: -0.16,
    color: 'rgba(27,42,99,.38)',
  },
  friendsTabActive: {
    fontFamily: fontFamily.sans700,
    color: colors.splitInk,
  },
  friendsRow: {
    gap: 12,
    paddingBottom: 4,
  },
  friendItem: {
    flexShrink: 0,
    alignItems: 'center',
    gap: 8,
    width: 84,
  },
  friendAddTile: {
    width: 84,
    height: 84,
    borderRadius: 26,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: 'rgba(27,42,99,.28)',
    backgroundColor: 'rgba(255,255,255,.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  friendAddLabel: {
    fontFamily: fontFamily.sans500,
    fontSize: 13,
    color: colors.splitInkFaint6,
  },
  friendTile: {
    width: 84,
    height: 84,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.splitInk,
    shadowOpacity: 0.09,
    shadowOffset: { width: 0, height: 12 },
    shadowRadius: 26,
    elevation: 2,
  },
  friendTileA: {
    backgroundColor: colors.splitAccentSoftBg,
  },
  friendTileB: {
    backgroundColor: '#E9EAFB',
  },
  friendTileText: {
    fontFamily: fontFamily.sans700,
    fontSize: 20,
    color: colors.splitInk,
  },
  friendName: {
    fontFamily: fontFamily.sans600,
    fontSize: 13,
    lineHeight: 17,
    color: colors.splitInk,
    textAlign: 'center',
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    fontFamily: fontFamily.sans700,
    fontSize: 19,
    letterSpacing: -0.2,
    color: colors.splitInk,
  },
  joinLink: {
    fontFamily: fontFamily.sans600,
    fontSize: 12.5,
    color: colors.splitAccent,
  },
  empty: {
    borderRadius: 24,
    backgroundColor: colors.splitSurface,
    padding: spacing.xxl,
    alignItems: 'center',
    gap: 6,
  },
  emptyTitle: {
    fontFamily: fontFamily.sans600,
    fontSize: 15,
    color: colors.splitInk,
  },
  emptyBody: {
    fontFamily: fontFamily.sans400,
    fontSize: 13,
    color: colors.splitInkFaint45,
    textAlign: 'center',
  },
  list: {
    gap: spacing.ms,
  },
  card: {
    borderRadius: 28,
    paddingVertical: 20,
    paddingHorizontal: 22,
    gap: 14,
    overflow: 'hidden',
  },
  cardPlain: {
    backgroundColor: colors.splitSurface,
    shadowColor: colors.splitInk,
    shadowOpacity: 0.07,
    shadowOffset: { width: 0, height: 12 },
    shadowRadius: 26,
    elevation: 2,
  },
  cardFeatured: {
    shadowColor: colors.splitAccent,
    shadowOpacity: 0.3,
    shadowOffset: { width: 0, height: 18 },
    shadowRadius: 38,
    elevation: 6,
  },
  cardPressed: {
    opacity: 0.85,
  },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.ms,
  },
  cardIcon: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardIconOff: {
    backgroundColor: colors.splitAccentSoftBg,
  },
  cardIconOn: {
    backgroundColor: 'rgba(255,255,255,.24)',
  },
  cardName: {
    flex: 1,
    fontFamily: fontFamily.sans700,
    fontSize: 19,
    letterSpacing: -0.2,
    color: colors.splitInk,
  },
  cardNameOn: {
    color: '#fff',
  },
  cardBadge: {
    borderRadius: 999,
    backgroundColor: '#F2F2F7',
    paddingHorizontal: 11,
    paddingVertical: 6,
  },
  cardBadgeOn: {
    backgroundColor: 'rgba(255,255,255,.24)',
  },
  cardBadgeText: {
    fontFamily: fontFamily.sans500,
    fontSize: 11.5,
    color: colors.splitInkFaint5,
  },
  cardBadgeTextOn: {
    color: '#fff',
  },
  cardBottomRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: spacing.ms,
  },
  cardCaption: {
    fontFamily: fontFamily.sans500,
    fontSize: 11.5,
    color: colors.splitInkFaint45,
    marginBottom: 2,
  },
  cardCaptionOn: {
    color: 'rgba(255,255,255,.8)',
  },
  cardTotal: {
    fontFamily: fontFamily.sans700,
    fontSize: 24,
    letterSpacing: -0.2,
    color: colors.splitInk,
  },
  cardTotalOn: {
    color: '#fff',
  },
  cardStatus: {
    fontFamily: fontFamily.sans600,
    fontSize: 12.5,
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 999,
    overflow: 'hidden',
  },
  cardStatusOn: {
    backgroundColor: 'rgba(255,255,255,.22)',
    color: '#fff',
  },
  cardStatusPositive: {
    backgroundColor: colors.splitPositiveBg,
    color: colors.splitPositiveFg,
  },
  cardStatusNegative: {
    backgroundColor: colors.splitAccentSoftBg,
    color: colors.splitDangerFg,
  },
  cardStatusNeutral: {
    backgroundColor: '#F2F2F7',
    color: colors.splitInkFaint5,
  },
  swipeWrap: {
    position: 'relative',
  },
  swipeDelete: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 28,
    backgroundColor: colors.splitDangerFg,
    flexDirection: 'column',
    alignItems: 'flex-end',
    justifyContent: 'center',
    gap: 4,
    paddingRight: 26,
  },
  swipeDeleteLabel: {
    fontFamily: fontFamily.sans600,
    fontSize: 12,
    color: '#fff',
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
