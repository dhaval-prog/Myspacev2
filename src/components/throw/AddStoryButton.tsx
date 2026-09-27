import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Icon } from '../Icon';
import { throwColor, throwNightColor } from '../../theme/throwTokens';

const SIZE = 56;
const BADGE_SIZE = 20;
// Feather Icons' "user" glyph — a plain person silhouette, matching the reference screenshot's
// dark circle-with-person button rather than a generic camera icon.
const PERSON_ICON = 'M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2 M12 11a4 4 0 100-8 4 4 0 000 8z';
const PLUS_ICON = 'M12 5v14M5 12h14';

interface AddStoryButtonProps {
  onPress: () => void;
  /** True while the user is actually viewing/posting their own Status — draws the same subtle
   * inner border a selected real contact gets (see RecipientCarousel's own avatarSelected), so
   * this slot visibly reads as "the current selection" instead of a real contact looking selected
   * while Status is what's actually showing. */
  selected?: boolean;
  isNight?: boolean;
}

/** Opens the story capture flow (camera → photo/video, or pick from the library) — sits to the
 * left of the recipient carousel's top row, always visible regardless of who's selected, per
 * explicit request with its own reference screenshot (a dark circle, person glyph, small green
 * "+" badge). */
export function AddStoryButton({ onPress, selected, isNight }: AddStoryButtonProps) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel="Add to your story" hitSlop={8}>
      {({ pressed }) => (
        <View style={[styles.circle, selected && (isNight ? styles.circleSelectedNight : styles.circleSelected), pressed && styles.pressed]}>
          <Icon path={PERSON_ICON} size={26} color="rgba(255,255,255,.75)" strokeWidth={1.8} />
          <View style={styles.badge}>
            <Icon path={PLUS_ICON} size={12} color={throwColor.ink} strokeWidth={2.4} />
          </View>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  circle: {
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    backgroundColor: throwColor.ink,
    alignItems: 'center',
    justifyContent: 'center',
    ...throwColor.shadowSoft,
  },
  pressed: { opacity: 0.85 },
  circleSelected: { borderWidth: 2, borderColor: throwColor.inkFaint },
  circleSelectedNight: { borderWidth: 2, borderColor: throwNightColor.ink },
  badge: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: BADGE_SIZE,
    height: BADGE_SIZE,
    borderRadius: BADGE_SIZE / 2,
    backgroundColor: throwColor.storyRing,
    borderWidth: 2,
    borderColor: throwColor.paper,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
