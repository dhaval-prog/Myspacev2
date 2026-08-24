import React from 'react';
import { StyleSheet, TextInput, TextInputProps, View } from 'react-native';
import { colors, radius, spacing, typography } from '../../theme';

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
  return (
    <View style={styles.row}>
      <View style={styles.iconSlot}>{icon}</View>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.placeholder}
        style={[typography.authFieldText, styles.input, { color: colors.textPrimary }]}
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
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.authFieldBg,
    borderRadius: radius.pill,
    paddingVertical: spacing.xxl,
    paddingHorizontal: spacing.huge,
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
