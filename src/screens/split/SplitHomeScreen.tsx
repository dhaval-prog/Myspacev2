import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fontFamily, spacing } from '../../theme';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import { Icon } from '../../components/Icon';
import { initialsOf } from '../../components/split/MemberAvatar';
import { JoinSplitSheet } from '../../components/split/JoinSplitSheet';
import { BottomNav } from '../../components/BottomNav';
import { useAuth } from '../../context/AuthContext';
import { useSplit } from '../../context/SplitContext';
import { SPLIT_CATEGORY_MAP } from '../../data/splitCategories';

interface SplitHomeScreenProps {
  onHome: () => void;
  onOpenExpenses: () => void;
}

/** The Split home: total balance across every split, then the list of your splits. */
export function SplitHomeScreen({ onHome, onOpenExpenses }: SplitHomeScreenProps) {
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const { user } = useAuth();
  const { groups, membersFor, expensesFor, balancesFor, goCreate, openGroup } = useSplit();
  const [joinOpen, setJoinOpen] = useState(false);

  const meInitials = (user?.user_metadata?.full_name ?? user?.email ?? 'You').trim().slice(0, 2).toUpperCase();

  const totalBalance = groups.reduce((sum, g) => sum + balancesFor(g.id).reduce((s, b) => s + b.net, 0), 0);

  const peopleIds = new Set<string>();
  for (const g of groups) for (const m of membersFor(g.id)) if (m.userId !== user?.id) peopleIds.add(m.userId);
  const people = Array.from(peopleIds)
    .slice(0, 5)
    .map((id) => groups.flatMap((g) => membersFor(g.id)).find((m) => m.userId === id)!);

  return (
    <View style={styles.screen}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + spacing.md }]}
      >
        <View style={styles.topRow}>
          <Pressable style={styles.roundButton} accessibilityRole="button" accessibilityLabel="Notifications">
            <Icon path="M6 8v8M12 5v14M18 9v6" color={colors.splitInk} size={20} strokeWidth={2} />
          </Pressable>
          <View style={styles.meAvatar}>
            <Text style={styles.meAvatarText}>{meInitials}</Text>
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
                onPress={() => setJoinOpen(true)}
                style={[styles.heroPeopleTile, styles.heroPeopleTileStack, styles.heroPeoplePlus]}
                accessibilityRole="button"
                accessibilityLabel="Join a split with an invite code"
              >
                <Text style={styles.heroPeoplePlusLabel}>+</Text>
              </Pressable>
            </View>
          )}
          <Pressable onPress={goCreate} style={({ pressed }) => [styles.heroCta, pressed && styles.heroCtaPressed]}>
            <Text style={styles.heroCtaLabel}>Let's Split</Text>
          </Pressable>
        </LinearGradient>

        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>Your splits</Text>
          <Pressable onPress={() => setJoinOpen(true)} accessibilityRole="button" accessibilityLabel="Join a split with an invite code">
            <Text style={styles.joinLink}>Have an invite code?</Text>
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
              const cat = SPLIT_CATEGORY_MAP[g.category] ?? SPLIT_CATEGORY_MAP.Other;
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

              if (featured) {
                return (
                  <Pressable key={g.id} onPress={() => openGroup(g.id)} style={({ pressed }) => [pressed && !reduceMotion && styles.cardPressed]}>
                    <LinearGradient
                      colors={colors.splitGradient as [string, string, ...string[]]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={[styles.card, styles.cardFeatured]}
                    >
                      {content}
                    </LinearGradient>
                  </Pressable>
                );
              }
              return (
                <Pressable
                  key={g.id}
                  onPress={() => openGroup(g.id)}
                  style={({ pressed }) => [styles.card, styles.cardPlain, pressed && !reduceMotion && styles.cardPressed]}
                >
                  {content}
                </Pressable>
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
    justifyContent: 'space-between',
  },
  roundButton: {
    width: 50,
    height: 50,
    borderRadius: 16,
    backgroundColor: colors.splitSurface,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.splitInk,
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 18,
    elevation: 2,
  },
  meAvatar: {
    width: 50,
    height: 50,
    borderRadius: 16,
    backgroundColor: colors.splitAccentSoftBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  meAvatarText: {
    fontFamily: fontFamily.sans700,
    fontSize: 15,
    color: colors.splitInk,
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
});
