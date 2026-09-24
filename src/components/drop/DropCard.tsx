import React from 'react';
import { View, ViewProps } from 'react-native';
import { dpColor, dpRadius, dpShadow } from '../../theme/dropTokens';

/** Flat frosted card — bg surface, hairline border, radius 26, soft shadow. Callers override radius/padding per-instance via style. */
export function DropCard({ style, children, ...rest }: ViewProps) {
  return (
    <View
      style={[
        { backgroundColor: dpColor.surface, borderWidth: 1, borderColor: dpColor.line, borderRadius: dpRadius.card },
        dpShadow.shadow,
        style,
      ]}
      {...rest}
    >
      {children}
    </View>
  );
}
