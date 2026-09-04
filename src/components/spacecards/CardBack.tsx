import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { scColor, scFont } from '../../theme/spaceCardsTokens';

/** The deck / draw pile back — the MySpace wordmark plate, exactly per §2. */
export function CardBack({ style }: { style?: object }) {
  return (
    <View style={[styles.plate, style]}>
      <Text style={styles.line1}>MY SPACE</Text>
      <Text style={styles.line2}>{'SPACE\nCARDS'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  plate: {
    width: 56,
    height: 78,
    borderRadius: 11,
    backgroundColor: scColor.cardBack,
    borderWidth: 1.4,
    borderColor: 'rgba(255,255,255,.18)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  line1: {
    fontFamily: scFont.sans700,
    fontSize: 6,
    letterSpacing: 6 * 0.08,
    color: scColor.lime,
  },
  line2: {
    fontFamily: scFont.sans800,
    fontSize: 9,
    lineHeight: 9.9,
    color: '#FFFFFF',
    textAlign: 'center',
  },
});
