import React from 'react';

// expo-video's web `VideoView` only reliably shows a moving picture for some sources — recorded
// `blob:` URIs (a just-recorded story, see StoryCaptureScreen.web's MediaRecorder output) and even
// plain uploaded `https:` ones would render frozen on their first frame instead of actually
// playing, in both the pre-post preview and the posted story/letter viewer. A plain HTML `<video>`
// element with the autoplay attributes set directly (rather than calling `.play()` from JS after
// the element mounts, which is what the shared expo-video path effectively does) is the standard,
// battle-tested way to get Safari/Chrome to actually autoplay-and-loop a muted video — the same
// raw-DOM-element approach StoryCaptureScreen.web already uses for its own live camera preview.
const style: React.CSSProperties = {
  position: 'absolute',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  width: '100%',
  height: '100%',
  objectFit: 'cover',
  pointerEvents: 'none',
};

export function AutoplayVideoFill({ uri }: { uri: string }) {
  // eslint-disable-next-line jsx-a11y/media-has-caption
  return <video src={uri} autoPlay loop muted playsInline style={style} />;
}
