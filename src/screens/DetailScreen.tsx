import React, { useMemo, useState } from 'react';
import { Animated, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing, typography, radius, EASE, duration } from '../theme';
import { Rail, type RailTile } from '../components/Rail';
import { ItemForm } from '../components/ItemForm';
import { AlertForm } from '../components/AlertForm';
import { ItemList } from '../components/ItemList';
import { Icon } from '../components/Icon';
import { BottomNav } from '../components/BottomNav';
import { useSpace } from '../context/SpaceContext';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { VIEWS, type ViewId } from '../data/views';
import { ROOM_OPTIONS } from '../data/rooms';
import { RAIL_ICON } from '../data/railIcons';
import { CATEGORY_ICON } from '../data/itemCategories';
import { getAttentionEntries, formatDate } from '../utils/attention';
import { formatTime12 } from '../utils/time';
import { recurAlertDate } from '../utils/alerts';

const BACK_ICON = 'M15 5l-7 7 7 7';

interface DetailScreenProps {
  viewId: ViewId;
  initialIndex?: number;
  onBack: () => void;
  onOpenExpenses: () => void;
  onOpenSplit: () => void;
}

export function DetailScreen({ viewId, initialIndex, onBack, onOpenExpenses, onOpenSplit }: DetailScreenProps) {
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const { items, addItem, editItem, removeItem } = useSpace();

  const [railIndex, setRailIndex] = useState(initialIndex ?? 1);
  const [collapsed, setCollapsed] = useState(false);

  const attentionEntries = useMemo(() => getAttentionEntries(items), [items]);

  const isFormView = viewId === 'add';
  const gateOn = items.length === 0;

  const tiles: RailTile[] = useMemo(() => {
    if (isFormView) {
      return VIEWS.add.items.map((it) => ({
        id: it.id,
        mono: it.mono,
        label: it.rail,
        path: RAIL_ICON[it.rail],
        locked: it.gated && gateOn,
      }));
    }
    return attentionEntries.map((entry) => ({
      id: entry.item.name + entry.index,
      mono: entry.item.mono,
      label: entry.item.name,
      path: entry.item.category === 'Alert' ? CATEGORY_ICON.Alert : undefined,
      locked: false,
    }));
  }, [isFormView, gateOn, attentionEntries]);

  const ri = Math.min(railIndex, Math.max(tiles.length - 1, 0));
  const selectedTileId = tiles[ri]?.id;

  const handleSelectTile = (index: number) => {
    setRailIndex(index);
    setCollapsed(true);
  };

  let title = '';
  let subline = '';

  if (isFormView) {
    const sel = VIEWS.add.items[ri];
    title = sel?.title ?? '';
    subline = sel?.desc ?? '';
  } else {
    const entry = attentionEntries[ri];
    title = entry ? entry.item.name : 'All caught up';
    subline = entry
      ? `${entry.badge} · ${[entry.item.category, entry.item.room].filter(Boolean).join(' · ') || 'Unfiled'}`
      : 'Nothing is expiring soon.';
  }

  return (
    <View style={styles.screen}>
      <View style={[styles.body, { paddingTop: insets.top + spacing.md }]}>
        {(isFormView || tiles.length > 0) && (
          <Rail
            tiles={tiles}
            activeIndex={ri}
            collapsed={collapsed}
            onSelect={handleSelectTile}
            onToggleCollapse={() => setCollapsed((c) => !c)}
            reduceMotion={reduceMotion}
            showLabels={isFormView}
          />
        )}

        {!collapsed && (isFormView || tiles.length > 0) && (
          <Pressable
            onPress={() => setCollapsed(true)}
            style={styles.railBackdrop}
            accessibilityRole="button"
            accessibilityLabel="Dismiss tools"
          />
        )}

        <ContentColumn collapsed={collapsed || tiles.length === 0} reduceMotion={reduceMotion}>
          <View key={`${viewId}-${selectedTileId}`} style={styles.titleBlock}>
            <Text style={typography.detailTitle}>{title}</Text>
            <Text style={[typography.detailSubline, styles.subline]}>{subline}</Text>
          </View>

          {viewId === 'add' && selectedTileId === 'add' && <ItemForm rooms={ROOM_OPTIONS} onSubmit={addItem} />}
          {viewId === 'add' && selectedTileId === 'view-all' && items.length > 0 && (
            <ItemList items={items} rooms={ROOM_OPTIONS} mode="view" onDelete={removeItem} onEditSave={editItem} />
          )}
          {viewId === 'add' && selectedTileId === 'alerts' && <AlertForm onSubmit={addItem} />}

          {viewId === 'attention' && attentionEntries[ri] && (
            <AttentionDetail
              entry={attentionEntries[ri]}
              onResolve={() => {
                const entry = attentionEntries[ri];
                const alertType = entry.item.alertType;
                editItem(entry.index, { expiry: alertType ? recurAlertDate(alertType) : '' });
              }}
              onRemove={() => removeItem(attentionEntries[ri].index)}
            />
          )}
        </ContentColumn>
      </View>

      <View
        style={[
          styles.pinnedBack,
          { paddingBottom: viewId === 'add' ? spacing.ms : Math.max(insets.bottom, spacing.md) + spacing.ms },
        ]}
      >
        <Pressable onPress={onBack} style={styles.backCircle} accessibilityRole="button" accessibilityLabel="Back">
          <Icon path={BACK_ICON} color={colors.textPrimary} size={18} strokeWidth={2} />
        </Pressable>
      </View>
      {viewId === 'add' && (
        <BottomNav
          activeId="home"
          onSelect={(id) => {
            if (id === 'home') onBack();
            if (id === 'expenses') onOpenExpenses();
            if (id === 'split') onOpenSplit();
          }}
          bottomInset={insets.bottom}
          reduceMotion={reduceMotion}
        />
      )}
    </View>
  );
}

function AttentionDetail({
  entry,
  onResolve,
  onRemove,
}: {
  entry: ReturnType<typeof getAttentionEntries>[number];
  onResolve: () => void;
  onRemove: () => void;
}) {
  const time = entry.item.reminderTimes?.[0];
  return (
    <View style={attentionStyles.card}>
      <Text style={typography.formLabel}>
        Expires {formatDate(entry.item.expiry)}
        {time ? ` at ${formatTime12(time)}` : ''}
      </Text>
      <View style={attentionStyles.actions}>
        <Pressable onPress={onResolve} style={[attentionStyles.button, { backgroundColor: colors.ink }]}>
          <Text style={[typography.buttonLabel, { fontSize: 13, color: colors.lime }]}>Mark used</Text>
        </Pressable>
        <Pressable onPress={onRemove} style={[attentionStyles.button, { backgroundColor: 'rgba(211,50,67,0.12)' }]}>
          <Text style={[typography.buttonLabel, { fontSize: 13, color: '#D33243' }]}>Remove item</Text>
        </Pressable>
      </View>
    </View>
  );
}

const attentionStyles = StyleSheet.create({
  card: {
    backgroundColor: colors.pale,
    borderRadius: radius.md,
    padding: spacing.lg,
    gap: spacing.ms,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  button: {
    flex: 1,
    paddingVertical: spacing.ms,
    borderRadius: radius.md - 8,
    alignItems: 'center',
  },
});

function ContentColumn({
  collapsed,
  reduceMotion,
  children,
}: {
  collapsed: boolean;
  reduceMotion?: boolean;
  children: React.ReactNode;
}) {
  const shift = React.useRef(new Animated.Value(collapsed ? 1 : 0)).current;

  React.useEffect(() => {
    Animated.timing(shift, {
      toValue: collapsed ? 1 : 0,
      duration: reduceMotion ? 0 : duration.screen,
      easing: EASE,
      useNativeDriver: false,
    }).start();
  }, [collapsed, shift, reduceMotion]);

  const marginLeft = shift.interpolate({ inputRange: [0, 1], outputRange: [156, 22] });

  return (
    <Animated.View style={[styles.contentColumn, { marginLeft }]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.contentScroll}>
        {children}
      </ScrollView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.lime,
  },
  pinnedBack: {
    paddingHorizontal: spacing.xxxl,
    paddingTop: spacing.ms,
  },
  backCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.ink,
    shadowOpacity: 0.06,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 14,
    elevation: 1,
  },
  body: {
    flex: 1,
  },
  railBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 5,
  },
  contentColumn: {
    flex: 1,
    marginRight: spacing.xxxl,
    zIndex: 1,
  },
  contentScroll: {
    // Clears the rail's toggle notch (26 top margin + 40 tall) with room to spare.
    paddingTop: 78,
    paddingBottom: spacing.huge,
    gap: spacing.xxl,
  },
  titleBlock: {
    gap: 0,
  },
  subline: {
    marginTop: spacing.xs,
  },
});
