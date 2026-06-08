import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Next.js 16 renames Middleware → Proxy. This does the *optimistic* auth check
// only: is a session cookie present? The secure DB-backed validation happens in
// `requireSession()` at the page level (see lib/auth.ts). Cookie name is inlined
// (not imported from lib/auth) to keep Prisma out of the proxy bundle.
const SESSION_COOKIE = 'proviso_session'

// Reachable without a session.
const PUBLIC_PATHS = ['/login', '/setup']

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl

  if (PUBLIC_PATHS.includes(pathname)) return NextResponse.next()

  const hasCookie = Boolean(req.cookies.get(SESSION_COOKIE)?.value)
  if (!hasCookie) {
    const url = req.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  return NextResponse.next()
}

export const config = {
  // Run on everything except API routes (guarded in their handlers), Next
  // internals, and static assets.
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:png|ico|svg)$).*)'],
}
