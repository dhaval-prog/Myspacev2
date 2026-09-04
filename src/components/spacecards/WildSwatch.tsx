import React from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import { SC_COLOUR_HEX } from '../../theme/spaceCardsTokens';

/**
 * The wild card's four-colour split, as a 2x2 quadrant grid — RN has no
 * conic-gradient, and this carries the same "any colour" meaning. Renders
 * at whatever size/shape `style` gives it (e.g. `StyleSheet.absoluteFill`
 * inside an already-sized, rounded, overflow:hidden wrapper).
 */
export function WildSwatch({ style }: { style?: StyleProp<ViewStyle> }) {
  return (
    <View style={style}>
      <View style={{ flex: 1, flexDirection: 'row' }}>
        <View style={{ flex: 1, backgroundColor: SC_COLOUR_HEX.ember }} />
        <View style={{ flex: 1, backgroundColor: SC_COLOUR_HEX.tide }} />
      </View>
      <View style={{ flex: 1, flexDirection: 'row' }}>
        <View style={{ flex: 1, backgroundColor: SC_COLOUR_HEX.moss }} />
        <View style={{ flex: 1, backgroundColor: SC_COLOUR_HEX.solar }} />
      </View>
    </View>
  );
}
