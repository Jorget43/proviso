'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const TABS = [
  { href: '/budget',      label: 'Budget' },
  { href: '/actuals',     label: 'Actuals' },
  { href: '/debts',       label: 'Debts & Assets' },
  { href: '/cashflow',    label: 'Cashflow' },
  { href: '/projections', label: 'Projections' },
]

export default function TopNav() {
  const pathname = usePathname()
  return (
    <div className="topbar">
      <div className="topbar-title">Household <em>Dashboard</em></div>
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
