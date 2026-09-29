import { useEffect, useMemo, useRef, useState } from 'react';
import type { LetterCardData, LetterStage } from '../components/throw/inbox/LetterFoldCard';
import type { PlaneSliderChip } from '../components/throw/inbox/PlaneSlider';
import { bezierPointAndHeading, ease, compactMiles, type Point } from '../utils/lettersArrivalMath';
import { formatLetterDate, bodyForLetter } from '../utils/inboxLetters';
import type { ThrowLetter } from '../types/throw';

export interface InboxPlaneState {
  x: number;
  y: number;
  rot: number;
  scale: number;
  shadowX: number;
  shadowY: number;
}

interface UseInboxArrivalOptions {
  /** Only runs its arrival/timer state machine while true — lets the caller call this hook
   * unconditionally (required, since hooks can't be conditional) and just gate it by whatever
   * drives visibility on their end (a screen mount, an in-place "mode" toggle, etc). */
  enabled: boolean;
  /** The one contact's received letters this instance shows, newest-first, already filtered for
   * any locally-deleted ids the caller is tracking. */
  letters: ThrowLetter[];
  contactName: string;
  reduceMotion: boolean;
  /** Design-units-to-pixels scale for the flight math and LetterFoldCard's own sizing — same
   * convention as ThrowInboxScreen's own `width / inboxLayout.phone.width`, just computed by the
   * caller from whatever frame this arrival is rendering into. */
  scale: number;
  /** Where the letter lands, in the caller's own local coordinate space (the same space the
   * caller renders the plane sprite and LetterFoldCard in). */
  landingPoint: Point;
  /** Where a next letter flies in from after a delete — below the card, matching the standalone
   * screen's own "flies up from the chip row" origin. Defaults to landingPoint offset down. */
  belowOrigin?: Point;
  deleteThrow: (throwId: string) => Promise<{ error: string | null }>;
}

/**
 * The letter-arrival state machine — plane flies in, lands, unfolds into the readable card, and
 * the chip row lets you switch between a contact's letters or delete one — extracted out of
 * ThrowInboxScreen (the standalone Received Letters screen) so the exact same behavior can also
 * run in-place, embedded directly in ThrowHomeScreen's own letter card, without owning a whole
 * separate screen's worth of navigation/map/contacts-rail concerns. Contact switching itself is
 * NOT this hook's job either way — the caller decides which contact's `letters` to hand in.
 */
export function useInboxArrival(opts: UseInboxArrivalOptions) {
  const { enabled, letters, contactName, reduceMotion, scale, landingPoint, belowOrigin, deleteThrow } = opts;

  const [activeLetterIdx, setActiveLetterIdx] = useState(0);
  const [stage, setStage] = useState<LetterStage>('hidden');
  const [plane, setPlane] = useState<InboxPlaneState | null>(null);
  const [locallyDeletedIds, setLocallyDeletedIds] = useState<Set<string>>(new Set());

  const stageRef = useRef<LetterStage>('hidden');
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const rafRef = useRef<number | undefined>(undefined);
  const startedRef = useRef(false);

  const visibleLetters = useMemo(() => letters.filter((l) => !locallyDeletedIds.has(l.id)), [letters, locallyDeletedIds]);

  const setStageBoth = (next: LetterStage) => {
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
  const busy = () => !(stageRef.current === 'open' || stageRef.current === 'hidden' || stageRef.current === 'empty');

  const foldAway = (then: () => void) => {
    if (stageRef.current === 'open' && !reduceMotion) {
      // A plain opacity fade for the currently-open letter — see LetterFoldCard's own 'fadeOut'
      // handling (FADE_MS there — keep the two in sync), which keeps the panels in their already-
      // open state and only fades the outer opacity, instead of the fold-closed-then-shrink-away
      // flourish ThrowInboxScreen's own standalone arrival flow still drives via 'folding'/'shrink'.
      setStageBoth('fadeOut');
      later(then, 260);
    } else {
      then();
    }
  };

  const play = (idx: number, from: Point | null) => {
    clear();
    if (reduceMotion) {
      setActiveLetterIdx(idx);
      setStageBoth('open');
      return;
    }
    const fly = () => {
      const s0 = from || { x: -60 * scale, y: 150 * scale };
      const P: [Point, Point, Point, Point] = from
        ? [s0, { x: s0.x, y: s0.y - 280 * scale }, { x: 330 * scale, y: 250 * scale }, landingPoint]
        : [s0, { x: 130 * scale, y: 40 * scale }, { x: 440 * scale, y: 190 * scale }, landingPoint];
      const dur = from ? 900 : 1250;
      const t0 = performance.now();
      setStageBoth('flying');
      setActiveLetterIdx(idx);
      const step = (now: number) => {
        const r = Math.min(1, (now - t0) / dur);
        const t = ease(r);
        const { point, headingDeg } = bezierPointAndHeading(P, t);
        const alt = Math.sin(r * Math.PI) * 70 * scale + (1 - r) * 20 * scale;
        setPlane({
          x: point.x,
          y: point.y + Math.sin(r * Math.PI * 3) * 6 * scale,
          rot: headingDeg,
          scale: 1.05 + r * 0.25,
          shadowX: point.x + alt * 0.3,
          shadowY: point.y + alt,
        });
        if (r < 1) {
          rafRef.current = requestAnimationFrame(step);
        } else {
          // Straight to the fully-open paper the instant the plane lands — no intervening
          // envelope/tri-fold "unfolding" flourish any more, per explicit request. LetterFoldCard's
          // own panel-fold effect reveals 'open' instantly (setValue, not Animated.timing) whenever
          // it's entered this way, so nothing else needs to change to make this read as instant.
          setPlane(null);
          setStageBoth('open');
        }
      };
      rafRef.current = requestAnimationFrame(step);
    };
    foldAway(fly);
  };

  // Resets and auto-plays the newest letter whenever this becomes enabled — covers both "first
  // time this contact's arrival is shown" and "shown again for a different contact" (the caller
  // re-passes a new `letters`/`contactName` while `enabled` stays true, e.g. switching contacts
  // while the panel is already open — see the contactName dependency below).
  useEffect(() => {
    if (!enabled) {
      clear();
      startedRef.current = false;
      setStageBoth('hidden');
      setPlane(null);
      return;
    }
    startedRef.current = false;
    if (visibleLetters.length === 0) {
      setStageBoth('empty');
      return;
    }
    startedRef.current = true;
    const t = setTimeout(() => play(0, null), 400);
    timers.current.push(t);
    // Deliberately not depending on `visibleLetters`/`play` themselves — this effect's only job
    // is the initial auto-play on entry (or on switching to a new contact), not re-running every
    // time a delete mutates the list, which already has its own play() call.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, contactName]);

  useEffect(() => clear, []);

  const handleSelectChip = (index: number, from: Point) => {
    if (busy()) return;
    play(index, from);
  };

  const handleReplay = () => {
    if (stageRef.current === 'open') play(activeLetterIdx, null);
  };

  const handleDelete = () => {
    const letter = visibleLetters[activeLetterIdx];
    if (!letter) return;
    clear();
    setStageBoth('trash');
    void deleteThrow(letter.id);
    later(() => {
      setLocallyDeletedIds((prev) => new Set(prev).add(letter.id));
      const remaining = visibleLetters.filter((l) => l.id !== letter.id);
      const n = remaining.length;
      const next = Math.max(0, Math.min(activeLetterIdx, n - 1));
      setActiveLetterIdx(next);
      setStageBoth(n ? 'hidden' : 'empty');
      if (n) later(() => play(next, belowOrigin ?? { x: landingPoint.x, y: landingPoint.y + 260 * scale }), 120);
    }, 520);
  };

  const activeLetter = visibleLetters[activeLetterIdx] ?? null;

  const cardData: LetterCardData | null = activeLetter
    ? {
        id: activeLetter.id,
        from: contactName,
        date: formatLetterDate(activeLetter.createdAt).date,
        place: activeLetter.senderCity.toUpperCase(),
        distance: compactMiles(activeLetter.distanceMiles),
        body: bodyForLetter(activeLetter),
        sig: `— ${contactName.charAt(0)}.`,
        count: `${activeLetterIdx + 1} / ${visibleLetters.length}`,
        photoUrls: activeLetter.photoUrls,
      }
    : null;

  const chips: PlaneSliderChip[] = visibleLetters.map((l) => ({
    id: l.id,
    short: formatLetterDate(l.createdAt).short,
    a11yLabel: `Letter from ${contactName}, ${formatLetterDate(l.createdAt).short}, ${l.senderCity}`,
  }));

  return {
    stage,
    plane,
    cardData,
    chips,
    activeLetterIdx,
    activeLetter,
    isEmpty: stage === 'empty',
    busy: busy(),
    canReplay: stage === 'open',
    handleSelectChip,
    handleReplay,
    handleDelete,
  };
}
