import React from 'react';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

interface StrokeIconProps {
  size?: number;
  color: string;
}

/** Person — Full Name field. */
export function PersonIcon({ size = 21, color }: StrokeIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
      <Circle cx={12} cy={8} r={3.4} />
      <Path d="M5.5 20c0-3.3 2.9-5.6 6.5-5.6s6.5 2.3 6.5 5.6" />
    </Svg>
  );
}

/** Envelope — Email field. */
export function EnvelopeIcon({ size = 21, color }: StrokeIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
      <Rect x={2.8} y={5.4} width={18.4} height={13.2} rx={4} />
      <Path d="M6.4 9.6l4.3 3.2a2.2 2.2 0 0 0 2.6 0l4.3-3.2" />
    </Svg>
  );
}

/** Lock — Password field. */
export function LockIcon({ size = 21, color }: StrokeIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
      <Rect x={4.6} y={10.4} width={14.8} height={9.6} rx={3.4} />
      <Path d="M8.4 10.4V7.9a3.6 3.6 0 0 1 7.2 0v2.5" />
      <Circle cx={12} cy={15.2} r={1.15} fill={color} stroke="none" />
    </Svg>
  );
}

/** Eye — password currently visible, tap to hide. */
export function EyeIcon({ size = 21, color }: StrokeIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M3 12c1.3-2.8 4.7-5.8 9-5.8s7.7 3 9 5.8c-1.3 2.8-4.7 5.8-9 5.8S4.3 14.8 3 12z" />
      <Circle cx={12} cy={12} r={2.9} />
    </Svg>
  );
}

/** Eye off — password currently hidden, tap to show. */
export function EyeOffIcon({ size = 21, color }: StrokeIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M3 3l18 18" />
      <Path d="M10.6 6.3A9.7 9.7 0 0 1 12 6.2c4.3 0 7.7 3 9 5.8-.5 1.1-1.4 2.4-2.6 3.5" />
      <Path d="M6.3 8.1C4.6 9.3 3.5 10.9 3 12c1.3 2.8 4.7 5.8 9 5.8 1.3 0 2.6-.3 3.7-.8" />
      <Path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
    </Svg>
  );
}

/** Facebook mark. */
export function FacebookIcon({ size = 30 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="#0A0A0A">
      <Path d="M14.6 21v-7.5h2.6l.4-3h-3V8.7c0-.9.3-1.5 1.5-1.5h1.6V4.5c-.3 0-1.3-.1-2.4-.1-2.4 0-4 1.5-4 4.1v2.9H8.5v3h2.4V21h3.7z" />
    </Svg>
  );
}

/** Google mark. */
export function GoogleIcon({ size = 27 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48">
      <Path fill="#4285F4" d="M45.1 24.5c0-1.6-.1-2.8-.4-4.1H24v7.8h11.9c-.2 2-1.5 4.9-4.4 6.9l-.1.3 6.4 4.9.4.05c4.1-3.8 6.9-9.4 6.9-15.85z" />
      <Path fill="#34A853" d="M24 46c5.9 0 10.8-1.9 14.2-5.3l-6.8-5.2c-1.8 1.3-4.3 2.2-7.4 2.2-5.7 0-10.6-3.8-12.3-9l-.3.02-6.6 5.1-.1.3C8 41.3 15.4 46 24 46z" />
      <Path fill="#FBBC05" d="M11.7 28.7c-.5-1.4-.7-2.9-.7-4.7s.3-3.3.7-4.7l-.01-.3-6.7-5.2-.2.1C3.1 16.9 2 20.3 2 24s1.1 7.1 2.8 10.1l6.9-5.4z" />
      <Path fill="#EA4335" d="M24 10.1c4 0 6.7 1.7 8.3 3.2l6-5.9C34.7 4 29.9 2 24 2 15.4 2 8 6.7 4.8 13.9l6.9 5.4C13.4 14 18.3 10.1 24 10.1z" />
    </Svg>
  );
}

/** Apple mark. */
export function AppleIcon({ size = 26 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="#fff">
      <Path d="M16.7 12.6c0-2.2 1.7-3.3 1.8-3.4-1-1.4-2.5-1.6-3-1.7-1.3-.1-2.4.7-3 .7-.6 0-1.6-.7-2.6-.7-1.4 0-2.6.8-3.3 2-1.4 2.4-.4 6 1 8 .7 1 1.5 2.1 2.6 2 1-.04 1.4-.66 2.6-.66 1.2 0 1.5.65 2.6.63 1.1-.02 1.8-1 2.5-2 .5-.7.7-1.1 1.1-1.9-2-.8-2.3-3.6-2.3-3.6zM14.6 5.9c.6-.7.9-1.7.8-2.7-.9.04-1.9.6-2.5 1.3-.5.6-.9 1.6-.8 2.6 1 .08 2-.5 2.5-1.2z" />
    </Svg>
  );
}
