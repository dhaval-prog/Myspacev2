import React, { createContext, useContext, useMemo, useState } from 'react';
import type { Item, Room } from '../types/space';
import { CATEGORY_MONO } from '../data/itemCategories';

interface NewItemInput {
  name: string;
  category: string;
  room: string;
  expiry: string;
}

interface EditItemInput {
  name?: string;
  category?: string;
  room?: string;
  expiry?: string;
}

interface SpaceContextValue {
  rooms: Room[];
  items: Item[];
  toggleRoom: (label: string) => void;
  renameRoom: (from: string, to: string) => void;
  removeRoom: (label: string) => void;
  addItem: (input: NewItemInput) => void;
  editItem: (index: number, input: EditItemInput) => void;
  removeItem: (index: number) => void;
}

const SpaceContext = createContext<SpaceContextValue | null>(null);

export function SpaceProvider({ children }: { children: React.ReactNode }) {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [items, setItems] = useState<Item[]>([]);

  const value = useMemo<SpaceContextValue>(
    () => ({
      rooms,
      items,
      toggleRoom: (label) =>
        setRooms((prev) => (prev.includes(label) ? prev.filter((r) => r !== label) : [...prev, label])),
      renameRoom: (from, to) =>
        setRooms((prev) => prev.map((r) => (r === from ? to : r))),
      removeRoom: (label) => setRooms((prev) => prev.filter((r) => r !== label)),
      addItem: (input) =>
        setItems((prev) => [
          { ...input, mono: CATEGORY_MONO[input.category] || '▢' },
          ...prev,
        ]),
      editItem: (index, input) =>
        setItems((prev) =>
          prev.map((row, i) =>
            i === index
              ? {
                  ...row,
                  ...input,
                  mono: input.category ? CATEGORY_MONO[input.category] || '▢' : row.mono,
                }
              : row,
          ),
        ),
      removeItem: (index) => setItems((prev) => prev.filter((_, i) => i !== index)),
    }),
    [rooms, items],
  );

  return <SpaceContext.Provider value={value}>{children}</SpaceContext.Provider>;
}

export function useSpace(): SpaceContextValue {
  const ctx = useContext(SpaceContext);
  if (!ctx) throw new Error('useSpace must be used within a SpaceProvider');
  return ctx;
}
