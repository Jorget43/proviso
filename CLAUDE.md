@AGENTS.md

# Proviso

**Product name:** Proviso (formerly "Household Dashboard" — rename in UI/branding pending, codebase still uses `household-dashboard` directory)

**Positioning:** "Most apps tell you what you spent yesterday. Proviso models what you will be worth tomorrow."

Jorge & Grace personal finance dashboard. Next.js 16 app, SQLite via Prisma 5, deployed on Unraid via Tailscale.

## Status: all tabs live

| Tab            | Status    | Route           |
|----------------|-----------|-----------------|
| Budget         | ✅ Done   | `/budget`       |
| Debts & Assets | ✅ Done   | `/debts`        |
| Cashflow       | ✅ Done   | `/cashflow`     |
| Projections    | ✅ Done   | `/projections`  |
| Actuals        | ✅ Done   | `/actuals`      |
| Super          | ✅ Done   | `/super`        |
| EOFY (seasonal)| ✅ Done   | `/eofy`         |
| Investments    | ✅ Done   | `/investments`  |

EOFY is a seasonal view, not a permanent tab — surfaced via a May/June `◷ EOFY` prompt in `TopNav`, reachable year-round by URL.

## Key architecture decisions

- **Prisma 5** (pinned — Prisma 7 broke `url = env(...)`, requires `prisma.config.ts`)
- **Next.js 16 params**: dynamic route handlers use `await params` — `params` is `Promise<{ id: string }>`
- **Next.js 16 Proxy (was Middleware)**: the middleware file convention is renamed — root `proxy.ts` exporting `proxy` + `config.matcher`. `cookies()` is async (`await cookies()`). Used for optimistic auth gating (`proxy.ts`); secure session validation is `requireSession()` in `lib/auth.ts` (Phase 4)
- **Auth (Phase 4)**: self-hosted, zero external deps — `node:crypto` scrypt password hashing + opaque DB-backed session token in an httpOnly cookie (`lib/auth.ts`, `Session`/`User` models). `COOKIE_SECURE=true` env when behind HTTPS (Tailscale Serve); default off for plain-http tailnet access
- **`@/*` alias** maps to `./` (project root), not `./src/`
- **Server vs client**: server components fetch from Prisma directly; `'use client'` for anything interactive or using Chart.js
- **Optimistic updates**: all CRUD hits state first, then API — no loading spinners
- **Tax engine** (`lib/tax.ts`): ATO 2024–25 Stage 3 brackets, LITO, Medicare, HELP repayments
- **Projection engine** (`lib/projections.ts`): 20-year dual simulation (with/without school fees), stepped inflation, monthly mortgage loop with live offset
- **Super engine** (`lib/super.ts`): per-person `runSuperProjection` + household `runHouseholdProjection`; accumulation (15%/30% tax) → drawdown (tax-free pension phase); concessional cap indexed to AWOTE; Div 293 at $250k
- **HELP indexation engine** (`lib/help.ts`): indexable base, 1-June countdown/window, marginal-rate equivalence (Phase 2A)
- **Carry-forward engine** (`lib/superHistory.ts`): legislative cap history + 5-year concessional carry-forward gated on prior-year TSB < $500k (Phase 2B)
- **EOFY engine** (`lib/eofy.ts`): May/June season gate + salary-sacrifice / marginal-rate optimisation (Phase 2C)
- **CGT engine** (`lib/cgt.ts`): per-parcel cost base, 12-month 50% discount eligibility, estimated CGT at the owner's marginal rate (Phase 6)

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

Singleton endpoints (id=1): `/api/income-settings`, `/api/mortgage-settings`, `/api/projection-settings`, `/api/super-settings`

CRUD endpoints: `/api/expenses/[id]`, `/api/debts/[id]`, `/api/assets/[id]`, `/api/grace-phases/[id]`, `/api/one-offs/[id]`, `/api/life-phases/[id]`

## Design system (`app/globals.css`)

CSS vars: `--bg`, `--surface`, `--surface2`, `--border`, `--border-md`, `--t1/t2/t3`, `--blue/green/red/amber/purple/pink/teal` (each with `-lt` variant), `--r`, `--rl`

Key classes: `.page`, `.banner` + `.b-item/.b-label/.b-value`, `.metrics`, `.mc`, `.panel` + `.panel-head/.panel-body`, `.two-col`, `.sidebar-layout`, `.da-grid/.da-row/.da-input`, `.pill` + color variants, `.toggle-switch/.toggle-slider`, `.slider-group/.slider-label`, `.tl-table`, `.add-btn`, `.del-btn`, `.input-prefix`, `.chart-wrap`, `.super-table`, `.super-badge`, `.super-hint`, `.super-context-box`, `.inc-person-card`, `.inc-breakdown`, `.inc-br-*`

## Docker deployment (completed 2026-06-06)

- **`household-dashboard/Dockerfile`** — 3-stage build: `deps` (npm ci) → `builder` (prisma generate + next build) → `runner` (node:20-alpine, standalone output only)
- **`household-dashboard/docker-entrypoint.sh`** — runs `prisma migrate deploy` on every start; runs `prisma db seed` only on first run (when `/data/household.db` doesn't exist)
- **`docker-compose.yml`** (at repo root `c:\Household-Dashboard\`) — named volume `household-db` mounted at `/data`; `DATABASE_URL=file:/data/household.db`
- **`next.config.ts`** — added `output: 'standalone'` for lean runner image
- **`.dockerignore`** — excludes `node_modules`, `.next`, `*.db`, `.env*`

### Prisma migrations baseline

Project previously used `db push` (no migrations folder). Steps taken to create migrations:

```sh
# Generate SQL from empty → current schema
npx prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script > migration.sql

# Manually created: prisma/migrations/0001_init/migration.sql + migration_lock.toml
# Marked existing DB as already migrated (avoids P3005 on existing DBs):
npx prisma migrate resolve --applied 0001_init
```

### Git cleanup

`prisma/household.db` was previously tracked. Removed with:
```sh
git rm --cached prisma/household.db
# Added *.db, *.db-journal, *.db-wal, *.db-shm to .gitignore
```

All 5 pages had `export const dynamic = 'force-dynamic'` added to prevent static prerendering at Docker build time (no DB available during build).

### Fix: Prisma 5 createMany + skipDuplicates type error

`createMany` on SQLite in Prisma 5 doesn't expose `skipDuplicates` in TS types but works at runtime. Workaround in `app/api/actuals/commit/route.ts`:
```ts
await (prisma.transaction.createMany as Function)({ data: [...], skipDuplicates: true })
```

## Super tab (`/super`) — completed 2026-06-06

Household two-person superannuation projector.

**Data model:**
- `SuperSettings` — Jorge's balance/retirement age/extra contribs + partner fields (Grace) + shared assumptions
- `IncomeSettings` — extended with `jorgeAge` and `graceAge` (used by super engine; not duplicated in SuperSettings)
- Salary and salary growth come from `IncomeSettings.jorgeFTE` / `graceFTE` and `ProjectionSettings.jorgeGrowth` / `graceGrowth` (read-only in Super tab, editable in Budget/Projections)

**Engine (`lib/super.ts`):**
- `runSuperProjection(SuperInputs)` — per-person engine; accumulation phase (earnings tax 15%, contribution tax 15%/30% Div293, concessional cap indexed to AWOTE ~3.5%); drawdown (pension phase, earnings tax-free)
- `runHouseholdProjection(HouseholdSuperInputs, ProjectionContext)` — runs both people, splits `desiredRetirementIncome / 2` per person, year-aligns `CombinedRow[]`, finds combined depletion age

**Retirement income goal** pre-populates from current Budget annual spend (rounded to $1k) if the DB still has the schema placeholder. "Reset to budget ↺" link snaps it back.

**Mortgage hint** — if `MortgageSettings.endDate` is before Jorge's retirement year, shows amber hint with annual saving and one-click "Apply" to reduce the income target.

**Migrations:**
- `0002_super` — creates `SuperSettings` table
- `0003_super_partner` — adds `partnerEnabled/Balance/RetirementAge/AdditionalContribs` to `SuperSettings`; adds `jorgeAge`/`graceAge` to `IncomeSettings`

When DB already has columns from a prior `db push`, baseline with:
```sh
npx prisma migrate resolve --applied 0003_super_partner
```

**Later migrations** (`0005_help_debt_detail`, `0009_super_history`, `0010_investment_parcels`) create brand-new tables, so `prisma migrate deploy` applies them cleanly on existing deployed DBs — no `migrate resolve` baseline needed.

## Budget tab income panel — updated 2026-06-06

`IncomePanel` (taxMode ON) now shows a per-person breakdown card for Grace and Jorge:
- Inline breakdown: income tax, Medicare levy, HELP repayment (Grace), Super SG at 12%, net take-home (yearly + monthly)
- **Income bracket bar** — 5-segment colour-coded bar (Nil/16%/30%/37%/45%) showing ATO bracket position; segments grey out above the person's income
- Effective rate and marginal rate footnote
- Old separate `TaxBreakdown` section removed; everything is now per-person and inline

## Remaining

1. **Deploy via Tailscale** — `git clone` on Unraid, then `docker compose up -d --build`

---

## Product strategy

### Target audience

Aged 30–45, Australian, carrying a mortgage and likely dependents. Professionals who use dashboards and CRMs at work and are frustrated their household finances are managed worse than their business. They have already mastered basic budgeting and are focused on wealth building, tax efficiency, and retirement planning. They are not the YNAB debt-payoff user — they are the household CFO.

### Competitive positioning

| Product | Price (AUD/yr) | AU Super | Self-hosted | HELP tracking |
|---------|---------------|----------|-------------|---------------|
| YNAB | ~$150 | No | No | No |
| Frollo | Free (ads) | No | No | No |
| Pocketbook | Free (ads) | No | No | No |
| **Proviso** | **$60** | **✓ core feature** | **✓ founding differentiator** | **✓ Phase 2** |

Annual-only billing — no monthly option. Aligns with the product's philosophy, eliminates churn, and guarantees cash flow to cover infrastructure costs. Annual billing is also standard for AU software (Atlassian, Xero, MYOB all default to it).

### Self-hosting as moat

No AU competitor can offer self-hosting without destroying their own SaaS margin. Proviso's data sovereignty promise (data never leaves the user's Unraid box) is structural, not just a feature flag. This is the founding differentiator and every architecture decision should reinforce it, not dilute it.

---

## Commercial roadmap (priority order)

### Phase 2 — AU tax & super depth (highest ROI, foundation already exists)

The Super tab and tax engine are the foundation. Phase 2 makes them commercially defensible — no competitor comes close on these features in the AU market.

**Status: 2A ✅ · 2B ✅ · 2C ✅ (all shipped 2026-06-07).** Spec text below is retained as reference; each sub-section now has an "Implemented" note describing what was built.

#### 2A — HELP/HECS indexation alert

CPI indexation applies on **1 June** each year. The ATO indexes the **opening FY balance minus any voluntary payments** made directly to the ATO before June 1. Critically, PAYG withholding deducted by employers throughout the year does **not** reduce the indexable amount — it is credited to the debt after the indexation date. This distinction is what makes voluntary prepayments valuable.

The alert: show in May "Your HELP balance of $X will increase by $Y on June 1 (CPI rate). A voluntary payment of $Z today saves you $W in indexed debt — equivalent to a guaranteed tax-free return."

Schema addition required:

```prisma
model HelpDebtDetail {
  id                  Int      @id @default(autoincrement())
  member              String   // "Jorge" or "Grace"
  // Opening balance at 1 July — this is the ATO indexation base
  openingFyBalance    Float
  // PAYG withheld by employer YTD — informational only, does NOT reduce indexation
  estimatedWithheld   Float    @default(0)
  // Direct voluntary payments to ATO before June 1 — these DO reduce indexation
  voluntaryRepayments Float    @default(0)
  financialYearEnding Int      // e.g., 2025 for FY24-25
  createdAt           DateTime @default(now())
  updatedAt           DateTime @updatedAt
  @@unique([member, financialYearEnding])
}
```

Note: our `Debt.id` is `Int @default(autoincrement())`, so `HelpDebtDetail` uses an `Int` PK — not a cuid string as some external schema suggestions have proposed.

**Implemented (2026-06-07):** `HelpDebtDetail` schema includes a `cpiRate` field (migration `0005_help_debt_detail`). Data-entry tracker is `components/debts/HelpPanel.tsx`; the seasonal banner is `components/debts/HelpIndexationAlert.tsx`, gated on a ~92-day window before 1 June via `lib/help.ts`. The engine expresses the saving as a marginal-rate equivalent — a guaranteed tax-free CPI% restated as the pre-tax return it beats (`cpiRate / (1 − marginalRate)`). HELP detail + CPI state live in `DebtsClient` (lifted) so the alert stays reactive. The banner is correctly dormant outside the window.

#### 2B — Super concessional cap carry-forward

The $30,000/yr concessional cap can be carried forward for up to 5 prior financial years, **but only if total super balance was under $500,000 at the end of the prior FY**. The current super engine (lib/super.ts) indexes the cap to AWOTE for projections but does not track actual historical utilisation.

Schema addition required:

```prisma
model SuperHistory {
  id                   Int      @id @default(autoincrement())
  member               String   // "Jorge" or "Grace"
  financialYearEnding  Int      // e.g., 2024 for FY23-24
  concessionalCap      Float    // Legislative cap that year (e.g., 27500, 30000)
  concessionalUtilised Float    // Employer SG + salary sacrifice + personal deductible
  totalSuperBalance    Float    // Balance at 30 June — triggers carry-forward if < $500k
  createdAt            DateTime @default(now())
  updatedAt            DateTime @updatedAt
  @@unique([member, financialYearEnding])
  @@index([member])
}
```

Query pattern for carry-forward calculation: fetch last 5 `SuperHistory` records per member, sum `(concessionalCap - concessionalUtilised)` for years where `totalSuperBalance < 500000`. Surface the result as an available top-up amount before EOFY.

**Implemented (2026-06-07):** `SuperHistory` schema (migration `0009_super_history`). Engine `lib/superHistory.ts` (legislative cap history FY19 $25k → FY26 $30k; `computeCarryForward`). API `/api/super-history` (GET/PUT upsert) + `/[id]` (DELETE). UI `components/super/ConcessionalCarryForward.tsx` on the Super tab.

> **Accuracy deviation from the spec's query pattern:** the literal "sum unused for years where `totalSuperBalance < 500000`" was *not* implemented as written. Per the ATO rule, unused cap **accrues every year regardless of balance**; the $500k TSB test gates only whether it can be **used** this FY, measured against the **prior 30 June** balance. The engine implements the correct rule and gates eligibility accordingly. Revert to the literal interpretation only if a simpler approximation is preferred.

#### 2C — EOFY dashboard

A dedicated June view (surfaced as a seasonal prompt, not a permanent tab):

- HELP voluntary payment window with countdown to June 1
- Super concessional top-up opportunity with carry-forward amount
- Marginal rate optimisation: show whether salary sacrificing to the cap reduces income below a bracket threshold

**Implemented (2026-06-07):** Route `/eofy` (`app/eofy/page.tsx`, server-rendered, `force-dynamic`) — per-member cards for HELP indexation (reuses `lib/help.ts`), super concessional top-up (reuses `lib/superHistory.ts`), and salary sacrifice. Marginal-rate optimisation lives in `lib/eofy.ts` (`computeSalarySacrifice`): concessional headroom, tax saved `room × (marginal − contributions tax)`, Div 293 awareness, and a bracket-crossing note when sacrificing down to the next threshold. `isEofySeason()` (May/June) gates a seasonal `◷ EOFY` pill in `TopNav` — **not** a permanent tab. `/eofy` stays reachable year-round.

#### Explicitly out of scope for Phase 2

Negative gearing calculators, investment property tools — these serve investors, not households.

### Phase 3 — CDR / Open Banking bank feeds

Australia's Consumer Data Right mandates banks expose transaction data via accredited APIs. This is the legitimate path to replace CSV import — no scraping, no US intermediaries like Plaid.

- Research ACCC CDR accreditation requirements before committing to any intermediary vendor
- Replace `parseCsvText()` in `lib/actuals.ts` with a CDR adapter behind the same interface
- CSV import stays as permanent fallback for non-CDR institutions and privacy-first users
- Subscription detection (recurring charges, price creep) is a natural by-product — build after the feed, not before

**Research done (2026-06-07):** cost & vendor map in [`docs/phase3-cdr-research.md`](docs/phase3-cdr-research.md). Verdict: keep CSV as the permanent $0 core; live feeds only viable as an **opt-in** CDR Representative integration (via Fiskil or Basiq, ~$15k–60k/yr first year) — direct accreditation is $100k–500k+/yr. Every CDR Representative route pipes data through the Principal's accredited cloud, in tension with the self-hosting moat, so CDR can only be a convenience layer, never the default. No code written yet (seam is `parseCsvText()` in `lib/actuals.ts` behind a future `TransactionSource` interface).

### Phase 4 — Household RBAC (family tenant model)

Build for a household as a unit, not an individual with sharing bolted on:

- **Tenant model** — single household, multiple users with roles
- **CFO role** — full read/write across all tabs
- **Partner role** — read + actuals import, no budget editing
- **Child role** — restricted view, gamified pocket money tracker (stretch)

This is architecturally significant (auth, multi-tenancy, row-level scoping) — do it after the data model is stable.

**Plan:** [`docs/phase4-rbac-plan.md`](docs/phase4-rbac-plan.md). Locked: minimal self-hosted auth, RBAC single-household-per-deployment, Child role deferred.

**4.0 shipped (2026-06-08):** auth foundation. `User`/`Session` models (migration `0011_auth`); `lib/auth.ts` (scrypt hashing, DB-backed sessions, `getSession`/`requireSession`); `proxy.ts` optimistic cookie gate; `/login` + `/setup` (first-run CFO) + `/api/auth/*`; `requireSession()` on all data pages; user chip + sign-out in `TopNav`.

**4.1 shipped (2026-06-08):** API role enforcement. `lib/rbac.ts` — two write scopes (`actuals:write`, `budget:write`); CFO does both, PARTNER only Actuals, CHILD none. `authorize(action)` guard called at the top of **all 39 mutating route handlers** (audited: handler count == guard count). Auth routes (`/api/auth/*`) intentionally ungated. Until 4.2 creates Partner users, only the CFO exists, so guards tighten security without changing current UX.

**4.2 shipped (2026-06-08):** user management. `users:write` scope (CFO-only) in `lib/rbac.ts`; `/api/users` (GET/POST) + `/[id]` (PUT role/password, DELETE) with last-CFO and self-delete safeguards. `components/settings/MembersPanel.tsx` on the Settings tab (CFO-only) — add member, change role, reset password, remove. Settings page passes role/users; the re-run-wizard block is now CFO-gated. `TopNav` shows a "Read-only" pill for non-CFO. Child role still deferred.

**4.2b shipped (2026-06-08):** role-gated UI. `components/ui/ReadOnlyFence.tsx` (a `fieldset disabled` wrapper; renders children untouched when `canEdit`). Pages pass `canEdit={role==='CFO'}` to the five edit-bearing clients. Budget/Debts/Investments/Projections fence their immediately-persisting controls; **Super** only fences Save + carry-forward (its sliders are local-until-save, so Partners can still explore scenarios). View widgets (NetPosition, HELP tracker/alert, charts, "Edit in Budget" link) stay live. Cashflow/EOFY are read-only already. Server `authorize()` guards remain the real boundary — the fence is UX only.

### Phase 5 — Developer watchdog (internal tooling only)

A background process / admin-only page that monitors for changes to underlying assumptions:
- ATO: new HELP repayment thresholds, new tax brackets, new LITO/LMITO offsets
- Super Guarantee rate changes (currently 12% final — no further increases legislated as of Jun 2026)
- CPI indexation rates when ATO announces them
- AWOTE index used for concessional cap indexation

Not user-facing at this stage. Surfaces via an admin flag that prompts the developer to update constants in `lib/tax.ts`, `lib/super.ts`, and `lib/constants.ts`. Future: allow CFO-role users to integrate government-announced changes themselves.

### Phase 6 — CGT-aware investment module

When users may need to sell investments (shares, ETFs, crypto, property), CGT rules apply:

- **50% discount**: assets held > 12 months qualify for 50% CGT discount (individuals/trusts)
- **Purchase date matters**: the discount eligibility is per-parcel, not per-asset
- What to build: an "Investment parcels" table where users record each purchase (date, quantity, price), the system calculates cost base, applicable discount, and estimated CGT on a hypothetical sale
- Links to the Projections tab: if a parcel is flagged "may sell in year X", the estimated CGT can feed into the one-off expense for that year

**Note:** The 2024 Federal Budget proposed a CGT discount rate change that was NOT passed into law. Current 50% discount rule still applies as of Jun 2026.

**Implemented (2026-06-07):** `InvestmentParcel` schema (migration `0010_investment_parcels`). Engine `lib/cgt.ts` (`computeCgt`): per-parcel cost base, market value, capital gain/loss, 12-month 50%-discount test (per parcel, via purchase date), and estimated CGT at the owner's marginal rate. API `/api/investments` (GET/POST) + `/[id]` (PUT/DELETE). UI `components/investments/InvestmentsClient.tsx` at `/investments` (permanent tab) — editable parcel cards, portfolio summary banner, and a "plan to sell year X" selector that posts the estimated CGT to `/api/one-offs` as a Projections one-off. Caveats (losses from other parcels, brokerage, non-sale CGT events) are noted in the UI and not modelled.

### Phase 2 status: complete. Phase 6 status: complete.

### Explicitly deprioritised

- Auto utility switching / bill negotiation — requires commercial partnerships
- One-click subscription cancellation — not feasible in AU without deep integrations
- NPV calculator for appliances (solar, EVs) — interesting but Phase 3 at earliest
- App Store optimisation — irrelevant until a native mobile wrapper exists
