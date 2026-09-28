import React from 'react';
import { act, render, fireEvent, screen } from '@testing-library/react-native';
import { RecipientCarousel } from '../RecipientCarousel';
import { useCarouselPos } from '../../../hooks/useCarouselPos';
import type { ThrowFriend } from '../../../types/throw';

const FRIENDS: ThrowFriend[] = [
  { userId: 'me', name: 'Myself', avatarUrl: null, location: { city: 'Mumbai', country: 'IN', latitude: 19, longitude: 72 } },
  { userId: 'friend-1', name: 'Priya', avatarUrl: null, location: { city: 'Pune', country: 'IN', latitude: 18.5, longitude: 73.8 } },
];

// A thin harness owning the real spring core (RecipientCarousel no longer tracks its own
// selection) — mirrors exactly how ThrowHomeScreen itself instantiates and hands it down.
function Harness({
  onSettle,
  storyCountFor,
  onOpenStory,
  selfUserId,
  youUserId,
  onOpenYouStatus,
}: {
  onSettle: (index: number) => void;
  storyCountFor?: (userId: string) => number;
  onOpenStory?: (userId: string) => void;
  selfUserId?: string;
  youUserId?: string;
  onOpenYouStatus?: () => void;
}) {
  const core = useCarouselPos({ min: youUserId ? -1 : 0, max: FRIENDS.length - 1, initial: 0, onSettle });
  return (
    <RecipientCarousel
      core={core}
      friends={FRIENDS}
      storyCountFor={storyCountFor}
      onOpenStory={onOpenStory}
      selfUserId={selfUserId}
      youUserId={youUserId}
      onOpenYouStatus={onOpenYouStatus}
    />
  );
}

// springTo's own commit (and thus onSettle/onOpenStory) fires synchronously the instant a tap is
// pressed — but it also kicks off a real requestAnimationFrame loop (real wall-clock time, not
// fake timers — see useCarouselPos's own doc comment on why this can't use RN's Animated.spring)
// that needs to actually finish before the tree unmounts cleanly between tests, or a still-running
// frame from one test lands mid-render of the next. Pressing through this helper (real delay, not
// fake timers) is the same fix this session already needed for ContactStoryStack's own Animated
// timing in an earlier round.
async function pressAndSettle(label: string, byLabel = false) {
  await act(async () => {
    fireEvent.press(byLabel ? screen.getByLabelText(label) : screen.getByText(label));
    await new Promise((resolve) => setTimeout(resolve, 700));
  });
}

describe('RecipientCarousel story-tap behavior', () => {
  it('selects an unselected contact on tap, even when they have an active story', async () => {
    const onSettle = jest.fn();
    const onOpenStory = jest.fn();
    await render(<Harness onSettle={onSettle} storyCountFor={() => 2} onOpenStory={onOpenStory} />);
    await pressAndSettle('Priya');
    expect(onSettle).toHaveBeenCalledWith(1);
    expect(onOpenStory).not.toHaveBeenCalled();
  });

  it('opens the story instead of re-selecting when the already-selected contact has one', async () => {
    const onSettle = jest.fn();
    const onOpenStory = jest.fn();
    await render(<Harness onSettle={onSettle} storyCountFor={(userId) => (userId === 'friend-1' ? 1 : 0)} onOpenStory={onOpenStory} />);
    // Select Priya first (index 1), then tap her again — the already-selected+has-story case.
    await pressAndSettle('Priya');
    onSettle.mockClear();
    await pressAndSettle('Priya');
    expect(onOpenStory).toHaveBeenCalledWith('friend-1');
    expect(onSettle).not.toHaveBeenCalled();
  });

  it('re-selecting (a no-op) is all that happens for an already-selected contact with no story', async () => {
    const onSettle = jest.fn();
    const onOpenStory = jest.fn();
    await render(<Harness onSettle={onSettle} storyCountFor={() => 0} onOpenStory={onOpenStory} />);
    await pressAndSettle('Myself');
    expect(onOpenStory).not.toHaveBeenCalled();
    // Index 0 is already the initial position, so springTo(0) is a same-target no-op commit —
    // onSettle only fires on an actual change (see useCarouselPos's own doc comment).
    expect(onSettle).not.toHaveBeenCalled();
  });

  it('never treats "Myself" as having a status to open, even with an active story count', async () => {
    const onSettle = jest.fn();
    const onOpenStory = jest.fn();
    await render(<Harness onSettle={onSettle} storyCountFor={() => 5} onOpenStory={onOpenStory} selfUserId="me" />);
    await pressAndSettle('Myself');
    expect(onOpenStory).not.toHaveBeenCalled();
  });
});

describe('RecipientCarousel "You" slot', () => {
  it('is absent entirely when no youUserId is given', async () => {
    await render(<Harness onSettle={jest.fn()} />);
    expect(screen.queryByLabelText('Your status')).toBeNull();
  });

  it('springs to index -1 on tap', async () => {
    const onSettle = jest.fn();
    await render(<Harness onSettle={onSettle} youUserId="me" />);
    await pressAndSettle('Your status', true);
    // onSettle fires for every committed index, -1 included — ThrowHomeScreen's own callback is
    // what ignores anything below 0 (see its own `if (index < 0) return;`), not this hook.
    expect(onSettle).toHaveBeenCalledWith(-1);
  });

  it('fires onOpenYouStatus on every re-tap of the already-selected "You" avatar', async () => {
    const onOpenYouStatus = jest.fn();
    await render(<Harness onSettle={jest.fn()} youUserId="me" onOpenYouStatus={onOpenYouStatus} />);
    await pressAndSettle('Your status', true);
    expect(onOpenYouStatus).not.toHaveBeenCalled();
    await pressAndSettle('Your status', true);
    expect(onOpenYouStatus).toHaveBeenCalledTimes(1);
  });

  it('shows "My status" once posted, "Add status" otherwise', async () => {
    const { rerender } = await render(<Harness onSettle={jest.fn()} youUserId="me" storyCountFor={() => 0} />);
    expect(screen.getByText('Add status')).toBeTruthy();
    await act(async () => {
      rerender(<Harness onSettle={jest.fn()} youUserId="me" storyCountFor={() => 1} />);
    });
    expect(screen.getByText('My status')).toBeTruthy();
  });
});
