// Same reasoning as TriviaGameContext's own test file: stub the real Supabase client so importing
// this module for its pure row-mapping helper doesn't need a real Expo/native environment.
jest.mock('../../lib/supabase', () => ({ supabase: {} }));
jest.mock('../AuthContext', () => ({ useAuth: () => ({ user: null }) }));
jest.mock('../ThrowContext', () => ({ useThrow: () => ({ friends: [] }) }));

import { toStory } from '../ThrowStoriesContext';

describe('toStory', () => {
  it('maps every snake_case DB column to its camelCase field', () => {
    expect(
      toStory({
        id: 's1',
        user_id: 'u1',
        media_url: 'https://example.com/a.jpg',
        media_type: 'photo',
        trim_start_ms: null,
        trim_end_ms: null,
        created_at: '2026-01-01T00:00:00.000Z',
      }),
    ).toEqual({
      id: 's1',
      userId: 'u1',
      mediaUrl: 'https://example.com/a.jpg',
      mediaType: 'photo',
      trimStartMs: null,
      trimEndMs: null,
      createdAt: '2026-01-01T00:00:00.000Z',
    });
  });

  it('preserves a trimmed video clip\'s start/end offsets', () => {
    const story = toStory({
      id: 's2',
      user_id: 'u1',
      media_url: 'https://example.com/a.mp4',
      media_type: 'video',
      trim_start_ms: 4000,
      trim_end_ms: 19000,
      created_at: '2026-01-01T00:00:00.000Z',
    });
    expect(story.trimStartMs).toBe(4000);
    expect(story.trimEndMs).toBe(19000);
  });
});
