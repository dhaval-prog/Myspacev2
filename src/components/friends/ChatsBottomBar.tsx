import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { colors, fontFamily } from '../../theme';
import { Icon } from '../Icon';

const SPLIT_ICON = 'M12 4v16M17 8H10a2.5 2.5 0 0 0 0 5h4a2.5 2.5 0 0 1 0 5H7';
const GAMES_ICON = 'M7 8h10a4 4 0 0 1 4 4v1a3 3 0 0 1-5.4 1.8L14.5 13h-5l-1.1 1.8A3 3 0 0 1 3 13v-1a4 4 0 0 1 4-4z';
const CHATS_TAB_ICON = 'M20 11.5a7.5 7.5 0 0 1-10.7 6.8L4 19.5l1.3-4.9A7.5 7.5 0 1 1 20 11.5z';
const MAP_TAB_ICON = 'M12 21s-6-5.6-6-11a6 6 0 0 1 12 0c0 5.4-6 11-6 11z';
const ME_TAB_ICON = 'M5 20a7 7 0 0 1 14 0';
const PLANE_BODY = 'M4 30 L60 8 L38 58 L30 36 Z';
const PLANE_WING = 'M30 36 L60 8 L22 40 Z';
const THROW_TAB_ICON = 'M22 2L11 13 M22 2L15 22L11 13L2 9L22 2Z';

/** The center Throw button's two-tone plane fill, lime-on-ink (day) or ink-on-lime (night) — same glyph `LetterPlaneGlyph` draws, inlined here since this is a fixed 24px button icon rather than an animated flight. */
function ThrowPlaneGlyph({ bodyFill, wingFill }: { bodyFill: string; wingFill: string }) {
  return (
    <Svg width={24} height={24} viewBox="0 0 64 64">
      <Path d={PLANE_BODY} fill={bodyFill} />
      <Path d={PLANE_WING} fill={wingFill} />
    </Svg>
  );
}

interface ChatsBottomBarProps {
  isDay: boolean;
  /** Which tab reads as active — defaults to 'chats' (every existing call site but the Map screen
   * itself leaves this unset). */
  activeTab?: 'chats' | 'map';
  onOpenThrow: () => void;
  onOpenExpenses: () => void;
  onOpenGames: () => void;
  onOpenAccount: () => void;
  /** Returns to the Chats list — only reachable from the Map screen's own "Chats" tab; every other
   * screen using this bar is already the Chats list, so its own "Chats" tab has nothing to do. */
  onOpenChats?: () => void;
  /** Opens the real Friends Map screen — falls back to `onOpenThrow` (Map used to just alias to
   * Throw, which already showed a map) wherever a caller hasn't been updated to pass this yet. */
  onOpenMap?: () => void;
  /** Hides the floating Throw/Split/Games quick-action pill — the Map screen's own design has no
   * equivalent row, just the menu bar underneath it. Defaults to true (every other screen). */
  showQuickActions?: boolean;
}

/**
 * The Chats list's bottom chrome (MySpace Chats Throw handoff, §"Bottom of the chat list") — a
 * floating quick-action pill (Throw/Split/Games map onto this app's existing Throw/Expenses/Games
 * destinations; the handoff's own Camera/Voice buttons were dropped — no screen for them to open)
 * and the Chats/Throw/Map/Me menu bar, also reused as-is by the Friends Map screen (with the quick
 * actions hidden and "Map" the active tab instead). Docked outside the scroll view (unlike the
 * handoff's own inline placement) so it never scrolls away, matching every other screen's
 * bottom-dock convention. Me still has no dedicated screen — it opens account settings.
 */
export function ChatsBottomBar({
  isDay,
  activeTab = 'chats',
  onOpenThrow,
  onOpenExpenses,
  onOpenGames,
  onOpenAccount,
  onOpenChats,
  onOpenMap,
  showQuickActions = true,
}: ChatsBottomBarProps) {
  const dim = isDay ? colors.ink50 : 'rgba(237,253,255,0.5)';
  const circleBg = isDay ? 'rgba(22,33,12,0.06)' : 'rgba(237,253,255,0.08)';
  const circleIcon = isDay ? colors.ink : colors.pale;

  return (
    <View>
      {showQuickActions && (
        <View style={styles.quickWrap}>
          <View style={[styles.quickPill, isDay ? styles.quickPillDay : styles.quickPillNight]}>
            <Pressable
              onPress={onOpenThrow}
              style={[styles.circle54, { backgroundColor: isDay ? colors.ink : colors.lime }]}
              accessibilityRole="button"
              accessibilityLabel="Throw"
            >
              <ThrowPlaneGlyph bodyFill={isDay ? colors.lime : colors.ink} wingFill={isDay ? '#8FB52E' : '#3B5222'} />
            </Pressable>
            <Pressable onPress={onOpenExpenses} style={[styles.circle44, { backgroundColor: circleBg }]} accessibilityRole="button" accessibilityLabel="Split">
              <Icon path={SPLIT_ICON} color={circleIcon} size={20} strokeWidth={1.9} />
            </Pressable>
            <Pressable onPress={onOpenGames} style={[styles.circle44, { backgroundColor: circleBg }]} accessibilityRole="button" accessibilityLabel="Games">
              <Icon path={GAMES_ICON} color={circleIcon} size={21} strokeWidth={1.8} />
            </Pressable>
          </View>
        </View>
      )}

      <View style={[styles.menuBar, isDay ? styles.menuBarDay : styles.menuBarNight]}>
        <MenuTab icon={CHATS_TAB_ICON} label="Chats" active={activeTab === 'chats'} isDay={isDay} onPress={onOpenChats} />
        <MenuTab icon={THROW_TAB_ICON} label="Throw" isDay={isDay} onPress={onOpenThrow} strokeWidth={4.5} viewBox="0 0 64 64" />
        <MenuTab
          icon={MAP_TAB_ICON}
          label="Map"
          active={activeTab === 'map'}
          isDay={isDay}
          onPress={onOpenMap ?? onOpenThrow}
          pathExtra={<Circle cx={12} cy={10} r={2.2} stroke={dim} strokeWidth={1.8} />}
        />
        <MenuTab icon={ME_TAB_ICON} label="Me" isDay={isDay} onPress={onOpenAccount} pathExtra={<Circle cx={12} cy={8} r={3.5} stroke={dim} strokeWidth={1.8} />} />
      </View>
    </View>
  );
}

function MenuTab({
  icon,
  label,
  active,
  isDay,
  onPress,
  strokeWidth = 1.8,
  viewBox = '0 0 24 24',
  pathExtra,
}: {
  icon: string;
  label: string;
  active?: boolean;
  isDay: boolean;
  onPress?: () => void;
  strokeWidth?: number;
  viewBox?: string;
  pathExtra?: React.ReactNode;
}) {
  const activeColor = isDay ? colors.ink : colors.lime;
  const inactiveColor = isDay ? colors.ink50 : 'rgba(237,253,255,0.5)';
  const color = active ? activeColor : inactiveColor;
  const pillBg = active ? (isDay ? colors.lime : 'rgba(195,234,79,0.16)') : 'transparent';
  return (
    <Pressable onPress={onPress} style={styles.tab} accessibilityRole="tab" accessibilityState={{ selected: !!active }} accessibilityLabel={label}>
      <View style={[styles.tabPill, { backgroundColor: pillBg }]}>
        <Svg width={22} height={22} viewBox={viewBox} fill="none">
          <Path d={icon} stroke={color} fill="none" strokeWidth={strokeWidth} strokeLinejoin="round" strokeLinecap="round" />
          {pathExtra}
        </Svg>
      </View>
      <Text style={[styles.tabLabel, { color }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  quickWrap: {
    alignItems: 'center',
    paddingBottom: 10,
  },
  quickPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 6,
    borderRadius: 999,
  },
  quickPillDay: {
    backgroundColor: 'rgba(255,255,255,0.82)',
    shadowColor: colors.ink,
    shadowOpacity: 0.14,
    shadowOffset: { width: 0, height: 10 },
    shadowRadius: 26,
    elevation: 2,
  },
  quickPillNight: {
    backgroundColor: 'rgba(237,253,255,0.07)',
    borderWidth: 1,
    borderColor: 'rgba(237,253,255,0.1)',
  },
  circle44: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  circle54: {
    width: 54,
    height: 54,
    borderRadius: 27,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuBar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingTop: 8,
    paddingBottom: 10,
    borderTopWidth: 1,
  },
  menuBarDay: {
    backgroundColor: 'rgba(255,255,255,0.76)',
    borderTopColor: 'rgba(22,33,12,0.08)',
  },
  menuBarNight: {
    backgroundColor: 'rgba(11,17,6,0.75)',
    borderTopColor: 'rgba(237,253,255,0.07)',
  },
  tab: {
    alignItems: 'center',
    gap: 3,
  },
  tabPill: {
    width: 52,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabLabel: {
    fontFamily: fontFamily.sans700,
    fontSize: 10.5,
  },
});
