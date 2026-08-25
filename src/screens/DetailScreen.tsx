import React, { useMemo, useState } from 'react';
import { Animated, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing, typography, radius, EASE, duration } from '../theme';
import { Rail, type RailTile } from '../components/Rail';
import { RoomPicker } from '../components/RoomPicker';
import { RoomList } from '../components/RoomList';
import { RenameSheet } from '../components/RenameSheet';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { ItemForm } from '../components/ItemForm';
import { ItemList } from '../components/ItemList';
import { useSpace } from '../context/SpaceContext';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { VIEWS, type ViewId } from '../data/views';
import { RAIL_ICON } from '../data/railIcons';
import { getAttentionEntries, formatDate } from '../utils/attention';
import type { Room } from '../types/space';

interface DetailScreenProps {
  viewId: ViewId;
  onBack: () => void;
}

export function DetailScreen({ viewId, onBack }: DetailScreenProps) {
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const { rooms, items, addRoom, renameRoom, removeRoom, addItem, editItem, removeItem } = useSpace();

  const [railIndex, setRailIndex] = useState(1);
  const [collapsed, setCollapsed] = useState(false);
  const [renameTarget, setRenameTarget] = useState<Room | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Room | null>(null);
  const roomLabels = useMemo(() => rooms.map((r) => r.label), [rooms]);

  const attentionEntries = useMemo(() => getAttentionEntries(items), [items]);

  const isFormView = viewId === 'rooms' || viewId === 'add';
  const gateOn = viewId === 'add' ? items.length === 0 : rooms.length === 0;

  const tiles: RailTile[] = useMemo(() => {
    if (isFormView) {
      const v = VIEWS[viewId as 'rooms' | 'add'];
      return v.items.map((it) => ({
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
      locked: false,
    }));
  }, [isFormView, viewId, gateOn, attentionEntries]);

  const ri = Math.min(railIndex, Math.max(tiles.length - 1, 0));
  const selectedTileId = tiles[ri]?.id;

  const handleSelectTile = (index: number) => {
    setRailIndex(index);
    setCollapsed(true);
  };

  let title = '';
  let subline = '';

  if (isFormView) {
    const v = VIEWS[viewId as 'rooms' | 'add'];
    const sel = v.items[ri];
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
      <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
        <Pressable onPress={onBack} accessibilityRole="button" accessibilityLabel="Back" style={styles.backButton}>
          <Text style={typography.backLabel}>‹ Back</Text>
        </Pressable>
        <View style={styles.avatar}>
          <Text style={styles.avatarIcon}>◎</Text>
        </View>
      </View>

      <View style={styles.body}>
        {(isFormView || tiles.length > 0) && (
          <Rail
            tiles={tiles}
            activeIndex={ri}
            collapsed={collapsed}
            onSelect={handleSelectTile}
            onToggleCollapse={() => setCollapsed((c) => !c)}
            reduceMotion={reduceMotion}
          />
        )}

        <ContentColumn collapsed={collapsed || tiles.length === 0} reduceMotion={reduceMotion}>
          <View key={`${viewId}-${selectedTileId}`} style={styles.titleBlock}>
            <Text style={typography.detailTitle}>{title}</Text>
            <Text style={[typography.detailSubline, styles.subline]}>{subline}</Text>
          </View>

          {viewId === 'rooms' && ri === 1 && (
            <RoomPicker lockedCategories={rooms.map((r) => r.category)} onSelect={addRoom} />
          )}
          {viewId === 'rooms' && ri === 0 && rooms.length > 0 && <RoomList rooms={rooms} mode="view" />}
          {viewId === 'rooms' && ri === 2 && rooms.length > 0 && (
            <RoomList rooms={rooms} mode="edit" onEdit={setRenameTarget} />
          )}
          {viewId === 'rooms' && ri === 3 && rooms.length > 0 && (
            <RoomList rooms={rooms} mode="delete" onDelete={setDeleteTarget} />
          )}

          {viewId === 'add' && ri === 1 && <ItemForm rooms={roomLabels} onSubmit={addItem} />}
          {viewId === 'add' && ri === 0 && items.length > 0 && (
            <ItemList items={items} rooms={roomLabels} mode="view" />
          )}
          {viewId === 'add' && ri === 2 && items.length > 0 && (
            <ItemList items={items} rooms={roomLabels} mode="delete" onDelete={removeItem} />
          )}
          {viewId === 'add' && ri === 3 && items.length > 0 && (
            <ItemList items={items} rooms={roomLabels} mode="edit" onEditSave={editItem} />
          )}

          {viewId === 'attention' && attentionEntries[ri] && (
            <AttentionDetail
              entry={attentionEntries[ri]}
              onResolve={() => removeItem(attentionEntries[ri].index)}
              onRemove={() => removeItem(attentionEntries[ri].index)}
            />
          )}
        </ContentColumn>
      </View>

      <RenameSheet
        visible={renameTarget !== null}
        initialValue={renameTarget?.label ?? ''}
        onCancel={() => setRenameTarget(null)}
        onSave={(value) => {
          if (renameTarget) renameRoom(renameTarget.id, value);
          setRenameTarget(null);
        }}
      />

      <ConfirmDialog
        visible={deleteTarget !== null}
        title="Delete this room?"
        message={`All items in "${deleteTarget?.label ?? ''}" will be deleted permanently.`}
        confirmLabel="Delete"
        destructive
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (deleteTarget) removeRoom(deleteTarget.id);
          setDeleteTarget(null);
        }}
      />
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
  return (
    <View style={attentionStyles.card}>
      <Text style={typography.formLabel}>Expires {formatDate(entry.item.expiry)}</Text>
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xxxl,
  },
  backButton: {
    minHeight: 44,
    justifyContent: 'center',
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    backgroundColor: colors.pale,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarIcon: {
    fontSize: 15,
    color: colors.textPrimary,
  },
  body: {
    flex: 1,
    marginTop: spacing.huge,
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
