export type StoryMediaType = 'photo' | 'video';

/** Raw shape of a `throw_stories` row, as returned by Supabase. */
export interface ThrowStoryRow {
  id: string;
  user_id: string;
  media_url: string;
  media_type: StoryMediaType;
  trim_start_ms: number | null;
  trim_end_ms: number | null;
  created_at: string;
}

export interface ThrowStory {
  id: string;
  userId: string;
  mediaUrl: string;
  mediaType: StoryMediaType;
  /** Non-null only for a video whose picked source ran longer than the 15s cap — the viewer
   * seeks to trimStartMs on load and advances to the next story at trimEndMs, rather than the
   * uploaded file itself ever being physically cut. */
  trimStartMs: number | null;
  trimEndMs: number | null;
  createdAt: string;
}
