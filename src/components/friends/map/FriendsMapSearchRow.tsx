import React from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { fmColor, fmFont, fmLayout, fmShadow } from '../../../theme/friendsMapTokens';

const SEARCH_PATH = 'M20 20l-4-4';

/** Search pill + add-friend button — the handoff's own "Search row" (§4). */
export function FriendsMapSearchRow({ query, onChangeQuery, onAddFriend }: { query: string; onChangeQuery: (q: string) => void; onAddFriend: () => void }) {
  return (
    <View style={styles.row}>
      <View style={[styles.pill, fmShadow.soft]}>
        <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={fmColor.ink} strokeWidth={2} strokeLinecap="round">
          <Circle cx={11} cy={11} r={6.5} />
          <Path d={SEARCH_PATH} />
        </Svg>
        <TextInput
          value={query}
          onChangeText={onChangeQuery}
          placeholder="Search friends or cities"
          placeholderTextColor="rgba(22,33,12,0.42)"
          style={styles.input}
        />
      </View>
      <Pressable onPress={onAddFriend} style={[styles.addBtn, fmShadow.soft]} accessibilityRole="button" accessibilityLabel="Add a friend">
        <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={fmColor.lime} strokeWidth={1.9} strokeLinecap="round">
          <Circle cx={9} cy={8} r={3.2} />
          <Path d="M3.5 19a5.5 5.5 0 0 1 11 0" />
          <Path d="M18 8v6M15 11h6" />
        </Svg>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  pill: {
    flex: 1,
    height: fmLayout.searchPillH,
    borderRadius: fmLayout.searchPillH / 2,
    backgroundColor: fmColor.white,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
  },
  input: {
    flex: 1,
    minWidth: 0,
    fontFamily: fmFont.ui500,
    fontSize: 15,
    color: fmColor.ink,
    padding: 0,
  },
  addBtn: {
    width: fmLayout.addBtnSize,
    height: fmLayout.addBtnSize,
    borderRadius: fmLayout.addBtnSize / 2,
    backgroundColor: fmColor.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
