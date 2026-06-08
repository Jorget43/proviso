#!/bin/sh
set -e

DB_PATH="/data/proviso.db"

# First-run: apply schema and seed
if [ ! -f "$DB_PATH" ]; then
  echo "[entrypoint] Creating database at $DB_PATH..."
  npx prisma migrate deploy
  npx prisma db seed
  echo "[entrypoint] Database seeded."
else
  # On subsequent starts, still run migrate deploy in case schema changed
  echo "[entrypoint] Database exists — running migrations..."
  npx prisma migrate deploy
fi

echo "[entrypoint] Starting Next.js..."
exec node server.js
