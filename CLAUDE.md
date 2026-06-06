@AGENTS.md

# Household Dashboard

Person1 & Person2 personal finance dashboard. Next.js 16 app, SQLite via Prisma 5, deployed on Unraid via Tailscale.

## Status: all tabs live

| Tab            | Status    | Route           |
|----------------|-----------|-----------------|
| Budget         | ✅ Done   | `/budget`       |
| Debts & Assets | ✅ Done   | `/debts`        |
| Cashflow       | ✅ Done   | `/cashflow`     |
| Projections    | ✅ Done   | `/projections`  |
| Actuals        | ✅ Done   | `/actuals`      |
| Super          | ✅ Done   | `/super`        |

## Key architecture decisions

- **Prisma 5** (pinned — Prisma 7 broke `url = env(...)`, requires `prisma.config.ts`)
- **Next.js 16 params**: dynamic route handlers use `await params` — `params` is `Promise<{ id: string }>`
- **`@/*` alias** maps to `./` (project root), not `./src/`
- **Server vs client**: server components fetch from Prisma directly; `'use client'` for anything interactive or using Chart.js
- **Optimistic updates**: all CRUD hits state first, then API — no loading spinners
- **Tax engine** (`lib/tax.ts`): ATO 2024–25 Stage 3 brackets, LITO, Medicare, HELP repayments
- **Projection engine** (`lib/projections.ts`): 20-year dual simulation (with/without school fees), stepped inflation, monthly mortgage loop with live offset
- **Super engine** (`lib/super.ts`): per-person `runSuperProjection` + household `runHouseholdProjection`; accumulation (15%/30% tax) → drawdown (tax-free pension phase); concessional cap indexed to AWOTE; Div 293 at $250k

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
- `SuperSettings` — Person1's balance/retirement age/extra contribs + partner fields (Person2) + shared assumptions
- `IncomeSettings` — extended with `jorgeAge` and `graceAge` (used by super engine; not duplicated in SuperSettings)
- Salary and salary growth come from `IncomeSettings.jorgeFTE` / `graceFTE` and `ProjectionSettings.jorgeGrowth` / `graceGrowth` (read-only in Super tab, editable in Budget/Projections)

**Engine (`lib/super.ts`):**
- `runSuperProjection(SuperInputs)` — per-person engine; accumulation phase (earnings tax 15%, contribution tax 15%/30% Div293, concessional cap indexed to AWOTE ~3.5%); drawdown (pension phase, earnings tax-free)
- `runHouseholdProjection(HouseholdSuperInputs, ProjectionContext)` — runs both people, splits `desiredRetirementIncome / 2` per person, year-aligns `CombinedRow[]`, finds combined depletion age

**Retirement income goal** pre-populates from current Budget annual spend (rounded to $1k) if the DB still has the schema placeholder. "Reset to budget ↺" link snaps it back.

**Mortgage hint** — if `MortgageSettings.endDate` is before Person1's retirement year, shows amber hint with annual saving and one-click "Apply" to reduce the income target.

**Migrations:**
- `0002_super` — creates `SuperSettings` table
- `0003_super_partner` — adds `partnerEnabled/Balance/RetirementAge/AdditionalContribs` to `SuperSettings`; adds `jorgeAge`/`graceAge` to `IncomeSettings`

When DB already has columns from a prior `db push`, baseline with:
```sh
npx prisma migrate resolve --applied 0003_super_partner
```

## Budget tab income panel — updated 2026-06-06

`IncomePanel` (taxMode ON) now shows a per-person breakdown card for Person2 and Person1:
- Inline breakdown: income tax, Medicare levy, HELP repayment (Person2), Super SG at 12%, net take-home (yearly + monthly)
- **Income bracket bar** — 5-segment colour-coded bar (Nil/16%/30%/37%/45%) showing ATO bracket position; segments grey out above the person's income
- Effective rate and marginal rate footnote
- Old separate `TaxBreakdown` section removed; everything is now per-person and inline

## Remaining

1. **Deploy via Tailscale** — `git clone` on Unraid, then `docker compose up -d --build`

---

## Commercial roadmap (priority order)

The app's founding differentiator is **self-hosting** — data never leaves the user's house. No AU competitor (Frollo, Pocketbook, YNAB) can offer this without destroying their own business model. Every phase below reinforces this, not dilutes it.

### Phase 2 — AU tax & super tooling (highest ROI, foundation already exists)

The HELP repayment engine in `lib/tax.ts` is a starting point. Extend with:

- **HELP/HECS indexing alert** — CPI indexation hits 1 June every year. Surface a prompt in May showing the projected indexation amount and how much a voluntary repayment would save. Most AU apps ignore this entirely.
- **Super concessional cap tracker** — show used vs. remaining cap ($30k/yr as of FY25), carry-forward unused caps (up to 5 prior years if balance < $500k), and an EOFY countdown. No mass-market AU app does this well.
- **EOFY dashboard** — a dedicated June view: HELP voluntary payment window, super top-up deadline, income splitting opportunities. Seasonally relevant, high engagement.

Explicitly out of scope: negative gearing calculators, investment property tools — these serve investors, not households.

### Phase 3 — CDR / Open Banking bank feeds

Australia's Consumer Data Right mandates banks expose transaction data via accredited APIs. This is the legitimate replacement for the current CSV import — no scraping, no US intermediaries like Plaid.

- Research CDR accreditation requirements (ACCC process)
- Replace `parseCsvText()` in `lib/actuals.ts` with a CDR feed adapter behind the same interface
- CSV import stays as fallback for non-CDR institutions

Subscription detection from transaction history (flagging recurring charges, price increases) is a useful by-product of having structured transaction data — build this on top of the CDR feed, not before it.

### Phase 4 — Household RBAC (family tenant model)

Build for a household as a unit, not an individual with sharing bolted on:

- **Tenant model** — single household has multiple users with roles
- **CFO role** — full read/write across all tabs
- **Partner role** — read + actuals import, no budget editing
- **Child role** — restricted view, gamified pocket money tracker (stretch)

This is architecturally significant (auth, multi-tenancy, row-level scoping) — do it after the data model is stable.

### Explicitly deprioritised

- Auto utility switching / bill negotiation — requires commercial partnerships, not buildable independently
- One-click subscription cancellation — not feasible in AU without deep integrations
