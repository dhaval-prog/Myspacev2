import { useRef, useState } from 'react';
import { Animated, Easing } from 'react-native';

// The handoff's own msFly send-plane curve.
const EASE_FLY = Easing.bezier(0.4, 0, 0.6, 1);

/** Drives the paper plane that flies off the send button on submit (the handoff's own msFly
 * keyframe: translate(-150px,-420px) rotate(-28deg) scale(.45), fading out over 900ms). */
export function useSendPlaneFly(reduceMotion: boolean) {
  const [flying, setFlying] = useState(false);
  const progress = useRef(new Animated.Value(0)).current;

  const flyThePlane = () => {
    if (reduceMotion) return;
    progress.setValue(0);
    setFlying(true);
    Animated.timing(progress, { toValue: 1, duration: 900, easing: EASE_FLY, useNativeDriver: true }).start(() => setFlying(false));
  };

  const translateX = progress.interpolate({ inputRange: [0, 1], outputRange: [0, -150] });
  const translateY = progress.interpolate({ inputRange: [0, 1], outputRange: [0, -420] });
  const rotate = progress.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '-28deg'] });
  const scale = progress.interpolate({ inputRange: [0, 1], outputRange: [1, 0.45] });
  const opacity = progress.interpolate({ inputRange: [0, 0.6, 1], outputRange: [1, 1, 0] });

  return {
    flying,
    flyThePlane,
    flyStyle: { opacity, transform: [{ translateX }, { translateY }, { rotate }, { scale }] },
  };
}
