/**
 * Throw design tokens — warm paper + soft world-map palette, deliberately far from the rest
 * of the app's lime/ink brand system. Throw is meant to feel like a handwritten letter, not
 * a chat app: warm cream paper, a soft muted-clay accent (never neon), and a gentle sage/dusty-
 * blue map rather than saturated cartography colors. Self-contained, same convention as
 * gamesHubTokens.ts/npatTokens.ts — never merged into the shared colors/fontFamily tokens so
 * it can't leak into the rest of the app.
 */

export const throwFont = {
  // The handwritten letter content itself, and any "penned" accents (kickers, signatures).
  hand400: 'Caveat_400Regular',
  hand500: 'Caveat_500Medium',
  hand600: 'Caveat_600SemiBold',
  hand700: 'Caveat_700Bold',
  // Everything else (labels, buttons, distance readouts) stays on the app's normal UI face.
  ui400: 'Figtree_400Regular',
  ui500: 'Figtree_500Medium',
  ui600: 'Figtree_600SemiBold',
  ui700: 'Figtree_700Bold',
  mono: 'DMMono_400Regular',
  mono500: 'DMMono_500Medium',
} as const;

export const throwColor = {
  // Warm cream paper — the letter's own surface, and the base background for Throw screens.
  paper: '#FBF6EC',
  paperShadow: 'rgba(80,64,40,.16)',
  paperLine: 'rgba(80,64,40,.08)',

  // Ink — a warm near-black, never the app's cool lime-adjacent ink.
  ink: '#2B231C',
  inkSoft: 'rgba(43,35,28,.66)',
  inkMute: 'rgba(43,35,28,.42)',
  inkFaint: 'rgba(43,35,28,.28)',

  // The one accent — a muted clay/terracotta, warm and quiet rather than a bright CTA color.
  clay: '#C9714F',
  clayDeep: '#A85A3C',
  claySoft: 'rgba(201,113,79,.14)',

  // Own pin vs. a friend's pin.
  pinSelf: '#2B231C',
  pinFriend: '#C9714F',
  pinRing: 'rgba(201,113,79,.28)',

  // Unread / "new letter" indicator.
  unread: '#C9714F',

  // The recipient carousel's "currently selected" indicator — a deliberate cool blue, the one
  // place that breaks from the rest of Throw's warm palette, per explicit request with a
  // reference screenshot (an animated pulse ring, not the warm clay accent used elsewhere).
  activeBlue: '#3D7BFF',
  activeBlueSoft: 'rgba(61,123,255,.16)',

  screenBg: '#F6F1E4',
  cardBg: '#FFFFFF',
  cardBorder: 'rgba(80,64,40,.1)',
  shadowSoft: {
    shadowColor: '#50402A',
    shadowOpacity: 0.12,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
} as const;

/**
 * Glassmorphism accents layered on top of the warm-paper palette above — reuses the main app's
 * lime/pale identity (theme/colors.ts) rather than inventing a new hue, per the "match Home's
 * colour" redesign ask. Only the chrome (header, buttons, cards, list rows) gets this treatment;
 * the letter's own paper stays warm cream, since that's what makes it read as a real letter.
 */
export const throwGlass = {
  // Soft radial blobs a GlassSurface's blur actually picks up — muted versions of Home's lime,
  // same idea as gamesHubTokens' blobGreen/blobSecondary.
  blobLime: 'rgba(195,234,79,.5)',
  blobPale: 'rgba(237,253,255,.6)',
  // The tint layered over BlurView on light glass chrome (header, buttons, cards).
  tint: 'rgba(195,234,79,.16)',
  tintStrong: 'rgba(195,234,79,.26)',
  border: 'rgba(195,234,79,.4)',
} as const;

export const throwGradient = {
  // The primary "THROW" button — a quiet warm gradient, not a bright brand-colored CTA.
  throwBtn: { colors: ['#D9885F', '#C9714F'] as [string, string], locations: [0, 1] as [number, number] },
  skyDawn: { colors: ['#F6F1E4', '#EDE3CE'] as [string, string], locations: [0, 1] as [number, number] },
} as const;

/**
 * The letter paper's own "night" skin — swapped in for `throwColor`'s warm-cream chrome whenever
 * the *viewer's own* device clock currently reads as nighttime (same `isDaytimeNow` signal every
 * Throw map's own day/night palette already follows, see ThrowHomeScreen — not any contact's own
 * destination, so every letter/map reads the same day or night at once), per an explicit
 * reference screenshot. Only the paper/badges/bottom-controls read this; the rest of Throw (map,
 * inbox, settings) is untouched — this is a per-letter skin, not a whole-app dark mode.
 */
export const throwNightColor = {
  paper: '#3A3A3C',
  ink: '#F2F0EA',
  inkSoft: 'rgba(242,240,234,.6)',
  placeholder: 'rgba(242,240,234,.4)',
  iconBg: '#1C1C1E',
  iconColor: '#F2F0EA',
  badgeBg: 'rgba(0,0,0,.55)',
  // The folded/flying paper plane's own night colour — a distinct, explicitly-specified hex
  // (not the same as `paper` above), per explicit request.
  planePaper: '#3D3D3D',
} as const;

export const throwRadius = {
  paper: 18,
  card: 20,
  pill: 999,
} as const;

export const throwSpace = {
  gutter: 20,
} as const;
