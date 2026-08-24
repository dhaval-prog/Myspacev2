export type ViewId = 'rooms' | 'add' | 'attention';

export interface RailItemDef {
  /** Stable key, also used as the rail index lookup ("view-all" | "add" | "edit" | "delete"). */
  id: string;
  mono: string;
  /** Label under the rail tile. */
  rail: string;
  /** Title shown in the detail column when this tile is selected. */
  title: string;
  desc: string;
  /** Locked until the relevant collection (rooms, then items) is non-empty. */
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
 * The two ways into a first-time space: add a room, then add items to it.
 * "Needs attention" is not listed here — it only exists once an item has
 * an expiry date, and is composed dynamically from live data.
 */
export const VIEWS: Record<'rooms' | 'add', ViewDef> = {
  rooms: {
    id: 'rooms',
    tabLabel: 'Add Rooms',
    kicker: 'Room',
    items: [
      {
        id: 'view-all',
        mono: '▤',
        rail: 'View all',
        title: 'Rooms',
        desc: 'Every room you have set up, with the places inside each one.',
        gated: true,
      },
      {
        id: 'add',
        mono: '＋',
        rail: 'Add Rooms',
        title: 'Which room are you adding?',
        desc: 'Pick the rooms you have. Each one arrives with its usual places.',
        gated: false,
      },
      {
        id: 'edit',
        mono: '⌨',
        rail: 'Edit',
        title: 'Name the room',
        desc: 'Rename a room or change the places inside it.',
        gated: true,
      },
      {
        id: 'delete',
        mono: '⌫',
        rail: 'Delete',
        title: 'Remove a room',
        desc: 'Delete a room and everything filed inside it.',
        gated: true,
      },
    ],
  },
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
