/**
 * react-native-web renders TextInput as a real <input>/<textarea>, which
 * picks up the browser's default focus ring (usually a harsh blue) on
 * top of whatever focus treatment the component already draws. This
 * strips it — every text input in the app uses its own animated border
 * instead (see useFocusBorder). No-op on native.
 */
// react-native-web accepts CSS's "none" for outlineStyle, but RN's own
// TextStyle type only models its native outline values ("solid" |
// "dotted" | "dashed"), so this is intentionally typed loosely.
export const noOutline: Record<string, unknown> = { outlineStyle: 'none', outlineWidth: 0 };

/**
 * Mobile Safari's own long-press text-selection/callout menu ("Copy / Translate / Look Up…") —
 * web only — otherwise fires on any plain `<Text>` a custom long-press gesture (drag-to-delete, a
 * story's own long-press-to-delete, etc.) is also listening on, stealing the touch instead of
 * letting that gesture's PanResponder claim it. Apply to the gesture's own root View, not each
 * Text individually — `user-select` is CSS-inherited, so one application here covers every
 * descendant. React's inline-style vendor-prefix convention capitalizes the prefix itself
 * (`WebkitFoo`, matching `element.style.WebkitFoo`) — confirmed directly via the browser's own
 * console warning when this was still lowercase-first (`webkitUserSelect` → "did you mean
 * WebkitUserSelect?").
 */
export const noSelect: Record<string, unknown> = { userSelect: 'none', WebkitUserSelect: 'none', WebkitTouchCallout: 'none' };
