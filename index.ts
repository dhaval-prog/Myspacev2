import { Platform } from 'react-native';
import { registerRootComponent } from 'expo';

import App from './App';

// Mobile browsers flash a translucent blue overlay on every tap by default
// (-webkit-tap-highlight-color) — RN Web's Pressable/Text don't disable it,
// so every link and button briefly "lights up" blue on tap. This app draws
// its own pressed states, so the browser's own highlight is just noise.
if (Platform.OS === 'web' && typeof document !== 'undefined') {
  const style = document.createElement('style');
  style.textContent = `
    * { -webkit-tap-highlight-color: transparent; }
  `;
  document.head.appendChild(style);
}

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
