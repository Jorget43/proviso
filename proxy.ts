import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { HSTS_VALUE } from './lib/securityHeaders'

// Next.js 16 renames Middleware → Proxy. This does the *optimistic* auth check
// only: is a session cookie present? The secure DB-backed validation happens in
// `requireSession()` at the page level (see lib/auth.ts). Cookie name is inlined
// (not imported from lib/auth) to keep Prisma out of the proxy bundle.
const SESSION_COOKIE = 'proviso_session'

// Reachable without a session.
// The password-reset pages must be public: whoever needs them is signed out.
const PUBLIC_PATHS = ['/login', '/setup', '/forgot-password', '/reset-password']

export function proxy(req: NextRequest) {
  return withHsts(route(req))
}

function route(req: NextRequest): NextResponse {
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

// HSTS only when the deployment says it's behind HTTPS (the same switch as the
// Secure cookie flag). Read here at request time rather than in next.config,
// which is evaluated when the image is built. Sent on pages only (API routes
// skip the proxy) — the browser applies it to the whole host either way.
function withHsts(res: NextResponse): NextResponse {
  if (process.env.COOKIE_SECURE === 'true') res.headers.set('Strict-Transport-Security', HSTS_VALUE)
  return res
}

export const config = {
  // Run on everything except API routes (guarded in their handlers), Next
  // internals, static assets, and the web app manifest (fetched without cookies).
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|manifest.webmanifest|.*\\.(?:png|ico|svg)$).*)'],
}
