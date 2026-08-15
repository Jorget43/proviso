@AGENTS.md

# Proviso

**Product name:** Proviso (formerly "Household Dashboard"). Repo directory stays `household-dashboard`.

**Positioning:** "Most apps tell you what you spent yesterday. Proviso models what you will be worth tomorrow."

Personal finance dashboard. Next.js 16 app, SQLite via Prisma 5, deployed on Unraid via Tailscale.

## ⚠️ Privacy rule — read before writing any code

**All code must be written for a generic end user, not for the developer's household.**

This repo is public. Never let any of the following into the codebase, comments, commit messages, or documentation:

- **Names** — real names of the developer or their household members. Use "Person 1 / Person 2", "the user", "the partner", "the operator", or "the developer" instead.
- **Financial figures** — specific salaries, balances, debt amounts, or any real numbers from the developer's own finances. Defaults in the schema are illustrative placeholders only; they must be realistic but not real.
- **Location** — suburb, city, street, or any address detail.
- **Any other PII** — email addresses (except `tsiposjorge@gmail.com` in CI/auth config where unavoidable), phone numbers, tax file numbers, account numbers.

**Practical rules:**
- Comments must describe behaviour, not the developer's situation ("Person 1 defaults to 5 days" not "Jorge defaults to 5 days").
- Seed data and default values must look like realistic placeholders, not copies of real household data.
- If you find a personal reference while working on something else, fix it in the same PR.
- Legacy personal-name DB columns/tables (`JorgePhase`, `GracePhase`, `jorgeFTE`, etc.) were removed in migration `0028_drop_legacy_person_cols` (2026-07-05) — the `person1`/`person2` equivalents added in `0024`/`0025` are now the only naming. Don't reintroduce personal names in schema, code, or sample/demo data.

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
- **Super engine** (`lib/super.ts`): per-person `runSuperProjection` + household `runHouseholdProjection`; accumulation (15%/30% tax) → drawdown (tax-free pension phase); Div 293 at $250k. Concessional cap comes from `lib/superHistory.ts`'s `legislativeCap()` (single source, see Phase 15) — `super.ts` does not maintain its own cap model. First-year cap can be topped up by `firstYearCapBonus` (carry-forward headroom, wired from `ConcessionalCarryForward` via `SuperClient`).
- **HELP indexation engine** (`lib/help.ts`): indexable base, 1-June countdown/window, marginal-rate equivalence
- **Carry-forward engine** (`lib/superHistory.ts`): `LEGISLATIVE_CONCESSIONAL_CAP` (legislated table, extrapolated beyond it via AWOTE ≈3.5%/yr floored to the nearest $2,500 — the ATO's published rounding rule) + 5-year concessional carry-forward gated on prior-year TSB < $500k
- **Inflation anchors — two kinds, do not conflate them**: `MODEL_BASE_YEAR` (`lib/constants.ts`, currently 2026) is a **data-vintage** anchor — the year `lib/schoolFees.ts`'s `SF_BASE` and `lib/lifephases.ts`'s `DEFAULT_LIFE_PHASES` dollar figures are denominated in; inflation compounds *from* it regardless of the wall clock, so it must never be `new Date().getFullYear()`. `SuperInputs.startYear`/`startFyEnding` (`lib/super.ts`) are the opposite — a **run-start** anchor that genuinely is "now" and must be *injected* per call (optional params defaulting to the wall clock), not hardcoded, so it stays testable with `vi.setSystemTime`. Before Phase 15 these were conflated: `schoolFeesForYear` read the wall clock directly (numbers drifted every 1 January) and `super.ts`'s run-start year was captured at module load (untestable).
- **EOFY engine** (`lib/eofy.ts`): May/June season gate + salary-sacrifice / marginal-rate optimisation
- **CGT engine** (`lib/cgt.ts`): per-parcel cost base, 12-month 50% discount eligibility, estimated CGT at owner's marginal rate
- **Childcare engine** (`lib/childcare.ts`): ATO 2024–25 CCS subsidy taper; syncs to managed `Childcare` expense line
- **PDF import** (`lib/pdfExtract.ts`, `lib/pdfStatement.ts`): client-side `pdf.js` — no data leaves the device
- **Net worth baseline** (`lib/netWorth.ts`): `computeCurrentNetWorth()` — the house/cash/crypto/mortgage heuristic shared by the Projections page's year-0 baseline and the monthly `NetWorthSnapshot` auto-capture, so "actual" stays scope-consistent with the projected line

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

- **`Dockerfile`** — 4-stage build: `deps` (npm ci) → `builder` (prisma generate + next build) → `pruner` (`npm prune --omit=dev`) → `runner` (node:20-slim, standalone). The runner takes `node_modules` from `pruner`, not `builder`, so devDependencies (vitest/vite/esbuild-as-test-runner, typescript, eslint, tailwind, `@types/*`) never ship to production. **The prune must stay a prune of the builder's tree, not a fresh `npm ci --omit=dev`** — the generated Prisma client lives in `node_modules/.prisma` and a clean install wouldn't contain it (npm leaves dot-dirs like `.prisma`/`.bin` alone).
- **`tsx` is a runtime dependency, not a devDependency** — `docker-entrypoint.sh` runs `prisma db seed` (`tsx prisma/seed.ts`) on first boot, so pruning it would break first-run seeding. Same for `prisma` (CLI, used by `migrate deploy` on every start). Don't "tidy" either back into devDependencies.
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
- The workflow runs on `master` AND `v*` tags — do not change to tags-only or routine pushes will stop deploying. Both triggers push `:latest`, so every release runs `build-and-push` twice and whichever finishes last wins `:latest` — this is intentional (rolling `:latest` between releases), not a bug to "fix" by removing a trigger.
- `PROVISO_VERSION` derivation (`Determine version` step): a tag push bakes the tag name verbatim; a `master` push bakes `git describe --tags --always` instead of the literal branch name — it resolves to the release tag itself when `master` and the tag share a commit, or `<tag>-<n>-g<sha>` for untagged commits ahead of the last release. Never let this fall back to `GITHUB_REF_NAME` directly — a bare `master`/`main` is not a version and breaks the update banner's "you're on X" text.

## Auth & RBAC

- **`lib/auth.ts`**: `getSession()`, `requireSession()` (throws redirect if unauthenticated)
- **`proxy.ts`**: optimistic cookie gate (fast, not the security boundary); `requireSession()` is the real boundary
- **`lib/rbac.ts`**: scopes `actuals:write`, `budget:write`, `users:write`, `child:write`; `authorize(action)` called at the top of all mutating handlers
- **Roles**: CFO (all scopes), PARTNER (`actuals:write` only), CHILD (`child:write` only — `/child` pocket money page)
- **59 mutating route handlers** have `authorize()` guards; update the count when adding routes. Passkey management routes (`register-options`, `register-verify`, DELETE `passkey/[id]`) use `getSession()` directly (all roles can manage their own passkeys) — they are auth-gated but not RBAC-gated.

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
- Every release must be tagged — the `dev` fallback in `PROVISO_VERSION` only applies to a local (non-CI) `docker build` with no `--build-arg`; CI-built images always carry a real version string (see Common pitfalls, `PROVISO_VERSION` derivation)

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

### Phase 13 — Projection accuracy tracker (shipped 2026-07-05)

- **Migration 0029**: `NetWorthSnapshot` table (`totalAssets`/`totalDebts` nullable — null for manual entries, populated for auto-captures; `netWorth`; `source: 'auto' | 'manual'`)
- **`lib/netWorthSnapshotScheduler.ts`**: runs `takeNetWorthSnapshot()` once immediately on boot, then monthly (1st, 06:00 AEST) via `node-cron` — registered unconditionally in `instrumentation.ts` (unlike watchdog, this ships to all users, not gated behind `WATCHDOG_ENABLED`)
- **`GET/POST /api/net-worth-snapshots`**, **`DELETE /api/net-worth-snapshots/[id]`** — manual backfill takes a date + a single net-worth number (not a full asset/debt breakdown)
- **`components/projections/NetWorthChart.tsx`**: gained an "Actual net worth" overlay series (`historyLabels`/`historyData` props) — bucketed to one point per calendar year in `ProjectionsClient.tsx`, anchored to the live baseline (`initNW`) for the current year until the first auto-snapshot lands, so it's always continuous with where the projected line starts
- **`components/projections/NetWorthHistoryPanel.tsx`**: snapshot list + manual add/delete, in a new "Projection accuracy" panel on `/projections`

### Phase 14 — API hardening: read-path authz, input validation, engine tests (shipped 2026-07-20, tag `v1.5.0`)

- **Deployment**: CI (`test` → `build-and-push`) green on `master` @ `6df49a3`; image `ghcr.io/jorget43/proviso:v1.5.0` + `:latest` pushed. **Watchtower rolls it out to the NAS at 3am AEST tonight (2026-07-21)** — no manual action.
- **Read-path authz** (closed the biggest gap): `requireAdult()` (`lib/auth.ts`) on all 9 adult pages redirects CHILD to `/child`; `app/page.tsx` too. `requireAdultRead()` (`lib/rbac.ts`) — 401 unauth / 403 CHILD — guards the ~21 household-data GET routes. `/api/version` stays public by design.
- **Uniform errors + validation**: `lib/apiHandler.ts` (`withErrors` HOF wraps ~47 mutating handlers; `parseBody` + `ApiError`; Prisma P2025→404 / P2002→409 / P2003→400; opaque 500 with server-side log — no internals leaked). `lib/schemas.ts` — per-model zod schemas, `.partial()` so unknown keys are stripped before Prisma, `.finite()` rejects NaN/Infinity.
- **Engine tests**: `vitest` + `vitest.config.ts` (`@/` alias, `test`/`test:watch` scripts). 42 tests across `tax`/`cgt`/`childcare`/`help`/`netWorth` pin ATO 2024-25 outputs. CI `test` job now gates `build-and-push` — a broken FY calculation blocks release.
- **FY-constant dedup**: `DIV293_THRESHOLD` exported once from `lib/super.ts`; `lib/eofy.ts` `BRACKET_THRESHOLDS` and `IncomePanel.tsx` display brackets both derive from canonical `TAX_THRESHOLDS_2425`.
- **Auto-update banner wired end-to-end**: `startVersionCheckScheduler()` registered in `instrumentation.ts`; `app/layout.tsx` + `UpdateBanner.tsx` now show an amber "vX available — you're on vY" notice (CFO-only, dismissible per tag).
- **Security review (2026-07-20)**: focused review of the v1.5.0 diff found no new HIGH/MEDIUM vulnerabilities — the changeset reduces attack surface.

### Phase 15 — Flagship engine tests, clock-anchor unification, concessional-cap reconciliation

- **Engine tests**: `tests/projections.test.ts` (43 tests, 10 named scenarios — homeowner baseline, stepped-inflation boundary, renter, renter→purchase with CGT haircut, parental leave incl. a two-consecutive-leave-years edge case, school fees on/off, HELP clearing, deficit year, one-offs, empty-phases regression) and `tests/super.test.ts` (19 tests — cap ladder, Div293 boundary, drawdown/depletion, present-value exponent convention, household combined/later-retirement-year selection, `startYear` injection). Plus `tests/schoolFees.test.ts`, `tests/lifephases.test.ts`, `tests/superHistory.test.ts`. Total suite: 140 tests. `tests/fixtures/{projections,super}.ts` — arithmetically-inert baseline factories (every growth/inflation/return dial at 0) so each scenario isolates one mechanism; values are round placeholders per the privacy rule, not schema defaults.
- **Fixed a live crash**: `lib/projections.ts` gave `person1Phases` an empty-array fallback but not `person2Phases` — deleting a user's last `Person2Phase` row white-screened `/projections` (`TypeError` inside a `useMemo`, no UI recovery). Both persons now fall back to 5 days/week symmetrically.
- **`MODEL_BASE_YEAR` (`lib/constants.ts`)**: unifies three previously-inconsistent inflation anchors. `lib/schoolFees.ts` and `lib/lifephases.ts` now compound from this **data-vintage** constant (what year the stored dollar figures are denominated in) instead of `new Date().getFullYear()` (schoolFees) or a bare hardcoded `2026` (lifephases) — school-fee figures no longer silently drift by one year of compounding every 1 January. Landed while the wall clock still read 2026 (the constant's value), so it was a provable zero-diff change on the day it shipped — verified by running the full suite before/after and confirming byte-identical output, then proving the drift test would have failed pre-fix via `git stash`. `lib/projections.ts`'s hardcoded `2028` near-term-inflation horizon was lifted to `NEAR_TERM_INFLATION_HORIZON` alongside it (named, tested, behaviour unchanged — it isn't a data-vintage anchor and changing it would move numbers).
- **`super.ts`'s run-start year is now injected, not read at module load**: `SuperInputs.startYear`/`ProjectionContext.startYear` (optional, defaults to the wall clock) replace the old module-top-level `CURRENT_YEAR` capture, which was untestable — `vi.setSystemTime` cannot freeze a value already bound at static-import time.
- **Concessional-cap reconciliation**: `lib/super.ts` had a private, calendar-year-keyed AWOTE estimate (`round()` to nearest $2,500) that diverged from `lib/superHistory.ts`'s FY-ending-keyed legislated table from FY2026-27 onward, growing to +$7,500 by FY2031. **`lib/superHistory.ts`'s `LEGISLATIVE_CONCESSIONAL_CAP` is now the single source** — `super.ts` imports `legislativeCap()`/`currentFinancialYearEnding()` instead of maintaining a second model. Fixed along the way: FY2026-27's cap was verified at **$32,500** (was returning $30,000 via the old fallback — a live wrong number in the EOFY/carry-forward paths, not just a modelling inconsistency); extrapolation beyond the table now floors to the nearest $2,500 (was rounding up, against the ATO's published rule) and anchors to the last *legislated* FY rather than the wall clock (was silently re-anchoring every 1 January). `SuperRow` gained `fyEnding`; `SuperInputs`/`ProjectionContext` gained `startFyEnding` (optional, same injection pattern as `startYear`).
- **Carry-forward now reaches the projection**: previously `/super` could show "you may contribute $145,000" (cap + carry-forward, in `ConcessionalCarryForward`) while flagging `capHit` on a $31,000 contribution (`runSuperProjection` only ever saw the bare annual cap). `HouseholdSuperInputs` gained `person1CapCarryForward`/`person2CapCarryForward`; `SuperInputs` gained `firstYearCapBonus` (applied only in the run's first year). `ConcessionalCarryForward` reports each member's computed `CarryForwardResult` up via a new `onCarryForward` callback; `SuperClient` folds eligible headroom into the projection inputs — not persisted, since carry-forward is derived from `SuperHistory` rows, not a saved setting.
- **Watchdog re-stamped**: the `concessional-cap` entry's `location` collapses to the single file (`lib/superHistory.ts`), `calibratedFyEnding` bumped to 2027, `authority` corrected `ABS`→`ATO` (the cited URL was always ato.gov.au).
- **Zero migrations, zero Prisma changes** — all new fields are optional with wall-clock-preserving defaults; the only DB-adjacent change is what `ConcessionalCarryForward` computes client-side.

#### Backlog (remaining)

- **SQLite `busy_timeout` / write-retry wrapper** — only if concurrent-write errors ever surface.
- **`Transaction` index — corrected scope**: the model has no `date` column (`dateStr`/`ym`/`importedAt` only). The only filtered queries are FY-window scans on `ym` (`app/api/work-expenses/scan/route.ts`, `app/api/donations/scan/route.ts`); a candidate would be `@@index([ym])`, not `date`. The two hottest reads (`app/actuals/page.tsx`, `actuals/commit/route.ts`) are unfiltered full-table loads ordered by `importedAt` that no index on `ym` would help. Premature at household scale — revisit only if import volume actually warrants it.
- ~~`import type` for client-bundled engines~~ — audited: already satisfied. Every type-only consumer of `tax.ts`/`super.ts`/`cgt.ts` uses `import type`; the components that import values genuinely call them at render time. No action needed.

## Security checklist for new features

> When designing features that handle user data, add new routes, or touch auth — read [`docs/security-privacy-legal.md`](docs/security-privacy-legal.md) for the full legal, privacy, and cybersecurity context first.

- [ ] Writes to DB → has `authorize()` guard; wrap the handler in `withErrors` (`lib/apiHandler.ts`)
- [ ] Reads household/sensitive data → GET behind `requireAdultRead()` (`lib/rbac.ts`); adult pages use `requireAdult()`
- [ ] Accepts user input → `parseBody(req, schema)` with a zod schema in `lib/schemas.ts` (`.partial()` for updates, `.finite()` on numbers)
- [ ] Renders user-supplied text → no `dangerouslySetInnerHTML`; use React's escaping
- [ ] Sends data off-device → explicit user consent; document in privacy policy
