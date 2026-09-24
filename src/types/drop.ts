export type DropPairStatus = 'pending' | 'active' | 'dissolved';

export interface DropPartnerPerson {
  userId: string;
  name: string;
  avatarUrl: string | null;
  initial: string;
}

export interface DropPair {
  id: string;
  status: DropPairStatus;
  meIsA: boolean;
  me: DropPartnerPerson;
  other: DropPartnerPerson;
  tz: string;
  togetherSince: string | null;
  streak: number;
  longestStreak: number;
  freezesRemaining: number;
  lastPlayedOn: string | null;
}

export interface DropPrompt {
  id: string;
  position: number;
  emoji: string | null;
  question: string;
  options: string[];
}

export type DropDayState = 'open' | 'one_done' | 'revealed';

export interface TodayState {
  exists: boolean;
  date: string;
  dropDayId?: string;
  state?: DropDayState;
  wavePct?: number | null;
  iAnswered?: boolean;
  partnerAnswered?: boolean;
  held: boolean;
  catchUpAvailable: boolean;
  yesterdayState?: DropDayState | null;
  dropCode?: string | null;
  dropTitle?: string | null;
}

export interface DropAnswer {
  promptId: string;
  author: string;
  pick: number;
  hunch: number;
}

export interface DropReaction {
  promptId: string;
  author: string;
  emoji: string;
}

export type Mood = 'golden' | 'good' | 'off' | 'heavy';

export interface MoodCheckState {
  myMood: Mood | null;
  partnerMood: Mood | null;
  refocusOffered: boolean;
}

export type RepairVerdict = 'yes' | 'getting_there' | 'still_tender';
export type RepairCheckinStateName = 'open' | 'revealed' | 'reflection' | 'still_open';

export interface RepairCheckin {
  exists: boolean;
  id?: string;
  state?: RepairCheckinStateName;
  iAnswered?: boolean;
  partnerAnswered?: boolean;
  myVerdict?: RepairVerdict | null;
  theirVerdict?: RepairVerdict | null;
  reflectionMine?: boolean;
}

export interface LoveMapLearning {
  id: string;
  about: string;
  authorId: string | null;
  emoji: string | null;
  need: string;
  detail: string | null;
  source: 'drop' | 'refocus' | 'repair';
  becamePromptId: string | null;
  createdAt: string;
}

export type RefocusBridgeDecision = 'bridge' | 'no_bridge';

export interface RefocusReadV2 {
  schema: 'v2';
  bridge_decision: RefocusBridgeDecision;
  underneath: string;
  not_wrong_about: string;
  bridge: string;
  no_bridge: { noticed: string; let_go: string } | null;
  screening_unavailable?: boolean;
}

export interface RefocusSafety {
  type: 'crisis' | 'abuse';
  title: string;
  message: string;
  helplines: { name: string; contact: string }[];
}

export type RefocusOutcome = { read: RefocusReadV2 } | { safety: RefocusSafety };

export interface RefocusChatLine {
  who: 'me' | 'them';
  text: string;
}

export interface RefocusSessionRow {
  id: string;
  topic: string | null;
  sideText: string;
  aiResult: RefocusReadV2 | RefocusSafety;
  createdAt: string;
}
