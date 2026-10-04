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
  -v proviso-db:/data \
  -p 3000:3000 \
  ghcr.io/jorget43/proviso:latest
```

Or use the `docker-compose.yml` in this repo — `docker compose up -d` (no build needed, it pulls the image by default).

First visit creates the initial **CFO** account at `/setup`; thereafter the app requires login.

## Updates

Run `./update.sh` on a schedule instead of a Watchtower sidecar. It's two lines — `docker compose pull proviso && docker compose up -d proviso` — and `up -d` only recreates the container when the image actually changed, so a no-op night is silent, not a restart.

We tried Watchtower first and don't recommend it here: it checks for updates with an anonymous `HEAD` request, and GHCR returns `403 Forbidden` on that specific request even for a fully public image (`GET` works fine — that's exactly what `docker compose pull` uses). Watchtower then fails silently, with nothing surfaced except its own debug logs — this ran undetected for two months on our own deployment before anyone noticed the version banner was stale. `update.sh` doesn't hit that code path at all, so it has no equivalent failure mode, and it needs no registry credentials.

Schedule it however your platform prefers:

```cron
# crontab -e — 3am daily
0 3 * * * /path/to/proviso/update.sh >> /var/log/proviso-update.log 2>&1
```

**Unraid**: install the *User Scripts* plugin (Community Applications), add a new script pointing at `update.sh`, set its schedule to daily.

**systemd**: a timer unit calling `update.sh` works too if you'd rather not use cron.

### Advanced: instant updates via Watchtower

If you'd rather have updates land the moment they're published instead of on a schedule, and don't mind managing a credential:

```bash
docker login ghcr.io -u <your-github-username> -p <PAT-with-read:packages-scope>   # once, on the host
docker compose -f docker-compose.yml -f docker-compose.watchtower.yml up -d
```

The PAT isn't for *access* — the image is already public — it's a workaround for GHCR rejecting Watchtower's anonymous HEAD check specifically; an authenticated request doesn't hit the same wall. See `docker-compose.watchtower.yml` for details. If you ever suspect it's not working, `docker logs watchtower` will show `auth: "not present"` / `403 Forbidden` on every failed check.

## Deployment (Docker — build from source)

```bash
docker compose up -d --build
```

This builds the standalone image locally and starts the `proviso` container on port 3000, backed by the named volume `proviso-db` (SQLite at `/data/proviso.db`). On first run the entrypoint applies migrations and seeds; on later starts it only applies new migrations.

Behind HTTPS (e.g. Tailscale Serve) set `COOKIE_SECURE=true` so session cookies carry the `Secure` flag. Over a plain-http tailnet address leave it unset.

## Tabs

Budget · Actuals · Debts & Assets · Cashflow · Projections · Super · Investments — plus a seasonal EOFY view (May/June). See `CLAUDE.md` for architecture and engine details.
