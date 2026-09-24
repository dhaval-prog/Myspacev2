import React from 'react';
import { Text, TextProps } from 'react-native';
import { dpColor, dpFont, dpKickStyle } from '../../theme/dropTokens';

interface KickProps extends TextProps {
  c?: string;
  children: React.ReactNode;
}

/** The small uppercase mono "eyebrow" label — sits above a Serif heading, or stands alone as a section label. */
export function Kick({ c, style, children, ...rest }: KickProps) {
  return (
    <Text allowFontScaling={false} style={[dpKickStyle, c ? { color: c } : null, style]} {...rest}>
      {children}
    </Text>
  );
}

interface SerifProps extends TextProps {
  s?: number;
  italic?: boolean;
  c?: string;
  children: React.ReactNode;
}

/** The large display heading in InstrumentSerif — the one big statement per screen/section. */
export function Serif({ s = 34, italic = false, c = dpColor.ink, style, children, ...rest }: SerifProps) {
  return (
    <Text
      allowFontScaling={false}
      style={[
        {
          fontFamily: italic ? dpFont.dispItalic : dpFont.disp,
          fontSize: s,
          lineHeight: s * 1.3,
          letterSpacing: 0.005,
          color: c,
        },
        style,
      ]}
      {...rest}
    >
      {children}
    </Text>
  );
}
