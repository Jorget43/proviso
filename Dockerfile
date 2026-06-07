# ── Stage 1: deps ──────────────────────────────────────────────────────────
FROM node:20-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# ── Stage 2: build ─────────────────────────────────────────────────────────
FROM node:20-slim AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

RUN npx prisma generate

ENV DATABASE_URL="file:/data/household.db"
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# ── Stage 3: runner ────────────────────────────────────────────────────────
FROM node:20-slim AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV DATABASE_URL="file:/data/household.db"

# Standalone Next.js server (includes a trimmed node_modules subset)
COPY --from=builder /app/.next/standalone            ./
COPY --from=builder /app/.next/static                ./.next/static
COPY --from=builder /app/public                      ./public

# Full node_modules copied AFTER standalone so prisma CLI, tsx, and
# their deps overwrite the standalone's trimmed subset
COPY --from=builder /app/node_modules               ./node_modules
COPY --from=builder /app/prisma                     ./prisma
COPY --from=builder /app/package.json               ./package.json
COPY --from=builder /app/tsconfig.json              ./tsconfig.json

COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN sed -i 's/\r//' /docker-entrypoint.sh && chmod +x /docker-entrypoint.sh

EXPOSE 3000
ENTRYPOINT ["/docker-entrypoint.sh"]
