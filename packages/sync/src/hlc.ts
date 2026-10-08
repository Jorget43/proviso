// Hybrid logical clocks (docs/architecture.md, D3): every change carries a
// timestamp that orders events correctly even when devices' clocks disagree.
//
// A timestamp is wall-clock milliseconds, a counter for events within the
// same millisecond, and the device's node id, written as one fixed-width
// string so that comparing two strings compares the timestamps:
//
//   000001780000000000-0000-1a2b3c4d5e6f7a8b
//   └ millis (18 digits) ┘└ctr┘└── node ──────┘
//
// The node id breaks ties between devices, so no two devices ever produce
// the same timestamp and "latest wins" always has one answer.

export interface Clock {
  millis:  number
  counter: number
  node:    string
}

/** Clocks further ahead than this are refused: a broken clock mustn't drag every device into the future. */
export const MAX_DRIFT_MS = 5 * 60 * 1000
const MAX_COUNTER = 0xffff

export class ClockError extends Error {
  constructor(message: string) { super(message); this.name = 'ClockError' }
}

export function formatHlc(c: Clock): string {
  return `${String(c.millis).padStart(18, '0')}-${c.counter.toString(16).padStart(4, '0')}-${c.node}`
}

export function parseHlc(s: string): Clock {
  const m = /^(\d{18})-([0-9a-f]{4})-([0-9a-f]{16})$/.exec(s)
  if (!m) throw new ClockError(`Not a sync timestamp: ${s}`)
  return { millis: Number(m[1]), counter: parseInt(m[2], 16), node: m[3] }
}

/** A device's node id: 16 hex characters, random, made once per device. */
export function isNodeId(s: string): boolean {
  return /^[0-9a-f]{16}$/.test(s)
}

/** The start of a device's clock. */
export function initialClock(node: string): Clock {
  if (!isNodeId(node)) throw new ClockError('A node id is 16 hex characters.')
  return { millis: 0, counter: 0, node }
}

/** The timestamp for a change made on this device now. Returns the new clock state (also the timestamp). */
export function tick(c: Clock, now: number): Clock {
  const millis = Math.max(c.millis, now)
  const counter = millis === c.millis ? c.counter + 1 : 0
  if (counter > MAX_COUNTER) throw new ClockError('Too many changes in one millisecond.')
  return { millis, counter, node: c.node }
}

/** Moves this device's clock past a timestamp received from another device. */
export function receive(c: Clock, remote: Clock, now: number): Clock {
  if (remote.millis - now > MAX_DRIFT_MS) throw new ClockError('Another device’s clock is too far ahead. Check the date and time on your devices.')
  const millis = Math.max(c.millis, remote.millis, now)
  const counter = millis === c.millis && millis === remote.millis ? Math.max(c.counter, remote.counter) + 1
    : millis === c.millis ? c.counter + 1
    : millis === remote.millis ? remote.counter + 1
    : 0
  if (counter > MAX_COUNTER) throw new ClockError('Too many changes in one millisecond.')
  return { millis, counter, node: c.node }
}
