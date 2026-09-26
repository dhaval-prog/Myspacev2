// Common video container extensions — covers both a picked/recorded local file's own extension
// and the extension the upload path writes from its blob's mime subtype (see ThrowContext's
// extFromBlob), since there's no separate per-attachment media-type column in the DB to read back
// instead.
const VIDEO_EXTENSIONS = new Set(['mp4', 'mov', 'qt', 'quicktime', 'webm', 'm4v', '3gp', '3gpp', 'avi', 'mkv', 'ogv']);

/** Best-effort "is this a video, not an image" check from a URI/URL's file extension. */
export function isVideoUri(uri: string): boolean {
  const clean = uri.split('?')[0].split('#')[0];
  const ext = clean.split('.').pop()?.toLowerCase() ?? '';
  return VIDEO_EXTENSIONS.has(ext);
}
