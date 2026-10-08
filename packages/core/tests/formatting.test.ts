import { describe, it, expect } from 'vitest'
import { possessive } from '../src/formatting'

describe('possessive', () => {
  it('names take ’s; the default name "You" becomes "Your"', () => {
    expect(possessive('Alex')).toBe('Alex’s')
    expect(possessive('James')).toBe('James’s')
    expect(possessive('You')).toBe('Your')
    expect(possessive(' you ')).toBe('Your')
  })
})
