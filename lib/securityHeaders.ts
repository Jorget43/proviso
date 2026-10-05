// HTTP security headers (Phase 21). Applied to every route by next.config.ts;
// HSTS is added separately in proxy.ts because it depends on COOKIE_SECURE,
// a runtime setting, while next.config is evaluated when the image is built.
//
// Pages get a per-request nonce (Phase 24): proxy.ts generates it and sends
// the policy with it, and Next stamps the nonce on its own hydration scripts.
// script-src is then "scripts carrying this page's nonce, plus whatever they
// load" ('strict-dynamic') — an injected <script> or inline handler can't run.
// Every page is already rendered per request, so the nonce costs nothing.
// Responses the proxy doesn't see (API JSON, static files) get the baseline
// policy from next.config.ts, without a nonce.
//
// Beyond scripts: no requests to other hosts (connect-src 'self' — the
// browser can't exfiltrate data anywhere), no framing (clickjacking), no
// <base>/<object> injection, and forms can only post back to this app.

export function contentSecurityPolicy(dev: boolean, nonce?: string): string {
  const directives: Record<string, string[]> = {
    'default-src':     ["'self'"],
    // React's dev overlay / fast refresh evaluates code; production doesn't.
    'script-src':      [
      ...(nonce ? ["'self'", `'nonce-${nonce}'`, "'strict-dynamic'"] : ["'self'"]),
      ...(dev ? ["'unsafe-eval'"] : []),
    ],
    // React `style={…}` props and Tailwind's injected styles.
    'style-src':       ["'self'", "'unsafe-inline'"],
    // data: for the TOTP QR code; blob: for chart / PDF canvases.
    'img-src':         ["'self'", 'data:', 'blob:'],
    'font-src':        ["'self'", 'data:'],
    // Dev needs the HMR websocket.
    'connect-src':     ["'self'", ...(dev ? ['ws:', 'wss:'] : [])],
    // pdf.js runs its text extraction in a worker served from /_next/static.
    'worker-src':      ["'self'", 'blob:'],
    'manifest-src':    ["'self'"],
    'object-src':      ["'none'"],
    'base-uri':        ["'self'"],
    'form-action':     ["'self'"],
    'frame-ancestors': ["'none'"],
  }
  return Object.entries(directives).map(([k, v]) => `${k} ${v.join(' ')}`).join('; ')
}

export function securityHeaders(dev: boolean): { key: string; value: string }[] {
  return [
    { key: 'Content-Security-Policy', value: contentSecurityPolicy(dev) },
    // Older browsers that ignore frame-ancestors.
    { key: 'X-Frame-Options',         value: 'DENY' },
    { key: 'X-Content-Type-Options',  value: 'nosniff' },
    // Reset-password links carry a token in the URL — never leak it in a Referer.
    { key: 'Referrer-Policy',         value: 'no-referrer' },
    // Passkeys need publickey-credentials-*; nothing here uses the rest.
    { key: 'Permissions-Policy',      value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()' },
    { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
  ]
}

// One year. No includeSubDomains/preload: the app is usually one host on a
// tailnet or behind a home reverse proxy, and HSTS on a parent domain would
// reach unrelated services.
export const HSTS_VALUE = 'max-age=31536000'
