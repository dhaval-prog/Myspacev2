jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest'));

import React from 'react';
import { Text } from 'react-native';
import { render, screen, waitFor } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCachedBootstrap } from '../useCachedBootstrap';
import { writeCache } from '../../utils/persistedCache';

function Probe({ userId, cacheKey, onHit }: { userId: string | null; cacheKey: string; onHit: (v: unknown) => void }) {
  const ready = useCachedBootstrap<unknown>(userId, cacheKey, onHit);
  return <Text testID="ready">{String(ready)}</Text>;
}

describe('useCachedBootstrap', () => {
  afterEach(async () => {
    await AsyncStorage.clear();
  });

  it('calls onHit with a cached value, then reports ready', async () => {
    await writeCache('u1', 'throw', { greeting: 'hi' });
    const onHit = jest.fn();
    await render(<Probe userId="u1" cacheKey="throw" onHit={onHit} />);

    await waitFor(() => expect(screen.getByTestId('ready').props.children).toBe('true'));
    expect(onHit).toHaveBeenCalledWith({ greeting: 'hi' });
  });

  it('reports ready without calling onHit when nothing was cached', async () => {
    const onHit = jest.fn();
    await render(<Probe userId="u1" cacheKey="never-written" onHit={onHit} />);

    await waitFor(() => expect(screen.getByTestId('ready').props.children).toBe('true'));
    expect(onHit).not.toHaveBeenCalled();
  });

  it('reports ready immediately, with no cache read, when there is no user yet', async () => {
    const onHit = jest.fn();
    await render(<Probe userId={null} cacheKey="throw" onHit={onHit} />);

    expect(screen.getByTestId('ready').props.children).toBe('true');
    expect(onHit).not.toHaveBeenCalled();
  });

  it('re-checks the cache under the new key when userId changes (e.g. a different account signs in)', async () => {
    await writeCache('u2', 'throw', { greeting: 'for u2' });
    const onHit = jest.fn();
    const { rerender } = await render(<Probe userId="u1" cacheKey="throw" onHit={onHit} />);
    await waitFor(() => expect(screen.getByTestId('ready').props.children).toBe('true'));
    expect(onHit).not.toHaveBeenCalled();

    rerender(<Probe userId="u2" cacheKey="throw" onHit={onHit} />);
    await waitFor(() => expect(onHit).toHaveBeenCalledWith({ greeting: 'for u2' }));
  });
});
