@AGENTS.md

# Proviso

**Product name:** Proviso (formerly "Household Dashboard"). UI **and** infra renamed to Proviso (2026-06-08): metadata/nav/auth/onboarding, `package.json`/lockfile name, Docker service + `container_name` `proviso`, volume `proviso-db`, DB `/data/proviso.db`. The repo **directory** stays `household-dashboard` (so `household-dashboard/Dockerfile` etc. paths below are unchanged).

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
- **`household-dashboard/docker-entrypoint.sh`** — runs `prisma migrate deploy` on every start; runs `prisma db seed` only on first run (when `/data/proviso.db` doesn't exist)
- **`docker-compose.yml`** (at repo root) — service/`container_name` `proviso`; named volume `proviso-db` mounted at `/data`; `DATABASE_URL=file:/data/proviso.db`
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

**Decision (2026-06-13): CSV + PDF import only. CDR indefinitely deferred.** The self-hosting moat outweighs the convenience of live bank feeds. CSV stays as the permanent $0 core; PDF import (Phase 6+) adds bank/credit card statement support client-side via `pdf.js` — no data leaves the user's instance. CDR Representative routes all pipe through accredited cloud infrastructure, which conflicts with Proviso's data sovereignty promise and is therefore out of scope.

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

**4.3 — Child role (deferred, spec documented 2026-06-13):**

The `CHILD` role exists in the DB schema and `SessionUser` type. What's needed to activate it:

- **Access model:** read-only `/child` route only — no mortgages, super, investments, or tax details visible. New `child:write` scope in `lib/rbac.ts` gates pocket money transactions only. All existing budget/debt/projection write routes already block CHILD via `authorize()`.
- **Data model (new migration when built):**
  ```prisma
  model AllowanceSchedule {
    id        Int   @id @default(autoincrement())
    userId    Int
    amount    Float   // weekly allowance
    dayOfWeek Int     // 0=Sun … 6=Sat
  }
  model PocketMoneyTx {
    id          Int      @id @default(autoincrement())
    userId      Int
    amount      Float    // negative = spend, positive = income
    description String
    date        DateTime @default(now())
    category    String?
  }
  ```
- **UI (`/child`):** running balance (allowance received − spending); log a spend (amount + category); savings goal with progress bar; gamification stretch (streaks, badges).
- **TopNav:** CHILD role sees only `/child`; all other routes redirect.
- **CFO management:** `MembersPanel` (Settings) gains CHILD role option + allowance schedule config.
- **When to build:** after Phase 5 watchdog enhancement; low commercial priority.

### Phase 5 — Developer watchdog (internal tooling only)

A background process / admin-only page that monitors for changes to underlying assumptions:
- ATO: new HELP repayment thresholds, new tax brackets, new LITO/LMITO offsets
- Super Guarantee rate changes (currently 12% final — no further increases legislated as of Jun 2026)
- CPI indexation rates when ATO announces them
- AWOTE index used for concessional cap indexation

Not user-facing at this stage. Surfaces via an admin flag that prompts the developer to update constants in `lib/tax.ts`, `lib/super.ts`, and `lib/constants.ts`. Future: allow CFO-role users to integrate government-announced changes themselves.

**Implemented (2026-06-08):** date-based staleness detector (no auto-fetch — prompts the developer). Engine `lib/watchdog.ts` — a registry of 8 time-sensitive assumptions (tax brackets, LITO, HELP thresholds, Medicare low threshold, HELP CPI rate, SG rate, concessional cap, Div 293), each stamped with `calibratedFyEnding`; `computeWatchdog(now)` flags `current`/`review`/`overdue` vs the current AU FY (non-indexed items like SG/Div293 never nag). Page `app/admin/watchdog/page.tsx` — **CFO-gated** + `notFound()` unless enabled (`WATCHDOG_ENABLED=true`, or any non-production env); lists each assumption with status, the exact constant to edit, the authority, and the review trigger. A CFO-only prompt in Settings links to it with an attention count. Workflow: verify → edit the constant → bump `calibratedFyEnding`. Future: plug a live ATO/ABS fetcher behind the same registry.

### Phase 6 — CGT-aware investment module

When users may need to sell investments (shares, ETFs, crypto, property), CGT rules apply:

- **50% discount**: assets held > 12 months qualify for 50% CGT discount (individuals/trusts)
- **Purchase date matters**: the discount eligibility is per-parcel, not per-asset
- What to build: an "Investment parcels" table where users record each purchase (date, quantity, price), the system calculates cost base, applicable discount, and estimated CGT on a hypothetical sale
- Links to the Projections tab: if a parcel is flagged "may sell in year X", the estimated CGT can feed into the one-off expense for that year

**Note:** The 2024 Federal Budget proposed a CGT discount rate change that was NOT passed into law. Current 50% discount rule still applies as of Jun 2026.

**Implemented (2026-06-07):** `InvestmentParcel` schema (migration `0010_investment_parcels`). Engine `lib/cgt.ts` (`computeCgt`): per-parcel cost base, market value, capital gain/loss, 12-month 50%-discount test (per parcel, via purchase date), and estimated CGT at the owner's marginal rate. API `/api/investments` (GET/POST) + `/[id]` (PUT/DELETE). UI `components/investments/InvestmentsClient.tsx` at `/investments` (permanent tab) — editable parcel cards, portfolio summary banner, and a "plan to sell year X" selector that posts the estimated CGT to `/api/one-offs` as a Projections one-off. Caveats (losses from other parcels, brokerage, non-sale CGT events) are noted in the UI and not modelled.

### Phase 6+ — Additional features (shipped 2026-06-10)

Built on top of Phase 6 in commit `056ed3f`:

**Cash ↔ mortgage offset:** `Asset.isOffset` boolean toggle (migration `0012_asset_offset`). Sum of flagged assets drives `MortgageSettings.offsetBal` (reduces interest) and projections cash-on-hand. Shown in `AssetGrid` and `MortgageDetail`.

**PDF statement import:** client-side `pdf.js` extraction — no PDF data is uploaded to a server. `lib/pdfExtract.ts` strips raw text; `lib/pdfStatement.ts` parses bank and credit card statement formats. Upload boxes on the Actuals page feed the existing review/commit pipeline. `pdfjs-dist` added as a dependency.

**CCS childcare engine:** ATO 2024–25 Combined Family Income taper (`lib/childcare.ts`). `ChildcareSettings` model (migration `0013_childcare`) stores income + days/week. `ChildcarePanel` on Budget tab computes gross fees, CCS subsidy, and net out-of-pocket; syncs result to the managed `Childcare` expense line automatically.

**Onboarding mortgage fix:** repayment input replaced with loan end date; repayment computed via P&I amortisation (`lib/mortgage.ts`). Fixes Budget Mortgage line staying $0 after onboarding.

**UX polish:** Budget add-line per-category inline with category picker; spend donut on-arc percentage labels (arcs ≥8%); HELP repayment projection uses pro-rated income (`FTE × days/5`); Super mobile secondary columns hidden ≤600px via `.super-col-sec` CSS class.

### Phase 2 status: complete. Phase 6 / 6+ status: complete.

### Phase 7 — Hosting accessibility (spec documented 2026-06-13)

**Problem:** The current hosting story (Unraid + Docker + Tailscale) locks out users without a NAS. Proviso's data sovereignty promise can hold without requiring a NAS — the key is keeping the SQLite file in the user's own storage.

**Tier 1: Docker on any machine (ship first — near-zero code change)**

Replace the Unraid-specific compose setup with a one-liner:

```sh
docker run -d \
  --name proviso \
  --restart unless-stopped \
  -v ~/proviso-data:/data \
  -p 3000:3000 \
  ghcr.io/jorget43/proviso
```

Works on Mac (Docker Desktop), Windows (Docker Desktop), Linux. Data lives in `~/proviso-data/proviso.db`. User can point that folder at their Google Drive / Dropbox sync location for cloud backup. Tailscale for remote access remains optional.

**Cloud sync caveat:** SQLite WAL mode creates journal files during active writes — advise users not to sync while Proviso is running. Overnight / scheduled sync is fine.

**Tier 2: Tauri desktop app (medium-term)**

Native `.dmg` / `.exe` installer wrapping the Next.js + Node.js runtime. No Docker required. SQLite stored in OS app-support dir (`~/Library/Application Support/Proviso` on Mac, `%APPDATA%\Proviso` on Windows) — compatible with Dropbox / Google Drive / iCloud sync. Requires GitHub Actions cross-compile pipeline. Estimate: 2–3 weeks. Target: after Phase 5 watchdog ships and feature-set is stable.

**Tier 3: Managed cloud (commercial horizon)**

Jorge hosts a shared deployment. Each household gets an isolated SQLite DB (or PostgreSQL schema). Users export their full DB at any time and migrate to self-hosted. $60/yr subscription with "export and leave" guarantee. Requires: multi-tenant isolation, payment processing, infrastructure ops. Estimate: 4–6 weeks. Auth is already built; main work is tenancy and payments.

**Data portability guarantee (all tiers):** SQLite export always available. Import on any tier by replacing `/data/proviso.db`.

### Phase 8 — Seamless update delivery (spec documented 2026-06-13)

**Problem:** Users across Docker, cloud, desktop, and eventually mobile need to receive updates without running manual infrastructure commands. The answer differs by deployment tier.

#### Detection & notification (all tiers)

A version check runs on startup and periodically (daily) to compare `PROVISO_VERSION` (baked in at build time) against the latest release. The CFO sees a dismissible in-app banner when a newer version exists.

- `PROVISO_VERSION` injected at Docker build time from the git tag: `ARG PROVISO_VERSION` → `ENV PROVISO_VERSION` in `Dockerfile`
- `GET /api/version` returns `{ version: string }` — publicly readable, no auth required
- Daily check via the watchdog scheduler or a separate `instrumentation.ts` cron; stores last-check result in a `VersionCheck` table (similar pattern to `WatchdogSnapshot`)
- Release manifest: `https://api.github.com/repos/Jorget43/proviso/releases/latest` — no API key required

#### Tier 1: Docker on any machine

**Option A — Watchtower companion (no app changes):**
An optional second service in `docker-compose.yml` that polls GHCR daily for a new image and sends a notification (email, Slack, etc.). Does NOT auto-restart by default — user confirms the update.

```yaml
watchtower:
  image: containrrr/watchtower
  volumes:
    - /var/run/docker.sock:/var/run/docker.sock
  command: --interval 86400 --label-enable --monitor-only  # notify only
  environment:
    WATCHTOWER_NOTIFICATIONS: email
    WATCHTOWER_NOTIFICATION_EMAIL_TO: ${NOTIFICATION_EMAIL}
    # ... SMTP config
```

Label the proviso service with `com.centurylinklabs.watchtower.enable: "true"` to scope it.

**Option B — In-app banner (preferred):**
CFO sees: *"Proviso v1.2.3 is available. Run `docker compose pull && docker compose up -d` to update."* One copy-paste command. No external tooling.

#### Tier 2: Tauri desktop app

Tauri 2.0 ships `tauri-plugin-updater`. Update flow:
- App checks a GitHub Releases endpoint or a signed `latest.json` manifest
- Prompts user to install update
- Downloads + re-launches automatically
- Manifest must be signed with a key pair baked into the build

#### Tier 3: Mobile (future)

iOS/Android app updates via the respective app stores. For any webview/hybrid logic not in the native wrapper, OTA (Over-the-Air) updates via a code-push service. Security note: Apple's App Store Review Guidelines restrict OTA updates that change app behaviour beyond web content.

#### Security requirements for update delivery

- All release artefacts (Docker images, Tauri binaries, mobile builds) must be **signed**
  - Docker: cosign (Sigstore) signatures on GHCR images
  - Tauri: standard code signing (Apple Developer ID, Windows Authenticode)
- Proviso must verify the update signature before applying (Tauri does this natively; Docker users rely on image digest pinning)
- Update channels: `stable` (default) and `beta` (opt-in via `UPDATE_CHANNEL=beta` env var)
- Never auto-apply without user confirmation at Tier 1/2; push is notification + one command/click only

#### Files created (Phase 8 shipped 2026-06-13)

- `Dockerfile` — `ARG PROVISO_VERSION=dev` + `ENV PROVISO_VERSION` baked into runner stage ✅
- `app/api/version/route.ts` — public `GET /api/version` → `{ version }` ✅
- `lib/versionCheck.ts` — polls GitHub Releases on startup + daily 09:00 AEST; caches in `VersionCheck` DB table ✅
- `components/ui/UpdateBanner.tsx` — dismissible CFO-only amber banner; copy-paste update command ✅
- `docker-compose.yml` — `PROVISO_VERSION` build arg; commented Watchtower block ✅
- `instrumentation.ts` — version check runs for all deployments; watchdog remains gated on `WATCHDOG_ENABLED=true` ✅
- `prisma/migrations/0015_version_check/` — `VersionCheck` table ✅

#### Releasing a new version — required workflow

**Every release must be tagged** so the in-app update banner works for deployed instances.

```bash
# 1. Merge your changes to main
git checkout main && git pull

# 2. Tag with semver (no branch prefix — tags live on commits, not branches)
git tag v1.2.3

# 3. Push the tag — this triggers the GitHub Actions build
git push origin v1.2.3

# 4. GitHub Actions builds the Docker image with --build-arg PROVISO_VERSION=v1.2.3
#    and pushes to: ghcr.io/jorget43/household-dashboard:v1.2.3
#                   ghcr.io/jorget43/household-dashboard:latest
```

**Rule:** never push code to main without tagging. Untagged images build as `dev` and the banner never fires for users.

**To check what version a running container is on:** `GET /api/version` (no auth required).

**Update cadence:** deployed instances poll GitHub Releases daily at 09:00 AEST. After tagging and pushing the image, the CFO banner appears on all running instances within 24 hours.

**GitHub Actions file to create** (`.github/workflows/docker.yml` at repo root):
```yaml
on:
  push:
    tags: ['v*']
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}
      - uses: docker/build-push-action@v5
        with:
          context: .
          push: true
          build-args: PROVISO_VERSION=${{ github.ref_name }}
          tags: |
            ghcr.io/jorget43/proviso:${{ github.ref_name }}
            ghcr.io/jorget43/proviso:latest
```

---

### Security, Privacy & Legal framework (documented 2026-06-13)

Proviso handles some of the most sensitive information in people's lives: income, debts, superannuation, tax position, and investment holdings. The following framework governs what must be built before public beta and what shapes every future feature.

#### Not financial advice — the single most important legal boundary

Under the **Corporations Act 2001 (Cth)**, providing "financial product advice" — a recommendation or opinion intended to influence a decision about a financial product — requires an **Australian Financial Services Licence (AFSL)**. Proviso does not hold an AFSL and must never cross that line.

**What Proviso is:** a modelling and projection tool. It reflects the user's own data back at them in a structured form. All numbers flow from user inputs; all interpretations are the user's own.

**What Proviso must never do:**
- Tell a user to buy, sell, or hold a specific financial product
- Recommend a specific super fund or investment
- Give personalised tax advice (e.g. "you should lodge an amended return")
- Suggest a specific debt repayment strategy without being explicit it is illustrative only

**Mandatory disclaimers (to be added before public beta):**
- Persistent footer or settings-page disclosure: *"Proviso is a personal finance modelling tool. It is not a financial adviser, tax agent, or accountant. All projections are estimates. Consult a licensed financial adviser (AFSL) or registered tax agent for personal advice."*
- On EOFY, HELP, and Super tabs: inline context notes making clear calculations are illustrative
- `/onboarding` welcome step: accept terms that include the disclaimer

**ASIC guidance:** ASIC's Regulatory Guide RG 36 (licensing: financial product advice) and the fintech regulatory sandbox (ASIC Class Order CO 16/1175) are worth monitoring. Under the sandbox, qualifying startups can test certain advice-related features for up to 24 months without an AFSL — relevant if Jorge ever wants to add goal-based recommendations.

#### Australian Privacy Act 1988 (Cth)

Proviso in self-hosted form is a **tool the user runs for themselves** — no data leaves their instance and Jorge has zero access to it. This is the cleanest possible privacy position.

The Privacy Act's Australian Privacy Principles (APPs) become binding on Jorge once he operates a managed SaaS (Tier 3) because he would then hold personal information on behalf of users. **At that point:**

- **APP 1:** Publish a Privacy Policy describing what data is collected, why, and how it is protected
- **APP 3:** Collect only what is necessary for the service
- **APP 6:** Use data only for the primary purpose it was collected for (never sell, never share with advertisers)
- **APP 11:** Take reasonable steps to protect personal information from misuse, loss, and unauthorised access
- **APP 12/13:** Allow individuals to access and correct their data on request

**Notifiable Data Breaches (NDB) scheme:** If a data breach is likely to result in serious harm to individuals, OAIC and affected individuals must be notified. This applies once Proviso handles others' data (Tier 3). For self-hosted users, the breach risk is entirely on their own infrastructure — clearly communicate this.

**Practical steps before Tier 3:**
1. Draft privacy policy (hosted at `/privacy`)
2. Draft terms of service (hosted at `/terms`)
3. Data retention policy: what data is kept and for how long
4. Breach response plan

#### Cybersecurity — current state and gaps

**Already in place:**
- Passwords: scrypt hashing via `node:crypto` (strong, no external deps)
- Sessions: DB-backed opaque tokens in httpOnly, SameSite=Lax cookies
- SQL injection: Prisma parameterised queries (immune by design)
- XSS: React's JSX escaping (immune for rendered content; watch `dangerouslySetInnerHTML` — currently unused)
- Transport: TLS via Tailscale Serve or external reverse proxy
- Auth gating: `requireSession()` on all data pages; `authorize()` on all mutating API routes

**Gaps to address before public beta (priority order):**

| Gap | Risk | Fix |
|---|---|---|
| No rate limiting on `/api/auth/login` | Brute-force password attack | Add rate-limit middleware (e.g. `next-rate-limit` or a simple in-memory counter at the route level) |
| No account lockout | Persistent brute force | Lock account for 15 min after N failed attempts; store `failedAttempts` + `lockedUntil` on `User` |
| No TOTP/2FA option | Account takeover if password leaked | Add TOTP second factor (HMAC-based, e.g. `otplib`) |
| Session tokens are opaque but long-lived (30 days) | Stolen session cookie | Consider shorter default TTL (7 days) + "remember me" for 30 days |
| No audit log | Can't detect or investigate unauthorized access | Add `AuditLog` table: `userId`, `action`, `target`, `ip`, `timestamp` on write operations |
| No Content Security Policy | XSS amplification if a future bug introduces it | Add `Content-Security-Policy` header in `next.config.ts` headers config |
| SQLite not encrypted at rest | Physical access to the Docker volume exposes all data | Future: SQLCipher or AES-encrypted SQLite. For now, document that volume-level encryption (Unraid array encryption, OS-level disk encryption) is the user's responsibility |
| No HTTPS enforcement at app level | Accidental HTTP use | Document that `COOKIE_SECURE=true` must be set when behind HTTPS; consider adding `Strict-Transport-Security` header |
| `npm audit` shows 5 vulnerabilities | Dependency chain attack | Run `npm audit fix` on next dependency update cycle; add Dependabot or Renovate |

**Content Security Policy starter (add to `next.config.ts`):**
```ts
headers: async () => [{
  source: '/(.*)',
  headers: [
    { key: 'X-Frame-Options', value: 'DENY' },
    { key: 'X-Content-Type-Options', value: 'nosniff' },
    { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
    // Tighten script-src once Chart.js CDN situation is confirmed
    { key: 'Content-Security-Policy', value: "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:;" },
  ]
}]
```

#### Security checklist for new features

Every new feature that handles user data must pass this checklist before merging:

- [ ] Does it write to the DB? → Has `authorize()` guard
- [ ] Does it read sensitive data? → Is it behind `requireSession()`
- [ ] Does it accept user input? → Is it validated/sanitised before use
- [ ] Does it render user-supplied text? → No `dangerouslySetInnerHTML`; use React's escaping
- [ ] Does it add a new route? → Is it in the `authorize()` audit count (currently 39 mutating handlers)
- [ ] Does it send data off-device? → Explicit user consent required; document it in privacy policy

---

### Phase 9 — Access roles, self-service auth & SSO (spec documented 2026-06-13)

#### Current gaps

The current auth system (Phase 4) covers the essentials but has UX friction that will become a blocker as the user base grows:

- **Password reset:** CFO must reset every user's password — there is no self-service flow
- **No 2FA:** Single factor only; a compromised password exposes all financial data
- **Google/social SSO:** Not yet implemented; requires architectural decision that differs by deployment tier
- **CHILD role:** Not yet fully built out (spec in Phase 4.3 above)

#### Self-service password reset (build before public beta)

Requires email infrastructure (Resend is already in place for the watchdog).

**Flow:**
1. User clicks "Forgot password?" on `/login`
2. System generates a signed, time-limited reset token (UUID, 1-hour TTL) stored in a new `PasswordReset` table
3. Email sent to the user's registered email address via Resend
4. User clicks link → `/reset-password?token=...` → sets new password → token invalidated
5. Invalidate all existing sessions for the user on password change

```prisma
model PasswordReset {
  id        Int      @id @default(autoincrement())
  userId    Int
  token     String   @unique
  expiresAt DateTime
  usedAt    DateTime?
  createdAt DateTime @default(now())
}
```

**CFO email field:** `User` currently has no email column. Add `email String?` to `User` to support this flow. CFO sets email addresses when managing members in `MembersPanel`.

**For self-hosted deployments without email (no `RESEND_API_KEY`):** fall back to CFO-resets-for-others (current behaviour). The CFO of each household is responsible for resetting passwords for members who can't receive email.

#### TOTP second factor (2FA)

Add an optional TOTP (time-based one-time password) second factor. No external service — entirely self-contained via `otplib`.

- `User.totpSecret String?` — base32-encoded TOTP secret, `null` if 2FA not enrolled
- `/settings/security` page: QR code to enrol in any authenticator app (Google Authenticator, Authy, 1Password)
- Login flow: after password, check `totpSecret`; if set, redirect to a 6-digit code prompt
- Recovery codes: generate 8 single-use codes at enrolment time, stored hashed

#### Google SSO — architecture and trade-offs

**Short answer:** yes, Google SSO can be integrated, but the self-hosted and managed-SaaS tiers require different approaches, and there's a meaningful trade-off against data sovereignty.

**Self-hosted tier (Tier 1/2):**
Each self-hosted instance needs its own Google OAuth client. The user (not Jorge) registers a project in Google Cloud Console, creates OAuth credentials, and supplies them as env vars:

```yaml
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
NEXTAUTH_URL=https://proviso.yourdomain.com
NEXTAUTH_SECRET=<random-32-bytes>
```

The Proviso app would use **Auth.js (NextAuth v5)** to handle the OAuth flow. This replaces the current `lib/auth.ts` with Auth.js adapters.

**Friction:** registering a Google Cloud project requires a non-technical user to navigate Google's developer console and set OAuth redirect URIs. This is a significant barrier for the target Tier 1 user (non-technical, just wants Docker on a Mac). Passkeys are a better answer for self-hosted (see below).

**Managed SaaS tier (Tier 3):**
Jorge registers one Google OAuth client for `proviso.app`. All managed-SaaS users authenticate via that one client. Standard SaaS pattern — easy to implement with Auth.js.

**Data sovereignty note:** Google SSO authenticates identity but does not touch financial data. Google learns that a specific email address logged into Proviso at a specific time — nothing else. For users who are privacy-conscious, offer username/password as an always-available alternative.

#### Passkeys (WebAuthn) — the self-hosted-friendly alternative

Passkeys are hardware-backed credentials stored on the device (Face ID, Touch ID, Windows Hello, hardware security key). They are:

- **No external service dependency** — perfect for self-hosted
- **Phishing-resistant** — no password to steal, credential is device-bound
- **Cross-device** — synced via iCloud Keychain or Google Password Manager (user's choice, not Proviso's)
- **Browser-native** — Chrome, Safari, Firefox all support WebAuthn

Implementation path: Auth.js v5 has experimental WebAuthn support. Alternatively, `@simplewebauthn/server` + `@simplewebauthn/browser` is the lower-level library used by many production apps.

**Recommendation for Proviso's auth roadmap:**

| Priority | Feature | Notes |
|---|---|---|
| 1 | Self-service password reset (email) | Unblocks non-CFO users; needs Resend + `User.email` field |
| 2 | Rate limiting + account lockout | Security baseline before public beta |
| 3 | TOTP 2FA (optional, user-enrolled) | Self-contained, no external dep |
| 4 | Passkeys (WebAuthn) | Best long-term for self-hosted |
| 5 | Google/Apple SSO | Managed SaaS tier only; not the right fit for self-hosted |

#### Data sovereignty commitment

This is a founding principle and must be reflected in both technical architecture and user-facing communication:

**What Jorge can never access (self-hosted tier):**
- Any user's financial data — it lives exclusively on their own machine/cloud storage
- Their DB file — there is no telemetry, no analytics beacon, no "phone home"
- Their usage patterns — no tracking, no session recording

**What Jorge can access (managed SaaS tier — to be designed):**
- Infrastructure health metrics (response times, error rates) — no user data
- Aggregate anonymised stats (e.g. "X% of deployments are on v2") — only if users explicitly opt in
- No individual household data under any circumstances — technical and contractual guarantee

**Technical enforcement for managed SaaS:**
- Each household's data in an isolated DB or schema
- Admin tools must not expose raw user data — only metadata (creation date, schema version, storage size)
- Any admin action on a user's DB (e.g. for support) must require user-initiated token + be logged in the audit trail

#### Files to create/modify when building Phase 9

- `prisma/schema.prisma` — `User.email`, `PasswordReset`, `User.totpSecret`, `User.totpRecoveryCodes`, `AuditLog`
- `lib/auth.ts` — extend or replace with Auth.js v5 if SSO is added; keep scrypt path as fallback
- `app/(auth)/reset-password/` — new route
- `app/(auth)/login/` — add "Forgot password?" link, TOTP prompt
- `components/settings/SecurityPanel.tsx` — 2FA enrolment, password change
- `lib/rbac.ts` — new scope `auth:manage` for CFO managing member emails + reset codes

---

### Explicitly deprioritised

- Auto utility switching / bill negotiation — requires commercial partnerships
- One-click subscription cancellation — not feasible in AU without deep integrations
- NPV calculator for appliances (solar, EVs) — interesting but Phase 3 at earliest
- App Store optimisation — irrelevant until a native mobile wrapper exists
