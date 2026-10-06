import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { fmColor, fmFont, fmLayout, fmRadius } from '../../../theme/friendsMapTokens';
import { FriendAvatar } from '../FriendAvatar';

const PLANE_BODY = 'M4 30 L60 8 L38 58 L30 36 Z';
const PLANE_WING = 'M30 36 L60 8 L22 40 Z';
const CHAT_ICON = 'M20 11.5a7.5 7.5 0 0 1-10.7 6.8L4 19.5l1.3-4.9A7.5 7.5 0 1 1 20 11.5z';
const DIRECTIONS_ICON = 'M12 3l8 18-8-4-8 4z';
const CLOSE_ICON = 'M6 6l12 12M18 6L6 18';

export interface FriendsMapListCard {
  userId: string;
  name: string;
  avatarUrl?: string | null;
  subtitle: string;
  live: boolean;
  distanceLabel: string;
  agoLabel: string;
  onPress: () => void;
}

export interface FriendsMapDetail {
  userId: string;
  name: string;
  avatarUrl?: string | null;
  live: boolean;
  area: string;
  statusLabel: string;
  distanceLabel: string;
  etaLabel: string;
  onThrow: () => void;
  onChat: () => void;
  onDirections: () => void;
}

interface FriendsMapSheetProps {
  listTitle: string;
  cards: FriendsMapListCard[];
  detail: FriendsMapDetail | null;
  onCloseDetail: () => void;
}

/** The bottom sheet — list mode (horizontal nearest-first cards) when nothing is selected, detail
 * mode (stat tiles + actions) once a pin/card is tapped. Sits just above the nav bar, matching
 * the handoff's own §6. */
export function FriendsMapSheet({ listTitle, cards, detail, onCloseDetail }: FriendsMapSheetProps) {
  return (
    <View style={styles.sheet}>
      <View style={styles.handle} />
      {detail ? (
        <View style={styles.detailWrap}>
          <View style={styles.detailHeaderRow}>
            <View style={styles.detailAvatarWrap}>
              <FriendAvatar userId={detail.userId} name={detail.name} avatarUrl={detail.avatarUrl} size={fmLayout.detailAvatarSize} initialsFontSize={18} />
              {detail.live && <View style={styles.detailLiveDot} />}
            </View>
            <View style={styles.detailTextCol}>
              <Text style={styles.detailName} numberOfLines={1}>
                {detail.name}
              </Text>
              <Text style={styles.detailArea} numberOfLines={1}>
                {detail.area}
              </Text>
              <Text style={[styles.detailStatus, { color: detail.live ? fmColor.readGreen : 'rgba(22,33,12,0.5)' }]} numberOfLines={1}>
                {detail.statusLabel}
              </Text>
            </View>
            <Pressable onPress={onCloseDetail} style={styles.closeBtn} accessibilityRole="button" accessibilityLabel="Close">
              <Svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke={fmColor.ink} strokeWidth={2.4} strokeLinecap="round">
                <Path d={CLOSE_ICON} />
              </Svg>
            </Pressable>
          </View>

          <View style={styles.statRow}>
            <View style={styles.statTile}>
              <Text style={styles.statLabel}>AWAY</Text>
              <Text style={styles.statValue}>{detail.distanceLabel}</Text>
            </View>
            <View style={styles.statTile}>
              <Text style={styles.statLabel}>A PLANE TAKES</Text>
              <Text style={styles.statValue}>{detail.etaLabel}</Text>
            </View>
          </View>

          <View style={styles.actionRow}>
            <Pressable onPress={detail.onThrow} style={styles.throwBtn} accessibilityRole="button" accessibilityLabel="Throw">
              <Svg width={18} height={18} viewBox="0 0 64 64">
                <Path d={PLANE_BODY} fill={fmColor.lime} />
                <Path d={PLANE_WING} fill={fmColor.limeDark} />
              </Svg>
              <Text style={styles.throwLabel}>Throw</Text>
            </Pressable>
            <Pressable onPress={detail.onChat} style={styles.chatBtn} accessibilityRole="button" accessibilityLabel="Chat">
              <Svg width={17} height={17} viewBox="0 0 24 24" fill="none" stroke={fmColor.ink} strokeWidth={1.9} strokeLinejoin="round">
                <Path d={CHAT_ICON} />
              </Svg>
              <Text style={styles.chatLabel}>Chat</Text>
            </Pressable>
            <Pressable onPress={detail.onDirections} style={styles.directionsBtn} accessibilityRole="button" accessibilityLabel="Directions">
              <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={fmColor.ink} strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round">
                <Path d={DIRECTIONS_ICON} />
              </Svg>
            </Pressable>
          </View>
        </View>
      ) : (
        <>
          <View style={styles.listHeaderRow}>
            <Text style={styles.listTitle}>{listTitle}</Text>
            <Text style={styles.listSub}>NEAREST FIRST</Text>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.cardsRow}>
            {cards.map((c) => (
              <Pressable key={c.userId} onPress={c.onPress} style={styles.card}>
                <View style={styles.cardAvatarWrap}>
                  <FriendAvatar userId={c.userId} name={c.name} avatarUrl={c.avatarUrl} size={fmLayout.listAvatarSize} initialsFontSize={13} />
                  {c.live && <View style={styles.cardLiveDot} />}
                </View>
                <View style={styles.cardTextCol}>
                  <Text style={styles.cardName} numberOfLines={1}>
                    {c.name}
                  </Text>
                  <Text style={styles.cardSubtitle} numberOfLines={1}>
                    {c.subtitle}
                  </Text>
                </View>
                <View style={styles.cardMetaRow}>
                  <Text style={styles.cardDist}>{c.distanceLabel}</Text>
                  <Text style={[styles.cardAgo, { color: c.live ? fmColor.readGreen : 'rgba(22,33,12,0.5)' }]}>{c.agoLabel}</Text>
                </View>
              </Pressable>
            ))}
          </ScrollView>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: {
    backgroundColor: fmColor.sheetCream,
    borderTopLeftRadius: fmRadius.sheetTop,
    borderTopRightRadius: fmRadius.sheetTop,
    paddingTop: 10,
    paddingBottom: 14,
    shadowColor: fmColor.ink,
    shadowOpacity: 0.12,
    shadowOffset: { width: 0, height: -10 },
    shadowRadius: 30,
  },
  handle: { width: fmLayout.sheetHandleW, height: fmLayout.sheetHandleH, borderRadius: 3, backgroundColor: 'rgba(22,33,12,0.18)', alignSelf: 'center', marginBottom: 12 },
  listHeaderRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 12 },
  listTitle: { fontFamily: fmFont.ui700, fontSize: 18, letterSpacing: -0.4, color: fmColor.ink },
  listSub: { fontFamily: fmFont.mono500, fontSize: 11, letterSpacing: 0.6, color: 'rgba(22,33,12,0.5)' },
  cardsRow: { gap: 10, paddingHorizontal: 20, paddingBottom: 2 },
  card: { width: fmLayout.listCardW, borderRadius: fmRadius.card, backgroundColor: fmColor.white, padding: 12, gap: 8, shadowColor: fmColor.ink, shadowOpacity: 0.06, shadowOffset: { width: 0, height: 4 }, shadowRadius: 12 },
  cardAvatarWrap: { width: fmLayout.listAvatarSize, height: fmLayout.listAvatarSize },
  cardLiveDot: { position: 'absolute', right: -2, bottom: -2, width: 14, height: 14, borderRadius: 7, backgroundColor: fmColor.lime, borderWidth: 2.5, borderColor: fmColor.white },
  cardTextCol: { gap: 1, width: '100%' },
  cardName: { fontFamily: fmFont.ui600, fontSize: 14, color: fmColor.ink },
  cardSubtitle: { fontFamily: fmFont.ui400, fontSize: 12, color: 'rgba(22,33,12,0.6)' },
  cardMetaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: '100%' },
  cardDist: { fontFamily: fmFont.mono500, fontSize: 11, fontWeight: '600', color: fmColor.ink },
  cardAgo: { fontFamily: fmFont.mono500, fontSize: 10 },

  detailWrap: { paddingHorizontal: 20, gap: 14 },
  detailHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  detailAvatarWrap: { width: fmLayout.detailAvatarSize, height: fmLayout.detailAvatarSize },
  detailLiveDot: { position: 'absolute', right: -1, bottom: -1, width: 18, height: 18, borderRadius: 9, backgroundColor: fmColor.lime, borderWidth: 3, borderColor: fmColor.sheetCream },
  detailTextCol: { flex: 1, minWidth: 0, gap: 2 },
  detailName: { fontFamily: fmFont.ui700, fontSize: 19, letterSpacing: -0.4, color: fmColor.ink },
  detailArea: { fontFamily: fmFont.ui500, fontSize: 13, color: 'rgba(22,33,12,0.65)' },
  detailStatus: { fontFamily: fmFont.mono500, fontSize: 11, letterSpacing: 0.4 },
  closeBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(22,33,12,0.07)', alignItems: 'center', justifyContent: 'center' },
  statRow: { flexDirection: 'row', gap: 8 },
  statTile: { flex: 1, borderRadius: 16, backgroundColor: fmColor.white, paddingVertical: 10, paddingHorizontal: 12, gap: 2 },
  statLabel: { fontFamily: fmFont.mono500, fontSize: 9.5, letterSpacing: 1, color: 'rgba(22,33,12,0.5)' },
  statValue: { fontFamily: fmFont.ui700, fontSize: 15, color: fmColor.ink },
  actionRow: { flexDirection: 'row', gap: 8 },
  throwBtn: { flex: 1.4, height: 48, borderRadius: 24, backgroundColor: fmColor.ink, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  throwLabel: { fontFamily: fmFont.ui700, fontSize: 14.5, color: fmColor.lime },
  chatBtn: { flex: 1, height: 48, borderRadius: 24, backgroundColor: fmColor.white, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  chatLabel: { fontFamily: fmFont.ui600, fontSize: 14, color: fmColor.ink },
  directionsBtn: { width: 48, height: 48, borderRadius: 24, backgroundColor: fmColor.white, alignItems: 'center', justifyContent: 'center' },
});
