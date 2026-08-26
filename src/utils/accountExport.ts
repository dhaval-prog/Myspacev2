import { Platform } from 'react-native';

/** Escapes a single CSV field per RFC 4180 (quote-wrap whenever it contains a comma, quote, or newline). */
function csvField(value: unknown): string {
  const s = value === null || value === undefined ? '' : String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Turns an array of flat objects into a CSV string, columns taken from the first row's keys. */
export function toCsv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return '';
  const columns = Object.keys(rows[0]);
  const lines = [columns.join(','), ...rows.map((row) => columns.map((c) => csvField(row[c])).join(','))];
  return lines.join('\n');
}

/**
 * Triggers a browser file download. Only works on web (this app's only
 * deployed target today) — returns false elsewhere so callers can show a
 * "not available on this build" note instead of silently doing nothing.
 */
export function triggerDownload(filename: string, content: string, mime: string): boolean {
  if (Platform.OS !== 'web' || typeof document === 'undefined') return false;
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  return true;
}

export function downloadJson(filename: string, data: unknown): boolean {
  return triggerDownload(filename, JSON.stringify(data, null, 2), 'application/json');
}

export function downloadCsv(filename: string, rows: Record<string, unknown>[]): boolean {
  return triggerDownload(filename, toCsv(rows), 'text/csv');
}
