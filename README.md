# Proviso

> Most apps tell you what you spent yesterday. Proviso models what you will be worth tomorrow.

A self-hosted personal finance dashboard for Australian households — budget, cashflow, debts & assets, 20-year projections, superannuation, EOFY tax planning, and CGT-aware investments. Built for the household CFO: wealth building, tax efficiency, and retirement planning, not day-to-day expense tracking.

Your data never leaves your own hardware. Proviso runs on your box (e.g. Unraid) and is reachable privately over Tailscale.

## Stack

- **Next.js 16** (App Router) + React, TypeScript
- **SQLite** via **Prisma 5**
- Self-hosted auth (scrypt + DB-backed sessions), household RBAC (CFO / Partner)
- Chart.js for visualisations

## Development

```bash
npm install
npx prisma migrate deploy   # apply schema to a local SQLite db
npm run dev                 # http://localhost:3000
```

Set `DATABASE_URL` (e.g. `file:./prisma/dev.db`) in `.env` for local work.

## Deployment (Docker)

```bash
docker compose up -d --build
```

This builds the standalone image and starts the `proviso` container on port 3000, backed by the named volume `proviso-db` (SQLite at `/data/proviso.db`). On first run the entrypoint applies migrations and seeds; on later starts it only applies new migrations.

Behind HTTPS (e.g. Tailscale Serve) set `COOKIE_SECURE=true` so session cookies carry the `Secure` flag. Over a plain-http tailnet address leave it unset.

First visit creates the initial **CFO** account at `/setup`; thereafter the app requires login.

## Tabs

Budget · Actuals · Debts & Assets · Cashflow · Projections · Super · Investments — plus a seasonal EOFY view (May/June). See `CLAUDE.md` for architecture and engine details.
