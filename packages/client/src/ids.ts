/**
 * Random ids for `X-Correlation-ID` and idempotency keys.
 *
 * The Lynx background thread may not expose `crypto`, so this feature-detects
 * `getRandomValues` and falls back to `Math.random`. The fallback is fine for
 * both uses: neither value is a secret, they only need to be unique enough
 * not to collide (a correlation id for log lookup; an idempotency key scoped
 * to one tenant/account by the backend).
 */

interface CryptoLike {
  getRandomValues(array: Uint8Array): Uint8Array;
}

function randomBytes(count: number): Uint8Array {
  const bytes = new Uint8Array(count);
  const c = (globalThis as { crypto?: Partial<CryptoLike> }).crypto;
  if (c && typeof c.getRandomValues === 'function') {
    c.getRandomValues(bytes);
    return bytes;
  }
  for (let i = 0; i < count; i++) bytes[i] = Math.floor(Math.random() * 256);
  return bytes;
}

/** UUID v4 shape (`xxxxxxxx-xxxx-4xxx-[89ab]xxx-xxxxxxxxxxxx`). */
export function createRandomId(): string {
  const b = randomBytes(16);
  b[6] = ((b[6] ?? 0) & 0x0f) | 0x40;
  b[8] = ((b[8] ?? 0) & 0x3f) | 0x80;
  let hex = '';
  for (let i = 0; i < 16; i++) hex += (b[i] ?? 0).toString(16).padStart(2, '0');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/** Backend rule (shared envelope): 1-255 visible ASCII characters. */
const IDEMPOTENCY_KEY_PATTERN = /^[!-~]{1,255}$/;

export function isValidIdempotencyKey(key: string): boolean {
  return IDEMPOTENCY_KEY_PATTERN.test(key);
}
