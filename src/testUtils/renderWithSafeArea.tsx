import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { render, type RenderResult } from '@testing-library/react-native';

const insetsMetrics = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 47, left: 0, right: 0, bottom: 34 } };

/** Every screen in this app reads insets via useSafeAreaInsets(), so tests need a SafeAreaProvider ancestor — this pins it to one fixed frame/inset set, matching the fixture-harness convention used for visual verification. */
export function renderWithSafeArea(ui: React.ReactElement): Promise<RenderResult> {
  return render(<SafeAreaProvider initialMetrics={insetsMetrics}>{ui}</SafeAreaProvider>);
}
