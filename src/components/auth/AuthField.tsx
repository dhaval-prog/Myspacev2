import React from 'react';
import { Animated, StyleSheet, TextInput, TextInputProps, View } from 'react-native';
import { colors, radius, spacing, typography, noOutline } from '../../theme';
import { useFocusBorder } from '../../hooks/useFocusBorder';

interface AuthFieldProps {
  icon: React.ReactNode;
  value: string;
  onChangeText: (text: string) => void;
  placeholder: string;
  rightAccessory?: React.ReactNode;
  accessibilityLabel: string;
  secureTextEntry?: boolean;
  keyboardType?: TextInputProps['keyboardType'];
  autoCapitalize?: TextInputProps['autoCapitalize'];
  autoComplete?: TextInputProps['autoComplete'];
  textContentType?: TextInputProps['textContentType'];
  returnKeyType?: TextInputProps['returnKeyType'];
  onSubmitEditing?: () => void;
}

/** Pill-shaped input row shared by every field on the auth screens. */
export function AuthField({
  icon,
  value,
  onChangeText,
  placeholder,
  rightAccessory,
  accessibilityLabel,
  secureTextEntry,
  keyboardType,
  autoCapitalize = 'none',
  autoComplete,
  textContentType,
  returnKeyType,
  onSubmitEditing,
}: AuthFieldProps) {
  const { borderColor, onFocus, onBlur } = useFocusBorder('rgba(22,33,12,0)', colors.ink);

  return (
    <Animated.View style={[styles.row, { borderColor }]}>
      <View style={styles.iconSlot}>{icon}</View>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        onFocus={onFocus}
        onBlur={onBlur}
        placeholder={placeholder}
        placeholderTextColor={colors.placeholder}
        style={[typography.authFieldText, styles.input, { color: colors.textPrimary }, noOutline]}
        accessibilityLabel={accessibilityLabel}
        secureTextEntry={secureTextEntry}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
        autoComplete={autoComplete}
        textContentType={textContentType}
        returnKeyType={returnKeyType}
        onSubmitEditing={onSubmitEditing}
      />
      {rightAccessory && <View style={styles.iconSlot}>{rightAccessory}</View>}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.authFieldBg,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    paddingVertical: spacing.xxl - 1.5,
    paddingHorizontal: spacing.huge - 1.5,
  },
  iconSlot: {
    width: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  input: {
    flex: 1,
    padding: 0,
  },
});
