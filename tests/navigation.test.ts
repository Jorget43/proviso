import { describe, it, expect } from 'vitest'
import { HUBS, hubFor, sectionFor } from '@/lib/navigation'

describe('hubFor', () => {
  it('maps the root to Home', () => {
    expect(hubFor('/')?.key).toBe('home')
  })

  it('groups the existing pages under the four hubs', () => {
    expect(hubFor('/budget')?.key).toBe('spending')
    expect(hubFor('/actuals')?.key).toBe('spending')
    expect(hubFor('/debts')?.key).toBe('wealth')
    expect(hubFor('/super')?.key).toBe('wealth')
    expect(hubFor('/investments')?.key).toBe('wealth')
    expect(hubFor('/projections')?.key).toBe('future')
    expect(hubFor('/cashflow')?.key).toBe('future')
  })

  it('matches nested paths but not lookalike prefixes', () => {
    expect(hubFor('/super/history')?.key).toBe('wealth')
    expect(hubFor('/budgeting')).toBeNull()
  })

  it('leaves pages outside the hubs unmatched', () => {
    expect(hubFor('/settings')).toBeNull()
    expect(hubFor('/eofy')).toBeNull()
    expect(hubFor('/settings/activity')).toBeNull()
  })
})

describe('sectionFor', () => {
  it('finds the active section within a hub', () => {
    expect(sectionFor('/cashflow')?.label).toBe('Next 2 years')
    expect(sectionFor('/')).toBeNull()
  })
})

describe('HUBS', () => {
  it('every hub links to its own first section', () => {
    for (const h of HUBS) {
      if (h.sections.length) expect(h.href).toBe(h.sections[0].href)
    }
  })
})
