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

  // World map surface — soft sage land on a dusty-blue ocean, both muted (this is a mood
  // board, not a navigation chart).
  ocean: '#D7E4E2',
  oceanDeep: '#C3D6D3',
  land: '#E9DEC4',
  landLine: 'rgba(80,64,40,.14)',

  // Streets + buildings scattered over land once the map is zoomed in enough to read as a place
  // (see mapStreetGrid.ts) — still muted paper tones, never map-app-saturated.
  road: 'rgba(80,64,40,.26)',
  roadMinor: 'rgba(80,64,40,.14)',
  building: '#DFD1A9',
  buildingLine: 'rgba(80,64,40,.20)',

  // Own pin vs. a friend's pin.
  pinSelf: '#2B231C',
  pinFriend: '#C9714F',
  pinRing: 'rgba(201,113,79,.28)',

  // Unread / "new letter" indicator.
  unread: '#C9714F',

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

export const throwGradient = {
  // The primary "THROW" button — a quiet warm gradient, not a bright brand-colored CTA.
  throwBtn: { colors: ['#D9885F', '#C9714F'] as [string, string], locations: [0, 1] as [number, number] },
  skyDawn: { colors: ['#F6F1E4', '#EDE3CE'] as [string, string], locations: [0, 1] as [number, number] },
} as const;

export const throwRadius = {
  paper: 18,
  card: 20,
  pill: 999,
} as const;

export const throwSpace = {
  gutter: 20,
} as const;
