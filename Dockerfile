# ── Stage 1: deps ──────────────────────────────────────────────────────────
# Workspace repo (docs/architecture.md, D7): install from the root lockfile,
# with each workspace's package.json in place so npm links them.
FROM node:24-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/web/package.json        apps/web/
COPY apps/client/package.json     apps/client/
COPY packages/core/package.json   packages/core/
COPY packages/tokens/package.json packages/tokens/
COPY packages/sync/package.json   packages/sync/
COPY apps/relay/package.json      apps/relay/
RUN npm ci

# ── Stage 2: build ─────────────────────────────────────────────────────────
FROM node:24-bookworm-slim AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Prisma's query engine needs OpenSSL to load. Nothing should query the DB at
# build time (lib/db.ts sets its pragma lazily), but if anything ever does,
# this keeps it a logged error instead of a failed build.
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

RUN npx prisma generate --schema apps/web/prisma/schema.prisma

ENV DATABASE_URL="file:/data/proviso.db"
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# ── Stage 3: prune ─────────────────────────────────────────────────────────
# Strip devDependencies (vitest/vite/esbuild, typescript, eslint, tailwind,
# @types/*) so they never reach the runtime image. This prunes the builder's
# tree in place rather than doing a fresh `npm ci --omit=dev`, because the
# Prisma client generated above lives in node_modules/.prisma and a clean
# install would not contain it. npm leaves dot-directories alone, so .prisma
# and .bin survive the prune.
FROM builder AS pruner
# This image serves the web app only. Dropping the phone app's and the
# relay's workspaces (apps/client, packages/tokens, packages/sync, apps/relay;
# the relay has its own image, apps/relay/Dockerfile) first makes Expo / React Native extraneous,
# so the prune removes them too — about 550 MB the server never uses. The
# first prune keeps packages the app's tree had marked "dev or optional"
# (e.g. micromatch); the second, reading the lockfile the first rewrote,
# removes them. CI's audit step prunes the same way.
RUN rm -rf apps/client packages/tokens packages/sync apps/relay \
 && npm pkg set --json workspaces='["apps/web","packages/core"]' \
 && npm prune --omit=dev \
 && npm prune --omit=dev

# ── Stage 4: runner ────────────────────────────────────────────────────────
FROM node:24-bookworm-slim AS runner
WORKDIR /app

RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV DATABASE_URL="file:/data/proviso.db"

# Bake the release tag and build date in at build time
ARG PROVISO_VERSION=dev
ENV PROVISO_VERSION=$PROVISO_VERSION
ARG BUILD_DATE=unknown
ENV BUILD_DATE=$BUILD_DATE

# Standalone Next.js server (includes a trimmed node_modules subset). In a
# workspace build the server lives at apps/web/server.js; packages/core is
# compiled into its chunks, so it isn't needed at runtime.
COPY --from=builder /app/apps/web/.next/standalone   ./
COPY --from=builder /app/apps/web/.next/static       ./apps/web/.next/static
COPY --from=builder /app/apps/web/public             ./apps/web/public

# Production node_modules copied AFTER standalone so the prisma CLI, tsx, and
# their deps overwrite the standalone's trimmed subset. Both are runtime deps
# here: docker-entrypoint.sh runs `prisma migrate deploy` on every start and
# `prisma db seed` (tsx prisma/seed.ts) on first run.
COPY --from=pruner /app/node_modules                ./node_modules
COPY --from=builder /app/apps/web/prisma            ./apps/web/prisma
COPY --from=builder /app/apps/web/package.json      ./apps/web/package.json
COPY --from=builder /app/apps/web/tsconfig.json     ./apps/web/tsconfig.json

# The entrypoint runs from the web app's folder and calls the installed
# prisma / tsx binaries directly (never npx, which could try to download).
WORKDIR /app/apps/web
ENV PATH="/app/node_modules/.bin:$PATH"

COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN sed -i 's/\r//' /docker-entrypoint.sh && chmod +x /docker-entrypoint.sh

EXPOSE 3000
ENTRYPOINT ["/docker-entrypoint.sh"]
