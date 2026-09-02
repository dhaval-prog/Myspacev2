// Patches the native runtime's globals (RTCPeerConnection, MediaStream,
// navigator.mediaDevices.getUserMedia, etc.) to mirror the browser's, via
// react-native-webrtc — so the rest of the calling code (CallContext) can
// stay platform-agnostic instead of branching on Platform.OS everywhere.
//
// Guarded: react-native-webrtc's native module isn't present when running
// in Expo Go (it needs a custom dev client — see the "Adding custom native
// code" step in the Expo docs), and importing it there throws synchronously.
// Swallow that so the app still boots; video calls just stay unavailable on
// that device, same as before this file existed.
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { registerGlobals } = require('react-native-webrtc');
  registerGlobals();
} catch {
  // Native module not linked — see above.
}
