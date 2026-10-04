# Phase 4 — Household RBAC: Implementation Plan

**Planned 2026-06-08.** Locked decisions: minimal self-hosted auth, RBAC for a single household per deployment, Child role deferred.

## Starting state
- **No auth** — no `middleware.ts`, no auth dependencies.
- **20 Prisma models, all global** — settings are `id=1` singletons; no `userId`/`householdId` anywhere.
- **32 API route files**; existing onboarding gated on `HouseholdSettings.onboardingDone`.

## Scope (locked)
RBAC for **one household per deployment** — not full multi-tenancy. Tenant = the whole DB. Add users + roles + enforcement; **defer** `householdId`-on-every-model scoping (future SaaS concern). Schema designed so `householdId` can be layered later.

## Role → permission matrix
| Capability | CFO | Partner | Child (deferred) |
|---|:--:|:--:|:--:|
| Read all tabs | ✅ | ✅ | Restricted subset |
| Edit Budget / Debts / Super / Projections / Settings | ✅ | ✗ | ✗ |
| Actuals: CSV import + categorise | ✅ | ✅ | ✗ |
| User management (invite, roles, reset pw) | ✅ | ✗ | ✗ |
| Pocket-money tracker | ✅ | ✅ | ✅ (own) |

## Auth approach (locked: minimal, self-host-friendly)
- Password hashing via **`node:crypto` scrypt** (zero deps — avoids native `bcrypt` build pain in the standalone Alpine Docker image).
- **Signed httpOnly session cookie** (`jose`), validated against a server-side `Session` table (enables logout/revoke).
- **`middleware.ts`** redirects unauthenticated → `/login`; role-gates pages.
- Read the Next.js 16 middleware/cookies docs in `node_modules/next/dist/docs/` before writing (APIs may differ from training — per AGENTS.md).

## Data model (4.0) — migration `0011_auth`
```prisma
model User {
  id           Int      @id @default(autoincrement())
  name         String
  username     String   @unique
  passwordHash String
  role         String   // CFO | PARTNER | CHILD
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
  sessions     Session[]
}
model Session {
  id        Int      @id @default(autoincrement())
  userId    Int
  token     String   @unique
  expiresAt DateTime
  createdAt DateTime @default(now())
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
}
```
Existing 20 models stay global in this phase.

## Enforcement (security-critical)
- Central **`lib/rbac.ts`**: `can(role, action)` matrix + `requireRole()` guard.
- **Every mutating API route (POST/PUT/DELETE across 32 files) calls the guard** — main risk is missing one. Mitigation: one consistent wrapper helper + a checklist applied uniformly.
- Server components read the session for role-aware rendering (hide/disable edit controls for non-CFO).

## First-run / migration
- Extend onboarding: first run creates the **CFO** (name + password).
- Existing deployments (`onboardingDone=true`, zero users) get a one-time "create your login" setup on next start. Optionally pre-create a Partner from `person2Name`.

## Build order (each step shippable)
- **4.0** Auth foundation — User/Session + migration, scrypt hashing, login/logout, cookie, middleware, "create first CFO." (Everyone logged-in acts as CFO; no gating yet.)
- **4.1** RBAC enforcement — `lib/rbac`, guard all mutating routes, role-gated UI, Partner role (read + actuals import).
- **4.2** User management UI in Settings — CFO creates Partner, assigns roles, resets passwords.
- **4.3** (deferred) Child role + pocket-money tracker.

## Deployment interaction
Session cookies want the `Secure` flag (needs HTTPS). `http://nas:3000` won't set Secure cookies — so this dovetails with **Tailscale Serve (HTTPS)**. Over plain HTTP, relax `Secure` for the LAN.

## Risks
- 32 routes to guard consistently (security surface) — enforce via a single wrapper + checklist.
- Next.js 16 modified middleware/cookie APIs — read bundled docs first.
- Auth adds login friction to a previously open app — intended; first-run UX must be smooth.
