/**
 * A v4-shaped UUID generator that works identically on web and native
 * (Hermes has no built-in `crypto.randomUUID`, and this app has no uuid
 * polyfill installed) — only used for client-side idempotency keys, never
 * for anything security-sensitive, so Math.random is an acceptable source.
 */
export function randomId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
