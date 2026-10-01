import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Image, PanResponder, Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path } from 'react-native-svg';
import { Icon } from '../../Icon';
import { AutoplayVideoFill } from '../../AutoplayVideoFill';
import { formatClockMs } from '../../../utils/formatClock';
import { v3Color, v3Font, v3Layout, v3Radius } from '../../../theme/throwLettersV3Tokens';
import type { MediaTrim } from '../../../types/throw';

const CLOSE_ICON = 'M6 6l12 12M18 6L6 18';
const CHEVRON_LEFT_ICON = 'M15 5l-7 7 7 7';
const CHEVRON_RIGHT_ICON = 'M9 5l7 7-7 7';
const PLAY_PATH = 'M8 5.5v13l11-6.5z';
const IMAGE_ICON = 'M19 3H5a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2V5a2 2 0 00-2-2z M8.5 10a1.5 1.5 0 100-3 1.5 1.5 0 000 3z M21 15l-5-5L5 21';

/** A solid filled play triangle — `Icon`'s shared component is stroke-only, which renders nothing
 * useful for a filled shape like this one. */
function PlayTriangle({ size, color }: { size: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d={PLAY_PATH} fill={color} />
    </Svg>
  );
}

const s = (n: number, scale: number) => n * scale;
const SWIPE_COMMIT_DISTANCE = 40;

function isVideoUrl(url: string): boolean {
  return /\.(mp4|webm|mov|m4v)(\?|$)/i.test(url);
}

interface MediaViewerV3Props {
  visible: boolean;
  contactName: string;
  dateShort: string;
  place: string;
  photoUrls: string[];
  photoTrims: (MediaTrim | null)[];
  onClose: () => void;
  scale: number;
}

/**
 * The letter's own photo/video attachments, full-screen — header with close/title/count, a
 * rounded media stage (photo, or a video that starts paused behind a play button rather than
 * autoplaying), prev/next chevrons, a caption line, and a thumbnail strip. Ported from the
 * handoff's own `mOpen`/`mK`/`playing` state.
 */
export function MediaViewerV3({ visible, contactName, dateShort, place, photoUrls, photoTrims, onClose, scale }: MediaViewerV3Props) {
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [durationMs, setDurationMs] = useState(0);

  const opacity = useRef(new Animated.Value(0)).current;
  const stageScale = useRef(new Animated.Value(0.92)).current;

  useEffect(() => {
    Animated.timing(opacity, { toValue: visible ? 1 : 0, duration: 300, easing: Easing.linear, useNativeDriver: true }).start();
    Animated.timing(stageScale, { toValue: visible ? 1 : 0.92, duration: 400, easing: Easing.bezier(0.3, 1.2, 0.5, 1), useNativeDriver: true }).start();
    if (visible) {
      setIndex(0);
      setPlaying(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const goTo = (next: number) => {
    if (next < 0 || next >= photoUrls.length) return;
    setPlaying(false);
    setElapsedMs(0);
    setDurationMs(0);
    setIndex(next);
  };

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        onMoveShouldSetPanResponder: (_e, g) => Math.abs(g.dx) > 12 && Math.abs(g.dx) > Math.abs(g.dy),
        onPanResponderRelease: (_e, g) => {
          if (g.dx <= -SWIPE_COMMIT_DISTANCE) goTo(index + 1);
          else if (g.dx >= SWIPE_COMMIT_DISTANCE) goTo(index - 1);
        },
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [index, photoUrls.length],
  );

  const url = photoUrls[index];
  const isVideo = url ? isVideoUrl(url) : false;
  const w = s(390 - v3Layout.mediaViewer.stageX * 2, scale);
  const h = s(v3Layout.mediaViewer.stageH, scale);

  return (
    <Animated.View pointerEvents={visible ? 'auto' : 'none'} style={[styles.overlay, { opacity }]}>
      <View style={[styles.header, { top: s(v3Layout.mediaViewer.header, scale), left: s(18, scale), right: s(18, scale), height: s(44, scale) }]}>
        <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Close" style={[styles.closeBtn, { width: s(44, scale), height: s(44, scale), borderRadius: s(22, scale) }]}>
          <Icon path={CLOSE_ICON} size={s(18, scale)} color="#FFFFFF" strokeWidth={2.4} />
        </Pressable>
        <View style={{ alignItems: 'center', gap: 2 }}>
          <Text style={[styles.title, { fontSize: s(15, scale) }]}>{contactName}</Text>
          <Text style={[styles.mono, { fontSize: s(10, scale), letterSpacing: 1 }]}>
            {dateShort} · {place}
          </Text>
        </View>
        <Text style={[styles.mono, styles.count, { fontSize: s(11, scale), width: s(44, scale) }]}>
          {photoUrls.length ? `${index + 1}/${photoUrls.length}` : ''}
        </Text>
      </View>

      <Animated.View
        {...panResponder.panHandlers}
        style={[
          styles.stage,
          { left: s(v3Layout.mediaViewer.stageX, scale), top: s(v3Layout.mediaViewer.stageY, scale), width: w, height: h, borderRadius: s(v3Radius.mediaStage, scale), transform: [{ scale: stageScale }] },
        ]}
      >
        {url &&
          (isVideo ? (
            <VideoStageV3
              uri={url}
              trim={photoTrims[index] ?? null}
              playing={playing}
              onToggle={() => setPlaying((p) => !p)}
              onTimeUpdate={(cur, dur) => {
                setElapsedMs(cur);
                setDurationMs(dur);
              }}
              elapsedMs={elapsedMs}
              durationMs={durationMs}
              scale={scale}
            />
          ) : (
            <Image source={{ uri: url }} style={StyleSheet.absoluteFill} resizeMode="cover" />
          ))}

        {photoUrls.length > 1 && (
          <>
            <Pressable
              onPress={() => goTo(index - 1)}
              disabled={index === 0}
              accessibilityRole="button"
              accessibilityLabel="Previous"
              style={[styles.chevronBtn, { left: s(10, scale), width: s(36, scale), height: s(36, scale), borderRadius: s(18, scale), marginTop: -s(18, scale), opacity: index === 0 ? 0.3 : 1 }]}
            >
              <Icon path={CHEVRON_LEFT_ICON} size={s(16, scale)} color="#FFFFFF" strokeWidth={2.6} />
            </Pressable>
            <Pressable
              onPress={() => goTo(index + 1)}
              disabled={index === photoUrls.length - 1}
              accessibilityRole="button"
              accessibilityLabel="Next"
              style={[styles.chevronBtn, { right: s(10, scale), width: s(36, scale), height: s(36, scale), borderRadius: s(18, scale), marginTop: -s(18, scale), opacity: index === photoUrls.length - 1 ? 0.3 : 1 }]}
            >
              <Icon path={CHEVRON_RIGHT_ICON} size={s(16, scale)} color="#FFFFFF" strokeWidth={2.6} />
            </Pressable>
          </>
        )}
      </Animated.View>

      <View style={{ position: 'absolute', left: s(24, scale), right: s(24, scale), top: s(v3Layout.mediaViewer.captionY, scale), gap: s(6, scale) }}>
        <Text style={[styles.mono, { fontSize: s(10, scale), letterSpacing: 1.2 }]}>
          {isVideo ? 'VIDEO' : 'PHOTO'} · {photoUrls.length ? index + 1 : 0} OF {photoUrls.length}
        </Text>
      </View>

      <View style={[styles.thumbsRow, { top: s(v3Layout.mediaViewer.thumbsY, scale), gap: s(10, scale) }]}>
        {photoUrls.map((u, i) => {
          const active = i === index;
          const video = isVideoUrl(u);
          return (
            <Pressable
              key={`${u}-${i}`}
              onPress={() => goTo(i)}
              accessibilityRole="button"
              accessibilityLabel={video ? `Video ${i + 1}` : `Photo ${i + 1}`}
              style={[
                styles.thumb,
                { width: s(v3Layout.mediaViewer.thumb, scale), height: s(v3Layout.mediaViewer.thumb, scale), borderRadius: s(v3Radius.thumb, scale), opacity: active ? 1 : 0.55 },
                active && styles.thumbActive,
              ]}
            >
              {video ? <PlayTriangle size={s(18, scale)} color="#FFFFFF" /> : <Icon path={IMAGE_ICON} size={s(18, scale)} color="#FFFFFF" strokeWidth={2} />}
              <Text style={[styles.mono, { fontSize: s(9, scale), color: 'rgba(255,255,255,.7)', marginTop: 2 }]}>{video ? '' : `0${i + 1}`}</Text>
            </Pressable>
          );
        })}
      </View>
    </Animated.View>
  );
}

function VideoStageV3({
  uri,
  trim,
  playing,
  onToggle,
  onTimeUpdate,
  elapsedMs,
  durationMs,
  scale,
}: {
  uri: string;
  trim: MediaTrim | null;
  playing: boolean;
  onToggle: () => void;
  onTimeUpdate: (currentMs: number, durationMs: number) => void;
  elapsedMs: number;
  durationMs: number;
  scale: number;
}) {
  const pct = durationMs > 0 ? Math.min(100, (elapsedMs / durationMs) * 100) : 0;
  return (
    <>
      {/* Reuses the same cross-platform AutoplayVideoFill every other video attachment in the app
          plays through, but only mounts it while `playing` — AutoplayVideoFill itself has no
          pause control (it always autoplays/loops), so "paused" here is simply "not mounted" (a
          dark stage behind the play button) rather than a true paused-frame freeze. A reasonable
          trade for reusing the one cross-platform video player this app already has, instead of
          building a second native/web video pair just for this toggle. */}
      {playing && (
        <AutoplayVideoFill uri={uri} trimStartMs={trim?.startMs} trimEndMs={trim?.endMs} muted={false} onTimeUpdate={onTimeUpdate} />
      )}
      <LinearGradient pointerEvents="none" colors={['rgba(0,0,0,0)', 'rgba(0,0,0,.55)']} locations={[0.7, 1]} style={StyleSheet.absoluteFill} />
      <Pressable onPress={onToggle} style={styles.playBtnWrap} accessibilityRole="button" accessibilityLabel={playing ? 'Pause' : 'Play'}>
        <View style={[styles.playBtn, { width: s(68, scale), height: s(68, scale), borderRadius: s(34, scale), opacity: playing ? 0.35 : 1 }]}>
          {playing ? (
            <View style={{ flexDirection: 'row', gap: s(4, scale) }}>
              <View style={{ width: s(4, scale), height: s(14, scale), borderRadius: s(1.2, scale), backgroundColor: v3Color.ink }} />
              <View style={{ width: s(4, scale), height: s(14, scale), borderRadius: s(1.2, scale), backgroundColor: v3Color.ink }} />
            </View>
          ) : (
            <PlayTriangle size={s(24, scale)} color={v3Color.ink} />
          )}
        </View>
      </Pressable>
      {playing && (
        <View style={[styles.scrubberRow, { left: s(18, scale), right: s(18, scale), bottom: s(16, scale), gap: s(10, scale) }]}>
          <Text style={[styles.mono, { fontSize: s(10.5, scale), color: '#FFFFFF' }]}>{formatClockMs(elapsedMs)}</Text>
          <View style={[styles.scrubberTrack, { height: s(4, scale), borderRadius: s(2, scale) }]}>
            <View style={[styles.scrubberFill, { width: `${pct}%`, borderRadius: s(2, scale) }]} />
          </View>
          <Text style={[styles.mono, { fontSize: s(10.5, scale), color: 'rgba(255,255,255,.75)' }]}>{formatClockMs(durationMs)}</Text>
        </View>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  overlay: { position: 'absolute', inset: 0, backgroundColor: v3Color.mediaViewerBg } as object,
  header: { position: 'absolute', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  closeBtn: { backgroundColor: 'rgba(255,255,255,.12)', alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: v3Font.ui800, color: '#FFFFFF' },
  mono: { fontFamily: v3Font.mono, color: 'rgba(255,255,255,.6)' },
  count: { textAlign: 'right' },
  stage: { position: 'absolute', backgroundColor: v3Color.mediaStageBg, overflow: 'hidden' },
  chevronBtn: { position: 'absolute', top: '50%', backgroundColor: 'rgba(0,0,0,.45)', alignItems: 'center', justifyContent: 'center' },
  thumbsRow: { position: 'absolute', left: 0, right: 0, flexDirection: 'row', justifyContent: 'center' },
  thumb: { backgroundColor: 'rgba(255,255,255,.1)', alignItems: 'center', justifyContent: 'center' },
  thumbActive: { borderWidth: 2, borderColor: '#FFFFFF' },
  playBtnWrap: { position: 'absolute', inset: 0, alignItems: 'center', justifyContent: 'center' } as object,
  playBtn: { backgroundColor: 'rgba(255,255,255,.92)', alignItems: 'center', justifyContent: 'center' },
  scrubberRow: { position: 'absolute', flexDirection: 'row', alignItems: 'center' },
  scrubberTrack: { flex: 1, backgroundColor: 'rgba(255,255,255,.3)', overflow: 'hidden' },
  scrubberFill: { height: '100%', backgroundColor: '#FFFFFF' },
});
