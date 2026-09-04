import React, { useEffect, useRef, useState } from 'react';
import { Animated, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Icon } from '../Icon';
import { SC_COLOURS, SC_COLOUR_HEX, SC_COLOUR_LABEL, scColor, scFont, scGeometry, type ScColourName } from '../../theme/spaceCardsTokens';
import { WildSwatch } from './WildSwatch';

const CHECK_ICON = 'M5 13l4.5 4.5L19 7';

const TILE_RADII: Record<ScColourName, string> = {
  // top-left, top-right, bottom-right, bottom-left — 12px on each tile's inner corner.
  ember: '34px 34px 12px 34px',
  tide: '34px 34px 34px 12px',
  solar: '12px 34px 34px 34px',
  moss: '34px 12px 34px 34px',
};

const TILE_POSITION: Record<ScColourName, { top?: number; bottom?: number; left?: number; right?: number; align: 'flex-start' | 'flex-end'; justify: 'flex-start' | 'flex-end' }> = {
  ember: { top: 0, left: 0, align: 'flex-start', justify: 'flex-start' },
  tide: { top: 0, right: 0, align: 'flex-end', justify: 'flex-start' },
  moss: { bottom: 0, left: 0, align: 'flex-start', justify: 'flex-end' },
  solar: { bottom: 0, right: 0, align: 'flex-end', justify: 'flex-end' },
};

function radiusStyle(spec: string) {
  const [a, b, c, d] = spec.split(' ').map((v) => parseInt(v, 10));
  return { borderTopLeftRadius: a, borderTopRightRadius: b, borderBottomRightRadius: c, borderBottomLeftRadius: d };
}

interface ColourWheelProps {
  visible: boolean;
  onLockColour: (colour: ScColourName) => void;
  onCancel: () => void;
  reduceMotion?: boolean;
}

export function ColourWheel({ visible, onLockColour, onCancel, reduceMotion }: ColourWheelProps) {
  const [selected, setSelected] = useState<ScColourName | null>(null);
  const scrim = useRef(new Animated.Value(0)).current;
  const tileAnims = useRef(SC_COLOURS.map(() => new Animated.Value(0))).current;
  const hubAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) {
      setSelected(null);
      return;
    }
    if (reduceMotion) {
      scrim.setValue(1);
      tileAnims.forEach((a) => a.setValue(1));
      hubAnim.setValue(1);
      return;
    }
    scrim.setValue(0);
    tileAnims.forEach((a) => a.setValue(0));
    hubAnim.setValue(0);
    Animated.timing(scrim, { toValue: 1, duration: 300, useNativeDriver: true }).start();
    Animated.stagger(
      65,
      tileAnims.map((a) => Animated.timing(a, { toValue: 1, duration: 440, useNativeDriver: true })),
    ).start();
    const t = setTimeout(() => {
      Animated.timing(hubAnim, { toValue: 1, duration: 300, useNativeDriver: true }).start();
    }, 240);
    return () => clearTimeout(t);
  }, [visible, reduceMotion, scrim, tileAnims, hubAnim]);

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onCancel}>
      <Animated.View style={[styles.scrim, { opacity: scrim }]}>
        <View style={styles.column}>
          <Text style={styles.label}>YOU PLAYED A WILD +4</Text>

          <View style={{ width: scGeometry.wheelTile * 2 + 24, height: scGeometry.wheelTile * 2 + 24 }}>
            {SC_COLOURS.map((colour, i) => {
              const pos = TILE_POSITION[colour];
              const isSelected = selected === colour;
              const dim = selected !== null && !isSelected;
              const scaleIn = tileAnims[i].interpolate({ inputRange: [0, 0.6, 1], outputRange: [0.42, 1.04, 1] });
              return (
                <Animated.View
                  key={colour}
                  style={{
                    position: 'absolute',
                    top: pos.top,
                    bottom: pos.bottom,
                    left: pos.left,
                    right: pos.right,
                    opacity: Animated.multiply(tileAnims[i], dim ? 0.5 : 1),
                    transform: [{ scale: isSelected ? 1.06 : scaleIn }],
                  }}
                >
                  <Pressable
                    onPress={() => setSelected(colour)}
                    accessibilityRole="button"
                    accessibilityLabel={SC_COLOUR_LABEL[colour]}
                    style={[
                      styles.tile,
                      radiusStyle(TILE_RADII[colour]),
                      {
                        backgroundColor: SC_COLOUR_HEX[colour],
                        alignItems: pos.align,
                        justifyContent: pos.justify,
                        shadowColor: SC_COLOUR_HEX[colour],
                      },
                      isSelected && styles.tileSelected,
                    ]}
                  >
                    <Text style={styles.tileLabel}>{SC_COLOUR_LABEL[colour]}</Text>
                    {isSelected ? (
                      <View style={styles.checkBadge}>
                        <Icon path={CHECK_ICON} color="#FFFFFF" size={13} strokeWidth={3.4} />
                      </View>
                    ) : null}
                  </Pressable>
                </Animated.View>
              );
            })}

            <Animated.View
              style={[
                styles.hub,
                {
                  opacity: hubAnim,
                  transform: [
                    { translateX: -32 },
                    { translateY: -45 },
                    { scale: hubAnim.interpolate({ inputRange: [0, 0.65, 1], outputRange: [0.7, 1.06, 1] }) },
                  ],
                },
              ]}
            >
              <WildSwatch style={styles.hubOval} />
              <Text style={styles.hubLabel}>+4</Text>
            </Animated.View>
          </View>

          <Pressable
            disabled={!selected}
            onPress={() => selected && onLockColour(selected)}
            style={[styles.confirm, selected && styles.confirmActive]}
            accessibilityRole="button"
            accessibilityLabel={selected ? `Lock in ${SC_COLOUR_LABEL[selected]}` : 'Pick a colour'}
          >
            <Text style={[styles.confirmLabel, selected && styles.confirmLabelActive]}>
              {selected ? `Lock in ${SC_COLOUR_LABEL[selected]}` : 'Pick a colour'}
            </Text>
          </Pressable>
          <Pressable onPress={onCancel} accessibilityRole="button" accessibilityLabel="Cancel">
            <Text style={styles.cancel}>Cancel</Text>
          </Pressable>
        </View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: {
    flex: 1,
    backgroundColor: 'rgba(12,5,24,.86)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  column: {
    alignItems: 'center',
    gap: 22,
  },
  label: {
    fontFamily: scFont.mono500,
    fontSize: 10,
    letterSpacing: 10 * 0.18,
    color: 'rgba(255,255,255,.6)',
  },
  tile: {
    width: scGeometry.wheelTile,
    height: scGeometry.wheelTile,
    padding: 15,
    shadowOpacity: 0.34,
    shadowOffset: { width: 0, height: 12 },
    shadowRadius: 26,
  },
  tileSelected: {
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,.9)',
  },
  tileLabel: {
    fontFamily: scFont.sans800,
    fontSize: 15,
    color: '#FFFFFF',
  },
  checkBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
  },
  hub: {
    position: 'absolute',
    left: '50%',
    top: '50%',
    width: 64,
    height: 90,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.5,
    shadowOffset: { width: 0, height: 14 },
    shadowRadius: 32,
  },
  hubOval: {
    width: 46,
    height: 68,
    borderRadius: 23,
    // Clips WildSwatch's sharp-cornered 2x2 grid to this oval — without it the
    // rotated square corners poke out past the curve, matching the bug where
    // this looked like a lopsided tilted square instead of the same clipped
    // colour oval every other card face (CardFace.tsx) already uses.
    overflow: 'hidden',
    backgroundColor: scColor.ember,
    transform: [{ rotate: '-22deg' }],
  },
  hubLabel: {
    position: 'absolute',
    left: 6,
    top: 5,
    fontFamily: scFont.sans800,
    fontSize: 10,
    color: scColor.ink,
  },
  confirm: {
    width: 260,
    paddingVertical: 17,
    borderRadius: 999,
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,.08)',
  },
  confirmActive: {
    backgroundColor: scColor.lime,
    shadowColor: scColor.lime,
    shadowOpacity: 0.4,
    shadowOffset: { width: 0, height: 12 },
    shadowRadius: 26,
  },
  confirmLabel: {
    fontFamily: scFont.sans700,
    fontSize: 16,
    color: 'rgba(255,255,255,.4)',
  },
  confirmLabelActive: {
    color: scColor.ink,
  },
  cancel: {
    fontFamily: scFont.sans600,
    fontSize: 14,
    color: 'rgba(255,255,255,.55)',
  },
});
