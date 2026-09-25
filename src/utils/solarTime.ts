/**
 * Whether it currently reads as daytime at a given longitude — a plain longitude-based local
 * solar time approximation (`UTC hour + longitude / 15`), not a real timezone/DST lookup. That's
 * a deliberate scope call, not a shortcut: this only ever drives which of two map palettes to
 * show, so an approximation that's occasionally off by the width of a timezone (a civil
 * boundary doesn't always line up with true solar noon) is fine, and it avoids pulling in a
 * timezone database for a cosmetic switch. 6am-6pm solar time reads as day.
 */
export function isDaytimeAt(longitude: number, at: Date = new Date()): boolean {
  const utcHours = at.getUTCHours() + at.getUTCMinutes() / 60 + at.getUTCSeconds() / 3600;
  const solarHour = (((utcHours + longitude / 15) % 24) + 24) % 24;
  return solarHour >= 6 && solarHour < 18;
}
