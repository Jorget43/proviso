'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { isEofySeason } from '@/lib/eofy'

const TABS = [
  { href: '/budget',      label: 'Budget' },
  { href: '/actuals',     label: 'Actuals' },
  { href: '/debts',       label: 'Debts & Assets' },
  { href: '/cashflow',    label: 'Cashflow' },
  { href: '/projections', label: 'Projections' },
  { href: '/super',       label: 'Super' },
  { href: '/investments', label: 'Investments' },
]

const HIDDEN_ON = ['/onboarding', '/login', '/setup']

interface TopNavUser { name: string; role: string }

export default function TopNav({ user }: { user: TopNavUser | null }) {
  const pathname = usePathname()
  const router   = useRouter()
  if (HIDDEN_ON.includes(pathname) || !user) return null

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/login')
    router.refresh()
  }
  const active = TABS.find(t => pathname.startsWith(t.href))?.href ?? TABS[0].href
  // Seasonal-only prompt — surfaced in May/June, not a permanent tab.
  const showEofy = isEofySeason() || pathname.startsWith('/eofy')
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
      {showEofy && (
        <Link
          href="/eofy"
          className={`nav-eofy${pathname.startsWith('/eofy') ? ' active' : ''}`}
          aria-label="End of financial year tools"
        >
          ◷ EOFY
        </Link>
      )}
      <Link href="/settings" className="nav-settings-btn" aria-label="Setup & settings">⚙</Link>
      <span className="nav-user" title={`${user.name} · ${user.role}`}>{user.name}</span>
      <button className="nav-logout" onClick={logout} aria-label="Sign out">Sign out</button>
    </div>
  )
}
