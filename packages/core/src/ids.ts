// Row IDs for the local-first data model (docs/architecture.md, D3).
//
// Every synced row has a UUID string id, created on the device:
//   - newId(): a UUIDv7 for ordinary new records. Time-ordered, random tail,
//     so two offline devices never pick the same id.
//   - contentId(): a deterministic id for rows that have a natural key — a
//     bank transaction (date + description + amount), a categorisation rule
//     (its pattern), a person's HELP record for a financial year. Two devices
//     that create "the same" row independently produce the same id, so sync
//     merges them instead of duplicating. This replaces database uniqueness
//     constraints, which can't work when devices write offline.
//
// Row ids travel inside the encrypted sync payload, never in clear, so a
// content id can't be used to guess the content.
//
// Pure TypeScript: callers pass in time and randomness, so this runs the same
// in Node, browsers and React Native.

/** A UUIDv7 from a millisecond timestamp and 10+ random bytes. */
export function uuidv7(nowMs: number, random: Uint8Array): string {
  if (random.length < 10) throw new Error('uuidv7 needs at least 10 random bytes')
  const b = new Uint8Array(16)
  let t = Math.floor(nowMs)
  for (let i = 5; i >= 0; i--) { b[i] = t % 256; t = Math.floor(t / 256) }
  b.set(random.subarray(0, 10), 6)
  b[6] = 0x70 | (b[6] & 0x0f)  // version 7
  b[8] = 0x80 | (b[8] & 0x3f)  // RFC 4122 variant
  return format(b)
}

/** A new record id. Uses the platform's secure random source (Web Crypto, present in Node, browsers and Hermes with expo-crypto). */
export function newId(nowMs: number = Date.now()): string {
  const random = new Uint8Array(10)
  const c = (globalThis as { crypto?: { getRandomValues(a: Uint8Array): Uint8Array } }).crypto
  if (!c?.getRandomValues) throw new Error('No secure random source available')
  c.getRandomValues(random)
  return uuidv7(nowMs, random)
}

/**
 * A deterministic id from a scope and the parts of a natural key: the same
 * inputs always give the same id. Scope separates kinds of row (use the table
 * name) and, for ids derived from legacy integer ids, the household.
 * Formatted as a UUIDv8 (the custom-layout version).
 */
export function contentId(scope: string, ...parts: (string | number)[]): string {
  // Unit Separator between parts, so ('ab','c') and ('a','bc') differ.
  const input = [scope, ...parts.map(p => String(p))].join('\u001f')
  const b = murmur3x86_128(utf8(input))
  b[6] = 0x80 | (b[6] & 0x0f)  // version 8
  b[8] = 0x80 | (b[8] & 0x3f)  // RFC 4122 variant
  return format(b)
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[78][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/

/** True for the ids this module produces (v7 or v8). */
export function isRowId(s: unknown): s is string {
  return typeof s === 'string' && UUID_RE.test(s)
}

function format(b: Uint8Array): string {
  const h = Array.from(b, x => x.toString(16).padStart(2, '0')).join('')
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`
}

export function utf8(s: string): Uint8Array {
  const out: number[] = []
  for (const ch of s) {
    let c = ch.codePointAt(0)!
    if (c < 0x80) out.push(c)
    else if (c < 0x800) out.push(0xc0 | (c >> 6), 0x80 | (c & 63))
    else if (c < 0x10000) out.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63))
    else { out.push(0xf0 | (c >> 18), 0x80 | ((c >> 12) & 63), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63)); c = 0 }
  }
  return Uint8Array.from(out)
}

// MurmurHash3, x86 128-bit variant (public domain, Austin Appleby). Not a
// cryptographic hash — used only to spread natural keys evenly over ids.
export function murmur3x86_128(key: Uint8Array, seed = 0): Uint8Array {
  const c1 = 0x239b961b, c2 = 0xab0e9789, c3 = 0x38b34ae5, c4 = 0xa1e38b93
  let h1 = seed, h2 = seed, h3 = seed, h4 = seed
  const len = key.length
  const nblocks = len >> 4
  const rd = (i: number) => key[i] | (key[i + 1] << 8) | (key[i + 2] << 16) | (key[i + 3] << 24)
  for (let i = 0; i < nblocks; i++) {
    const o = i * 16
    let k1 = rd(o), k2 = rd(o + 4), k3 = rd(o + 8), k4 = rd(o + 12)
    k1 = Math.imul(k1, c1); k1 = rotl(k1, 15); k1 = Math.imul(k1, c2); h1 ^= k1
    h1 = rotl(h1, 19); h1 = (h1 + h2) | 0; h1 = (Math.imul(h1, 5) + 0x561ccd1b) | 0
    k2 = Math.imul(k2, c2); k2 = rotl(k2, 16); k2 = Math.imul(k2, c3); h2 ^= k2
    h2 = rotl(h2, 17); h2 = (h2 + h3) | 0; h2 = (Math.imul(h2, 5) + 0x0bcaa747) | 0
    k3 = Math.imul(k3, c3); k3 = rotl(k3, 17); k3 = Math.imul(k3, c4); h3 ^= k3
    h3 = rotl(h3, 15); h3 = (h3 + h4) | 0; h3 = (Math.imul(h3, 5) + 0x96cd1c35) | 0
    k4 = Math.imul(k4, c4); k4 = rotl(k4, 18); k4 = Math.imul(k4, c1); h4 ^= k4
    h4 = rotl(h4, 13); h4 = (h4 + h1) | 0; h4 = (Math.imul(h4, 5) + 0x32ac3b17) | 0
  }
  const tail = nblocks * 16
  let k1 = 0, k2 = 0, k3 = 0, k4 = 0
  switch (len & 15) {
    case 15: k4 ^= key[tail + 14] << 16 // falls through
    case 14: k4 ^= key[tail + 13] << 8 // falls through
    case 13: k4 ^= key[tail + 12]
      k4 = Math.imul(k4, c4); k4 = rotl(k4, 18); k4 = Math.imul(k4, c1); h4 ^= k4 // falls through
    case 12: k3 ^= key[tail + 11] << 24 // falls through
    case 11: k3 ^= key[tail + 10] << 16 // falls through
    case 10: k3 ^= key[tail + 9] << 8 // falls through
    case 9: k3 ^= key[tail + 8]
      k3 = Math.imul(k3, c3); k3 = rotl(k3, 17); k3 = Math.imul(k3, c4); h3 ^= k3 // falls through
    case 8: k2 ^= key[tail + 7] << 24 // falls through
    case 7: k2 ^= key[tail + 6] << 16 // falls through
    case 6: k2 ^= key[tail + 5] << 8 // falls through
    case 5: k2 ^= key[tail + 4]
      k2 = Math.imul(k2, c2); k2 = rotl(k2, 16); k2 = Math.imul(k2, c3); h2 ^= k2 // falls through
    case 4: k1 ^= key[tail + 3] << 24 // falls through
    case 3: k1 ^= key[tail + 2] << 16 // falls through
    case 2: k1 ^= key[tail + 1] << 8 // falls through
    case 1: k1 ^= key[tail]
      k1 = Math.imul(k1, c1); k1 = rotl(k1, 15); k1 = Math.imul(k1, c2); h1 ^= k1
  }
  h1 ^= len; h2 ^= len; h3 ^= len; h4 ^= len
  h1 = (h1 + h2) | 0; h1 = (h1 + h3) | 0; h1 = (h1 + h4) | 0
  h2 = (h2 + h1) | 0; h3 = (h3 + h1) | 0; h4 = (h4 + h1) | 0
  h1 = fmix(h1); h2 = fmix(h2); h3 = fmix(h3); h4 = fmix(h4)
  h1 = (h1 + h2) | 0; h1 = (h1 + h3) | 0; h1 = (h1 + h4) | 0
  h2 = (h2 + h1) | 0; h3 = (h3 + h1) | 0; h4 = (h4 + h1) | 0
  const out = new Uint8Array(16)
  ;[h1, h2, h3, h4].forEach((h, i) => {
    out[i * 4] = h >>> 24; out[i * 4 + 1] = (h >>> 16) & 255; out[i * 4 + 2] = (h >>> 8) & 255; out[i * 4 + 3] = h & 255
  })
  return out
}

function rotl(x: number, r: number): number { return (x << r) | (x >>> (32 - r)) }

function fmix(h: number): number {
  h ^= h >>> 16; h = Math.imul(h, 0x85ebca6b)
  h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35)
  h ^= h >>> 16
  return h
}
