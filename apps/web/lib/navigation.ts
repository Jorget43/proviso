// App structure: four destinations ("hubs"), each grouping one or more pages.
// The same structure drives the desktop top tabs, the mobile bottom bar, and
// the segmented sub-navigation shown inside a hub with more than one page.
// Page URLs predate the hubs and are kept as-is so bookmarks keep working.

export interface NavSection {
  href:  string
  label: string
}

export interface NavHub {
  key:      'home' | 'spending' | 'wealth' | 'future'
  label:    string
  href:     string        // where tapping the hub goes
  sections: NavSection[]  // empty for single-page hubs
}

export const HUBS: NavHub[] = [
  { key: 'home', label: 'Home', href: '/', sections: [] },
  {
    key: 'spending', label: 'Spending', href: '/budget',
    sections: [
      { href: '/budget',  label: 'Budget' },
      { href: '/actuals', label: 'Actual spending' },
    ],
  },
  {
    key: 'wealth', label: 'Wealth', href: '/debts',
    sections: [
      { href: '/debts',       label: 'Own & owe' },
      { href: '/super',       label: 'Super' },
      { href: '/investments', label: 'Investments' },
    ],
  },
  {
    key: 'future', label: 'Future', href: '/projections',
    sections: [
      { href: '/projections', label: 'Long term' },
      { href: '/cashflow',    label: 'Next 2 years' },
    ],
  },
]

function isUnder(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(href + '/')
}

/** The hub a path belongs to, or null for pages outside the hubs (Settings, EOFY…). */
export function hubFor(pathname: string): NavHub | null {
  if (pathname === '/') return HUBS[0]
  return HUBS.find(h => h.sections.some(s => isUnder(pathname, s.href))) ?? null
}

/** The section within its hub that a path belongs to, or null. */
export function sectionFor(pathname: string): NavSection | null {
  return hubFor(pathname)?.sections.find(s => isUnder(pathname, s.href)) ?? null
}
