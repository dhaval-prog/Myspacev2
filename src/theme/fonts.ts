import {
  Figtree_400Regular,
  Figtree_500Medium,
  Figtree_600SemiBold,
  Figtree_700Bold,
  Figtree_800ExtraBold,
} from '@expo-google-fonts/figtree';
import { DMMono_400Regular, DMMono_500Medium } from '@expo-google-fonts/dm-mono';
import {
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold,
} from '@expo-google-fonts/plus-jakarta-sans';
import { Caveat_400Regular, Caveat_500Medium, Caveat_600SemiBold, Caveat_700Bold } from '@expo-google-fonts/caveat';
// Split in two so App.tsx can block first paint on only what the very first screen (Throw, the
// app's landing point) actually needs — Figtree (used everywhere) and Caveat (Throw's own
// handwritten-letter face, visible immediately on the compose card). Plus Jakarta Sans is loaded
// in the background instead (see deferredFontsToLoad below): it's the Games hub/NPAT/Space Cards'
// own face, nothing else uses it, and blocking the whole app's launch on 5 extra font weights for
// a screen most sessions never open was pure wasted startup time.
export const fontsToLoad = {
  Figtree_400Regular,
  Figtree_500Medium,
  Figtree_600SemiBold,
  Figtree_700Bold,
  Figtree_800ExtraBold,
  DMMono_400Regular,
  DMMono_500Medium,
  // Throw only — its handwritten-letter face, kept out of the shared fontFamily
  // tokens for the same reason Plus Jakarta Sans below is.
  Caveat_400Regular,
  Caveat_500Medium,
  Caveat_600SemiBold,
  Caveat_700Bold,
};

// Space Cards, NPAT, and the Games hub only — every other screen uses Figtree; Plus Jakarta Sans
// is the Games feature's own design-mandated face, kept out of the shared fontFamily tokens in
// typography.ts so it can't leak into the rest of the app. Loaded via its own background
// `useFonts` call (see App.tsx) that doesn't gate first paint — by the time anyone actually
// reaches a Games screen, this has almost always already finished loading anyway.
export const deferredFontsToLoad = {
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold,
};
