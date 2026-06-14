#!/bin/sh
# Intentionally NOT using `set -e`.
#
# A failed `prisma migrate deploy` must never crash-loop the container. A
# reachable app — even one with a stale or inconsistent schema — is far easier
# to diagnose and recover than ERR_CONNECTION_REFUSED with no way in. (See the
# 2026-06-13 incident: a single failed migration record, P3009, wedged every
# boot.) So we attempt migrations, warn loudly on failure, and start anyway.
# The app's error boundaries surface DB problems in the UI.

DB_PATH="/data/proviso.db"

# Back up the database before every migration run.
# Keeps the 3 most recent backups in the same volume so data survives container replacement.
# To restore: docker exec proviso cp /data/proviso.YYYYMMDD_HHMMSS.bak /data/proviso.db && docker restart proviso
backup_db() {
  if [ -f "$DB_PATH" ]; then
    BACKUP="${DB_PATH%.db}.$(date +%Y%m%d_%H%M%S).bak"
    cp "$DB_PATH" "$BACKUP"
    echo "[entrypoint] Database backed up to $BACKUP"
    # Rotate — keep only the 3 most recent backups
    ls -t "${DB_PATH%.db}".*.bak 2>/dev/null | tail -n +4 | xargs rm -f 2>/dev/null || true
  fi
}

run_migrations() {
  echo "[entrypoint] Running migrations (prisma migrate deploy)..."
  if npx prisma migrate deploy; then
    echo "[entrypoint] Migrations applied."
    return 0
  fi
  echo "[entrypoint] =============================================================="
  echo "[entrypoint] ⚠  WARNING: prisma migrate deploy FAILED."
  echo "[entrypoint]    Starting the app anyway so it stays reachable."
  echo "[entrypoint]    Pages that need a missing table may error until resolved."
  echo "[entrypoint]"
  echo "[entrypoint]    Common cause: a failed/inconsistent migration history (P3009)."
  echo "[entrypoint]    Inspect:  docker exec <container> npx prisma migrate status"
  echo "[entrypoint]    Resolve:  docker exec <container> npx prisma migrate resolve --applied <name>"
  echo "[entrypoint] =============================================================="
  return 1
}

if [ ! -f "$DB_PATH" ]; then
  echo "[entrypoint] No database at $DB_PATH — first run."
  if run_migrations; then
    echo "[entrypoint] Seeding initial data..."
    if npx prisma db seed; then
      echo "[entrypoint] Database seeded."
    else
      echo "[entrypoint] ⚠  WARNING: seed failed — continuing without seed data."
    fi
  else
    echo "[entrypoint] ⚠  Skipping seed because migrations did not complete."
  fi
else
  echo "[entrypoint] Database exists at $DB_PATH."
  backup_db
  run_migrations || true
fi

echo "[entrypoint] Starting Next.js..."
exec node server.js
