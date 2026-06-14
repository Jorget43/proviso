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

## Quick start (pre-built image)

No source code required. The latest image is published to GHCR on every push to `master`.

```bash
docker run -d \
  --name proviso \
  --restart unless-stopped \
  -v proviso-data:/data \
  -p 3000:3000 \
  ghcr.io/jorget43/proviso:latest
```

Or with Docker Compose — save this as `docker-compose.yml` and run `docker compose up -d`:

```yaml
services:
  proviso:
    image: ghcr.io/jorget43/proviso:latest
    container_name: proviso
    restart: unless-stopped
    labels:
      - "com.centurylinklabs.watchtower.enable=true"
    ports:
      - "3000:3000"
    volumes:
      - proviso-data:/data
    environment:
      - DATABASE_URL=file:/data/proviso.db
      - NODE_ENV=production
      # Optional — set COOKIE_SECURE=true when running behind HTTPS (e.g. Tailscale Serve)
      # - COOKIE_SECURE=true

  watchtower:
    image: containrrr/watchtower
    container_name: watchtower
    restart: unless-stopped
    environment:
      - TZ=Australia/Sydney   # change to your local timezone if needed
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
    command: --schedule "0 0 3 * * *" proviso   # 3 am daily

volumes:
  proviso-data:
```

Updates are automatic — Watchtower checks for a new image at 3 am and restarts Proviso in place. Users see a dismissible in-app banner on their next visit.

First visit creates the initial **CFO** account at `/setup`; thereafter the app requires login.

## Deployment (Docker — build from source)

```bash
docker compose up -d --build
```

This builds the standalone image locally and starts the `proviso` container on port 3000, backed by the named volume `proviso-db` (SQLite at `/data/proviso.db`). On first run the entrypoint applies migrations and seeds; on later starts it only applies new migrations.

Behind HTTPS (e.g. Tailscale Serve) set `COOKIE_SECURE=true` so session cookies carry the `Secure` flag. Over a plain-http tailnet address leave it unset.

## Tabs

Budget · Actuals · Debts & Assets · Cashflow · Projections · Super · Investments — plus a seasonal EOFY view (May/June). See `CLAUDE.md` for architecture and engine details.
