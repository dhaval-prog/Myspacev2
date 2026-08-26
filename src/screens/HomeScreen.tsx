import React, { useEffect, useMemo, useState } from 'react';
import { ScrollView, StatusBar, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radius, spacing } from '../theme';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { useAuth } from '../context/AuthContext';
import { useSpace } from '../context/SpaceContext';
import { getAttentionEntries } from '../utils/attention';
import { VIEWS, type ViewId } from '../data/views';
import { Header } from '../components/Header';
import type { SearchSuggestion } from '../components/SearchBar';
import { Hero } from '../components/Hero';
import { CategoryNavigation, type CategoryRowData } from '../components/CategoryNavigation';
import { ContextCard } from '../components/ContextCard';
import { BottomNav } from '../components/BottomNav';
import { ConfirmDialog } from '../components/ConfirmDialog';

interface HomeScreenProps {
  onOpenDetail: (viewId: ViewId, initialIndex?: number) => void;
  onOpenExpenses: () => void;
  onOpenSplit: () => void;
}

/**
 * MySpace V2 — Home, first-run state.
 * A brand-new space only has two ways in: add a room, then add items to
 * it. "Needs attention" only joins the list once an item has an expiry
 * date that's due or coming up — it's an alarm, not a starting tab.
 */
export function HomeScreen({ onOpenDetail, onOpenExpenses, onOpenSplit }: HomeScreenProps) {
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const { signOut } = useAuth();
  const { rooms, items } = useSpace();
  const [query, setQuery] = useState('');
  const [activeViewId, setActiveViewId] = useState<ViewId>('rooms');
  const [previewViewId, setPreviewViewId] = useState<ViewId>('rooms');
  const [activeNavId, setActiveNavId] = useState('home');
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false);

  const attentionEntries = useMemo(() => getAttentionEntries(items), [items]);
  const showAttention = attentionEntries.length > 0;

  const rows: CategoryRowData[] = useMemo(() => {
    const list: CategoryRowData[] = [
      { id: 'rooms', label: VIEWS.rooms.tabLabel, count: rooms.length ? String(rooms.length) : '＋' },
      {
        id: 'add',
        label: VIEWS.add.tabLabel,
        count: rooms.length === 0 ? '⊘' : items.length ? String(items.length) : '＋',
        locked: rooms.length === 0,
      },
    ];
    if (showAttention) {
      list.push({ id: 'attention', label: 'Needs attention', count: String(attentionEntries.length) });
    }
    return list;
  }, [rooms.length, items.length, showAttention, attentionEntries.length]);

  // Ambient preview: while the user is just looking, the context card on
  // its own quietly cycles through every section every 3s — a tour, not
  // a demand. The row list above (and the hero line) stay put, showing
  // whatever the user actually last selected, so nothing above the card
  // appears to change on its own. A real tap always navigates away
  // immediately. Off entirely when the OS asks for reduced motion.
  useEffect(() => {
    if (reduceMotion || rows.length <= 1) return;
    const ids = rows.map((r) => r.id);
    const timer = setInterval(() => {
      setPreviewViewId((current) => {
        const idx = ids.indexOf(current);
        return ids[idx === -1 ? 0 : (idx + 1) % ids.length] as ViewId;
      });
    }, 3000);
    return () => clearInterval(timer);
  }, [rows, reduceMotion]);

  // Keep the preview aligned to a real selection whenever one happens.
  useEffect(() => {
    setPreviewViewId(activeViewId);
  }, [activeViewId]);

  const heroLine =
    activeViewId === 'rooms'
      ? rooms.length
        ? `${rooms.length} room${rooms.length === 1 ? '' : 's'} set up. Add the things next.`
        : 'Start with a room. Add the things after.'
      : activeViewId === 'attention'
        ? 'Set an expiry date and we will nudge you here.'
        : 'Say it, scan it, or type it — it files itself.';

  const contextLabel =
    previewViewId === 'rooms' ? VIEWS.rooms.tabLabel : previewViewId === 'add' ? VIEWS.add.tabLabel : 'Needs attention';
  const contextTitle =
    previewViewId === 'rooms'
      ? VIEWS.rooms.items[1].title
      : previewViewId === 'add'
        ? VIEWS.add.items[1].title
        : (attentionEntries[0]?.item.name ?? 'All caught up');

  // Empty query: quick shortcuts to the same sections as the row list below.
  // Non-empty query: live matches against rooms and filed items — picking
  // one jumps straight to its "view all" list rather than the add form.
  const searchSuggestions: SearchSuggestion[] = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) {
      const list: SearchSuggestion[] = [
        { id: 'shortcut-rooms', label: VIEWS.rooms.tabLabel, meta: rooms.length ? `${rooms.length} set up` : 'Get started' },
      ];
      if (rooms.length > 0) {
        list.push({ id: 'shortcut-add', label: VIEWS.add.tabLabel, meta: items.length ? `${items.length} filed` : 'Get started' });
      }
      if (showAttention) {
        list.push({
          id: 'shortcut-attention',
          label: 'Needs attention',
          meta: `${attentionEntries.length} item${attentionEntries.length === 1 ? '' : 's'}`,
        });
      }
      return list;
    }
    const roomMatches: SearchSuggestion[] = rooms
      .filter((r) => r.label.toLowerCase().includes(q))
      .map((r) => ({ id: `room-${r.id}`, label: r.label, meta: 'Room' }));
    const itemMatches: SearchSuggestion[] = items
      .filter((it) => it.name.toLowerCase().includes(q))
      .map((it, i) => ({
        id: `item-${i}-${it.name}`,
        label: it.name,
        meta: [it.category, it.room].filter(Boolean).join(' · ') || 'Item',
      }));
    return [...roomMatches, ...itemMatches].slice(0, 6);
  }, [query, rooms, items, showAttention, attentionEntries.length]);

  const handleSelectSuggestion = (s: SearchSuggestion) => {
    setQuery('');
    if (s.id === 'shortcut-rooms') onOpenDetail('rooms', 1);
    else if (s.id === 'shortcut-add') onOpenDetail('add', 1);
    else if (s.id === 'shortcut-attention') onOpenDetail('attention', 0);
    else if (s.id.startsWith('room-')) onOpenDetail('rooms', 0);
    else if (s.id.startsWith('item-')) onOpenDetail('add', 0);
  };

  return (
    <View style={styles.screen}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.lime} />

      <View style={{ paddingTop: insets.top + spacing.md }}>
        <View style={styles.headerPad}>
          <Header
            query={query}
            onChangeQuery={setQuery}
            onAvatarPress={() => setLogoutConfirmOpen(true)}
            suggestions={searchSuggestions}
            onSelectSuggestion={handleSelectSuggestion}
          />
        </View>
        <Hero line={heroLine} reduceMotion={reduceMotion} />
      </View>

      <View style={styles.surface}>
        <ScrollView
          style={styles.rows}
          contentContainerStyle={styles.rowsContent}
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          <CategoryNavigation
            rows={rows}
            activeId={activeViewId}
            onSelect={(id) => {
              setActiveViewId(id as ViewId);
              onOpenDetail(id as ViewId);
            }}
            reduceMotion={reduceMotion}
          />
        </ScrollView>

        <ContextCard
          label={contextLabel}
          title={contextTitle}
          onPress={() => onOpenDetail(previewViewId)}
          reduceMotion={reduceMotion}
        />

        <BottomNav
          activeId={activeNavId}
          onSelect={(id) => {
            setActiveNavId(id);
            if (id === 'expenses') onOpenExpenses();
            if (id === 'split') onOpenSplit();
          }}
          onAdd={() => onOpenDetail('add')}
          bottomInset={insets.bottom}
          reduceMotion={reduceMotion}
        />
      </View>

      <ConfirmDialog
        visible={logoutConfirmOpen}
        title="Log out"
        message="Log out of MySpace?"
        confirmLabel="Log out"
        destructive
        onCancel={() => setLogoutConfirmOpen(false)}
        onConfirm={() => {
          setLogoutConfirmOpen(false);
          signOut();
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.lime,
  },
  headerPad: {
    paddingHorizontal: spacing.xxxl,
    zIndex: 20,
  },
  surface: {
    flex: 1,
    marginTop: spacing.xxxl,
    backgroundColor: colors.pale,
    borderTopLeftRadius: radius.organic,
  },
  rows: {
    flex: 1,
  },
  rowsContent: {
    paddingTop: spacing.md,
    flexGrow: 1,
  },
});
