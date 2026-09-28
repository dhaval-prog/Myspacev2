import React from 'react';
import { WeatherCanvas } from './WeatherCanvas.web';
import type { WeatherQuality } from '../../../types/weather';

/**
 * Web-only override of WeatherOverlay (Metro/Expo picks `.web.tsx` over `.tsx` automatically).
 * Same props and same mount point in ThrowHomeScreen's mapArea — above ThrowMap, below the
 * carousel/letter/plane — so nothing in ThrowHomeScreen or ThrowSettingsScreen changes.
 * Native keeps the existing WeatherOverlay.tsx renderers.
 */
export function WeatherOverlay(_props: { quality?: WeatherQuality }) {
  return <WeatherCanvas />;
}
