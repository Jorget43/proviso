# ── Stage 1: deps ──────────────────────────────────────────────────────────
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# ── Stage 2: build ─────────────────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Generate Prisma client for the target platform
RUN npx prisma generate

# Build the Next.js app in standalone output mode
ENV DATABASE_URL="file:/data/household.db"
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# ── Stage 3: runner ────────────────────────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app

RUN apk add --no-cache openssl

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV DATABASE_URL="file:/data/household.db"

# Full node_modules needed: prisma CLI, tsx (for seed), and all their deps
COPY --from=builder /app/node_modules               ./node_modules
COPY --from=builder /app/prisma                     ./prisma
COPY --from=builder /app/package.json               ./package.json

# Next.js standalone build (overlays its own trimmed node_modules on top)
COPY --from=builder /app/.next/standalone            ./
COPY --from=builder /app/.next/static                ./.next/static
COPY --from=builder /app/public                      ./public

# Entrypoint script — seeds DB on first run, then starts the server
COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN sed -i 's/\r//' /docker-entrypoint.sh && chmod +x /docker-entrypoint.sh

EXPOSE 3000
ENTRYPOINT ["/docker-entrypoint.sh"]
