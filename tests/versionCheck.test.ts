import { describe, it, expect } from 'vitest'
import { isUpdateAvailable } from '@/lib/versionCheck'

describe('isUpdateAvailable', () => {
  it('flags a strictly newer release', () => {
    expect(isUpdateAvailable('v1.5.0', 'v1.6.0')).toBe(true)
    expect(isUpdateAvailable('v1.6.0', 'v1.6.1')).toBe(true)
    expect(isUpdateAvailable('v1.9.0', 'v2.0.0')).toBe(true)
  })

  it('compares numerically, not lexically', () => {
    expect(isUpdateAvailable('v1.9.0', 'v1.10.0')).toBe(true)
    expect(isUpdateAvailable('v1.10.0', 'v1.9.0')).toBe(false)
  })

  it('is not fooled by the v prefix', () => {
    expect(isUpdateAvailable('1.6.0', 'v1.6.0')).toBe(false)
  })

  it('does not tell a master build ahead of the last tag to "update" to that tag', () => {
    expect(isUpdateAvailable('v1.6.0-2-gabc1234', 'v1.6.0')).toBe(false)
  })

  it('still flags a newer release for a master build', () => {
    expect(isUpdateAvailable('v1.6.0-2-gabc1234', 'v1.7.0')).toBe(true)
  })

  it('stays quiet for dev builds and unparseable versions', () => {
    expect(isUpdateAvailable('dev', 'v1.6.0')).toBe(false)
    expect(isUpdateAvailable('abc1234', 'v1.6.0')).toBe(false)
    expect(isUpdateAvailable('v1.6.0', '')).toBe(false)
  })
})
