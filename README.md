# MySpace V2

A personal space for everything that matters — things, spends, people, all in one place.

This is the mobile Home screen for MySpace V2, built with Expo / React Native and recreated from the MySpace 6a/6b design reference. Minimal, personal, calm, premium: a lime background, a pale content surface with a single organic corner, and large editorial typography.

## Stack

- Expo (React Native, TypeScript)
- `react-native-safe-area-context` for notch/home-indicator safe areas
- `@expo-google-fonts/figtree` and `@expo-google-fonts/dm-mono` for the type system (the closest openly-licensed match to the reference's Calibre)
- RN's built-in `Animated` API for every micro-interaction — no external animation library

## Getting started

```bash
npm install
npm run web      # or: npm run ios / npm run android
```

## Project structure

```
src/
  theme/         design tokens — colors, typography, spacing, radius, motion
  data/          data-driven category & navigation content
  components/    Header, Hero, CategoryNavigation, CategoryRow, ContextCard, BottomNavigation
  screens/       HomeScreen
  hooks/         useReducedMotion
```

Navigation content lives in `src/data/` as plain arrays, so adding or relabeling a category or bottom-nav destination never touches component code.

## Design system

| Token | Value | Use |
|---|---|---|
| `colors.lime` | `#C3EA4F` | Background, accents, active states |
| `colors.ink` | `#16210C` | Primary text, icons |
| `colors.pale` | `#EDFDFF` | Content surface |
| `radius.organic` | `34` | The asymmetric top-left corner of the content surface — the signature MySpace shape |

Every interactive element keeps at least a 44×44pt touch target, respects the OS "reduce motion" setting, and exposes accessible roles/labels/state.
