@AGENTS.md

# Household Dashboard — Phase 1 Progress

Jorge & Grace personal finance dashboard. Next.js 16 app, SQLite via Prisma 5, deployed on Unraid via Tailscale.

## Status: 4 of 5 tabs complete

| Tab          | Status    | Route           |
|-------------|-----------|-----------------|
| Budget       | ✅ Done   | `/budget`       |
| Debts & Assets | ✅ Done | `/debts`        |
| Cashflow     | ✅ Done   | `/cashflow`     |
| Projections  | ✅ Done   | `/projections`  |
| Actuals      | ✅ Done   | `/actuals`      |

## Key architecture decisions

- **Prisma 5** (pinned — Prisma 7 broke `url = env(...)`, requires `prisma.config.ts`)
- **Next.js 16 params**: dynamic route handlers use `await params` — `params` is `Promise<{ id: string }>`
- **`@/*` alias** maps to `./` (project root), not `./src/`
- **Server vs client**: server components fetch from Prisma directly; `'use client'` for anything interactive or using Chart.js
- **Optimistic updates**: all CRUD hits state first, then API — no loading spinners
- **Tax engine** (`lib/tax.ts`): ATO 2024–25 Stage 3 brackets, LITO, Medicare, HELP repayments
- **Projection engine** (`lib/projections.ts`): 20-year dual simulation (with/without school fees), stepped inflation, monthly mortgage loop with live offset

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

Singleton endpoints (id=1): `/api/income-settings`, `/api/mortgage-settings`, `/api/projection-settings`

CRUD endpoints: `/api/expenses/[id]`, `/api/debts/[id]`, `/api/assets/[id]`, `/api/grace-phases/[id]`, `/api/one-offs/[id]`, `/api/life-phases/[id]`

## Design system (`app/globals.css`)

CSS vars: `--bg`, `--surface`, `--surface2`, `--border`, `--border-md`, `--t1/t2/t3`, `--blue/green/red/amber/purple/pink/teal` (each with `-lt` variant), `--r`, `--rl`

Key classes: `.page`, `.banner` + `.b-item/.b-label/.b-value`, `.metrics`, `.mc`, `.panel` + `.panel-head/.panel-body`, `.two-col`, `.sidebar-layout`, `.da-grid/.da-row/.da-input`, `.pill` + color variants, `.toggle-switch/.toggle-slider`, `.slider-group/.slider-label`, `.tl-table`, `.add-btn`, `.del-btn`, `.input-prefix`, `.chart-wrap`

## Remaining (Phase 1)

1. **Docker + docker-compose** — self-hosted on Unraid
2. **Deploy via Tailscale** — mobile access for Jorge & Grace
