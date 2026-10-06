import { haversineMeters, type LatLng } from './geo';

/**
 * Pure logic for the Friends Map screen — Web Mercator projection, screen-pixel clustering,
 * distance/ETA formatting and search/filter — ported from the design handoff's own `Component`
 * class (`source/MySpace Friends Map.dc.html`) so the exact zoom-shrink/cluster-merge/focus
 * behavior matches the reference, just driven by this app's real friend data instead of the
 * handoff's own hardcoded `CONTACTS` seed array. Kept dependency-free (no React, no map SDK) so
 * it's unit-testable on its own and reusable from both the web (Mapbox GL) and native
 * (react-native-maps) map canvases.
 */

/** Standard 256px slippy-map tile size — the same convention OSM/Google/the design handoff use.
 * Mapbox GL's own zoom is one level "zoomed in" per step relative to this (its tiles are 512px),
 * so a web canvas converting one of these zoom values for `map.setZoom` subtracts 1 — see
 * `FriendsMapCanvas.web.tsx`'s own comment. */
export const TILE_SIZE = 256;
export const MIN_ZOOM = 3;
export const MAX_ZOOM = 15;
/** Below this zoom, nearby pins merge into a cluster bubble (design handoff's own threshold). */
export const CLUSTER_ZOOM_THRESHOLD = 13;
/** Pins within this many screen pixels of each other merge (at a given zoom). */
export const CLUSTER_MERGE_PX = 48;
/** "Nearby" filter chip's own distance cutoff. */
export const NEARBY_KM = 60;
/** A location's `updatedAt` counts as "live" (currently sharing) within this window. */
export const LIVE_WINDOW_MS = 5 * 60 * 1000;

export function clampZoom(z: number): number {
  return Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, z));
}

/** Normalized Web Mercator x (0..1 across the whole world). */
export function mercatorU(lon: number): number {
  return (lon + 180) / 360;
}

/** Normalized Web Mercator y (0..1 across the whole world). */
export function mercatorV(lat: number): number {
  const r = (lat * Math.PI) / 180;
  return (1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2;
}

export function lonFromU(u: number): number {
  return u * 360 - 180;
}

export function latFromV(v: number): number {
  const n = Math.PI - 2 * Math.PI * v;
  return (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
}

/** World pixel width of the whole map at a given zoom (256px-tile convention). */
export function worldWidth(zoom: number): number {
  return TILE_SIZE * 2 ** zoom;
}

export function distanceKm(a: LatLng, b: LatLng): number {
  return haversineMeters(a, b) / 1000;
}

/** "4.2 km" under 10km (one decimal), "1,284 km" beyond it — matches the handoff's own `fmtKm`. */
export function formatDistanceKm(km: number): string {
  return km < 10 ? `${km.toFixed(1)} km` : `${Math.round(km).toLocaleString()} km`;
}

/** Rough "a plane takes" ETA label — matches the handoff's own `etaFor` bucketing exactly. */
export function etaLabel(km: number): string {
  if (km < 15) return '2 min';
  if (km < 200) return `${Math.round(4 + km / 20)} min`;
  return `${Math.round(10 + km / 25)} min`;
}

/** Whether a location's last-updated timestamp counts as "currently sharing live" right now. */
export function isLive(updatedAt: string | null | undefined, now: number = Date.now()): boolean {
  if (!updatedAt) return false;
  const t = new Date(updatedAt).getTime();
  if (Number.isNaN(t)) return false;
  return now - t < LIVE_WINDOW_MS;
}

export interface ClusterInput {
  id: string;
  lat: number;
  lon: number;
}

export interface ClusterGroup<T extends ClusterInput> {
  lat: number;
  lon: number;
  items: T[];
}

/**
 * Merges pins that land within `CLUSTER_MERGE_PX` screen pixels of each other at the given zoom —
 * ported from the handoff's own `groups` reducer. Clustering only ever needs *relative* pixel
 * distances between two world points, which only depend on (u, v, zoom) — not on where the
 * camera itself is pointed or how the viewport anchors it — so this never needs a screen
 * projection/anchor to be correct, only the zoom level.
 *
 * `selectedId`, if set, never merges into another group (the handoff keeps a selected pin always
 * visible on its own, even if a neighbor would otherwise swallow it).
 */
export function clusterPins<T extends ClusterInput>(
  pins: T[],
  opts: { zoom: number; selectedId?: string | null; enabled?: boolean },
): ClusterGroup<T>[] {
  const enabled = (opts.enabled ?? true) && opts.zoom < CLUSTER_ZOOM_THRESHOLD;
  const W = worldWidth(opts.zoom);
  const pts = pins.map((p) => ({ p, u: mercatorU(p.lon), v: mercatorV(p.lat) }));
  const groups: { u: number; v: number; items: { p: T; u: number; v: number }[]; hasSel: boolean }[] = [];
  for (const pt of pts) {
    const isSelected = opts.selectedId != null && pt.p.id === opts.selectedId;
    const match =
      enabled && !isSelected
        ? groups.find((g) => !g.hasSel && Math.hypot((g.u - pt.u) * W, (g.v - pt.v) * W) < CLUSTER_MERGE_PX)
        : undefined;
    if (match) {
      match.items.push(pt);
      match.u = match.items.reduce((sum, i) => sum + i.u, 0) / match.items.length;
      match.v = match.items.reduce((sum, i) => sum + i.v, 0) / match.items.length;
    } else {
      groups.push({ u: pt.u, v: pt.v, items: [pt], hasSel: isSelected });
    }
  }
  return groups.map((g) => ({
    lat: latFromV(g.v),
    lon: lonFromU(g.u),
    items: g.items.map((i) => i.p),
  }));
}

/**
 * Shrinks zoom from `MAX_ZOOM` until every point's bounding box fits inside a ~300px square —
 * ported verbatim from the handoff's own `fit()`. Returns the zoom plus the bbox's center point,
 * for a "fit all" / "fit this cluster" camera jump.
 */
export function fitViewport(points: LatLng[]): { zoom: number; center: LatLng } | null {
  if (points.length === 0) return null;
  const us = points.map((p) => mercatorU(p.longitude));
  const vs = points.map((p) => mercatorV(p.latitude));
  const u0 = Math.min(...us);
  const u1 = Math.max(...us);
  const v0 = Math.min(...vs);
  const v1 = Math.max(...vs);
  let z = MAX_ZOOM;
  while (z > MIN_ZOOM && ((u1 - u0) * worldWidth(z) > 300 || (v1 - v0) * worldWidth(z) > 300)) z--;
  return { zoom: z, center: { latitude: latFromV((v0 + v1) / 2), longitude: lonFromU((u0 + u1) / 2) } };
}

/**
 * The camera jump a tapped pin/card focuses to — ported from the handoff's own `focus(c)`: zoom
 * in to at least 12, and nudge the center's world-space v by a fixed 40px (at the *target* zoom)
 * so the pin lands a little above true center, leaving room for the bottom sheet/detail card
 * below it rather than being covered by it.
 */
export function focusCamera(point: LatLng, currentZoom: number): { zoom: number; center: LatLng } {
  const zoom = Math.max(currentZoom, 12);
  const v = mercatorV(point.latitude) + 40 / worldWidth(zoom);
  return { zoom, center: { latitude: latFromV(v), longitude: point.longitude } };
}

export type MapFilter = 'all' | 'live' | 'nearby';

export interface FilterableContact {
  name: string;
  city: string;
  area: string;
  live: boolean;
  distanceKm: number;
}

/** Search-by-name/area/city plus the All/Live/Nearby chip — ported from the handoff's own `visible()`. */
export function filterContacts<T extends FilterableContact>(contacts: T[], opts: { filter: MapFilter; query: string }): T[] {
  const q = opts.query.trim().toLowerCase();
  return contacts.filter((c) => {
    const passesFilter = opts.filter === 'all' || (opts.filter === 'live' && c.live) || (opts.filter === 'nearby' && c.distanceKm < NEARBY_KM);
    if (!passesFilter) return false;
    if (!q) return true;
    return `${c.name} ${c.city} ${c.area}`.toLowerCase().includes(q);
  });
}
