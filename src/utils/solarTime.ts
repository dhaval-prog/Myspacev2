/**
 * Whether it currently reads as daytime by the *viewer's own device clock* — plain local wall-
 * clock hours (`Date#getHours`/`getMinutes`, which JS already resolves in the runtime's own
 * timezone, no UTC/longitude math needed). Every Throw map and letter uses this same one signal,
 * per explicit request: a contact's own country reading as day or night there is irrelevant —
 * whoever is using the app right now sees every map and every paper in whichever half of the day
 * it currently is *for them*, uniformly. 6am-6pm reads as day.
 */
export function isDaytimeNow(at: Date = new Date()): boolean {
  const hour = at.getHours() + at.getMinutes() / 60 + at.getSeconds() / 3600;
  return hour >= 6 && hour < 18;
}
