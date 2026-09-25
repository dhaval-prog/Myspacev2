import type { MapStyleElement } from 'react-native-maps';
import { throwMapNightColor } from './throwMapTokens';

/**
 * Google Maps' own JSON style-array format (the only customization surface react-native-maps
 * exposes on Android/Google Maps — there's no MapLibre-style layer-by-layer paint API here), fed
 * the same locked night palette as the web MapLibre version so both platforms read as the same
 * "night" even though the mechanism is completely different. iOS/Apple Maps has no equivalent
 * custom-JSON hook; it gets `userInterfaceStyle="dark"` instead (Apple's own built-in dark map),
 * set alongside this in ThrowMap.native.tsx.
 */
export const throwMapNightGoogleStyle: MapStyleElement[] = [
  { elementType: 'geometry', stylers: [{ color: throwMapNightColor.land }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: throwMapNightColor.land }] },
  { elementType: 'labels.text.fill', stylers: [{ color: throwMapNightColor.roadMajor }] },
  { featureType: 'poi', elementType: 'geometry', stylers: [{ color: throwMapNightColor.landuseTint }] },
  { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: throwMapNightColor.landuseTint }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: throwMapNightColor.roadMinor }] },
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: throwMapNightColor.land }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: throwMapNightColor.roadMajor }] },
  { featureType: 'road.arterial', elementType: 'geometry', stylers: [{ color: throwMapNightColor.roadMajor }] },
  { featureType: 'transit', elementType: 'geometry', stylers: [{ color: throwMapNightColor.landuseTint }] },
  { featureType: 'administrative', elementType: 'geometry', stylers: [{ color: throwMapNightColor.roadMinor }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: throwMapNightColor.water }] },
];
