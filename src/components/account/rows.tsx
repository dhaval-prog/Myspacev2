import React from 'react';
import { Pressable, StyleSheet, Switch, Text, TextInput, View, type StyleProp, type ViewStyle } from 'react-native';
import { colors, fontFamily, noOutline, radius, spacing } from '../../theme';
import { Icon } from '../Icon';

const CHEVRON = 'M9 6l6 6-6 6';

/** Uppercase mono section label, sitting above a `Card`. */
export function SectionLabel({ children }: { children: React.ReactNode }) {
  return <Text style={styles.sectionLabel}>{children}</Text>;
}

/** Rounded white card grouping a section's rows. */
export function Card({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

interface RowProps {
  label: string;
  sublabel?: string;
  value?: string;
  onPress?: () => void;
  disabled?: boolean;
  /** e.g. "Coming soon" — shown as a soft pill, implies the row is informational only. */
  badge?: string;
  destructive?: boolean;
  /** Custom right-side content (a Switch, for instance) instead of the value/chevron pair. */
  right?: React.ReactNode;
  last?: boolean;
}

/** One tappable (or static) settings row: label, optional sublabel, value/chevron or custom right content. */
export function Row({ label, sublabel, value, onPress, disabled, badge, destructive, right, last }: RowProps) {
  const content = (
    <View style={[styles.row, !last && styles.rowDivider]}>
      <View style={styles.rowText}>
        <Text style={[styles.rowLabel, destructive && styles.rowLabelDestructive, disabled && styles.rowLabelDisabled]}>{label}</Text>
        {sublabel ? <Text style={styles.rowSublabel}>{sublabel}</Text> : null}
      </View>
      {badge ? (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{badge}</Text>
        </View>
      ) : right ? (
        right
      ) : (
        <View style={styles.rowRight}>
          {value ? <Text style={styles.rowValue}>{value}</Text> : null}
          {onPress ? <Icon path={CHEVRON} color={colors.textFaint} size={16} strokeWidth={2} /> : null}
        </View>
      )}
    </View>
  );

  if (!onPress || disabled) return content;
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} style={({ pressed }) => pressed && styles.rowPressed}>
      {content}
    </Pressable>
  );
}

/** A toggle row backed by a real value + onValueChange, styled to match `Row`. */
export function ToggleRow({ label, sublabel, value, onValueChange, last }: { label: string; sublabel?: string; value: boolean; onValueChange: (v: boolean) => void; last?: boolean }) {
  return (
    <Row
      label={label}
      sublabel={sublabel}
      last={last}
      right={
        <Switch
          value={value}
          onValueChange={onValueChange}
          trackColor={{ false: colors.badgeInactiveBg, true: colors.ink }}
          thumbColor={colors.white}
        />
      }
    />
  );
}

/** A labeled text field for the editable Profile fields. */
export function TextField({
  label,
  value,
  onChangeText,
  placeholder,
  editable = true,
  keyboardType,
  secureTextEntry,
  autoCapitalize,
}: {
  label: string;
  value: string;
  onChangeText?: (v: string) => void;
  placeholder?: string;
  editable?: boolean;
  keyboardType?: 'default' | 'email-address' | 'phone-pad' | 'numeric';
  secureTextEntry?: boolean;
  autoCapitalize?: 'none' | 'words' | 'sentences';
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {editable ? (
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.placeholder}
          style={[styles.input, noOutline]}
          keyboardType={keyboardType}
          secureTextEntry={secureTextEntry}
          autoCapitalize={autoCapitalize ?? 'none'}
        />
      ) : (
        <Text style={styles.fieldStatic}>{value || '—'}</Text>
      )}
    </View>
  );
}

/** Primary/secondary/destructive action button, full-width. */
export function ActionButton({
  label,
  onPress,
  variant = 'primary',
  disabled,
  loading,
}: {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'destructive' | 'success';
  disabled?: boolean;
  loading?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [
        styles.button,
        variant === 'primary' && styles.buttonPrimary,
        variant === 'secondary' && styles.buttonSecondary,
        variant === 'destructive' && styles.buttonDestructive,
        variant === 'success' && styles.buttonSuccess,
        (disabled || loading) && styles.buttonDisabled,
        pressed && !disabled && !loading && styles.buttonPressed,
      ]}
    >
      <Text
        style={[
          styles.buttonLabel,
          variant === 'primary' && styles.buttonLabelPrimary,
          variant === 'secondary' && styles.buttonLabelSecondary,
          variant === 'destructive' && styles.buttonLabelDestructive,
          variant === 'success' && styles.buttonLabelSuccess,
        ]}
      >
        {loading ? 'Please wait…' : label}
      </Text>
    </Pressable>
  );
}

export function InlineError({ children }: { children: React.ReactNode }) {
  if (!children) return null;
  return <Text style={styles.inlineError}>{children}</Text>;
}

export function InlineNote({ children }: { children: React.ReactNode }) {
  return <Text style={styles.inlineNote}>{children}</Text>;
}

const styles = StyleSheet.create({
  sectionLabel: {
    fontFamily: fontFamily.mono500,
    fontSize: 10.5,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: colors.textMuted,
    marginBottom: spacing.xs,
    marginLeft: 4,
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.lg,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.ms,
    paddingVertical: 15,
  },
  rowDivider: {
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  rowPressed: {
    opacity: 0.6,
  },
  rowText: {
    flex: 1,
    gap: 2,
  },
  rowLabel: {
    fontFamily: fontFamily.sans600,
    fontSize: 14.5,
    color: colors.textPrimary,
  },
  rowLabelDestructive: {
    color: colors.danger,
  },
  rowLabelDisabled: {
    color: colors.textDisabled,
  },
  rowSublabel: {
    fontFamily: fontFamily.sans400,
    fontSize: 12,
    color: colors.textFaint,
  },
  rowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  rowValue: {
    fontFamily: fontFamily.sans500,
    fontSize: 13,
    color: colors.textSecondary,
  },
  badge: {
    backgroundColor: colors.badgeInactiveBg,
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  badgeText: {
    fontFamily: fontFamily.sans600,
    fontSize: 10.5,
    color: colors.badgeInactiveFg,
  },
  field: {
    gap: 6,
    paddingVertical: 10,
  },
  fieldLabel: {
    fontFamily: fontFamily.mono500,
    fontSize: 9.5,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: colors.textMuted,
  },
  fieldStatic: {
    fontFamily: fontFamily.sans500,
    fontSize: 14.5,
    color: colors.textSecondary,
  },
  input: {
    fontFamily: fontFamily.sans600,
    fontSize: 15,
    color: colors.textPrimary,
    paddingVertical: 6,
  },
  button: {
    borderRadius: radius.md - 8,
    paddingVertical: 15,
    alignItems: 'center',
  },
  buttonPrimary: {
    backgroundColor: colors.ink,
  },
  buttonSecondary: {
    backgroundColor: colors.pressWash,
  },
  buttonDestructive: {
    backgroundColor: colors.danger,
  },
  buttonSuccess: {
    backgroundColor: colors.lime,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonPressed: {
    opacity: 0.85,
  },
  buttonLabel: {
    fontFamily: fontFamily.sans600,
    fontSize: 14.5,
  },
  buttonLabelPrimary: {
    color: colors.lime,
  },
  buttonLabelSecondary: {
    color: colors.textPrimary,
  },
  buttonLabelDestructive: {
    color: colors.white,
  },
  buttonLabelSuccess: {
    color: colors.ink,
  },
  inlineError: {
    fontFamily: fontFamily.sans500,
    fontSize: 12.5,
    color: colors.danger,
  },
  inlineNote: {
    fontFamily: fontFamily.sans400,
    fontSize: 12,
    lineHeight: 17,
    color: colors.textFaint,
  },
});
