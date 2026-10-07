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
  // Chat is the app's landing point now (see App.tsx) — leads the pill accordingly.
  // Same chat-bubble glyph as Throw's own Chats entry (FoldingLetter's CHAT_ICON) — reused here
  // so this reads as the same destination. Deliberately the plain bubble, not ChatsListScreen's
  // own bubble-plus FAB glyph (that one means "start a new chat", a different action).
  { id: 'chat', icon: 'M20 11.5a7.5 7.5 0 0 1-10.7 6.8L4 19.5l1.3-4.9A7.5 7.5 0 1 1 20 11.5z', label: 'Chat' },
  // Same pin glyph as Chats' own ChatsBottomBar "Map" tab (MAP_TAB_ICON) — opens the same Friends
  // Map screen, just reachable from every other screen's own nav dock too.
  { id: 'map', icon: 'M12 21s-6-5.6-6-11a6 6 0 0 1 12 0c0 5.4-6 11-6 11z', label: 'Map' },
  { id: 'expenses', icon: 'M5 4.5h14v15H5zM8 8.5h8M8 12h8M8 15.5h5', label: 'Pocket' },
  // Throw moved to the trailing slot per explicit request (previously led the pill).
  { id: 'throw', icon: 'M22 2L11 13 M22 2L15 22L11 13L2 9L22 2Z', label: 'Throw' },
];
