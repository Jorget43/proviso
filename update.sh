#!/bin/sh
# Scheduled auto-update for the proviso container. Run this on a schedule
# (cron / systemd timer / Unraid User Scripts) instead of relying on
# Watchtower's default polling.
#
# Why not Watchtower: it checks for updates with an anonymous HEAD request,
# and GHCR returns 403 Forbidden on that specific request even for a fully
# public image (GET works fine — proven by the `docker compose pull` below).
# Watchtower then fails silently: no error surfaces anywhere except its own
# debug logs, so an auto-updater can stop working for months with nobody
# noticing. See README.md "Updates" for the full story and the Watchtower+PAT
# alternative if you want event-driven updates instead of scheduled ones.
#
# This script has no such failure mode: `docker compose pull` is a plain
# anonymous pull (always works against a public image), and `docker compose
# up -d` only recreates the container if the pulled image actually changed —
# so an unchanged night is a silent no-op, not a restart.
set -eu

cd "$(dirname "$0")"

echo "[$(date -Is)] Checking for a new proviso image..."
docker compose pull proviso
docker compose up -d proviso
echo "[$(date -Is)] Done."
