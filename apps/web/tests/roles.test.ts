import { describe, it, expect } from 'vitest'
import { can } from '@/lib/roles'

describe('roles', () => {
  it('lets a Partner change the household’s money, but not its members', () => {
    expect(can('PARTNER', 'budget:write')).toBe(true)
    expect(can('PARTNER', 'actuals:write')).toBe(true)
    expect(can('PARTNER', 'users:write')).toBe(false)
  })
  it('keeps a Child to their pocket money', () => {
    expect(can('CHILD', 'budget:write')).toBe(false)
    expect(can('CHILD', 'child:write')).toBe(true)
  })
  it('refuses unknown roles', () => {
    expect(can('GUEST', 'budget:write')).toBe(false)
  })
})
