import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '../../components/Icon';
import { ContactsRail, type ContactRailItem } from '../../components/throw/inbox/ContactsRail';
import { LetterFoldCard, type LetterCardData, type LetterFoldCardHandle, type LetterStage } from '../../components/throw/inbox/LetterFoldCard';
import { LetterPlaneGlyph } from '../../components/throw/inbox/LetterPlaneGlyph';
import { PlaneSlider, type PlaneSliderChip } from '../../components/throw/inbox/PlaneSlider';
import { InboxMap } from '../../components/throw/inbox/InboxMap';
import type { InboxMapPin } from '../../components/throw/inbox/inboxMapTypes';
import { inboxLayout } from '../../theme/throwInboxTokens';
import { bezierPointAndHeading, ease, compactMiles, type Point } from '../../utils/lettersArrivalMath';
import { useThrow } from '../../context/ThrowContext';
import { useThrowColorMode } from '../../context/ThrowColorModeContext';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import type { ThrowLetter } from '../../types/throw';

const BACK_ICON = 'M15 18l-6-6 6-6';

interface InboxContact {
  id: string;
  name: string;
  sub: string;
  avatarUrl: string | null;
  letters: ThrowLetter[]; // newest-first
}

interface ThrowInboxScreenProps {
  onBack: () => void;
  /** Reusing the same nav ThrowLetterDetailScreen's own "Throw Back" button already drives —
   * routes back to the compose map with this contact locked in as the recipient. */
  onThrowBack: (counterpartUserId: string, repliedToThrowId: string) => void;
  /** The contact the user was viewing on the map before opening the inbox, if any — selected on
   * open; falls back to whoever has the newest letter. */
  initialContactId?: string;
}

const WEEKDAY = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
const MONTH = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

/** "TODAY · 9:12 AM" / "YESTERDAY · 8:20 PM" / "SUN · 7:40 PM" / "SEP 18 · 6:30 AM" — and the
 * matching short chip label ("TODAY"/"YDAY"/"SUN"/"SEP 18"), per the design handoff's own date
 * treatment. */
function formatLetterDate(iso: string): { date: string; short: string } {
  const d = new Date(iso);
  const now = new Date();
  const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const daysAgo = Math.floor((now.getTime() - d.getTime()) / 86400000);
  if (sameDay(d, now)) return { date: `TODAY · ${time}`, short: 'TODAY' };
  if (sameDay(d, yesterday)) return { date: `YESTERDAY · ${time}`, short: 'YDAY' };
  if (daysAgo < 7 && daysAgo >= 0) return { date: `${WEEKDAY[d.getDay()]} · ${time}`, short: WEEKDAY[d.getDay()] };
  const short = `${MONTH[d.getMonth()]} ${d.getDate()}`;
  return { date: `${short} · ${time}`, short };
}

function bodyFor(letter: ThrowLetter): string {
  if (letter.messageText) return letter.messageText;
  if (letter.photoUrls.length > 0) return 'Sent a photo.';
  return 'A handwritten letter.';
}

const s = (n: number, scale: number) => n * scale;

/**
 * The Received Letters screen — opens from the "Throw inbox" icon on the letter. Letters arrive
 * as paper planes (a 2D bezier-flight sprite, see `plane` state below) and land folded, at rest;
 * from there the user drags UP on the letter to unfold it — the same real WebGL paper-fold engine
 * (see LetterFoldCard) and gesture the Throw compose screen uses to fold its own letter, just
 * driven from the opposite end of the timeline. `play()` drives the flight and hands off to
 * LetterFoldCard once landed; `foldAway()` asks the currently-open letter to fold itself closed
 * (LetterFoldCard's own `closeIfOpen`) before switching/replaying/deleting.
 */
export function ThrowInboxScreen({ onBack, onThrowBack, initialContactId }: ThrowInboxScreenProps) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const scale = width / inboxLayout.phone.width;
  const reduceMotion = useReducedMotion();
  const { mapIsDay } = useThrowColorMode();
  const { inbox, deleteThrow } = useThrow();

  const [locallyDeletedIds, setLocallyDeletedIds] = useState<Set<string>>(new Set());

  const contacts = useMemo<InboxContact[]>(() => {
    const map = new Map<string, InboxContact>();
    for (const l of inbox) {
      if (locallyDeletedIds.has(l.id)) continue;
      const existing = map.get(l.counterpartId);
      if (existing) existing.letters.push(l);
      else map.set(l.counterpartId, { id: l.counterpartId, name: l.counterpartName, sub: l.senderCity, avatarUrl: l.counterpartAvatarUrl, letters: [l] });
    }
    return Array.from(map.values()).sort((a, b) => (a.letters[0].createdAt < b.letters[0].createdAt ? 1 : -1));
  }, [inbox, locallyDeletedIds]);

  const [selectedContactIdx, setSelectedContactIdx] = useState(() => {
    if (contacts.length === 0) return 0;
    const idx = initialContactId ? contacts.findIndex((c) => c.id === initialContactId) : -1;
    return idx >= 0 ? idx : 0;
  });
  const [activeLetterIdx, setActiveLetterIdx] = useState(0);
  const [stage, setStage] = useState<LetterStage>('hidden');
  const [isLetterOpen, setIsLetterOpen] = useState(false);
  const [plane, setPlane] = useState<{ x: number; y: number; rot: number; scale: number; shadowX: number; shadowY: number } | null>(null);

  const stageRef = useRef<LetterStage>('hidden');
  const cardRef = useRef<LetterFoldCardHandle>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const rafRef = useRef<number | undefined>(undefined);
  const containerRef = useRef<View>(null);
  const startedRef = useRef(false);

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
  const busy = () => stageRef.current === 'flying';

  // Folds the current letter closed first (a no-op if it's already closed, or hasn't been
  // rendered yet) — LetterFoldCard owns that animation itself now, driven by the same drag-to-
  // open gesture the user has, so switching/replaying/deleting just asks it to settle closed
  // rather than this screen scripting a separate fold-away timeline.
  const foldAway = (then: () => void) => {
    const p = cardRef.current?.closeIfOpen();
    if (p) p.then(then);
    else then();
  };

  const LAND: Point = { x: s(inboxLayout.landingPoint.x, scale), y: s(inboxLayout.landingPoint.y, scale) };

  const play = (ci: number, idx: number, from: Point | null) => {
    clear();
    if (reduceMotion) {
      setSelectedContactIdx(ci);
      setActiveLetterIdx(idx);
      // LetterFoldCard's own reduced-motion effect crossfades straight to the readable open
      // letter the moment it sees stage 'ready' — no drag, no flight.
      setStageBoth('ready');
      return;
    }
    const fly = () => {
      const s0 = from || { x: s(-60, scale), y: s(150, scale) };
      const P: [Point, Point, Point, Point] = from
        ? [s0, { x: s0.x, y: s0.y - s(280, scale) }, { x: s(330, scale), y: s(250, scale) }, LAND]
        : [s0, { x: s(130, scale), y: s(40, scale) }, { x: s(440, scale), y: s(190, scale) }, LAND];
      const dur = from ? 900 : 1250;
      const t0 = performance.now();
      setStageBoth('flying');
      setSelectedContactIdx(ci);
      setActiveLetterIdx(idx);
      const step = (now: number) => {
        const r = Math.min(1, (now - t0) / dur);
        const t = ease(r);
        const { point, headingDeg } = bezierPointAndHeading(P, t);
        const alt = Math.sin(r * Math.PI) * s(70, scale) + (1 - r) * s(20, scale);
        setPlane({
          x: point.x,
          y: point.y + Math.sin(r * Math.PI * 3) * s(6, scale),
          rot: headingDeg,
          scale: 1.05 + r * 0.25,
          shadowX: point.x + alt * 0.3,
          shadowY: point.y + alt,
        });
        if (r < 1) {
          rafRef.current = requestAnimationFrame(step);
        } else {
          setPlane(null);
          // Lands folded, at rest — LetterFoldCard mounts its own WebGL fold stage and waits for
          // the user's own drag-up-to-open gesture instead of auto-unfolding on a timer.
          setStageBoth('ready');
        }
      };
      rafRef.current = requestAnimationFrame(step);
    };
    foldAway(fly);
  };

  // First letter flies in ~600ms after the screen opens.
  useEffect(() => {
    if (startedRef.current || contacts.length === 0) return;
    startedRef.current = true;
    const t = setTimeout(() => play(selectedContactIdx, 0, null), 600);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contacts.length > 0]);

  useEffect(() => clear, []);

  const selectContact = (ci: number) => {
    if (ci === selectedContactIdx || busy()) return;
    const contact = contacts[ci];
    if (!contact || contact.letters.length === 0) {
      foldAway(() => {
        setSelectedContactIdx(ci);
        setActiveLetterIdx(0);
        setStageBoth('empty');
      });
      return;
    }
    play(ci, 0, null);
  };

  const toLocal = (windowPoint: { x: number; y: number }): Promise<Point> =>
    new Promise((resolve) => {
      const node = containerRef.current;
      if (!node) return resolve(windowPoint);
      node.measureInWindow((cx, cy) => resolve({ x: windowPoint.x - cx, y: windowPoint.y - cy }));
    });

  const handleSelectChip = async (index: number, originScreen: { x: number; y: number }) => {
    if (busy()) return;
    const local = await toLocal(originScreen);
    play(selectedContactIdx, index, local);
  };

  const handleReplay = () => {
    if (isLetterOpen) play(selectedContactIdx, activeLetterIdx, null);
  };

  // A clearly horizontal flick on the open letter switches contacts — left moves to the next
  // (right-hand) contact on the rail, right moves to the previous (left-hand) one, matching
  // FoldingLetter's own reversed-from-the-folded-plane convention for its still-open paper's own
  // contact-flick gesture. Clamped, not wrapping, like every other contact-switch path here.
  const handleFlick = (direction: 'left' | 'right') => {
    if (busy()) return;
    const next = selectedContactIdx + (direction === 'left' ? 1 : -1);
    if (next < 0 || next >= contacts.length) return;
    selectContact(next);
  };

  const handleDelete = () => {
    const contact = contacts[selectedContactIdx];
    const letter = contact?.letters[activeLetterIdx];
    if (!letter) return;
    clear();
    setStageBoth('trash');
    setIsLetterOpen(false);
    void deleteThrow(letter.id);
    later(() => {
      setLocallyDeletedIds((prev) => new Set(prev).add(letter.id));
      const remaining = contact.letters.filter((l) => l.id !== letter.id);
      const n = remaining.length;
      const next = Math.max(0, Math.min(activeLetterIdx, n - 1));
      setActiveLetterIdx(next);
      setStageBoth(n ? 'hidden' : 'empty');
      if (n) later(() => play(selectedContactIdx, next, { x: s(195, scale), y: s(690, scale) }), 120);
    }, 520);
  };

  const railContacts: ContactRailItem[] = contacts.map((c) => ({ id: c.id, name: c.name, sub: c.sub, avatarUrl: c.avatarUrl, count: c.letters.length }));
  const currentContact = contacts[selectedContactIdx] ?? null;
  const currentLetters = currentContact?.letters ?? [];
  const activeLetter = currentLetters[activeLetterIdx] ?? null;

  const cardData: LetterCardData | null = activeLetter && currentContact
    ? {
        from: currentContact.name,
        date: formatLetterDate(activeLetter.createdAt).date,
        place: activeLetter.senderCity.toUpperCase(),
        distance: compactMiles(activeLetter.distanceMiles),
        body: bodyFor(activeLetter),
        sig: `— ${currentContact.name.charAt(0)}.`,
        count: `${activeLetterIdx + 1} / ${currentLetters.length}`,
        strokes: activeLetter.strokes,
        messageText: activeLetter.messageText,
        photoUri: activeLetter.photoUrls[0] ?? null,
      }
    : null;

  const pins: InboxMapPin[] = currentLetters.map((l, i) => ({
    id: l.id,
    latitude: l.senderLatitude,
    longitude: l.senderLongitude,
    active: i === activeLetterIdx && stage !== 'empty',
    label: i === activeLetterIdx ? `${l.senderCity.toUpperCase()} · ${compactMiles(l.distanceMiles)}` : undefined,
  }));
  const route = [...currentLetters].reverse().map((l) => ({ latitude: l.senderLatitude, longitude: l.senderLongitude }));
  const anchor = activeLetter ? { latitude: activeLetter.senderLatitude, longitude: activeLetter.senderLongitude } : null;

  const chips: PlaneSliderChip[] = currentLetters.map((l) => ({
    id: l.id,
    short: formatLetterDate(l.createdAt).short,
    a11yLabel: `Letter from ${currentContact?.name ?? ''}, ${formatLetterDate(l.createdAt).short}, ${l.senderCity}`,
  }));

  const topOffset = (designY: number) => Math.max(0, insets.top + s(designY - 50, scale));

  return (
    <View ref={containerRef} style={styles.root}>
      <View style={StyleSheet.absoluteFill}>
        <InboxMap pins={pins} route={route} anchor={anchor} isDay={mapIsDay} />
      </View>
      <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.mapScrim]} />

      <Pressable
        onPress={onBack}
        hitSlop={10}
        accessibilityRole="button"
        accessibilityLabel="Back to map"
        style={[styles.backBtn, { top: Math.max(insets.top, s(12, scale)), left: s(20, scale), width: s(40, scale), height: s(40, scale), borderRadius: s(20, scale) }]}
      >
        <Icon path={BACK_ICON} size={s(22, scale)} color="#111111" strokeWidth={2.4} />
      </Pressable>

      <View style={[styles.absTop, { top: topOffset(56) }]}>
        <ContactsRail contacts={railContacts} selectedId={currentContact?.id ?? null} onSelect={(id) => selectContact(contacts.findIndex((c) => c.id === id))} scale={scale} disabled={busy()} />
      </View>

      <View style={[styles.absTop, { top: topOffset(inboxLayout.letter.y), left: s(inboxLayout.letter.x, scale), alignItems: 'flex-start' }]}>
        <LetterFoldCard
          ref={cardRef}
          stage={stage}
          letter={cardData}
          isEmpty={stage === 'empty'}
          emptyName={currentContact?.name ?? ''}
          scale={scale}
          reduceMotion={reduceMotion}
          isNight={!mapIsDay}
          onThrowBack={currentContact && activeLetter ? () => onThrowBack(currentContact.id, activeLetter.id) : undefined}
          onOpenChange={setIsLetterOpen}
          onFlick={handleFlick}
        />
      </View>

      {plane && (
        <>
          <View
            pointerEvents="none"
            style={[
              styles.planeShadow,
              { left: plane.shadowX - s(23, scale), top: plane.shadowY - s(6, scale), width: s(46, scale), height: s(12, scale), borderRadius: s(6, scale) },
            ]}
          />
          <View pointerEvents="none" style={{ position: 'absolute', left: plane.x - s(32, scale), top: plane.y - s(32, scale), transform: [{ rotate: `${plane.rot}deg` }, { scale: plane.scale }] }}>
            <LetterPlaneGlyph size={s(64, scale)} variant="default" />
          </View>
        </>
      )}

      <View style={[styles.absTop, { bottom: Math.max(insets.bottom, s(20, scale)) }]}>
        <PlaneSlider
          chips={chips}
          activeIndex={activeLetterIdx}
          contactName={currentContact?.name ?? ''}
          scale={scale}
          busy={busy()}
          canReplay={isLetterOpen}
          onSelectChip={handleSelectChip}
          onReplay={handleReplay}
          onDelete={handleDelete}
        />
      </View>

      {contacts.length === 0 && !isLetterOpen && (
        <View pointerEvents="none" style={styles.noLettersHint}>
          <Text style={styles.noLettersText}>No letters yet — once someone throws you one, it'll fly in here.</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#EDEDEA', overflow: 'hidden' },
  mapScrim: { backgroundColor: 'rgba(244,244,242,.28)' },
  absTop: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  backBtn: { position: 'absolute', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,.6)' },
  planeShadow: { position: 'absolute', backgroundColor: 'rgba(0,0,0,.18)' },
  noLettersHint: { position: 'absolute', left: 24, right: 24, top: '45%', alignItems: 'center' },
  noLettersText: { fontFamily: 'Figtree_600SemiBold', fontSize: 14, color: '#444444', textAlign: 'center' },
});
