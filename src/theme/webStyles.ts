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
