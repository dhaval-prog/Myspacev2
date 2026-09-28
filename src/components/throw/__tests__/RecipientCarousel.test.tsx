import React from 'react';
import { render, fireEvent, screen } from '@testing-library/react-native';
import { RecipientCarousel } from '../RecipientCarousel';
import type { ThrowFriend } from '../../../types/throw';

const FRIENDS: ThrowFriend[] = [
  { userId: 'me', name: 'Myself', avatarUrl: null, location: { city: 'Mumbai', country: 'IN', latitude: 19, longitude: 72 } },
  { userId: 'friend-1', name: 'Priya', avatarUrl: null, location: { city: 'Pune', country: 'IN', latitude: 18.5, longitude: 73.8 } },
];

describe('RecipientCarousel story-tap behavior', () => {
  it('selects an unselected contact on tap, even when they have an active story', async () => {
    const onChangeIndex = jest.fn();
    const onOpenStory = jest.fn();
    await render(
      <RecipientCarousel
        friends={FRIENDS}
        selectedIndex={0}
        onChangeIndex={onChangeIndex}
        storyCountFor={() => 2}
        onOpenStory={onOpenStory}
      />,
    );
    fireEvent.press(screen.getByText('Priya'));
    expect(onChangeIndex).toHaveBeenCalledWith(1);
    expect(onOpenStory).not.toHaveBeenCalled();
  });

  it('opens the story instead of re-selecting when the already-selected contact has one', async () => {
    const onChangeIndex = jest.fn();
    const onOpenStory = jest.fn();
    await render(
      <RecipientCarousel
        friends={FRIENDS}
        selectedIndex={0}
        onChangeIndex={onChangeIndex}
        storyCountFor={(userId) => (userId === 'me' ? 1 : 0)}
        onOpenStory={onOpenStory}
      />,
    );
    fireEvent.press(screen.getByText('Myself'));
    expect(onOpenStory).toHaveBeenCalledWith('me');
    expect(onChangeIndex).not.toHaveBeenCalled();
  });

  it('re-selecting (a no-op) is all that happens for an already-selected contact with no story', async () => {
    const onChangeIndex = jest.fn();
    const onOpenStory = jest.fn();
    await render(
      <RecipientCarousel friends={FRIENDS} selectedIndex={0} onChangeIndex={onChangeIndex} storyCountFor={() => 0} onOpenStory={onOpenStory} />,
    );
    fireEvent.press(screen.getByText('Myself'));
    expect(onOpenStory).not.toHaveBeenCalled();
    expect(onChangeIndex).not.toHaveBeenCalled();
  });

  it('tapping the still-selected contact while Status is showing still fires onChangeIndex, so there is a way back', async () => {
    // Status mode doesn't move `selectedIndex` away from Own Contact — it only sets
    // isAddStorySelected — so re-tapping that same contact needs its own path back out, since the
    // index genuinely isn't changing.
    const onChangeIndex = jest.fn();
    const onOpenStory = jest.fn();
    await render(
      <RecipientCarousel
        friends={FRIENDS}
        selectedIndex={0}
        onChangeIndex={onChangeIndex}
        storyCountFor={() => 0}
        onOpenStory={onOpenStory}
        isAddStorySelected
      />,
    );
    fireEvent.press(screen.getByText('Myself'));
    expect(onOpenStory).not.toHaveBeenCalled();
    expect(onChangeIndex).toHaveBeenCalledWith(0);
  });
});

describe('RecipientCarousel add-story slot', () => {
  it('is absent entirely when no onAddStory is given', async () => {
    await render(<RecipientCarousel friends={FRIENDS} selectedIndex={0} onChangeIndex={jest.fn()} />);
    expect(screen.queryByLabelText('Add to your story')).toBeNull();
  });

  it('opens the capture flow on tap, without affecting contact selection', async () => {
    const onChangeIndex = jest.fn();
    const onAddStory = jest.fn();
    await render(<RecipientCarousel friends={FRIENDS} selectedIndex={0} onChangeIndex={onChangeIndex} onAddStory={onAddStory} />);
    fireEvent.press(screen.getByLabelText('Add to your story'));
    expect(onAddStory).toHaveBeenCalledTimes(1);
    expect(onChangeIndex).not.toHaveBeenCalled();
  });
});
