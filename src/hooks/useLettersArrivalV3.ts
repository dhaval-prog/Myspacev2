import { useEffect, useMemo, useRef, useState } from 'react';
import { bez, dbez, ease, type Point } from '../utils/lettersArrivalMath';
import { formatLetterDate, bodyForLetter } from '../utils/inboxLetters';
import { formatAlertPillLabel, compactKm } from '../utils/lettersV3Format';
import { v3Layout } from '../theme/throwLettersV3Tokens';
import type { AlertSchedule, ThrowLetter } from '../types/throw';

export type LetterStageV3 = 'hidden' | 'flying' | 'landed' | 'flap' | 'rise' | 'drop' | 'unfold' | 'open' | 'folding' | 'shrink' | 'trash' | 'replyFly' | 'empty';

export interface V3Contact {
  id: string;
  name: string;
  city: string;
  avatarUrl: string | null;
  /** This contact's received letters, newest-first (the app's own fetch order) — already whatever
   * the caller considers "visible" before this hook's own local-delete tracking is applied. */
  letters: ThrowLetter[];
}

export interface V3PlaneState {
  x: number;
  y: number;
  rot: number;
  scale: number;
  shadowX: number;
  shadowY: number;
}

export interface V3LetterCardData {
  id: string;
  from: string;
  date: string;
  place: string;
  km: string;
  body: string;
  sig: string;
  count: string;
  photoUrls: string[];
  photoTrims: (import('../types/throw').MediaTrim | null)[];
  alertSchedule: AlertSchedule | null;
  alertConfirmed: boolean;
  mediaLabel: string;
}

export interface V3ContactRow {
  id: string;
  name: string;
  city: string;
  avatarUrl: string | null;
  selected: boolean;
  unreadCount: number;
}

interface UseLettersArrivalV3Options {
  contacts: V3Contact[];
  /** Preselects this contact (by id) on first mount — falls back to the first contact with any
   * unread letter, then the first contact at all. */
  initialContactId?: string;
  reduceMotion: boolean;
  /** Design-units-to-pixels scale for the flight math (the 390×844 reference frame → the actual
   * rendered phone frame). */
  scale: number;
  deleteThrow: (throwId: string) => Promise<{ error: string | null }>;
  markRead: (throwId: string) => Promise<void>;
  confirmThrowAlert: (throwId: string, schedule: AlertSchedule) => Promise<{ error: string | null }>;
  /** Fires once the fold-away + fly-to-corner reply exit finishes (1150ms in) — the caller
   * navigates to compose from here, same timing as the handoff's own `window.location.href` call. */
  onReply: (contactId: string, letterId: string) => void;
}

const DEL = 80;

function unreadCountOf(letters: ThrowLetter[]): number {
  return letters.filter((l) => l.status === 'thrown').length;
}

/**
 * The Received Letters v3 screen's own state machine — multi-contact plane-flies-in → envelope →
 * flap-opens → letter-rises-and-drops → unfolds sequence, chip switching, long-press-drag-to-
 * delete, Confirm/alert, and the fold-away-then-fly-to-corner Reply exit. Ported stage-for-stage
 * from the design handoff's own `Component` class (`play`/`selectContact`/`deleteActive`/`reply`/
 * `confirm`) — see that file's own `renderVals()` for the exact state → style mapping every
 * presentational component (LetterCardV3, MapBackgroundV3, ChipsRowV3, ActionRowV3) derives its
 * own Animated values from, the same "hook owns the stage, components own their own Animated
 * interpolation of it" split `useInboxArrival`/`LetterFoldCard` already use for the in-place panel.
 */
export function useLettersArrivalV3({ contacts, initialContactId, reduceMotion, scale, deleteThrow, markRead, confirmThrowAlert, onReply }: UseLettersArrivalV3Options) {
  const initialIndex = useMemo(() => {
    if (initialContactId) {
      const byId = contacts.findIndex((c) => c.id === initialContactId);
      if (byId >= 0) return byId;
    }
    const unread = contacts.findIndex((c) => unreadCountOf(c.letters) > 0);
    return unread >= 0 ? unread : 0;
    // Only ever computed once, for the initial mount — switching contacts afterwards is the
    // user's own action (selectContact), not something this should recompute on data refresh.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [contactIdx, setContactIdx] = useState(initialIndex);
  const [activeLetterIdx, setActiveLetterIdx] = useState(0);
  const [stage, setStage] = useState<LetterStageV3>('hidden');
  const [plane, setPlane] = useState<V3PlaneState | null>(null);
  const [locallyDeletedIds, setLocallyDeletedIds] = useState<Set<string>>(new Set());
  const [confirmedIds, setConfirmedIds] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState<string | null>(null);

  const stageRef = useRef<LetterStageV3>('hidden');
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rafRef = useRef<number | undefined>(undefined);

  const setStageBoth = (next: LetterStageV3) => {
    stageRef.current = next;
    setStage(next);
  };
  const later = (fn: () => void, ms: number) => {
    timers.current.push(setTimeout(fn, ms));
  };
  const clear = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
  };
  useEffect(() => clear, []);

  const busy = () => !(stageRef.current === 'open' || stageRef.current === 'hidden' || stageRef.current === 'empty');

  const visibleLettersFor = (ci: number) => contacts[ci]?.letters.filter((l) => !locallyDeletedIds.has(l.id)) ?? [];

  const markIfUnread = (ci: number, idx: number) => {
    const l = visibleLettersFor(ci)[idx];
    if (l && l.status === 'thrown') void markRead(l.id);
  };

  const foldAway = (then: () => void) => {
    if (stageRef.current === 'open') {
      setStageBoth('folding');
      later(() => setStageBoth('shrink'), 640);
      later(then, 980);
    } else then();
  };

  const play = (ci: number, idx: number, from: Point | null) => {
    clear();
    const list = visibleLettersFor(ci);
    if (list.length === 0) {
      foldAway(() => {
        setContactIdx(ci);
        setActiveLetterIdx(0);
        setStageBoth('empty');
      });
      return;
    }
    if (reduceMotion) {
      foldAway(() => {
        setContactIdx(ci);
        setActiveLetterIdx(idx);
        setStageBoth('open');
        markIfUnread(ci, idx);
      });
      return;
    }
    const fly = () => {
      const land = { x: v3Layout.landingPoint.x * scale, y: v3Layout.landingPoint.y * scale };
      const s0 = from || { x: -60 * scale, y: 150 * scale };
      const P: [Point, Point, Point, Point] = from
        ? [s0, { x: s0.x, y: s0.y - 280 * scale }, { x: 330 * scale, y: 260 * scale }, land]
        : [s0, { x: 130 * scale, y: 40 * scale }, { x: 440 * scale, y: 200 * scale }, land];
      const dur = from ? 900 : 1250;
      const t0 = performance.now();
      setContactIdx(ci);
      setActiveLetterIdx(idx);
      setStageBoth('flying');
      const step = (now: number) => {
        const r = Math.min(1, (now - t0) / dur);
        const t = ease(r);
        const x = bez(P[0].x, P[1].x, P[2].x, P[3].x, t);
        const y = bez(P[0].y, P[1].y, P[2].y, P[3].y, t);
        const rot = (Math.atan2(dbez(P[0].y, P[1].y, P[2].y, P[3].y, t), dbez(P[0].x, P[1].x, P[2].x, P[3].x, t)) * 180) / Math.PI + 22;
        const alt = Math.sin(r * Math.PI) * 70 * scale + (1 - r) * 20 * scale;
        setPlane({ x, y: y + Math.sin(r * Math.PI * 3) * 6 * scale, rot, scale: 1.05 + r * 0.25, shadowX: x + alt * 0.3, shadowY: y + alt });
        if (r < 1) {
          rafRef.current = requestAnimationFrame(step);
        } else {
          setPlane(null);
          setStageBoth('landed');
          later(() => setStageBoth('flap'), 460);
          later(() => setStageBoth('rise'), 940);
          later(() => setStageBoth('drop'), 1480);
          later(() => setStageBoth('unfold'), 1820);
          later(() => {
            setStageBoth('open');
            markIfUnread(ci, idx);
          }, 2440);
        }
      };
      rafRef.current = requestAnimationFrame(step);
    };
    foldAway(fly);
  };

  // Auto-plays the initially-selected contact's newest unread letter (or newest letter) once,
  // 600ms after mount — same lead-in beat the handoff's own componentDidMount gives the plane
  // before it starts flying, so the screen doesn't feel like it's firing the instant it opens.
  const startedRef = useRef(false);
  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    const list = contacts[initialIndex]?.letters ?? [];
    if (list.length === 0) {
      setStageBoth('empty');
      return;
    }
    const unreadIdx = list.findIndex((l) => l.status === 'thrown');
    const t = setTimeout(() => play(initialIndex, unreadIdx >= 0 ? unreadIdx : 0, null), 600);
    timers.current.push(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectContact = (ci: number) => {
    if (ci === contactIdx || busy()) return;
    play(ci, 0, null);
  };

  const selectChip = (index: number, from: Point) => {
    if (busy() || index === activeLetterIdx) return;
    play(contactIdx, index, from);
  };

  const deleteActive = () => {
    const ci = contactIdx;
    const idx = activeLetterIdx;
    const list = visibleLettersFor(ci);
    const letter = list[idx];
    if (!letter) return;
    clear();
    setStageBoth('trash');
    void deleteThrow(letter.id);
    later(() => {
      setLocallyDeletedIds((prev) => new Set(prev).add(letter.id));
      const remaining = list.filter((l) => l.id !== letter.id);
      const n = remaining.length;
      const next = Math.max(0, Math.min(idx, n - 1));
      setActiveLetterIdx(next);
      setStageBoth(n ? 'hidden' : 'empty');
      if (n) {
        // The next letter flies in from the chip row itself (390×844 reference-frame point, ported
        // verbatim from the handoff's own `deleteActive`), not from the landing point — it reads as
        // "the next one rises up to replace the one you just dropped" rather than a second arrival
        // from off-screen.
        later(() => play(ci, next, { x: 195 * scale, y: 640 * scale }), 120);
      }
    }, 520);
  };

  const curList = visibleLettersFor(contactIdx);
  const curLetter = curList[activeLetterIdx] ?? null;
  const curContact = contacts[contactIdx] ?? null;

  const reply = () => {
    if (stageRef.current !== 'open' || !curLetter || !curContact) return;
    clear();
    setStageBoth('folding');
    later(() => setStageBoth('replyFly'), 620);
    later(() => onReply(curContact.id, curLetter.id), 1150);
  };

  const confirmAlert = async () => {
    if (!curLetter || !curLetter.alertSchedule || stageRef.current !== 'open') return;
    if (confirmedIds.has(curLetter.id) || curLetter.alertConfirmed) return;
    setConfirmedIds((prev) => new Set(prev).add(curLetter.id));
    const { error } = await confirmThrowAlert(curLetter.id, curLetter.alertSchedule);
    if (error) {
      setConfirmedIds((prev) => {
        const next = new Set(prev);
        next.delete(curLetter.id);
        return next;
      });
      return;
    }
    setToast(`Alert set · ${formatAlertPillLabel(curLetter.alertSchedule)}`);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2400);
  };

  const cardData: V3LetterCardData | null = curLetter
    ? (() => {
        const nP = curLetter.photoUrls.filter((u) => !/\.(mp4|webm|mov|m4v)(\?|$)/i.test(u)).length;
        const nV = curLetter.photoUrls.length - nP;
        const mediaLabel = [nP ? `${nP} PHOTO${nP > 1 ? 'S' : ''}` : '', nV ? `${nV} VIDEO${nV > 1 ? 'S' : ''}` : ''].filter(Boolean).join(' · ');
        return {
          id: curLetter.id,
          from: curContact?.name ?? '',
          date: formatLetterDate(curLetter.createdAt).date,
          place: curLetter.senderCity.toUpperCase(),
          km: compactKm(curLetter.distanceMiles),
          body: bodyForLetter(curLetter),
          sig: `— ${(curContact?.name ?? '?').charAt(0)}.`,
          count: curList.length ? `${activeLetterIdx + 1} / ${curList.length}` : '',
          photoUrls: curLetter.photoUrls,
          photoTrims: curLetter.photoTrims,
          alertSchedule: curLetter.alertSchedule,
          alertConfirmed: curLetter.alertConfirmed || confirmedIds.has(curLetter.id),
          mediaLabel,
        };
      })()
    : null;

  const contactRows: V3ContactRow[] = contacts.map((c, i) => ({
    id: c.id,
    name: c.name,
    city: c.city,
    avatarUrl: c.avatarUrl,
    selected: i === contactIdx,
    unreadCount: unreadCountOf(c.letters.filter((l) => !locallyDeletedIds.has(l.id))),
  }));

  const nNew = curList.filter((l) => l.status === 'thrown').length;
  const rowTitle = curContact ? `LETTERS FROM ${curContact.name.toUpperCase()} · ${curList.length}${nNew ? ` · ${nNew} NEW` : ''}` : '';

  const chips = curList.map((l) => ({
    id: l.id,
    short: formatLetterDate(l.createdAt).short,
    unread: l.status === 'thrown',
    alert: !!l.alertSchedule && !l.alertConfirmed && !confirmedIds.has(l.id),
    hasMedia: l.photoUrls.length > 0,
    a11yLabel: `Letter from ${curContact?.name ?? ''}, ${formatLetterDate(l.createdAt).short}, ${l.senderCity}`,
  }));

  return {
    stage,
    plane,
    cardData,
    curContactName: curContact?.name ?? '',
    contactRows,
    activeLetterIdx,
    rowTitle,
    chips,
    toast,
    isEmpty: stage === 'empty',
    busy: busy(),
    selectContact,
    selectChip,
    deleteActive,
    reply,
    confirmAlert,
  };
}
