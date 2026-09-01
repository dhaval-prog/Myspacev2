export type ViewId = 'add' | 'attention';

export interface RailItemDef {
  /** Stable key, also used as the rail index lookup ("view-all" | "add" | "edit" | "delete"). */
  id: string;
  mono: string;
  /** Label under the rail tile. */
  rail: string;
  /** Title shown in the detail column when this tile is selected. */
  title: string;
  desc: string;
  /** Locked until the relevant collection (items) is non-empty. */
  gated: boolean;
}

export interface ViewDef {
  id: ViewId;
  /** Home row / tab label. */
  tabLabel: string;
  kicker: string;
  items: RailItemDef[];
}

/**
 * The one way into a space: add items directly, picking a room (a fixed
 * default set — see `src/data/rooms.ts`) right in the add form's
 * "Where is it?" step. "Needs attention" is not listed here — it only
 * exists once an item has an expiry date, and is composed dynamically
 * from live data.
 */
export const VIEWS: Record<'add', ViewDef> = {
  add: {
    id: 'add',
    tabLabel: 'Add Items',
    kicker: 'New thing',
    items: [
      {
        id: 'view-all',
        mono: '▤',
        rail: 'View all',
        title: 'Items',
        desc: 'Everything you have filed, newest first.',
        gated: true,
      },
      {
        id: 'add',
        mono: '＋',
        rail: 'Add Items',
        title: 'What are you putting away?',
        desc: 'Say it, scan the label, or type it out. It files itself into the room and place you name.',
        gated: false,
      },
      {
        id: 'delete',
        mono: '⌫',
        rail: 'Delete',
        title: 'Remove an item',
        desc: 'Delete a thing you have filed.',
        gated: true,
      },
      {
        id: 'edit',
        mono: '⌨',
        rail: 'Edit',
        title: 'Edit an item',
        desc: 'Change a name, its category or the place it lives.',
        gated: true,
      },
    ],
  },
};
