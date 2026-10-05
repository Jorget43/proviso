'use client'
import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { isEofySeason } from '@proviso/core/eofy'
import { HUBS, hubFor, sectionFor, type NavHub } from '@/lib/navigation'

// Pages that render without any navigation chrome.
const HIDDEN_ON = ['/onboarding', '/login', '/setup']

interface TopNavUser { name: string; role: string }

// Simple line icons for the mobile bottom bar (24px grid, stroke = currentColor).
const HUB_ICONS: Record<NavHub['key'], React.ReactNode> = {
  home:     <path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z" />,
  spending: <><rect x="3" y="6" width="18" height="13" rx="2" /><path d="M3 10h18M16 15h2" /></>,
  wealth:   <><path d="M4 20V10M10 20V6M16 20v-8M22 20H2" /></>,
  future:   <><path d="M3 17l6-6 4 4 8-8" /><path d="M15 7h6v6" /></>,
}

function HubIcon({ hub }: { hub: NavHub['key'] }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {HUB_ICONS[hub]}
    </svg>
  )
}

export default function TopNav({ user }: { user: TopNavUser | null }) {
  const pathname = usePathname()
  const router   = useRouter()
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  // Close the account menu on navigation and on any tap outside it.
  useEffect(() => {
    if (!menuOpen) return
    const close = (e: Event) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false)
    }
    document.addEventListener('pointerdown', close)
    return () => document.removeEventListener('pointerdown', close)
  }, [menuOpen])
  const [menuPath, setMenuPath] = useState(pathname)
  if (menuPath !== pathname) { setMenuPath(pathname); setMenuOpen(false) }

  if (HIDDEN_ON.includes(pathname) || !user) return null

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/login')
    router.refresh()
  }

  const isChild   = user.role === 'CHILD'
  const isPartner = user.role === 'PARTNER'
  const hub       = isChild ? null : hubFor(pathname)
  const section   = isChild ? null : sectionFor(pathname)
  const showEofy  = !isChild && (isEofySeason() || pathname.startsWith('/eofy'))

  return (
    <>
      <header className="topbar">
        <Link href={isChild ? '/child' : '/'} className="topbar-title">Proviso</Link>

        {!isChild && (
          <nav className="nav-tabs" aria-label="Main">
            {HUBS.map(h => (
              <Link key={h.key} href={h.href} className={`nav-tab${hub?.key === h.key ? ' active' : ''}`}
                aria-current={hub?.key === h.key ? 'page' : undefined}>
                {h.label}
              </Link>
            ))}
          </nav>
        )}

        <div className="topbar-actions">
          {showEofy && (
            <Link
              href="/eofy"
              className={`nav-eofy${pathname.startsWith('/eofy') ? ' active' : ''}`}
              aria-label="End of financial year tools"
            >
              ◷ EOFY
            </Link>
          )}
          {isPartner && <span className="nav-readonly" title="Partner access — viewing only, plus Actuals import">Read-only</span>}
          {!isChild && (
            <Link href="/settings" className={`nav-icon-btn${pathname.startsWith('/settings') ? ' active' : ''}`} aria-label="Setup & settings">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h0a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51h0a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v0a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
              </svg>
            </Link>
          )}
          <div className="nav-account" ref={menuRef}>
            <button
              className="nav-avatar"
              onClick={() => setMenuOpen(o => !o)}
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              aria-label={`Account: ${user.name}`}
            >
              {user.name.trim().charAt(0).toUpperCase() || '?'}
            </button>
            {menuOpen && (
              <div className="nav-menu" role="menu">
                <div className="nav-menu-name">{user.name}</div>
                <div className="nav-menu-role">
                  {isPartner ? 'Partner · view only' : isChild ? 'Child' : 'Owner'}
                </div>
                <button className="nav-menu-item" role="menuitem" onClick={logout}>Sign out</button>
              </div>
            )}
          </div>
        </div>
      </header>

      {hub && hub.sections.length > 1 && (
        <nav className="subnav" aria-label={`${hub.label} sections`}>
          <div className="subnav-track">
            {hub.sections.map(s => (
              <Link key={s.href} href={s.href} className={`subnav-item${section?.href === s.href ? ' active' : ''}`}
                aria-current={section?.href === s.href ? 'page' : undefined}>
                {s.label}
              </Link>
            ))}
          </div>
        </nav>
      )}

      {!isChild && (
        <nav className="bottom-nav" aria-label="Main">
          {HUBS.map(h => (
            <Link key={h.key} href={h.href} className={`bottom-nav-item${hub?.key === h.key ? ' active' : ''}`}
              aria-current={hub?.key === h.key ? 'page' : undefined}>
              <HubIcon hub={h.key} />
              <span>{h.label}</span>
            </Link>
          ))}
        </nav>
      )}
    </>
  )
}
