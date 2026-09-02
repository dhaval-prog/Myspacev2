// No-op on web — the browser already provides real WebRTC globals natively.
// Exists only so ../utils/registerWebRTC resolves on every platform (mirrors
// the .native.ts counterpart, same split pattern as MapCanvas/VideoTile).
export {};
