import { describe, it, expect } from 'vitest'
import { uuidv7, newId, contentId, isRowId } from '../src/ids'

describe('uuidv7', () => {
  it('puts the timestamp first, so ids sort by creation time', () => {
    const r = new Uint8Array(10)
    const a = uuidv7(Date.UTC(2026, 9, 6), r)
    const b = uuidv7(Date.UTC(2026, 9, 7), r)
    expect(a < b).toBe(true)
    // 2026-10-06T00:00:00Z = 0x019cb7… ms → first 48 bits
    expect(a.slice(0, 13)).toBe(Date.UTC(2026, 9, 6).toString(16).padStart(12, '0').replace(/^(.{8})/, '$1-'))
  })

  it('sets version 7 and the RFC 4122 variant', () => {
    const id = uuidv7(0, new Uint8Array(10).fill(255))
    expect(id[14]).toBe('7')
    expect('89ab').toContain(id[19])
    expect(isRowId(id)).toBe(true)
  })
})

describe('newId', () => {
  it('never repeats', () => {
    const ids = new Set(Array.from({ length: 2000 }, () => newId()))
    expect(ids.size).toBe(2000)
  })
})

describe('contentId', () => {
  it('is the same for the same natural key, on any device', () => {
    const a = contentId('transaction', '01/09/2026', 'TEST GROCER', -45.2)
    const b = contentId('transaction', '01/09/2026', 'TEST GROCER', -45.2)
    expect(a).toBe(b)
    expect(a[14]).toBe('8')  // version 8
    expect(isRowId(a)).toBe(true)
  })

  it('differs for any change in scope or key', () => {
    const base = contentId('transaction', '01/09/2026', 'TEST GROCER', -45.2)
    expect(contentId('transaction', '01/09/2026', 'TEST GROCER', -45.21)).not.toBe(base)
    expect(contentId('donation', '01/09/2026', 'TEST GROCER', -45.2)).not.toBe(base)
  })

  it('keeps parts separate: ("ab","c") ≠ ("a","bc")', () => {
    expect(contentId('t', 'ab', 'c')).not.toBe(contentId('t', 'a', 'bc'))
  })

  it('handles non-ASCII text', () => {
    expect(contentId('t', 'Café ☕')).not.toBe(contentId('t', 'Cafe ☕'))
  })
})

describe('isRowId', () => {
  it('rejects other strings', () => {
    expect(isRowId('household')).toBe(false)
    expect(isRowId('123')).toBe(false)
    expect(isRowId('00000000-0000-4000-8000-000000000000')).toBe(false)  // v4 isn't ours
  })
})
