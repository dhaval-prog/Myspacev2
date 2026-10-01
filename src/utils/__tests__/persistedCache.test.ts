jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest'));

import AsyncStorage from '@react-native-async-storage/async-storage';
import { readCache, writeCache } from '../persistedCache';

describe('persistedCache', () => {
  afterEach(async () => {
    await AsyncStorage.clear();
  });

  it('round-trips a value written for one user/key', async () => {
    await writeCache('user-1', 'throw', { a: 1, b: ['x', 'y'] });
    const result = await readCache<{ a: number; b: string[] }>('user-1', 'throw');
    expect(result).toEqual({ a: 1, b: ['x', 'y'] });
  });

  it('returns null for a key nothing was ever written to', async () => {
    const result = await readCache('user-1', 'never-written');
    expect(result).toBeNull();
  });

  it('keeps different users\' cache under the same key fully separate', async () => {
    await writeCache('user-1', 'notifications', ['a']);
    await writeCache('user-2', 'notifications', ['b']);
    expect(await readCache('user-1', 'notifications')).toEqual(['a']);
    expect(await readCache('user-2', 'notifications')).toEqual(['b']);
  });

  it('returns null instead of throwing when the stored value is corrupt JSON', async () => {
    await AsyncStorage.setItem('cache:v1:user-1:throw', 'not valid json{');
    const result = await readCache('user-1', 'throw');
    expect(result).toBeNull();
  });

  it('overwrites a previous value under the same user/key', async () => {
    await writeCache('user-1', 'throw', { v: 1 });
    await writeCache('user-1', 'throw', { v: 2 });
    expect(await readCache('user-1', 'throw')).toEqual({ v: 2 });
  });
});
