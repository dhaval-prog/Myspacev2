import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';
import { useThrow } from './ThrowContext';
import type { StoryMediaType, ThrowStory, ThrowStoryRow } from '../types/story';

const POLL_MS = 30000;

function warn(action: string, error: { message: string } | null) {
  if (error) console.warn(`[ThrowStories] ${action} failed:`, error.message);
}

/** Same reasoning as ThrowContext's own copy: a naive "everything after the last dot" breaks on
 * web, where expo-image-picker/a captured photo/video hands back an extension-less `blob:` URI. */
function extFromBlob(localUri: string, mimeType: string): string {
  const mimeExt = mimeType.split('/')[1]?.split('+')[0];
  if (mimeExt && /^[a-z0-9]{2,5}$/i.test(mimeExt)) return mimeExt.toLowerCase() === 'jpeg' ? 'jpg' : mimeExt.toLowerCase();
  const match = localUri.split('?')[0].match(/\.([a-z0-9]{2,5})$/i);
  return match ? match[1].toLowerCase() : 'jpg';
}

export function toStory(row: ThrowStoryRow): ThrowStory {
  return {
    id: row.id,
    userId: row.user_id,
    mediaUrl: row.media_url,
    mediaType: row.media_type,
    trimStartMs: row.trim_start_ms,
    trimEndMs: row.trim_end_ms,
    createdAt: row.created_at,
  };
}

interface ThrowStoriesContextValue {
  loading: boolean;
  /** Every active (posted within the last 24h) story from me and my friends, oldest first within
   * each author — the order the viewer plays them back in. Keyed by author's userId. */
  storiesByUser: Record<string, ThrowStory[]>;
  /** How many active stories a contact has — 0 hides the ring entirely (see StoryRing). */
  storyCountFor: (userId: string) => number;
  /** Uploads a captured/picked photo or video to this user's own story folder and inserts the
   * row — trim is only ever present for a video whose source ran past the 15s cap (see
   * ThrowStory.trimStartMs). */
  postStory: (localUri: string, mediaType: StoryMediaType, trim?: { startMs: number; endMs: number }) => Promise<{ error: string | null }>;
  /** Best-effort — records that I've watched a specific story. Never surfaced as an error since a
   * failed write here shouldn't block the viewer itself. */
  markViewed: (storyId: string) => Promise<void>;
  refresh: () => Promise<void>;
}

const ThrowStoriesContext = createContext<ThrowStoriesContextValue | null>(null);

/** Scoped around the Throw screen tree, nested inside ThrowProvider (for `friends`/myId) —
 * mirrors ThrowContext's own "not mounted at app root" comment. */
export function ThrowStoriesProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const { friends } = useThrow();
  const myId = user?.id ?? null;

  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<ThrowStoryRow[]>([]);
  const hasLoadedRef = useRef(false);

  const refresh = useCallback(async () => {
    if (!myId) return;
    if (!hasLoadedRef.current) setLoading(true);
    const authorIds = [myId, ...friends.map((f) => f.userId)];
    const { data, error } = await supabase
      .from('throw_stories')
      .select('*')
      .in('user_id', authorIds)
      .gt('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      .order('created_at', { ascending: true });
    warn('load stories', error);
    setRows((data as ThrowStoryRow[] | null) ?? []);
    hasLoadedRef.current = true;
    setLoading(false);
  }, [myId, friends]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (!myId) return;
    // No single-column equality filter covers "any of my friends" (an ever-changing list), so
    // this listens unfiltered and just re-runs the real (RLS-scoped) query above — cheap enough
    // at this app's scale, same tradeoff ThrowContext's own poll makes.
    const channel = supabase.channel(`throw-stories-${myId}`).on('postgres_changes', { event: '*', schema: 'public', table: 'throw_stories' }, () => refresh()).subscribe();
    const poll = setInterval(refresh, POLL_MS);
    return () => {
      supabase.removeChannel(channel);
      clearInterval(poll);
    };
  }, [myId, refresh]);

  const storiesByUser = useMemo(() => {
    const map: Record<string, ThrowStory[]> = {};
    for (const row of rows) {
      const story = toStory(row);
      (map[story.userId] ??= []).push(story);
    }
    return map;
  }, [rows]);

  const storyCountFor = useCallback((userId: string) => storiesByUser[userId]?.length ?? 0, [storiesByUser]);

  const postStory = useCallback(
    async (localUri: string, mediaType: StoryMediaType, trim?: { startMs: number; endMs: number }): Promise<{ error: string | null }> => {
      if (!myId) return { error: 'Not signed in.' };
      try {
        const response = await fetch(localUri);
        const blob = await response.blob();
        const defaultMime = mediaType === 'video' ? 'video/mp4' : 'image/jpeg';
        const ext = extFromBlob(localUri, blob.type || defaultMime);
        const path = `${myId}/${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage.from('throw-stories').upload(path, blob, { contentType: blob.type || defaultMime });
        if (upErr) return { error: upErr.message };
        const { data: pub } = supabase.storage.from('throw-stories').getPublicUrl(path);
        const { error: insertErr } = await supabase.from('throw_stories').insert({
          user_id: myId,
          media_url: pub.publicUrl,
          media_type: mediaType,
          trim_start_ms: trim?.startMs ?? null,
          trim_end_ms: trim?.endMs ?? null,
        });
        if (insertErr) return { error: insertErr.message };
        await refresh();
        return { error: null };
      } catch (e) {
        return { error: e instanceof Error ? e.message : 'Could not post that story.' };
      }
    },
    [myId, refresh],
  );

  const markViewed = useCallback(
    async (storyId: string) => {
      if (!myId) return;
      const { error } = await supabase.from('throw_story_views').upsert({ story_id: storyId, viewer_id: myId }, { onConflict: 'story_id,viewer_id' });
      warn('mark viewed', error);
    },
    [myId],
  );

  const value: ThrowStoriesContextValue = { loading, storiesByUser, storyCountFor, postStory, markViewed, refresh };
  return <ThrowStoriesContext.Provider value={value}>{children}</ThrowStoriesContext.Provider>;
}

export function useThrowStories(): ThrowStoriesContextValue {
  const ctx = useContext(ThrowStoriesContext);
  if (!ctx) throw new Error('useThrowStories must be used within a ThrowStoriesProvider');
  return ctx;
}
