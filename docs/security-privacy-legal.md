# Security, Privacy & Legal Reference

Proviso handles income, debts, superannuation, tax position, and investment holdings. Read this before designing features that: handle user data, add new routes, touch auth, or ship publicly.

---

## Not financial advice — the single most important legal boundary

Under the **Corporations Act 2001 (Cth)**, providing "financial product advice" — a recommendation or opinion intended to influence a decision about a financial product — requires an **Australian Financial Services Licence (AFSL)**. Proviso does not hold an AFSL and must never cross that line.

**What Proviso is:** a modelling and projection tool. It reflects the user's own data back at them. All numbers flow from user inputs; all interpretations are the user's own.

**What Proviso must never do:**
- Tell a user to buy, sell, or hold a specific financial product
- Recommend a specific super fund or investment
- Give personalised tax advice (e.g. "you should lodge an amended return")
- Suggest a specific debt repayment strategy without being explicit it is illustrative only

**Mandatory disclaimers (to add before public beta):**
- Persistent footer or settings-page disclosure: *"Proviso is a personal finance modelling tool. It is not a financial adviser, tax agent, or accountant. All projections are estimates. Consult a licensed financial adviser (AFSL) or registered tax agent for personal advice."*
- On EOFY, HELP, and Super tabs: inline context notes making clear calculations are illustrative
- `/onboarding` welcome step: accept terms that include the disclaimer

**ASIC guidance:** ASIC's Regulatory Guide RG 36 and the fintech regulatory sandbox (ASIC Class Order CO 16/1175) are worth monitoring. Under the sandbox, qualifying startups can test certain advice-related features for up to 24 months without an AFSL — relevant if goal-based recommendations are ever added.

---

## Australian Privacy Act 1988 (Cth)

Proviso in self-hosted form is a tool the user runs for themselves — no data leaves their instance and the developer has zero access. This is the cleanest possible privacy position.

The Australian Privacy Principles (APPs) become binding on the developer once they operate a managed SaaS (Tier 3). **At that point:**

- **APP 1:** Publish a Privacy Policy describing what data is collected, why, and how it is protected
- **APP 3:** Collect only what is necessary for the service
- **APP 6:** Use data only for the primary purpose it was collected for — never sell, never share with advertisers
- **APP 11:** Take reasonable steps to protect personal information from misuse, loss, and unauthorised access
- **APP 12/13:** Allow individuals to access and correct their data on request

**Notifiable Data Breaches (NDB) scheme:** If a breach is likely to result in serious harm, OAIC and affected individuals must be notified. Applies once Proviso handles others' data (Tier 3). For self-hosted users the breach risk is on their own infrastructure — communicate this clearly.

**Practical steps before Tier 3:**
1. Draft privacy policy (hosted at `/privacy`)
2. Draft terms of service (hosted at `/terms`)
3. Data retention policy
4. Breach response plan

---

## Data sovereignty commitment

**What the developer can never access (self-hosted tier):**
- Any user's financial data — lives exclusively on their own machine/cloud storage
- Their DB file — no telemetry, no analytics beacon, no "phone home"
- Their usage patterns — no tracking, no session recording

**What the developer can access (managed SaaS tier — to be designed):**
- Infrastructure health metrics (response times, error rates) — no user data
- Aggregate anonymised stats — only if users explicitly opt in
- No individual household data under any circumstances — technical and contractual guarantee

**Technical enforcement for managed SaaS:**
- Each household's data in an isolated DB or schema
- Admin tools must not expose raw user data — only metadata (creation date, schema version, storage size)
- Any admin action on a user's DB must require a user-initiated token and be logged in the audit trail

---

## Cybersecurity — current state

*Last reviewed 2026-10-05.*

**Already in place:**
- Passwords: scrypt hashing via `node:crypto`
- Sessions: DB-backed opaque tokens in httpOnly, SameSite=Lax cookies; `Secure` flag via `COOKIE_SECURE=true` behind HTTPS (documented in README). 7-day idle timeout, 30-day absolute limit; a password change ends the user's other sessions (Phase 21). Only a SHA-256 of each token is stored, so a database copy can't sign anyone in; Settings → Your devices lists every signed-in device and signs any of them out (Phase 24)
- Native app tokens: bearer tokens (30-day idle, 90-day limit), never accepted as cookies and vice versa; shown and revocable under Your devices like any browser (Phase 24)
- Headers: CSP, `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy: no-referrer`, `Permissions-Policy`, COOP on every response; HSTS when `COOKIE_SECURE=true` (`lib/securityHeaders.ts`, Phase 21)
- Audit log: sign-ins, failures, lockouts, credential/2FA/passkey changes and every data write (field names, not values), kept 365 days, viewable by the CFO at `/settings/activity` (Phase 21)
- Dependencies: Dependabot weekly PRs; CI fails on high/critical advisories in production dependencies (Phase 21)
- Brute force: in-memory per-IP limit on `/api/auth/login` (20 req/min) plus DB account lockout after 10 failures (Phase 9)
- Second factor: TOTP with recovery codes (Phase 9) and passkeys / WebAuthn (Phase 12)
- SQL injection: Prisma parameterised queries (immune by design)
- XSS: React JSX escaping (`dangerouslySetInnerHTML` is unused)
- Input validation: every mutating route parses its body with a zod schema (`lib/schemas.ts`) — unknown fields stripped, ranges enforced (Phase 19)
- Transport: TLS via Tailscale Serve or external reverse proxy
- Auth gating: `requireSession()` on all data pages; `authorize()` on all mutating API routes; read-path checks via `requireAdultRead()` (Phase 14)
- Repo hygiene: the repository is public, so a privacy scanner runs in git hooks and CI to keep personal data out (see `CLAUDE.md` § Privacy guardrails)

**Gaps still open:**

| Gap | Risk | Fix |
|---|---|---|
| CSP allows inline scripts | XSS amplification if an injection is ever found | Nonce-based `script-src` (every page dynamic); React escaping is the primary defence today |
| SQLite not encrypted at rest | Physical volume access exposes all data | Document that volume-level encryption is the user's responsibility; future: SQLCipher |

**Content Security Policy:** see `lib/securityHeaders.ts` — the comment there explains each directive and why `script-src` still allows inline scripts.
