import { describe, it, expect } from 'vitest'
import { contentSecurityPolicy, securityHeaders } from '@/lib/securityHeaders'

describe('contentSecurityPolicy', () => {
  it('locks down framing, plugins, base and form targets, and outbound requests', () => {
    const csp = contentSecurityPolicy(false)
    expect(csp).toContain("frame-ancestors 'none'")
    expect(csp).toContain("object-src 'none'")
    expect(csp).toContain("base-uri 'self'")
    expect(csp).toContain("form-action 'self'")
    expect(csp).toContain("connect-src 'self';")
  })

  it('never allows eval or websockets in production', () => {
    const csp = contentSecurityPolicy(false)
    expect(csp).not.toContain('unsafe-eval')
    expect(csp).not.toMatch(/wss?:/)
  })

  it('never allows inline scripts', () => {
    for (const nonce of [undefined, 'abc123']) {
      const scriptSrc = contentSecurityPolicy(false, nonce).split('; ').find(d => d.startsWith('script-src'))
      expect(scriptSrc).not.toContain("'unsafe-inline'")
    }
  })

  it('pages trust their nonce and what nonce-carrying scripts load', () => {
    const csp = contentSecurityPolicy(false, 'abc123')
    expect(csp).toContain("script-src 'self' 'nonce-abc123' 'strict-dynamic';")
    // Styles stay inline-friendly: React style props. A nonce there would switch that off.
    expect(csp).toContain("style-src 'self' 'unsafe-inline';")
  })

  it('allows what the dev server needs', () => {
    const csp = contentSecurityPolicy(true)
    expect(csp).toContain("'unsafe-eval'")
    expect(csp).toContain('ws:')
  })
})

describe('securityHeaders', () => {
  it('sends the standard hardening headers', () => {
    const keys = securityHeaders(false).map(h => h.key)
    expect(keys).toEqual(expect.arrayContaining([
      'Content-Security-Policy', 'X-Frame-Options', 'X-Content-Type-Options', 'Referrer-Policy', 'Permissions-Policy',
    ]))
  })
})
