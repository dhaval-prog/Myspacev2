import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { scColor, scFont } from '../../theme/spaceCardsTokens';

/** The small 3-plate "someone else's hand" stack — used on the opponent's own stack and in their player pill. */
export function OpponentStack({ style }: { style?: object }) {
  return (
    <View style={[styles.wrap, style]}>
      <View style={styles.plateBack} />
      <View style={styles.plateMid} />
      <View style={styles.plateTop}>
        <Text style={styles.line1}>MY SPACE</Text>
        <Text style={styles.line2}>{'SPACE\nCARDS'}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: 40,
    height: 52,
  },
  plateBack: {
    position: 'absolute',
    left: 4,
    top: 2,
    width: 34,
    height: 48,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,.14)',
  },
  plateMid: {
    position: 'absolute',
    left: 2,
    top: 1,
    width: 34,
    height: 48,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,.2)',
  },
  plateTop: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: 34,
    height: 48,
    borderRadius: 8,
    backgroundColor: scColor.stackFace,
    borderWidth: 1.2,
    borderColor: 'rgba(195,234,79,.4)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 1,
  },
  line1: {
    fontFamily: scFont.sans700,
    fontSize: 4.5,
    letterSpacing: 4.5 * 0.06,
    color: scColor.lime,
  },
  line2: {
    fontFamily: scFont.sans800,
    fontSize: 6,
    lineHeight: 6.6,
    color: '#FFFFFF',
    textAlign: 'center',
  },
});
