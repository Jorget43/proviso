import { describe, it, expect } from 'vitest'
import { isBusyError } from '@/lib/dbErrors'

describe('isBusyError', () => {
  it('matches a raw SQLITE_BUSY message', () => {
    expect(isBusyError(new Error('SQLITE_BUSY: database is locked'))).toBe(true)
  })

  it('matches a bare "database is locked" message', () => {
    expect(isBusyError(new Error('database is locked'))).toBe(true)
  })

  it('is case-insensitive', () => {
    expect(isBusyError(new Error('Database Is Locked'))).toBe(true)
  })

  it('matches a non-Error value coerced to string', () => {
    expect(isBusyError('SQLITE_BUSY')).toBe(true)
  })

  it('is false for an unrelated error message', () => {
    expect(isBusyError(new Error('Unique constraint failed on the fields'))).toBe(false)
  })

  it('is false for a network-style error', () => {
    expect(isBusyError(new Error('fetch failed'))).toBe(false)
  })
})
