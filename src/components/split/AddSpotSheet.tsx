import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { colors, fontFamily, noOutline, spacing } from '../../theme';
import { Icon } from '../Icon';
import { BottomSheet } from '../expenses/BottomSheet';
import { useSplit } from '../../context/SplitContext';
import { SPOT_ICONS } from '../../data/spotIcons';

interface AddSpotSheetProps {
  visible: boolean;
  onClose: () => void;
  /** Position in the planned-spots list this new spot will land at — spreads pins across the map canvas. */
  nextIndex: number;
}

const GRID_COLS = 3;

/** Loose grid spread across the stylized map so new pins don't stack on top of each other. */
function gridPosition(index: number): { posX: number; posY: number } {
  const col = index % GRID_COLS;
  const row = Math.floor(index / GRID_COLS) % 4;
  return { posX: 18 + col * 32, posY: 22 + row * 20 };
}

/** Add a planned spot to the trip map — name, icon, optional note. */
export function AddSpotSheet({ visible, onClose, nextIndex }: AddSpotSheetProps) {
  const { addPlannedSpot } = useSplit();
  const [name, setName] = useState('');
  const [note, setNote] = useState('');
  const [icon, setIcon] = useState(SPOT_ICONS[0].label);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (visible) {
      setName('');
      setNote('');
      setIcon(SPOT_ICONS[0].label);
      setSubmitting(false);
    }
  }, [visible]);

  const valid = name.trim().length > 0;

  const submit = async () => {
    if (!valid || submitting) return;
    setSubmitting(true);
    const { posX, posY } = gridPosition(nextIndex);
    await addPlannedSpot({ name, icon, note, posX, posY });
    setSubmitting(false);
    onClose();
  };

  return (
    <BottomSheet visible={visible} onClose={onClose}>
      <Text style={styles.title}>Add a planned spot</Text>
      <Text style={styles.hint}>Pin a place the group wants to hit on this trip.</Text>

      <TextInput
        value={name}
        onChangeText={setName}
        placeholder="e.g. Baga Beach"
        placeholderTextColor={colors.splitInkFaint45}
        style={[styles.input, noOutline]}
      />

      <View style={styles.iconRow}>
        {SPOT_ICONS.map((def) => {
          const selected = def.label === icon;
          return (
            <Pressable
              key={def.label}
              onPress={() => setIcon(def.label)}
              style={[styles.iconChip, selected && styles.iconChipOn]}
              accessibilityRole="button"
              accessibilityLabel={def.label}
            >
              <Icon path={def.icon} color={selected ? '#fff' : colors.splitInk} size={16} strokeWidth={1.8} />
              <Text style={[styles.iconChipLabel, selected && styles.iconChipLabelOn]}>{def.label}</Text>
            </Pressable>
          );
        })}
      </View>

      <TextInput
        value={note}
        onChangeText={setNote}
        placeholder="Note (optional)"
        placeholderTextColor={colors.splitInkFaint45}
        style={[styles.input, noOutline]}
      />

      <View style={styles.actionsRow}>
        <Pressable onPress={onClose} style={styles.cancelButton}>
          <Text style={styles.cancelLabel}>Cancel</Text>
        </Pressable>
        <Pressable onPress={submit} style={[styles.saveButton, { backgroundColor: valid ? colors.splitAccent : 'rgba(250,46,110,.4)' }]}>
          <Text style={styles.saveLabel}>{submitting ? 'Adding…' : 'Add spot'}</Text>
        </Pressable>
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  title: {
    fontFamily: fontFamily.sans700,
    fontSize: 21,
    color: colors.splitInk,
  },
  hint: {
    fontFamily: fontFamily.sans400,
    fontSize: 13.5,
    lineHeight: 21,
    color: colors.splitInkFaint55,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.splitInkFaint09,
    backgroundColor: '#F3F3F8',
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 16,
    fontFamily: fontFamily.sans500,
    fontSize: 15,
    color: colors.splitInk,
  },
  iconRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  iconChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 9,
    paddingHorizontal: 13,
    borderRadius: 999,
    backgroundColor: '#F3F3F8',
  },
  iconChipOn: {
    backgroundColor: colors.splitAccent,
  },
  iconChipLabel: {
    fontFamily: fontFamily.sans600,
    fontSize: 12.5,
    color: colors.splitInk,
  },
  iconChipLabelOn: {
    color: '#fff',
  },
  actionsRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginTop: spacing.xxs,
  },
  cancelButton: {
    flex: 1,
    borderRadius: 999,
    paddingVertical: 16,
    alignItems: 'center',
    backgroundColor: 'rgba(27,42,99,.06)',
  },
  cancelLabel: {
    fontFamily: fontFamily.sans600,
    fontSize: 15.5,
    color: colors.splitInk,
  },
  saveButton: {
    flex: 1.4,
    borderRadius: 999,
    paddingVertical: 16,
    alignItems: 'center',
  },
  saveLabel: {
    fontFamily: fontFamily.sans600,
    fontSize: 15.5,
    color: '#fff',
  },
});
