import React, { useEffect, useMemo, useState } from 'react';
import { ScrollView, StatusBar, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radius, spacing } from '../theme';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { useAuth } from '../context/AuthContext';
import { useSpace } from '../context/SpaceContext';
import { useFriends } from '../context/FriendsContext';
import { getAttentionEntries } from '../utils/attention';
import { notifySelf, type NotificationTarget } from '../utils/notify';
import { isSupabaseConfigured } from '../lib/supabase';
import { VIEWS, type ViewId } from '../data/views';
import { Header } from '../components/Header';
import { SearchOverlay } from '../components/SearchOverlay';
import { NotificationsSheet } from '../components/NotificationsSheet';
import { Hero } from '../components/Hero';
import { CategoryNavigation, type CategoryRowData } from '../components/CategoryNavigation';
import { ContextCard } from '../components/ContextCard';
import { BottomNav } from '../components/BottomNav';

const CHAT_ICON = 'M20 11.5a7.5 7.5 0 0 1-10.7 6.8L4 19.5l1.3-4.9A7.5 7.5 0 1 1 20 11.5z';

interface HomeScreenProps {
  onOpenNotificationTarget?: (target: NotificationTarget) => void;
  onOpenDetail: (viewId: ViewId, initialIndex?: number) => void;
  onOpenExpenses: () => void;
  onOpenSplit: () => void;
  onOpenFriends: () => void;
  onOpenAccount: () => void;
}

/**
 * MySpace V2 — Home, first-run state.
 * Items are added directly — no separate "add a room" step; the add form's
 * own "Where is it?" picker covers the fixed default rooms. "Needs
 * attention" only joins the list once an item has an expiry date that's
 * due or coming up — it's an alarm, not a starting tab.
 */
export function HomeScreen({
  onOpenNotificationTarget,
  onOpenDetail,
  onOpenExpenses,
  onOpenSplit,
  onOpenFriends,
  onOpenAccount,
}: HomeScreenProps) {
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const { items } = useSpace();
  const { receivedRequests, goRequests } = useFriends();
  const [activeViewId, setActiveViewId] = useState<ViewId>('add');
  const [previewViewId, setPreviewViewId] = useState<ViewId>('add');
  const [activeNavId, setActiveNavId] = useState('home');
  const [searchOpen, setSearchOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);

  const attentionEntries = useMemo(() => getAttentionEntries(items), [items]);
  const showAttention = attentionEntries.length > 0;

  // Fires a real in-app notification the first time each item is seen at
  // (or past) its expiry ("Expiring items") or coming up within the window
  // ("Item reminders") — deduped per item name + tier for this session so
  // re-renders don't spam the inbox.
  const notifiedRef = React.useRef<Set<string>>(new Set());
  useEffect(() => {
    if (!userId || !isSupabaseConfigured) return;
    for (const entry of attentionEntries) {
      const category = entry.urgent ? 'expiring_items' : 'item_reminders';
      const key = `${category}:${entry.item.name}:${entry.item.expiry}`;
      if (notifiedRef.current.has(key)) continue;
      notifiedRef.current.add(key);
      const title = entry.urgent ? 'Item expiring' : 'Item reminder';
      notifySelf(userId, category, key, title, `${entry.item.name} — ${entry.badge.toLowerCase()}`);
    }
  }, [attentionEntries, userId]);

  const rows: CategoryRowData[] = useMemo(() => {
    const list: CategoryRowData[] = [
      { id: 'add', label: VIEWS.add.tabLabel, count: items.length ? String(items.length) : '＋' },
    ];
    if (showAttention) {
      list.push({ id: 'attention', label: 'Needs attention', count: String(attentionEntries.length) });
    }
    list.push({
      id: 'friends',
      label: 'Orbit - Find Your Circle',
      count: receivedRequests.length ? String(receivedRequests.length) : '',
      icon: receivedRequests.length ? undefined : CHAT_ICON,
    });
    return list;
  }, [items.length, showAttention, attentionEntries.length, receivedRequests.length]);

  // Ambient preview: while the user is just looking, the context card on
  // its own quietly cycles through every section every 3s — a tour, not
  // a demand. The row list above (and the hero line) stay put, showing
  // whatever the user actually last selected, so nothing above the card
  // appears to change on its own. A real tap always navigates away
  // immediately. Off entirely when the OS asks for reduced motion.
  useEffect(() => {
    // "Orbit" (friends & chat) opens a whole separate section, not a
    // detail rail — it never joins the ambient preview rotation.
    const ids = rows.map((r) => r.id).filter((id) => id !== 'friends');
    if (reduceMotion || ids.length <= 1) return;
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

  const friendRequestNote =
    receivedRequests.length > 0 ? ` ${receivedRequests.length} friend request${receivedRequests.length === 1 ? '' : 's'} waiting.` : '';

  const heroLine =
    activeViewId === 'attention'
      ? 'Set an expiry date and we will nudge you here.'
      : `Say it, scan it, or type it — it files itself.${friendRequestNote}`;

  // The friend-requests card takes over the ambient context card outright
  // (not just a stop in its rotation) whenever there's something waiting —
  // it's a nudge, not scenery.
  const requestNames = receivedRequests.slice(0, 2).map((r) => r.name.split(' ')[0]);
  const showFriendsCard = receivedRequests.length > 0;
  const openFriendRequests = () => {
    goRequests();
    onOpenFriends();
  };

  const contextLabel = showFriendsCard ? 'MAKE FRIENDS' : previewViewId === 'add' ? VIEWS.add.tabLabel : 'Needs attention';
  const contextTitle = showFriendsCard
    ? `${requestNames.length === 1 ? requestNames[0] : requestNames.join(' and ')} want${requestNames.length === 1 ? 's' : ''} to connect`
    : previewViewId === 'add'
      ? VIEWS.add.items[1].title
      : (attentionEntries[0]?.item.name ?? 'All caught up');

  return (
    <View style={styles.screen}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.lime} />

      <View style={{ paddingTop: insets.top + spacing.md }}>
        <View style={styles.headerPad}>
          <Header
            onSearchPress={() => setSearchOpen(true)}
            onAvatarPress={onOpenAccount}
            onBellPress={() => setNotificationsOpen(true)}
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
              if (id === 'friends') {
                onOpenFriends();
                return;
              }
              setActiveViewId(id as ViewId);
              onOpenDetail(id as ViewId);
            }}
            reduceMotion={reduceMotion}
          />
        </ScrollView>

        <ContextCard
          label={contextLabel}
          title={contextTitle}
          onPress={showFriendsCard ? openFriendRequests : () => onOpenDetail(previewViewId)}
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

      <SearchOverlay
        visible={searchOpen}
        onClose={() => setSearchOpen(false)}
        items={items}
        onOpenHome={() => onOpenDetail('add')}
        onOpenDetail={onOpenDetail}
        onOpenExpenses={onOpenExpenses}
        onOpenSplit={onOpenSplit}
        reduceMotion={reduceMotion}
      />

      <NotificationsSheet visible={notificationsOpen} onClose={() => setNotificationsOpen(false)} onNavigate={onOpenNotificationTarget} />
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
