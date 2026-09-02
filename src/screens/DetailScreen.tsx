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
import { ConfirmDialog } from '../components/ConfirmDialog';
import { useSpace } from '../context/SpaceContext';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { VIEWS, type ViewId } from '../data/views';
import { ROOM_OPTIONS } from '../data/rooms';
import { RAIL_ICON } from '../data/railIcons';
import { CATEGORY_ICON, EMPTY_CATEGORY_ICON } from '../data/itemCategories';
import { getAttentionEntries } from '../utils/attention';
import { recurAlertDate } from '../utils/alerts';

const BACK_ICON = 'M15 5l-7 7 7 7';
const CHECK_ICON = 'M5 12.5 10 17.5 19 7';
const DELETE_PATH = 'M4 7h16M9.5 7V4.5h5V7M6.5 7l1 13h9l1-13M10.5 10.5v6.5M13.5 10.5v6.5';

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
    if (!isFormView) return [];
    return VIEWS.add.items.map((it) => ({
      id: it.id,
      mono: it.mono,
      label: it.rail,
      path: RAIL_ICON[it.rail],
      locked: it.gated && gateOn,
    }));
  }, [isFormView, gateOn]);

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
    title = 'Needs attention';
    subline =
      attentionEntries.length > 0
        ? `${attentionEntries.length} ${attentionEntries.length === 1 ? 'thing needs' : 'things need'} a look`
        : 'Nothing is expiring soon.';
  }

  return (
    <View style={styles.screen}>
      {!collapsed && isFormView && (
        <Pressable
          onPress={() => setCollapsed(true)}
          style={styles.railBackdrop}
          accessibilityRole="button"
          accessibilityLabel="Dismiss tools"
        />
      )}

      <View style={[styles.body, { paddingTop: insets.top + spacing.md }]}>
        {isFormView && (
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

        {isFormView ? (
          <ContentColumn collapsed={collapsed} reduceMotion={reduceMotion}>
            <View key={selectedTileId} style={styles.titleBlock}>
              <Text style={typography.detailTitle}>{title}</Text>
              <Text style={[typography.detailSubline, styles.subline]}>{subline}</Text>
            </View>

            {selectedTileId === 'add' && <ItemForm rooms={ROOM_OPTIONS} onSubmit={addItem} />}
            {selectedTileId === 'view-all' && items.length > 0 && (
              <ItemList items={items} rooms={ROOM_OPTIONS} mode="view" onDelete={removeItem} onEditSave={editItem} />
            )}
            {selectedTileId === 'alerts' && <AlertForm onSubmit={addItem} />}
          </ContentColumn>
        ) : (
          <View style={styles.attentionColumn}>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.attentionScroll}>
              <View style={styles.titleBlock}>
                <Text style={typography.detailTitle}>{title}</Text>
                <Text style={[typography.detailSubline, styles.subline]}>{subline}</Text>
              </View>

              {attentionEntries.map((entry) => (
                <AttentionRow
                  key={entry.item.name + entry.index}
                  entry={entry}
                  onResolve={() => {
                    const alertType = entry.item.alertType;
                    editItem(entry.index, { expiry: alertType ? recurAlertDate(alertType) : '' });
                  }}
                  onRemove={() => removeItem(entry.index)}
                />
              ))}
            </ScrollView>
          </View>
        )}
      </View>

      <View
        style={[
          styles.pinnedBack,
          { paddingBottom: viewId === 'add' ? spacing.ms : Math.max(insets.bottom, spacing.md) + spacing.ms },
        ]}
        pointerEvents="box-none"
      >
        <Pressable onPress={onBack} style={styles.backCircle} accessibilityRole="button" accessibilityLabel="Back">
          <Icon path={BACK_ICON} color={colors.textPrimary} size={18} strokeWidth={2} />
        </Pressable>
      </View>
      {viewId === 'add' && (
        <View style={styles.bottomNavWrap} pointerEvents="box-none">
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
        </View>
      )}
    </View>
  );
}

/** One line per "needs attention" entry — icon, name + badge, mark-used/remove actions. */
function AttentionRow({
  entry,
  onResolve,
  onRemove,
}: {
  entry: ReturnType<typeof getAttentionEntries>[number];
  onResolve: () => void;
  onRemove: () => void;
}) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const meta = [entry.item.category, entry.item.room].filter(Boolean).join(' · ') || 'Unfiled';

  return (
    <View style={attentionStyles.row}>
      <View style={attentionStyles.rowIcon}>
        <Icon path={CATEGORY_ICON[entry.item.category] || EMPTY_CATEGORY_ICON} color={colors.pale} size={17} />
      </View>
      <View style={attentionStyles.rowText}>
        <Text style={attentionStyles.rowName} numberOfLines={1}>
          {entry.item.name}
        </Text>
        <Text style={[attentionStyles.rowBadge, entry.urgent && attentionStyles.rowBadgeUrgent]} numberOfLines={1}>
          {entry.badge} · {meta}
        </Text>
      </View>
      <Pressable
        onPress={onResolve}
        accessibilityRole="button"
        accessibilityLabel={`Mark ${entry.item.name} used`}
        style={[attentionStyles.actionBtn, { backgroundColor: colors.ink }]}
      >
        <Icon path={CHECK_ICON} color={colors.lime} size={14} strokeWidth={2.4} />
      </Pressable>
      <Pressable
        onPress={() => setConfirmOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={`Remove ${entry.item.name}`}
        style={[attentionStyles.actionBtn, { backgroundColor: 'rgba(211,50,67,0.12)' }]}
      >
        <Icon path={DELETE_PATH} color="#D33243" size={14} strokeWidth={1.9} />
      </Pressable>

      <ConfirmDialog
        visible={confirmOpen}
        title={`Remove ${entry.item.name}?`}
        message="This removes it permanently — it can't be undone."
        confirmLabel="Remove"
        destructive
        onConfirm={() => {
          setConfirmOpen(false);
          onRemove();
        }}
        onCancel={() => setConfirmOpen(false)}
      />
    </View>
  );
}

const attentionStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.pale,
    borderRadius: radius.md - 8,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.ms,
  },
  rowIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowText: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  rowName: {
    fontFamily: typography.itemTitle.fontFamily,
    fontSize: 14.5,
    color: colors.textPrimary,
  },
  rowBadge: {
    fontFamily: typography.itemSub.fontFamily,
    fontSize: 12,
    color: colors.textSecondary,
  },
  rowBadgeUrgent: {
    color: '#D33243',
  },
  actionBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
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
    zIndex: 6,
  },
  bottomNavWrap: {
    zIndex: 6,
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
    zIndex: 6,
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
  attentionColumn: {
    flex: 1,
    marginLeft: spacing.xxxl,
    marginRight: spacing.xxxl,
    zIndex: 1,
  },
  attentionScroll: {
    paddingTop: spacing.md,
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
