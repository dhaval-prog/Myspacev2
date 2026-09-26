/**
 * Bottom navigation destinations, data-driven per the MySpace reference.
 * All three sit together in the nav pill, in this order; the "+" action
 * is a separate floating button, not one of these items.
 * `icon` is an SVG path drawn via the shared `Icon` component.
 */
export interface NavItem {
  id: string;
  icon: string;
  label: string;
}

export const navItems: NavItem[] = [
  // Same chat-bubble glyph as Throw's own Chats entry (FoldingLetter's CHAT_ICON) — reused here
  // so this reads as the same destination. Chats is the app's landing point now (see App.tsx),
  // replacing the old standalone Home tab. Deliberately the plain bubble, not ChatsListScreen's
  // own bubble-plus FAB glyph (that one means "start a new chat", a different action).
  { id: 'chat', icon: 'M20 11.5a7.5 7.5 0 0 1-10.7 6.8L4 19.5l1.3-4.9A7.5 7.5 0 1 1 20 11.5z', label: 'Chat' },
  { id: 'expenses', icon: 'M5 4.5h14v15H5zM8 8.5h8M8 12h8M8 15.5h5', label: 'Pocket' },
  // Same paper-plane glyph as ChatsListScreen's own Throw entry — reused here so this reads as
  // the same destination, not a nav-specific reinterpretation.
  { id: 'throw', icon: 'M22 2L11 13 M22 2L15 22L11 13L2 9L22 2Z', label: 'Throw' },
];
