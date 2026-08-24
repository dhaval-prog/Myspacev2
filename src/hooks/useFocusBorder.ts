import { useRef, useState } from 'react';
import { Animated } from 'react-native';
import { EASE, duration } from '../theme';

/**
 * Drives a quiet animated border-color transition on text-input focus —
 * the app's one focus treatment, used everywhere instead of the browser's
 * default outline.
 */
export function useFocusBorder(restColor: string, focusColor: string) {
  const [focused, setFocused] = useState(false);
  const anim = useRef(new Animated.Value(0)).current;

  const onFocus = () => {
    setFocused(true);
    Animated.timing(anim, { toValue: 1, duration: duration.micro, easing: EASE, useNativeDriver: false }).start();
  };
  const onBlur = () => {
    setFocused(false);
    Animated.timing(anim, { toValue: 0, duration: duration.state, easing: EASE, useNativeDriver: false }).start();
  };

  const borderColor = anim.interpolate({ inputRange: [0, 1], outputRange: [restColor, focusColor] });

  return { focused, borderColor, onFocus, onBlur };
}
