import React from 'react';
import { act } from '@testing-library/react-native';
import { renderWithSafeArea } from '../../../testUtils/renderWithSafeArea';
import { ThrowInboxScreen } from '../ThrowInboxScreen';
import { useThrow } from '../../../context/ThrowContext';
import { useThrowColorMode } from '../../../context/ThrowColorModeContext';
import { useReducedMotion } from '../../../hooks/useReducedMotion';
import type { ThrowLetter } from '../../../types/throw';

jest.mock('../../../context/ThrowContext', () => ({ useThrow: jest.fn() }));
jest.mock('../../../context/ThrowColorModeContext', () => ({ useThrowColorMode: jest.fn() }));
jest.mock('../../../hooks/useReducedMotion', () => ({ useReducedMotion: jest.fn() }));

// InboxMap pulls in mapbox-gl (a real browser map library, irrelevant to the data/state-machine
// logic under test here) via its .web/.native platform split — stubbed out the same way ThrowMap
// is in ThrowHomeScreen's own tests.
jest.mock('../../../components/throw/inbox/InboxMap', () => ({
  InboxMap: () => null,
}));

let mockContactsRailProps: any;
jest.mock('../../../components/throw/inbox/ContactsRail', () => ({
  ContactsRail: (props: any) => {
    mockContactsRailProps = props;
    return null;
  },
}));

let mockLetterFoldCardProps: any;
jest.mock('../../../components/throw/inbox/LetterFoldCard', () => ({
  LetterFoldCard: (props: any) => {
    mockLetterFoldCardProps = props;
    return null;
  },
}));

let mockPlaneSliderProps: any;
jest.mock('../../../components/throw/inbox/PlaneSlider', () => ({
  PlaneSlider: (props: any) => {
    mockPlaneSliderProps = props;
    return null;
  },
}));

const mockUseThrow = useThrow as jest.Mock;
const mockUseThrowColorMode = useThrowColorMode as jest.Mock;
const mockUseReducedMotion = useReducedMotion as jest.Mock;

const noop = () => {};

function letter(overrides: Partial<ThrowLetter> & { id: string; counterpartId: string; createdAt: string }): ThrowLetter {
  return {
    senderId: overrides.counterpartId,
    recipientId: 'me-1',
    counterpartName: 'Dhaval',
    counterpartAvatarUrl: null,
    direction: 'received',
    messageText: 'Monsoon finally reached Pune.',
    strokes: null,
    penColor: null,
    photoUrls: [],
    senderCity: 'Pune',
    senderCountry: 'IN',
    senderLatitude: 18.5,
    senderLongitude: 73.8,
    recipientCity: 'Mumbai',
    recipientCountry: 'IN',
    recipientLatitude: 19.07,
    recipientLongitude: 72.87,
    distanceMiles: 1180,
    status: 'thrown',
    readAt: null,
    repliedToThrowId: null,
    ...overrides,
  };
}

function setupMocks(inbox: ThrowLetter[], deleteThrow = jest.fn().mockResolvedValue({ error: null })) {
  mockUseThrow.mockReturnValue({
    inbox,
    deleteThrow,
    markRead: jest.fn().mockResolvedValue(undefined),
    unreadCountFor: (counterpartId: string) => inbox.filter((l) => l.counterpartId === counterpartId && l.status === 'thrown').length,
  });
  mockUseThrowColorMode.mockReturnValue({ mapIsDay: true });
  mockUseReducedMotion.mockReturnValue(true); // avoids depending on the rAF-driven flight timeline
  return deleteThrow;
}

async function renderScreen(props: Partial<React.ComponentProps<typeof ThrowInboxScreen>> = {}) {
  await renderWithSafeArea(<ThrowInboxScreen onBack={noop} onThrowBack={noop} {...props} />);
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers();
  mockContactsRailProps = undefined;
  mockLetterFoldCardProps = undefined;
  mockPlaneSliderProps = undefined;
});

afterEach(() => {
  jest.useRealTimers();
});

describe('ThrowInboxScreen contact grouping', () => {
  it('groups letters by counterpart and sorts contacts by their newest letter, newest-first', async () => {
    setupMocks([
      letter({ id: 'l1', counterpartId: 'a', counterpartName: 'Alice', createdAt: '2026-09-01T09:00:00.000Z' }),
      letter({ id: 'l2', counterpartId: 'b', counterpartName: 'Bob', createdAt: '2026-09-20T09:00:00.000Z' }),
      letter({ id: 'l3', counterpartId: 'a', counterpartName: 'Alice', createdAt: '2026-09-15T09:00:00.000Z' }),
    ]);
    await renderScreen();

    expect(mockContactsRailProps.contacts.map((c: any) => c.id)).toEqual(['b', 'a']);
    expect(mockContactsRailProps.contacts.find((c: any) => c.id === 'a').count).toBe(2);
    expect(mockContactsRailProps.contacts.find((c: any) => c.id === 'b').count).toBe(1);
  });

  it('within a contact, keeps letters newest-first for the plane chip row', async () => {
    // ThrowContext's own `inbox` is already queried newest-first (order('created_at', {ascending:
    // false})) — grouping-by-counterpart relies on that upstream order rather than re-sorting, so
    // the fixture here lists the newer letter first, matching what the real inbox array looks like.
    setupMocks([
      letter({ id: 'newer', counterpartId: 'a', createdAt: '2026-09-20T09:00:00.000Z' }),
      letter({ id: 'older', counterpartId: 'a', createdAt: '2026-09-01T09:00:00.000Z' }),
    ]);
    await renderScreen({ initialContactId: 'a' });
    await act(async () => {
      jest.advanceTimersByTime(600);
    });

    expect(mockPlaneSliderProps.chips.map((c: any) => c.id)).toEqual(['newer', 'older']);
  });
});

describe('ThrowInboxScreen initial contact selection', () => {
  it('selects the contact passed as initialContactId', async () => {
    setupMocks([
      letter({ id: 'l1', counterpartId: 'a', counterpartName: 'Alice', createdAt: '2026-09-20T09:00:00.000Z' }),
      letter({ id: 'l2', counterpartId: 'b', counterpartName: 'Bob', createdAt: '2026-09-25T09:00:00.000Z' }),
    ]);
    await renderScreen({ initialContactId: 'a' });

    expect(mockContactsRailProps.selectedId).toBe('a');
  });

  it('falls back to the contact with the newest letter when no initialContactId is given', async () => {
    setupMocks([
      letter({ id: 'l1', counterpartId: 'a', counterpartName: 'Alice', createdAt: '2026-09-01T09:00:00.000Z' }),
      letter({ id: 'l2', counterpartId: 'b', counterpartName: 'Bob', createdAt: '2026-09-25T09:00:00.000Z' }),
    ]);
    await renderScreen();

    expect(mockContactsRailProps.selectedId).toBe('b');
  });

  it('falls back to the newest contact when initialContactId does not match anyone', async () => {
    setupMocks([
      letter({ id: 'l1', counterpartId: 'a', counterpartName: 'Alice', createdAt: '2026-09-01T09:00:00.000Z' }),
      letter({ id: 'l2', counterpartId: 'b', counterpartName: 'Bob', createdAt: '2026-09-25T09:00:00.000Z' }),
    ]);
    await renderScreen({ initialContactId: 'nobody' });

    expect(mockContactsRailProps.selectedId).toBe('b');
  });
});

describe('ThrowInboxScreen letter card data', () => {
  it('builds the card fields the design expects, and opens directly under reduced motion', async () => {
    setupMocks([
      letter({
        id: 'l1',
        counterpartId: 'a',
        counterpartName: 'Dhaval',
        createdAt: new Date().toISOString(),
        messageText: 'Monsoon finally reached Pune.',
        senderCity: 'Pune',
        distanceMiles: 1180,
      }),
    ]);
    await renderScreen({ initialContactId: 'a' });
    await act(async () => {
      jest.advanceTimersByTime(600);
    });

    expect(mockLetterFoldCardProps.stage).toBe('open');
    expect(mockLetterFoldCardProps.letter).toEqual(
      expect.objectContaining({
        from: 'Dhaval',
        place: 'PUNE',
        distance: '1,180 MI',
        body: 'Monsoon finally reached Pune.',
        sig: '— D.',
        count: '1 / 1',
      }),
    );
    expect(mockLetterFoldCardProps.letter.date).toMatch(/^TODAY · /);
  });

  it('falls back to a placeholder body for a photo-only letter', async () => {
    setupMocks([letter({ id: 'l1', counterpartId: 'a', createdAt: new Date().toISOString(), messageText: null, photoUrls: ['https://example.com/p.jpg'] })]);
    await renderScreen({ initialContactId: 'a' });
    await act(async () => {
      jest.advanceTimersByTime(600);
    });

    expect(mockLetterFoldCardProps.letter.body).toBe('Sent a photo.');
  });
});

describe('ThrowInboxScreen contact switching', () => {
  it('shows the empty-state card when switching to a contact with no letters', async () => {
    setupMocks([
      letter({ id: 'l1', counterpartId: 'a', counterpartName: 'Alice', createdAt: new Date().toISOString() }),
    ]);
    await renderScreen({ initialContactId: 'a' });
    await act(async () => {
      jest.advanceTimersByTime(600);
    });
    expect(mockLetterFoldCardProps.isEmpty).toBe(false);

    // Selecting a contact id not present in the (letters-only) grouped list mirrors picking a
    // friend on the rail who has never sent a letter.
    await act(async () => {
      mockContactsRailProps.onSelect('nobody-with-letters');
    });

    expect(mockLetterFoldCardProps.isEmpty).toBe(true);
  });

  it('does nothing when re-selecting the already-active contact', async () => {
    setupMocks([
      letter({ id: 'l1', counterpartId: 'a', counterpartName: 'Alice', createdAt: new Date().toISOString() }),
      letter({ id: 'l2', counterpartId: 'b', counterpartName: 'Bob', createdAt: '2026-09-01T09:00:00.000Z' }),
    ]);
    await renderScreen({ initialContactId: 'a' });
    await act(async () => {
      jest.advanceTimersByTime(600);
    });

    await act(async () => {
      mockContactsRailProps.onSelect('a');
    });

    expect(mockContactsRailProps.selectedId).toBe('a');
  });
});

describe('ThrowInboxScreen delete', () => {
  it('calls deleteThrow with the active letter id and drops it from the rail badge count', async () => {
    const deleteThrow = jest.fn().mockResolvedValue({ error: null });
    setupMocks(
      [
        letter({ id: 'l2', counterpartId: 'a', counterpartName: 'Alice', createdAt: '2026-09-25T09:00:00.000Z' }),
        letter({ id: 'l1', counterpartId: 'a', counterpartName: 'Alice', createdAt: '2026-09-20T09:00:00.000Z' }),
      ],
      deleteThrow,
    );
    await renderScreen({ initialContactId: 'a' });
    await act(async () => {
      jest.advanceTimersByTime(600);
    });
    expect(mockContactsRailProps.contacts.find((c: any) => c.id === 'a').count).toBe(2);

    await act(async () => {
      mockPlaneSliderProps.onDelete();
      jest.advanceTimersByTime(600);
    });

    expect(deleteThrow).toHaveBeenCalledWith('l2');
    expect(mockContactsRailProps.contacts.find((c: any) => c.id === 'a').count).toBe(1);
  });

  it('moves to the empty state once the only letter from a contact is deleted', async () => {
    const deleteThrow = jest.fn().mockResolvedValue({ error: null });
    setupMocks([letter({ id: 'l1', counterpartId: 'a', counterpartName: 'Alice', createdAt: new Date().toISOString() })], deleteThrow);
    await renderScreen({ initialContactId: 'a' });
    await act(async () => {
      jest.advanceTimersByTime(600);
    });

    await act(async () => {
      mockPlaneSliderProps.onDelete();
      jest.advanceTimersByTime(600);
    });

    expect(deleteThrow).toHaveBeenCalledWith('l1');
    expect(mockLetterFoldCardProps.isEmpty).toBe(true);
  });
});
