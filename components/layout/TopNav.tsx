'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'

const TABS = [
  { href: '/budget',      label: 'Budget' },
  { href: '/actuals',     label: 'Actuals' },
  { href: '/debts',       label: 'Debts & Assets' },
  { href: '/cashflow',    label: 'Cashflow' },
  { href: '/projections', label: 'Projections' },
  { href: '/super',       label: 'Super' },
]

export default function TopNav() {
  const pathname = usePathname()
  const router   = useRouter()
  if (pathname === '/onboarding') return null
  const active = TABS.find(t => pathname.startsWith(t.href))?.href ?? TABS[0].href
  return (
    <div className="topbar">
      <div className="topbar-title">Proviso</div>
      <nav className="nav-tabs">
        {TABS.map(t => (
          <Link
            key={t.href}
            href={t.href}
            className={`nav-tab${pathname.startsWith(t.href) ? ' active' : ''}`}
          >
            {t.label}
          </Link>
        ))}
      </nav>
      <select
        className="nav-select"
        value={active}
        onChange={e => router.push(e.target.value)}
        aria-label="Navigate to section"
      >
        {TABS.map(t => (
          <option key={t.href} value={t.href}>{t.label}</option>
        ))}
      </select>
      <Link href="/settings" className="nav-settings-btn" aria-label="Setup & settings">⚙</Link>
    </div>
  )
}
