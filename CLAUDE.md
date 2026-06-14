@AGENTS.md

# Proviso

**Product name:** Proviso (formerly "Household Dashboard"). Repo directory stays `household-dashboard`.

**Positioning:** "Most apps tell you what you spent yesterday. Proviso models what you will be worth tomorrow."

Personal finance dashboard. Next.js 16 app, SQLite via Prisma 5, deployed on Unraid via Tailscale.

## Status: all tabs live

| Tab            | Route           |
|----------------|-----------------|
| Budget         | `/budget`       |
| Debts & Assets | `/debts`        |
| Cashflow       | `/cashflow`     |
| Projections    | `/projections`  |
| Actuals        | `/actuals`      |
| Super          | `/super`        |
| EOFY (seasonal)| `/eofy`         |
| Investments    | `/investments`  |

EOFY is seasonal — surfaced via May/June `◷ EOFY` pill in `TopNav`, reachable year-round by URL.

## Key architecture decisions

- **Prisma 5** (pinned — Prisma 7 broke `url = env(...)`, requires `prisma.config.ts`)
- **Next.js 16 params**: dynamic route handlers use `await params` — `params` is `Promise<{ id: string }>`
- **Next.js 16 Proxy (was Middleware)**: root `proxy.ts` exporting `proxy` + `config.matcher`. `cookies()` is async (`await cookies()`). Optimistic auth gating; secure session validation is `requireSession()` in `lib/auth.ts`
- **Auth**: self-hosted, zero external deps — `node:crypto` scrypt + opaque DB-backed session token in httpOnly cookie. `COOKIE_SECURE=true` when behind HTTPS
- **`@/*` alias** maps to `./` (project root), not `./src/`
- **Server vs client**: server components fetch from Prisma directly; `'use client'` for anything interactive or using Chart.js
- **Optimistic updates**: all CRUD hits state first, then API — no loading spinners
- **Tax engine** (`lib/tax.ts`): ATO 2024–25 Stage 3 brackets, LITO, Medicare, HELP repayments
- **Projection engine** (`lib/projections.ts`): 20-year dual simulation (with/without school fees), stepped inflation, monthly mortgage loop with live offset; renter mode with compound rent growth and optional purchase plan (deposit from cash/investments with ~12% CGT haircut, then mortgage via `computeMonthlyRepayment`)
- **Super engine** (`lib/super.ts`): per-person `runSuperProjection` + household `runHouseholdProjection`; accumulation (15%/30% tax) → drawdown (tax-free pension phase); concessional cap indexed to AWOTE; Div 293 at $250k
- **HELP indexation engine** (`lib/help.ts`): indexable base, 1-June countdown/window, marginal-rate equivalence
- **Carry-forward engine** (`lib/superHistory.ts`): legislative cap history + 5-year concessional carry-forward gated on prior-year TSB < $500k
- **EOFY engine** (`lib/eofy.ts`): May/June season gate + salary-sacrifice / marginal-rate optimisation
- **CGT engine** (`lib/cgt.ts`): per-parcel cost base, 12-month 50% discount eligibility, estimated CGT at owner's marginal rate
- **Childcare engine** (`lib/childcare.ts`): ATO 2024–25 CCS subsidy taper; syncs to managed `Childcare` expense line
- **PDF import** (`lib/pdfExtract.ts`, `lib/pdfStatement.ts`): client-side `pdf.js` — no data leaves the device

## DB singleton

```ts
// lib/db.ts
import { PrismaClient } from '@prisma/client'
const globalForPrisma = globalThis as unknown as { prisma: PrismaClient }
export const prisma = globalForPrisma.prisma ?? new PrismaClient()
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
```

## API routes

All dynamic routes use `await params`:
```ts
export async function PUT(req, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  ...
}
```

Singleton endpoints (id=1): `/api/income-settings`, `/api/mortgage-settings`, `/api/projection-settings`, `/api/super-settings`, `/api/rent-settings`

CRUD endpoints (not exhaustive — check `app/api/` for full list): `/api/expenses/[id]`, `/api/debts/[id]`, `/api/assets/[id]`, `/api/investments/[id]`, `/api/one-offs/[id]`, `/api/life-phases/[id]`, `/api/annual-expenses/[id]`, `/api/users/[id]`, `/api/pocket-money/[id]`, `/api/actuals/rules/[id]`, etc.

All dynamic pages export `export const dynamic = 'force-dynamic'` to prevent static prerendering at build time (no DB available during build).

### Prisma known issue

`createMany` on SQLite in Prisma 5 doesn't expose `skipDuplicates` in TS types but works at runtime. Workaround in `app/api/actuals/commit/route.ts`:
```ts
await (prisma.transaction.createMany as Function)({ data: [...], skipDuplicates: true })
```

## Design system (`app/globals.css`)

CSS vars: `--bg`, `--surface`, `--surface2`, `--border`, `--border-md`, `--t1/t2/t3`, `--blue/green/red/amber/purple/pink/teal` (each with `-lt` variant), `--r`, `--rl`

Key classes: `.page`, `.banner` + `.b-item/.b-label/.b-value`, `.metrics`, `.mc`, `.panel` + `.panel-head/.panel-body`, `.two-col`, `.sidebar-layout`, `.da-grid/.da-row/.da-input`, `.pill` + color variants, `.toggle-switch/.toggle-slider`, `.slider-group/.slider-label`, `.tl-table`, `.add-btn`, `.del-btn`, `.input-prefix`, `.chart-wrap`, `.super-table`, `.super-badge`, `.super-hint`, `.super-context-box`, `.inc-person-card`, `.inc-breakdown`, `.inc-br-*`

## Docker & deployment

- **`Dockerfile`** — 3-stage build: `deps` (npm ci) → `builder` (prisma generate + next build) → `runner` (node:20-alpine, standalone)
- **`docker-entrypoint.sh`** — backs up `/data/proviso.db` (3 rolling `.bak` files), then `prisma migrate deploy` on every start; `prisma db seed` only on first run. Does NOT `set -e`: migrate failure logs a warning and the app starts anyway (hardened 2026-06-13 after a P3009 failed-migration record wedged every boot). Restore: `docker exec proviso cp /data/proviso.YYYYMMDD_HHMMSS.bak /data/proviso.db && docker restart proviso`
- **`docker-compose.yml`** — service/container `proviso`; volume `proviso-db` at `/data`; `DATABASE_URL=file:/data/proviso.db`
- **`next.config.ts`** — `output: 'standalone'`

### Migration policy

All migrations must be **additive only** — Watchtower applies them automatically on restart, so a bad migration lands on every user's DB simultaneously:
- ✅ Add new columns (`ALTER TABLE ... ADD COLUMN ... DEFAULT ...`)
- ✅ Add new tables, indexes, foreign keys
- ❌ Never drop columns or tables
- ❌ Never rename a column (add new → migrate data in seed.ts → drop old in a later release)
- ❌ Never change a column's type
- Every new non-nullable column **must** have a `DEFAULT` so existing rows remain valid

### Release workflow

1. Run `node_modules/next/dist/bin/next build` locally to catch TS errors before CI.
2. Commit and push to `master` — CI builds and pushes `ghcr.io/jorget43/proviso:latest`.
3. Tag significant releases: `git tag -a v1.x.0 -m "..."` then `git push origin v1.x.0` — also pushes `ghcr.io/jorget43/proviso:<tag>`.
4. **No manual NAS update needed.** Watchtower is configured with `--schedule "0 0 3 * * *" --tz Australia/Sydney` and pulls + restarts the container automatically at 3am AEST each night. Do NOT tell the user to run `docker compose pull && docker compose up -d` — that's Watchtower's job.

**Common pitfalls:**
- `parsed.y` in Chart.js tooltip callbacks is typed as `number | null` — always null-coalesce it.
- `.github/workflows/docker.yml` was found missing while still tracked in git (cause unknown). If CI says no workflow exists, run `git checkout HEAD -- .github/workflows/docker.yml`.
- After adding a dependency, run `npm install` and commit the updated lockfile — `npm ci` fails if `package.json` and `package-lock.json` diverge.
- The workflow runs on `master` AND `v*` tags — do not change to tags-only or routine pushes will stop deploying.

## Auth & RBAC

- **`lib/auth.ts`**: `getSession()`, `requireSession()` (throws redirect if unauthenticated)
- **`proxy.ts`**: optimistic cookie gate (fast, not the security boundary); `requireSession()` is the real boundary
- **`lib/rbac.ts`**: scopes `actuals:write`, `budget:write`, `users:write`, `child:write`; `authorize(action)` called at the top of all mutating handlers
- **Roles**: CFO (all scopes), PARTNER (`actuals:write` only), CHILD (`child:write` only — `/child` pocket money page)
- **51 mutating route handlers** have `authorize()` guards; update the count when adding routes. Passkey management routes (`register-options`, `register-verify`, DELETE `passkey/[id]`) use `getSession()` directly (all roles can manage their own passkeys) — they are auth-gated but not RBAC-gated.

## Roadmap

### Phase 4.3 — Child role (shipped 2026-06-14)

- `/child` route — CHILD-only; CFO/PARTNER redirected to `/budget`
- `child:write` scope — CHILD can add own spends; CFO can add any transaction (credits + spends)
- Models: `AllowanceSchedule` (userId unique, amount, dayOfWeek), `PocketMoneyTx` (userId, amount, description, date, category)
- `PUT /api/allowance` (budget:write), `POST /api/pocket-money` (child:write), `DELETE /api/pocket-money/[id]` (budget:write)
- CFO manages allowance via `MembersPanel` inline; TopNav shows only "Pocket Money" tab for CHILD

### Phase 7 — Hosting accessibility

- **Tier 1 (shipped 2026-06-14):** Docker one-liner — `docker run -d --name proviso --restart unless-stopped -v proviso-data:/data -p 3000:3000 ghcr.io/jorget43/proviso:latest`. `docker-compose.yml` uses `image: ghcr.io/jorget43/proviso:latest` so no source code is needed on the NAS. Subsequent updates are automatic via Watchtower (see Release workflow). Documented in `README.md`.
- **Tier 2:** Tauri desktop app — `.dmg`/`.exe`, SQLite in OS app-support dir, cross-compile via GitHub Actions
- **Tier 3:** Managed SaaS — $60/yr, isolated SQLite per household, "export and leave" guarantee
- See [`docs/security-privacy-legal.md`](docs/security-privacy-legal.md) for data sovereignty constraints that shape Tier 3 design

### Phase 8 — Update delivery (shipped 2026-06-13)

- `lib/versionCheck.ts` — polls GitHub Releases daily 09:00 AEST; caches in `VersionCheck` table (migration `0015_version_check`)
- `components/ui/UpdateBanner.tsx` — dismissible CFO-only amber banner with copy-paste update command
- `GET /api/version` — public, no auth
- `instrumentation.ts` — version check runs on startup for all deployments
- Every release must be tagged — untagged images build as `dev` and the banner never fires for users

### Phase 9 — Auth enhancements (items 1–3 shipped 2026-06-13; item 4 shipped 2026-06-14)

Items 1–4 shipped. Item 5 not yet built.

| # | Feature | Status |
|---|---|---|
| 1 | Self-service password reset | ✅ `User.email`, `PasswordReset` model, Resend + stdout fallback |
| 2 | Rate limiting + account lockout | ✅ In-memory IP limiter (20 req/min) + DB lockout after 10 failures |
| 3 | TOTP 2FA | ✅ `otplib` + `qrcode`; two-phase login; 8 recovery codes; SecurityPanel |
| 4 | Passkeys (WebAuthn) | ✅ Phase 12 — `@simplewebauthn` v13; migration 0023; 6 routes; `PasskeyPanel`; login button |
| 5 | Google/Apple SSO | Managed SaaS tier only |

### Phase 10 — Operational improvements (shipped 2026-06-14)

- **Watchtower scheduling**: switched from `--interval 86400` to `--schedule "0 0 3 * * *"` with `TZ=Australia/Sydney` so updates land at 3am AEST
- **Pre-migration DB backup**: `docker-entrypoint.sh` backs up `/data/proviso.db` before every migrate; 3 rolling `.bak` files retained
- **Auto-categorisation**: `CAT_RULES` expanded from ~40 to 120+ keywords — delivery platforms, ride-share, Australian insurers, streaming services, utilities, home brands
- **Annual expenses panel** (migration `0020_annual_expenses`): new `AnnualExpense` model (id, name, cat, amt, month 1–12) replaces hardcoded `LUMPY` constant; `GET/POST /api/annual-expenses`, `PUT/DELETE /api/annual-expenses/[id]`; editable `AnnualExpensesPanel` in Budget tab; Cashflow reads from DB. Note "next expected" is computed client-side from `month` field.
- **Education cost presets** (migration `0021_education_preset`): `lib/educationCosts.ts` encodes 2025 Futurity data for 13 regions × 3 school types (39 presets); `sfPresetKey` on `ProjectionSettings` (null = custom/legacy); Government/Catholic/Independent/Custom selector in Projections school fees panel; custom editable table hidden when preset active

### Phase 11 — Category restructure + Renter model (shipped 2026-06-14)

- **New categories**: `Eating Out`, `Travel`, `Shopping` appended to `CATS` (preserves existing colour-index assignments for older categories)
- **`CAT_RULES` restructure**: dining/cafes/fast food + delivery apps → `Eating Out`; flights/hotels/Airbnb/holiday → `Travel`; department stores + general Amazon → `Shopping`; `amazon prime` stays in `Subscriptions` and is evaluated before the `Shopping` rule so it isn't clobbered
- **`costco`** moved from Home → Food (it's a supermarket)
- **Renter model** (migration `0022_rent_settings`): new `RentSettings` singleton (enabled, monthlyRent, annualIncreaseRate, purchasePlanEnabled, targetPurchaseYear, targetPropertyValue, depositPct, depositFromCash, depositFromInvestments, newMortgageRate, newMortgageTermYrs); `GET/PUT /api/rent-settings`
  - Rent is tracked **separately** from `baseMonthlyExpenses` in projections — users must not also add rent to the budget to avoid double-counting
  - At `targetPurchaseYear`: deposit deducted from cash + investments (investments carry ~12% effective CGT haircut); mortgage starts via `computeMonthlyRepayment`; post-purchase mortgage tracked as `extraAnnualExp` (not inflation-compounded like `expBase`)
  - `ProjectionResult` gains `rentArr: number[]` and `purchaseYr: number | null`
  - Projections sidebar has a "Housing" panel with homeowner/renter toggle and purchase plan inputs

### Phase 12 — Passkeys / WebAuthn (shipped 2026-06-14)

- **Package**: `@simplewebauthn/server` v13 + `@simplewebauthn/browser` v13 (no external auth service)
- **`rpID`**: read from `WEBAUTHN_RP_ID` env var; falls back to the request's `origin` header hostname. **WebAuthn requires HTTPS** except for `localhost` — works with Tailscale Serve.
- **Migration 0023**: `Passkey` table (userId, credentialId, publicKey BLOB, counter BIGINT, deviceType, backedUp, transports, name) + `WebAuthnChallenge` table (challenge, userId nullable, expiresAt — 5-min TTL, cleaned up on use)
- **API routes** (all under `/api/auth/passkey/`):
  - `GET /` — list current user's passkeys (auth required, any role)
  - `POST /register-options` — generate registration challenge (auth required)
  - `POST /register-verify` — verify + store credential (auth required)
  - `DELETE /[id]` — remove own passkey (auth required, ownership-checked)
  - `POST /auth-options` — generate auth challenge (no auth — this IS the login)
  - `POST /auth-verify` — verify assertion, update counter, `createSession()` (no auth)
- **`components/settings/PasskeyPanel.tsx`**: list + add + remove passkeys; `@simplewebauthn/browser` dynamically imported on button click; HTTPS warning shown on plain-HTTP origins
- **`components/auth/AuthForm.tsx`**: "Sign in with passkey" button below the login form (login mode only); uses discoverable credentials (empty `allowCredentials`) so browser prompts to pick
- **Discoverable credentials**: `generateAuthenticationOptions` is called with no `allowCredentials` so any stored passkey for this RP can be used — no username entry required

## Security checklist for new features

> When designing features that handle user data, add new routes, or touch auth — read [`docs/security-privacy-legal.md`](docs/security-privacy-legal.md) for the full legal, privacy, and cybersecurity context first.

- [ ] Writes to DB → has `authorize()` guard; update the 51-handler count
- [ ] Reads sensitive data → behind `requireSession()`
- [ ] Accepts user input → validated/sanitised before use
- [ ] Renders user-supplied text → no `dangerouslySetInnerHTML`; use React's escaping
- [ ] Sends data off-device → explicit user consent; document in privacy policy
