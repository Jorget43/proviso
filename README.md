# Proviso

> Most apps tell you what you spent yesterday. Proviso models what you will be worth tomorrow.

A self-hosted personal finance dashboard for Australian households — budget, cashflow, debts & assets, long-term projections, superannuation, EOFY tax planning, and CGT-aware investments. Built for the household CFO: wealth building, tax efficiency, and retirement planning, not day-to-day expense tracking.

Your data never leaves your own hardware. Proviso runs on your box (e.g. Unraid) and is reachable privately over Tailscale.

## Stack

- **Next.js 16** (App Router) + React, TypeScript
- **SQLite** via **Prisma 5**
- Self-hosted auth (scrypt + DB-backed sessions), household RBAC (CFO / Partner)
- Chart.js for visualisations

## Development

The repo is an npm workspace (see [`docs/architecture.md`](docs/architecture.md)): `apps/web` is the Next.js app, `packages/core` holds the calculations and data rules.

```bash
npm install                 # from the repo root — installs and links every workspace
npx prisma migrate deploy   # apply the schema (apps/web/prisma) to a local SQLite db
npm run dev                 # http://localhost:3000
npm test                    # tests for every workspace
npm run typecheck
```

Set `DATABASE_URL` (e.g. `file:./dev.db`, relative to `apps/web/prisma/`) in `apps/web/.env` for local work — Next.js reads `.env` from the app's own folder.

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

Behind HTTPS (e.g. Tailscale Serve) set `COOKIE_SECURE=true` so session cookies carry the `Secure` flag and browsers get an HSTS header (remember HTTPS for this host for a year). Over a plain-http tailnet address leave it unset.

### Protecting the data on disk

Everything Proviso knows lives in one SQLite file, `/data/proviso.db`, in the `proviso-db` volume, alongside the three automatic `.bak` copies the container makes before each upgrade. Passwords and sign-in tokens in it are hashed, so the file can't be used to log in, but the household figures (budget, balances, transactions) are stored as plain data.

Proviso doesn't encrypt the file itself. Protect it where it's stored instead: that covers the backups too, and a key kept in the app's own settings would sit on the same machine as the data anyway.

- **Unraid**: put the disk or pool that holds Docker's data (usually the cache pool with `appdata` and the Docker image) on an encrypted file system — *XFS - encrypted* or *BTRFS - encrypted*. Changing a disk's file system erases it, so move its data off first. Unraid then asks for the passphrase or keyfile each time the array starts. Keep that passphrase somewhere safe: without it the data can't be recovered.
- **Other Linux hosts**: keep the Docker volume on a LUKS-encrypted disk or partition.
- **Synology / QNAP**: use the NAS's encrypted volume or encrypted shared-folder feature for the folder holding the volume.
- **Copies that leave the NAS** (cloud sync, USB drives): encrypt them, e.g. with an encrypting backup tool such as restic or an encrypted archive.

## What's inside

Built for phones first (Add to Home Screen opens it like an app), with the same layout on desktop:

- **Home** — what's left over each month, things worth a look, where you stand, bills coming up
- **Spending** — Budget · Actual spending (bank/card statement import)
- **Wealth** — Own & owe · Super · Investments
- **Future** — Long term (projections with "What if?") · Next 2 years (cashflow)

Plus a seasonal EOFY view (May/June) and Settings, where "Your situation" switches on renting, childcare, school fees and parental leave. See `CLAUDE.md` for architecture and engine details.
