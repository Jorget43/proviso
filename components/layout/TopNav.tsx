'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

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
  if (pathname === '/onboarding') return null
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
    </div>
  )
}
