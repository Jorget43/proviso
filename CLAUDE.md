@AGENTS.md

# Proviso

**Product name:** Proviso (formerly "Household Dashboard"). Repo directory stays `household-dashboard`.

**Positioning:** "Most apps tell you what you spent yesterday. Proviso models what you will be worth tomorrow."

Personal finance dashboard. Next.js 16 app, SQLite via Prisma 5, self-hosted via Docker. npm workspace repo since Phase 25.

> **Direction (agreed 2026-10-06): app first, local-first.** [`docs/architecture.md`](docs/architecture.md) is the target architecture: one Expo client (iOS, Android, web), data on each device (Drizzle + SQLite), end-to-end encrypted sync through a relay (hosted Proviso Sync or self-hosted). The Next.js app below is what runs today and is retired in stages. **Read that document before any structural change** — new code must move towards it, not away. Project skills in `.claude/skills/` (`proviso-architecture`, `-schema-change`, `-feature`, `-release`, `-ui`) are the working checklists.

## Repo layout (npm workspaces, Phase 25)

| Path | What |
|---|---|
| `apps/web` | The Next.js app: `app/`, `components/`, `lib/` (server, auth, UI helpers), `prisma/`, `proxy.ts`, its own tests. Package `@proviso/web`. |
| `apps/client` | The Expo app (iOS, Android, web) — Phase 27. `app/` routes (expo-router), `src/data/` (database, loaders, writes, views — plain TS, tested in Node against `node:sqlite`), `src/ui/` (token-styled kit). Package `@proviso/client`. Run on the web with `npm run web -w @proviso/client` (http://localhost:8080). |
| `packages/tokens` | Colours (light + dark), spacing, radii, type sizes for every client. Package `@proviso/tokens`. |
| `packages/core` | Calculations and data rules — tax, super, projections, HELP, CGT, childcare, school fees, budget summary, net worth, zod schemas, formatting, constants — with their tests. Package `@proviso/core`, imported as `@proviso/core/<module>`. **No React, Next, Prisma, Node or DOM** (its tsconfig has no DOM or Node types, so a slip fails the typecheck). |
| root | Workspace `package.json` (scripts fan out: `npm test`, `npm run typecheck`, `npm run lint`, `npm run dev`), `Dockerfile`, `docker-entrypoint.sh`, compose files, `update.sh`, `scripts/privacy-scan.mjs`, `.githooks/`, docs. |

Inside `apps/web`, `@/` still means the app's own folder (`@/lib/auth`, `@/components/...`). Core is consumed as TypeScript source (`transpilePackages`), so there's no build step for it. Phase entries below were written before the move; their paths have been updated to the new layout.


## ⚠️ Privacy rule — read before writing any code

**All code must be written for a generic end user, not for the developer's household.**

This repo is public. Never let any of the following into the codebase, comments, commit messages, or documentation:

- **Names** — real names of the developer or their household members. Use "Person 1 / Person 2", "the user", "the partner", "the operator", or "the developer" instead.
- **Financial figures** — specific salaries, balances, debt amounts, or any real numbers from the developer's own finances. Defaults in the schema are illustrative placeholders only; they must be realistic but not real.
- **Location** — suburb, city, street, or any address detail.
- **Any other PII** — email addresses, phone numbers, tax file numbers, account numbers.
- **Identifying details** — school names or school-specific fee schedules, employers, insurers/providers paired with real amounts, children's ages or school-start years, deployment specifics of the developer's own server.

**Practical rules:**
- Comments must describe behaviour, not the developer's situation ("Person 1 defaults to 5 days", never a real person's name).
- Seed data and default values must look like realistic placeholders, not copies of real household data.
- If you find a personal reference while working on something else, fix it in the same PR.
- The schema and migrations use generic `person1`/`person2` naming only. The original migration chain (which carried personal names and real figures) was squashed into `0001_baseline` and the git history rewritten in Phase 18 (2026-10-04). Don't reintroduce personal names or real figures in schema, code, sample/demo data, tests, commit messages or this file.

## 🔒 Privacy guardrails — HARD RULES, no exceptions

A leak into this public repo is permanent: git history, forks, Docker image layers on GHCR, and third-party archives all keep copies. Cleaning one up took a full history rewrite and a repo deletion (Phase 18). These rules are not style guidance — they are blocking.

### When writing anything that lands in the repo

Applies to code, comments, tests, fixtures, seed/demo/sample data, docs, CLAUDE.md, commit messages, tag messages, branch names, PR and issue text.

1. **Never copy a value from real data.** Not from the local SQLite DB, a bank statement, a payslip, the running app, a screenshot, or the private denylist. Invent placeholders instead.
2. **Placeholders must be obviously generic**: "Person 1 / Person 2", round figures (`500000`, `6.25`, `2500.00`), `example.com` emails, unbranded merchants ("GAS BILL", "INTERNET PLAN") with no suburb or store location, standard "Year 1–12" school naming, dates relative to the current year.
3. **No identifying combinations** even when each part looks harmless: provider + real amount, school type + fee level, child count + school-start years, employer, ages, suburb-tagged merchant names.
4. **Never commit data files**: `*.db`/`*.sqlite`, `*.bak`, `.env*` (except `.env.example`), CSV/OFX/QIF/XLSX exports, PDFs, `restore-*` scripts, or images outside `public/` / `apps/web/app/`.
5. **Test against scratch databases** (a fresh `migrate deploy` + seed in a temp directory), never the real one, so real values never show up in output that gets pasted into code or tests.
6. **Example values in comments count** — use neutral examples ("Alex", "1234"), never the household's own.

### Before every commit and push

1. **Hooks must be active**: `git config core.hooksPath` must print `.githooks`. The hooks run `scripts/privacy-scan.mjs`:
   - `pre-commit` — staged files, plus a check that `user.email` is the GitHub noreply address
   - `commit-msg` — the message
   - `pre-push` — every file of every outgoing commit, commit and tag messages, author/committer emails
2. **Never bypass**: no `--no-verify`, no `commit -n`, no changing or unsetting `core.hooksPath`. A blocked check means remove the data, not route around it.
3. **Read the full staged diff** (`git diff --cached`) before committing, and the outgoing range (`git log -p @{u}..` or the full tree on a first push) before pushing. The scanner only knows the patterns it's given — a human/agent read is still required.
4. **Fix before pushing, never after.** If something slipped into a local commit, rewrite the local commit (amend/rebase) before it's pushed. Pushing a fix on top leaves the leak in history.
5. **CI re-checks** every commit (`privacy` job in `.github/workflows/docker.yml`, generic patterns only) and the Docker build depends on it. It is a backstop, not the gate.

### The private denylist

`scripts/privacy-scan.mjs` and the editor hooks read a list of the developer's real names, places, contact details and figures from **outside the repo** — `../.proviso-private/denylist.txt` (or `$PROVISO_DENYLIST`). It is personal data itself, so it is never committed, copied into the repo, pasted into issues, or quoted in commit messages. The scanner refuses to run locally without it, and prints findings masked so a hit never appears verbatim in a log.

When a new personal fact appears (a child's name, a new address, employer, school, bank, account number), **add it to the denylist first**, then carry on.

### Setting up a new machine / fresh clone

```sh
git config core.hooksPath .githooks
git config user.email "<id>+<username>@users.noreply.github.com"
# create ../.proviso-private/denylist.txt (one term per line, # comments)
node scripts/privacy-scan.mjs --tree HEAD   # must print "clean"
```

### If something leaks anyway

Treat it as an incident: stop pushing, don't "fix forward". If it's only local, rewrite the commit. If it was pushed, follow the Phase 18 procedure — back up, rebuild history without it, delete and recreate the GitHub repo (force-push alone leaves old commits reachable by SHA), delete the affected GHCR image versions, then add the leaked term to the denylist.

## Status: all tabs live

Mobile-first since Phase 22: four destinations ("hubs", `apps/web/lib/navigation.ts`) shown as a bottom tab bar on phones and top tabs on desktop, with a segmented sub-nav inside each hub. Page URLs predate the hubs and are unchanged.

| Hub      | Section (sub-nav)  | Route           |
|----------|--------------------|-----------------|
| Home     | overview           | `/`             |
| Spending | Budget             | `/budget`       |
|          | Actual spending    | `/actuals`      |
| Wealth   | Own & owe          | `/debts`        |
|          | Super              | `/super`        |
|          | Investments        | `/investments`  |
| Future   | Long term          | `/projections`  |
|          | Next 2 years       | `/cashflow`     |
| (⚙)      | Settings           | `/settings`     |
| (seasonal) | EOFY             | `/eofy`         |

**The app (`apps/client`, Phases 27–30)** has the same four destinations as tabs, with Settings behind a gear: a setup questionnaire with typical costs, Home, Spending, Wealth, Future and Settings (recovery phrase, encrypted backups). Single device, no sync yet. Run it on a phone with Expo Go (`npm run start -w @proviso/client`, scan the QR code) or in a browser (`npm run web -w @proviso/client`). The NAS web app below is still the full product; "The app — next steps" in the Backlog lists what the app lacks.

EOFY is seasonal — surfaced via May/June `◷ EOFY` pill in `TopNav`, reachable year-round by URL. Situational sections (renting/buying, childcare, school fees, parental leave) appear only when switched on in Settings → Your situation (`apps/web/lib/situation.ts`).

## Key architecture decisions

- **Prisma 5** (pinned — Prisma 7 broke `url = env(...)`, requires `prisma.config.ts`)
- **Next.js 16 params**: dynamic route handlers use `await params` — `params` is `Promise<{ id: string }>`
- **Next.js 16 Proxy (was Middleware)**: `apps/web/proxy.ts` exporting `proxy` + `config.matcher`. `cookies()` is async (`await cookies()`). Optimistic auth gating; secure session validation is `requireSession()` in `apps/web/lib/auth.ts`
- **Auth**: self-hosted, zero external deps — `node:crypto` scrypt + opaque DB-backed session token in httpOnly cookie. Sessions end after 7 days idle or 30 days total. `COOKIE_SECURE=true` when behind HTTPS (also turns on HSTS)
- **`@/*` alias** maps to `./` (project root), not `./src/`
- **Server vs client**: server components fetch from Prisma directly; `'use client'` for anything interactive or using Chart.js
- **Optimistic updates**: all CRUD hits state first, then API — no loading spinners
- **Tax engine** (`packages/core/src/tax.ts`): FY2026-27 (`TAX_FY = 2027`) — resident brackets with the 15% bottom rate, LITO, Medicare levy with the single low-income shade-in, marginal HELP repayments (15c/17c bands, 10% of total income at the top). All figures are watchdog-tracked; update them together and bump `TAX_FY`. Applied flat across all projection years (not indexed). The 15% rate drops to 14% from 1 Jul 2027.
- **Projection engine** (`packages/core/src/projections.ts`): dual simulation over the user's horizon (5–40 years) (with/without school fees), stepped inflation, monthly mortgage loop with live offset; renter mode with compound rent growth and optional purchase plan (deposit from cash/investments with ~12% CGT haircut, then mortgage via `computeMonthlyRepayment`)
  - **Mortgage repayments are modelled, not budgeted**: `baseMonthlyExpenses` passed to the engine EXCLUDES the Budget's mortgage line(s) (`cat === 'Home'` and name matching /mortgage/i — `ProjectionsClient` subtracts `budgetMortgageMonthly` while a loan is modelled). `simulateMortgageYear` pays `mortPayment` out of cash each month, never inflated, and stops the month the loan clears (partial final payment); `annualPaid` is added back into reported `expArr`. Don't put repayments back into the inflating expense base — that was the "phantom mortgage after payoff" bug. If `mortPayment` is 0 the Budget line is used as the scheduled payment.
  - **HELP for both people**, from real balances on the Debts tab (`findHelpDebt`), indexed yearly, repayment capped at the residual, outstanding balance subtracted from net worth. Results: `person1HelpClearedYr` / `person2HelpClearedYr`.
  - **Net worth** each year = home equity + cash + investments + crypto − HELP − `otherDebts`. The starting investment balance is `investmentsValue` (shares and other non-offset assets, grown at the investment return); `otherDebts` (car loans etc.) are held flat. Both come from `computeCurrentNetWorth()`, so year 0 equals the net worth shown on Home and Own & owe.
  - **PPL** comes from `PPL_TOTAL` (`packages/core/src/constants.ts`, FY2026-27: 26 weeks × $1,004.70) and is taxed via `calcAfterTax`, indexed for later leave years. Watchdog entry `ppl-rate`.
- **Super engine** (`packages/core/src/super.ts`): per-person `runSuperProjection` + household `runHouseholdProjection`; accumulation (15%/30% tax) → drawdown (tax-free pension phase); Div 293 at $250k. Concessional cap comes from `packages/core/src/superHistory.ts`'s `legislativeCap()` (single source, see Phase 15) — `super.ts` does not maintain its own cap model. First-year cap can be topped up by `firstYearCapBonus` (carry-forward headroom, wired from `ConcessionalCarryForward` via `SuperClient`).
- **HELP indexation engine** (`packages/core/src/help.ts`): indexable base, 1-June countdown/window, marginal-rate equivalence
- **Carry-forward engine** (`packages/core/src/superHistory.ts`): `LEGISLATIVE_CONCESSIONAL_CAP` (legislated table, extrapolated beyond it via AWOTE ≈3.5%/yr floored to the nearest $2,500 — the ATO's published rounding rule) + 5-year concessional carry-forward gated on prior-year TSB < $500k
- **Inflation anchors — two kinds, do not conflate them**: `MODEL_BASE_YEAR` (`packages/core/src/constants.ts`, currently 2026) is a **data-vintage** anchor — the year `packages/core/src/schoolFees.ts`'s `SF_BASE` and the life-phase dollar figures (`packages/core/src/lifephases.ts`) are denominated in; inflation compounds *from* it regardless of the wall clock, so it must never be `new Date().getFullYear()`. `SuperInputs.startYear`/`startFyEnding` (`packages/core/src/super.ts`) are the opposite — a **run-start** anchor that genuinely is "now" and must be *injected* per call (optional params defaulting to the wall clock), not hardcoded, so it stays testable with `vi.setSystemTime`. Before Phase 15 these were conflated: `schoolFeesForYear` read the wall clock directly (numbers drifted every 1 January) and `super.ts`'s run-start year was captured at module load (untestable).
- **EOFY engine** (`packages/core/src/eofy.ts`): May/June season gate + salary-sacrifice / marginal-rate optimisation
- **CGT engine** (`packages/core/src/cgt.ts`): per-parcel cost base, 12-month 50% discount eligibility, estimated CGT at owner's marginal rate
- **Childcare engine** (`packages/core/src/childcare.ts`): FY2026-27 CCS (`CCS_PARAMS_FY`), standard and higher-rate income tests; syncs to the managed `Childcare` expense line
- **PDF import** (`apps/web/lib/pdfExtract.ts`, `packages/core/src/pdfStatement.ts`): client-side `pdf.js` — no data leaves the device
- **Net worth** (`packages/core/src/netWorth.ts`): the single definition — everything on Own & owe minus what's owed, the home counted once as equity (a "mortgage" debt row isn't subtracted on top of a house-equity asset), super excluded. `netPositionOf()` (live, Own & owe panel) and `computeCurrentNetWorth()` (Home, Projections' starting point and "today", monthly `NetWorthSnapshot`) share it, so every screen shows the same figure. Snapshots before `NET_WORTH_DEFINED_FROM` used an older, narrower scope.

## DB singleton

```ts
// lib/db.ts
import { PrismaClient } from '@prisma/client'
const globalForPrisma = globalThis as unknown as { prisma: PrismaClient }
export const prisma = globalForPrisma.prisma ?? new PrismaClient()
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
```

## API routes

All dynamic routes use `await params`:
```ts
export async function PUT(req, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  ...
}
```

Singleton endpoints (id=1): `/api/income-settings`, `/api/mortgage-settings`, `/api/projection-settings`, `/api/super-settings`, `/api/rent-settings`

CRUD endpoints (not exhaustive — check `apps/web/app/api/` for full list): `/api/expenses/[id]`, `/api/debts/[id]`, `/api/assets/[id]`, `/api/investments/[id]`, `/api/one-offs/[id]`, `/api/life-phases/[id]`, `/api/annual-expenses/[id]`, `/api/users/[id]`, `/api/pocket-money/[id]`, `/api/actuals/rules/[id]`, etc.

All dynamic pages export `export const dynamic = 'force-dynamic'` to prevent static prerendering at build time (no DB available during build).

### Prisma known issue

`createMany` on SQLite in Prisma 5 doesn't expose `skipDuplicates` in TS types but works at runtime. Workaround in `apps/web/app/api/actuals/commit/route.ts`:
```ts
await (prisma.transaction.createMany as Function)({ data: [...], skipDuplicates: true })
```

## Design system (`apps/web/app/globals.css`)

CSS vars: `--bg`, `--surface`, `--surface2`, `--border`, `--border-md`, `--t1/t2/t3`, `--blue/green/red/amber/purple/pink/teal` (each with `-lt` variant), `--r`, `--rl`

Key classes: `.page`, `.banner` + `.b-item/.b-label/.b-value`, `.metrics`, `.mc`, `.panel` + `.panel-head/.panel-body`, `.two-col`, `.sidebar-layout`, `.da-grid/.da-row/.da-input`, `.pill` + color variants, `.toggle-switch/.toggle-slider`, `.slider-group/.slider-label`, `.tl-table`, `.add-btn`, `.del-btn`, `.input-prefix`, `.chart-wrap`, `.super-table`, `.super-badge`, `.super-hint`, `.super-context-box`, `.inc-person-card`, `.inc-breakdown`, `.inc-br-*`

Mobile-first pieces (Phase 22): `.bottom-nav`, `.subnav`, `.sheet` (+ `apps/web/components/ui/BottomSheet.tsx`, a native `<dialog>`), `.field`/`.field-money`/`.seg`/`.btn` for touch forms, `.scrub*` (+ `apps/web/components/ui/ScrubChart.tsx`), `.explorer*`, `.whatif*`, `.exp-*` (Budget phone list), `.home-*`, `.situation-*`, `.mini-stats`. Rules of thumb: design at 390px first; touch inputs are ≥16px (iOS zooms otherwise — enforced under `pointer: coarse`); grid children need `min-width: 0` or wide content widens the column; never `overflow-x: hidden` on an ancestor of something sticky (use `clip`). `--bottom-nav-h` is the bottom bar's height (0 on desktop) for anything fixed to the bottom.

## Docker & deployment

- **`Dockerfile`** — 4-stage build: `deps` (npm ci with every workspace's `package.json` in place) → `builder` (prisma generate + next build) → `pruner` (`npm prune --omit=dev`) → `runner` (`node:24-bookworm-slim`, standalone). The runner takes `node_modules` from `pruner`, not `builder`, so devDependencies (vitest/vite/esbuild-as-test-runner, typescript, eslint, tailwind, `@types/*`) never ship to production. **The prune must stay a prune of the builder's tree, not a fresh `npm ci --omit=dev`** — the generated Prisma client lives in `node_modules/.prisma` and a clean install wouldn't contain it (npm leaves dot-dirs like `.prisma`/`.bin` alone). The prune re-resolves the whole tree, so a peer-dependency conflict that `npm ci` tolerates fails the image build — CI's test job runs `npm prune --omit=dev --dry-run` so pull requests catch it. Runtime layout: the standalone server is `/app/apps/web/server.js`, the container's working directory is `/app/apps/web`, and `/app/node_modules/.bin` is on `PATH` — the entrypoint calls `prisma` directly, never `npx` (which could try to download it).
- **CI smoke test** (`smoke` job in `.github/workflows/docker.yml`): builds the image and runs it on a fresh volume (migrate + seed), then restarts it (backup + migrate an existing database), checking the app answers each time. Every branch runs it; only `master` and `v*` tags publish, and only after it passes.
- **`tsx` is a runtime dependency, not a devDependency** — `docker-entrypoint.sh` runs `prisma db seed` (`tsx prisma/seed.ts`) on first boot, so pruning it would break first-run seeding. Same for `prisma` (CLI, used by `migrate deploy` on every start). Don't "tidy" either back into devDependencies.
- **`docker-entrypoint.sh`** — backs up `/data/proviso.db` (3 rolling `.bak` files), then `prisma migrate deploy` on every start; `prisma db seed` only on first run. Does NOT `set -e`: migrate failure logs a warning and the app starts anyway (hardened 2026-06-13 after a P3009 failed-migration record wedged every boot). Restore: `docker exec proviso cp /data/proviso.YYYYMMDD_HHMMSS.bak /data/proviso.db && docker restart proviso`
- **`docker-compose.yml`** — service/container `proviso`; volume `proviso-db` at `/data`; `DATABASE_URL=file:/data/proviso.db`
- **`apps/web/next.config.ts`** — `output: 'standalone'`

### Migration policy

The chain starts at `0001_baseline` (Phase 18). Existing databases created by the old 29-step chain are rebuilt onto it automatically on first boot by `apps/web/prisma/adopt-baseline.cjs` (called from `docker-entrypoint.sh`). New migrations go after the baseline as usual (`0002_…`).


All migrations must be **additive only** — `update.sh` (or Watchtower, if opted in) restarts the container automatically on a new image, so a bad migration lands on every user's DB simultaneously:
- ✅ Add new columns (`ALTER TABLE ... ADD COLUMN ... DEFAULT ...`)
- ✅ Add new tables, indexes, foreign keys
- ❌ Never drop columns or tables
- ❌ Never rename a column (add new → migrate data in seed.ts → drop old in a later release)
- ❌ Never change a column's type
- Every new non-nullable column **must** have a `DEFAULT` so existing rows remain valid

### Release workflow

1. Run `node_modules/next/dist/bin/next build` locally to catch TS errors before CI.
2. Commit and push to `master` — CI builds and pushes `ghcr.io/jorget43/proviso:latest`.
3. Tag significant releases: `git tag -a v1.x.0 -m "..."` then `git push origin v1.x.0` — also pushes `ghcr.io/jorget43/proviso:<tag>`. Use plain `vX.Y.Z` tags: the in-app update banner reads the repo's tags (not GitHub Releases) and ignores anything with a suffix, so an untagged or `-rc` build never announces itself.
4. **No manual server update needed *if `update.sh` is scheduled* (see Phase 16).** Do not default to recommending Watchtower — GHCR returns `403 Forbidden` on Watchtower's anonymous `HEAD`-based digest check even for a public image, so it fails silently forever (logs `Failed=0` on every no-op run) unless authenticated with a PAT. This failure mode was confirmed in production: a deployment silently ran a two-month-old build before the stale version banner was noticed. `update.sh` (`docker compose pull proviso && docker compose up -d proviso`, scheduled via cron/systemd timer/Unraid User Scripts) has no equivalent failure mode — `pull` is a plain anonymous `GET`, which always works — and needs no credentials. Watchtower + PAT remains available as an opt-in for instant-vs-scheduled updates (`docker-compose.watchtower.yml`, README.md § Advanced).

**Common pitfalls:**
- `parsed.y` in Chart.js tooltip callbacks is typed as `number | null` — always null-coalesce it.
- `.github/workflows/docker.yml` was found missing while still tracked in git (cause unknown). If CI says no workflow exists, run `git checkout HEAD -- .github/workflows/docker.yml`.
- After adding a dependency, run `npm install` and commit the updated lockfile — `npm ci` fails if `package.json` and `package-lock.json` diverge.
- The workflow runs on `master` AND `v*` tags — do not change to tags-only or routine pushes will stop deploying. Both triggers push `:latest`, so every release runs `build-and-push` twice and whichever finishes last wins `:latest` — this is intentional (rolling `:latest` between releases), not a bug to "fix" by removing a trigger.
- `PROVISO_VERSION` derivation (`Determine version` step): a tag push bakes the tag name verbatim; a `master` push bakes `git describe --tags --always` instead of the literal branch name — it resolves to the release tag itself when `master` and the tag share a commit, or `<tag>-<n>-g<sha>` for untagged commits ahead of the last release. Never let this fall back to `GITHUB_REF_NAME` directly — a bare `master`/`main` is not a version and breaks the update banner's "you're on X" text.

## Auth & RBAC

- **`apps/web/lib/auth.ts`**: `getSession()`, `requireSession()` (throws redirect if unauthenticated). A session is presented as the `proviso_session` cookie (browser, kind `web`) or `Authorization: Bearer <token>` (native app, kind `app`); each kind is only accepted the way it was issued. `Session.token` holds the SHA-256 of the token (`hashToken`), never the token. `Session.expiresAt` is the idle deadline — web 7 days idle / 30 days max, app 30 / 90 — extended by `getSession()` at most once a day (which also moves `lastUsedAt`). Sign-in routes finish with `signInResponse(req, userId)`: cookie for the browser, `{ token, expiresAt }` in the body when the request sends `X-Proviso-Client: app`. `revokeSessions(userId, { keepCurrent })` ends a user's sessions — call it whenever a credential changes
- **`apps/web/lib/audit.ts`**: audit trail. `withErrors` opens a request context, `authorize()` names the actor, and the Prisma extension in `apps/web/lib/db.ts` records every write (model, id, field names — never values). Auth routes call `audit({ action: 'auth.…' })` explicitly. New auth-type routes: wrap in `withErrors` and add an `audit()` call. Viewer: `/settings/activity` (CFO)
- **`apps/web/lib/securityHeaders.ts`**: CSP and hardening headers, applied to every route by `apps/web/next.config.ts`; HSTS comes from `apps/web/proxy.ts` when `COOKIE_SECURE=true`. Pages get a per-request nonce from `apps/web/proxy.ts` (`script-src 'self' 'nonce-…' 'strict-dynamic'`, no `'unsafe-inline'`) — it relies on every page being dynamically rendered (they all are; a statically prerendered page would lose its scripts). Never add an inline `<script>` or `dangerouslySetInnerHTML` script; a third-party script would need its host in the policy. Adding a third-party script, font, image host or API call from the browser needs a CSP change — check with the headless-browser pass described in Phase 21
- **`apps/web/proxy.ts`**: optimistic cookie gate (fast, not the security boundary); `requireSession()` is the real boundary
- **`apps/web/lib/rbac.ts`**: scopes `actuals:write`, `budget:write`, `users:write`, `child:write`; `authorize(action)` called at the top of all mutating handlers
- **Roles**: CFO (all scopes), PARTNER (`actuals:write` only), CHILD (`child:write` only — `/child` pocket money page)
- **60 mutating route handlers** have `authorize()` guards; update the count when adding routes. Passkey management routes (`register-options`, `register-verify`, DELETE `passkey/[id]`) and the device routes (`/api/auth/sessions`, `/api/auth/sessions/[id]`, `/api/auth/me`) use `getSession()` directly (every role manages its own) — they are auth-gated but not RBAC-gated, and always scoped to the caller's userId.

## Roadmap

### Phase 4.3 — Child role (shipped 2026-06-14)

- `/child` route — CHILD-only; CFO/PARTNER redirected to `/` (Home)
- `child:write` scope — CHILD can add own spends; CFO can add any transaction (credits + spends)
- Models: `AllowanceSchedule` (userId unique, amount, dayOfWeek), `PocketMoneyTx` (userId, amount, description, date, category)
- `PUT /api/allowance` (budget:write), `POST /api/pocket-money` (child:write), `DELETE /api/pocket-money/[id]` (budget:write)
- CFO manages allowance via `MembersPanel` inline; TopNav shows only "Pocket Money" tab for CHILD

### Phase 7 — Hosting accessibility

- **Tier 1 (shipped 2026-06-14):** Docker one-liner — `docker run -d --name proviso --restart unless-stopped -v proviso-db:/data -p 3000:3000 ghcr.io/jorget43/proviso:latest`. `docker-compose.yml` uses `image: ghcr.io/jorget43/proviso:latest` so no source code is needed on the NAS. Subsequent updates: `update.sh` on a schedule by default since Phase 16 (Watchtower is an opt-in alternative, not the default — see Release workflow and Phase 16). Documented in `README.md`.
- **Tier 2:** Tauri desktop app — `.dmg`/`.exe`, SQLite in OS app-support dir, cross-compile via GitHub Actions
- **Tier 3:** Managed SaaS — $60/yr, isolated SQLite per household, "export and leave" guarantee
- See [`docs/security-privacy-legal.md`](docs/security-privacy-legal.md) for data sovereignty constraints that shape Tier 3 design

### Phase 8 — Update delivery (shipped 2026-06-13)

- `apps/web/lib/versionCheck.ts` — polls the repo's git tags daily 09:00 AEST (highest plain `vX.Y.Z`; the repo publishes tags, not GitHub Releases); caches in `VersionCheck` table (migration `0015_version_check`)
- `apps/web/components/ui/UpdateBanner.tsx` — dismissible CFO-only amber banner with copy-paste update command
- `GET /api/version` — public, no auth
- `apps/web/instrumentation.ts` — version check runs on startup for all deployments
- Every release must be tagged — the `dev` fallback in `PROVISO_VERSION` only applies to a local (non-CI) `docker build` with no `--build-arg`; CI-built images always carry a real version string (see Common pitfalls, `PROVISO_VERSION` derivation)

### Phase 9 — Auth enhancements (items 1–3 shipped 2026-06-13; item 4 shipped 2026-06-14)

Items 1–4 shipped. Item 5 not yet built.

| # | Feature | Status |
|---|---|---|
| 1 | Self-service password reset | ✅ `User.email`, `PasswordReset` model, Resend + stdout fallback |
| 2 | Rate limiting + account lockout | ✅ In-memory IP limiter (20 req/min) + DB lockout after 10 failures |
| 3 | TOTP 2FA | ✅ `otplib` + `qrcode`; two-phase login; 8 recovery codes; SecurityPanel |
| 4 | Passkeys (WebAuthn) | ✅ Phase 12 — `@simplewebauthn` v13; migration 0023; 6 routes; `PasskeyPanel`; login button |
| 5 | Google/Apple SSO | Managed SaaS tier only |

### Phase 10 — Operational improvements (shipped 2026-06-14)

- **Watchtower scheduling**: switched from `--interval 86400` to `--schedule "0 0 3 * * *"` with `TZ=Australia/Sydney` so updates land at 3am AEST
- **Pre-migration DB backup**: `docker-entrypoint.sh` backs up `/data/proviso.db` before every migrate; 3 rolling `.bak` files retained
- **Auto-categorisation**: `CAT_RULES` expanded from ~40 to 120+ keywords — delivery platforms, ride-share, Australian insurers, streaming services, utilities, home brands
- **Annual expenses panel** (migration `0020_annual_expenses`): new `AnnualExpense` model (id, name, cat, amt, month 1–12) replaces hardcoded `LUMPY` constant; `GET/POST /api/annual-expenses`, `PUT/DELETE /api/annual-expenses/[id]`; editable `AnnualExpensesPanel` in Budget tab; Cashflow reads from DB. Note "next expected" is computed client-side from `month` field.
- **Education cost presets** (migration `0021_education_preset`): `packages/core/src/educationCosts.ts` encodes 2025 Futurity data for 13 regions × 3 school types (39 presets); `sfPresetKey` on `ProjectionSettings` (null = custom/legacy); Government/Catholic/Independent/Custom selector in Projections school fees panel; custom editable table hidden when preset active

### Phase 11 — Category restructure + Renter model (shipped 2026-06-14)

- **New categories**: `Eating Out`, `Travel`, `Shopping` appended to `CATS` (preserves existing colour-index assignments for older categories)
- **`CAT_RULES` restructure**: dining/cafes/fast food + delivery apps → `Eating Out`; flights/hotels/Airbnb/holiday → `Travel`; department stores + general Amazon → `Shopping`; `amazon prime` stays in `Subscriptions` and is evaluated before the `Shopping` rule so it isn't clobbered
- **`costco`** moved from Home → Food (it's a supermarket)
- **Renter model** (migration `0022_rent_settings`): new `RentSettings` singleton (enabled, monthlyRent, annualIncreaseRate, purchasePlanEnabled, targetPurchaseYear, targetPropertyValue, depositPct, depositFromCash, depositFromInvestments, newMortgageRate, newMortgageTermYrs); `GET/PUT /api/rent-settings`
  - Rent is tracked **separately** from `baseMonthlyExpenses` in projections — users must not also add rent to the budget to avoid double-counting
  - At `targetPurchaseYear`: deposit deducted from cash + investments (investments carry ~12% effective CGT haircut); mortgage starts via `computeMonthlyRepayment`; post-purchase mortgage tracked as `extraAnnualExp` (not inflation-compounded like `expBase`)
  - `ProjectionResult` gains `rentArr: number[]` and `purchaseYr: number | null`
  - Projections sidebar has a "Housing" panel with homeowner/renter toggle and purchase plan inputs

### Phase 12 — Passkeys / WebAuthn (shipped 2026-06-14)

- **Package**: `@simplewebauthn/server` v13 + `@simplewebauthn/browser` v13 (no external auth service)
- **`rpID`**: read from `WEBAUTHN_RP_ID` env var; falls back to the request's `origin` header hostname. **WebAuthn requires HTTPS** except for `localhost` — works with Tailscale Serve.
- **Migration 0023**: `Passkey` table (userId, credentialId, publicKey BLOB, counter BIGINT, deviceType, backedUp, transports, name) + `WebAuthnChallenge` table (challenge, userId nullable, expiresAt — 5-min TTL, cleaned up on use)
- **API routes** (all under `/api/auth/passkey/`):
  - `GET /` — list current user's passkeys (auth required, any role)
  - `POST /register-options` — generate registration challenge (auth required)
  - `POST /register-verify` — verify + store credential (auth required)
  - `DELETE /[id]` — remove own passkey (auth required, ownership-checked)
  - `POST /auth-options` — generate auth challenge (no auth — this IS the login)
  - `POST /auth-verify` — verify assertion, update counter, `createSession()` (no auth)
- **`apps/web/components/settings/PasskeyPanel.tsx`**: list + add + remove passkeys; `@simplewebauthn/browser` dynamically imported on button click; HTTPS warning shown on plain-HTTP origins
- **`apps/web/components/auth/AuthForm.tsx`**: "Sign in with passkey" button below the login form (login mode only); uses discoverable credentials (empty `allowCredentials`) so browser prompts to pick
- **Discoverable credentials**: `generateAuthenticationOptions` is called with no `allowCredentials` so any stored passkey for this RP can be used — no username entry required

### Phase 13 — Projection accuracy tracker (shipped 2026-07-05)

- **Migration 0029**: `NetWorthSnapshot` table (`totalAssets`/`totalDebts` nullable — null for manual entries, populated for auto-captures; `netWorth`; `source: 'auto' | 'manual'`)
- **`apps/web/lib/netWorthSnapshotScheduler.ts`**: runs `takeNetWorthSnapshot()` once immediately on boot, then monthly (1st, 06:00 AEST) via `node-cron` — registered unconditionally in `apps/web/instrumentation.ts` (unlike watchdog, this ships to all users, not gated behind `WATCHDOG_ENABLED`)
- **`GET/POST /api/net-worth-snapshots`**, **`DELETE /api/net-worth-snapshots/[id]`** — manual backfill takes a date + a single net-worth number (not a full asset/debt breakdown)
- **`apps/web/components/projections/NetWorthChart.tsx`**: gained an "Actual net worth" overlay series (`historyLabels`/`historyData` props) — bucketed to one point per calendar year in `ProjectionsClient.tsx`, anchored to the live baseline (`initNW`) for the current year until the first auto-snapshot lands, so it's always continuous with where the projected line starts
- **`apps/web/components/projections/NetWorthHistoryPanel.tsx`**: snapshot list + manual add/delete, in a new "Projection accuracy" panel on `/projections`

### Phase 14 — API hardening: read-path authz, input validation, engine tests (shipped 2026-07-20, tag `v1.5.0`)

- **Deployment**: CI (`test` → `build-and-push`) green on `master`; image `ghcr.io/jorget43/proviso:v1.5.0` + `:latest` pushed.
- **Read-path authz** (closed the biggest gap): `requireAdult()` (`apps/web/lib/auth.ts`) on all 9 adult pages redirects CHILD to `/child`; `apps/web/app/page.tsx` too. `requireAdultRead()` (`apps/web/lib/rbac.ts`) — 401 unauth / 403 CHILD — guards the ~21 household-data GET routes. `/api/version` stays public by design.
- **Uniform errors + validation**: `apps/web/lib/apiHandler.ts` (`withErrors` HOF wraps ~47 mutating handlers; `parseBody` + `ApiError`; Prisma P2025→404 / P2002→409 / P2003→400; opaque 500 with server-side log — no internals leaked). `packages/core/src/schemas.ts` — per-model zod schemas, `.partial()` so unknown keys are stripped before Prisma, `.finite()` rejects NaN/Infinity.
- **Engine tests**: `vitest` + `apps/web/vitest.config.ts` (`@/` alias, `test`/`test:watch` scripts). 42 tests across `tax`/`cgt`/`childcare`/`help`/`netWorth` pin ATO 2024-25 outputs. CI `test` job now gates `build-and-push` — a broken FY calculation blocks release.
- **FY-constant dedup**: `DIV293_THRESHOLD` exported once from `packages/core/src/super.ts`; `packages/core/src/eofy.ts` `BRACKET_THRESHOLDS` and `IncomePanel.tsx` display brackets both derive from canonical `TAX_THRESHOLDS_2425`.
- **Auto-update banner wired end-to-end**: `startVersionCheckScheduler()` registered in `apps/web/instrumentation.ts`; `apps/web/app/layout.tsx` + `UpdateBanner.tsx` now show an amber "vX available — you're on vY" notice (CFO-only, dismissible per tag).
- **Security review (2026-07-20)**: focused review of the v1.5.0 diff found no new HIGH/MEDIUM vulnerabilities — the changeset reduces attack surface.

### Phase 15 — Flagship engine tests, clock-anchor unification, concessional-cap reconciliation

- **Engine tests**: `packages/core/tests/projections.test.ts` (43 tests, 10 named scenarios — homeowner baseline, stepped-inflation boundary, renter, renter→purchase with CGT haircut, parental leave incl. a two-consecutive-leave-years edge case, school fees on/off, HELP clearing, deficit year, one-offs, empty-phases regression) and `packages/core/tests/super.test.ts` (19 tests — cap ladder, Div293 boundary, drawdown/depletion, present-value exponent convention, household combined/later-retirement-year selection, `startYear` injection). Plus `packages/core/tests/schoolFees.test.ts`, `packages/core/tests/lifephases.test.ts`, `packages/core/tests/superHistory.test.ts`. Total suite: 140 tests. `packages/core/tests/fixtures/{projections,super}.ts` — arithmetically-inert baseline factories (every growth/inflation/return dial at 0) so each scenario isolates one mechanism; values are round placeholders per the privacy rule, not schema defaults.
- **Fixed a live crash**: `packages/core/src/projections.ts` gave `person1Phases` an empty-array fallback but not `person2Phases` — deleting a user's last `Person2Phase` row white-screened `/projections` (`TypeError` inside a `useMemo`, no UI recovery). Both persons now fall back to 5 days/week symmetrically.
- **`MODEL_BASE_YEAR` (`packages/core/src/constants.ts`)**: unifies three previously-inconsistent inflation anchors. `packages/core/src/schoolFees.ts` and `packages/core/src/lifephases.ts` now compound from this **data-vintage** constant (what year the stored dollar figures are denominated in) instead of `new Date().getFullYear()` (schoolFees) or a bare hardcoded `2026` (lifephases) — school-fee figures no longer silently drift by one year of compounding every 1 January. Landed while the wall clock still read 2026 (the constant's value), so it was a provable zero-diff change on the day it shipped — verified by running the full suite before/after and confirming byte-identical output, then proving the drift test would have failed pre-fix via `git stash`. `packages/core/src/projections.ts`'s hardcoded `2028` near-term-inflation horizon was lifted to `NEAR_TERM_INFLATION_HORIZON` alongside it (named, tested, behaviour unchanged — it isn't a data-vintage anchor and changing it would move numbers).
- **`super.ts`'s run-start year is now injected, not read at module load**: `SuperInputs.startYear`/`ProjectionContext.startYear` (optional, defaults to the wall clock) replace the old module-top-level `CURRENT_YEAR` capture, which was untestable — `vi.setSystemTime` cannot freeze a value already bound at static-import time.
- **Concessional-cap reconciliation**: `packages/core/src/super.ts` had a private, calendar-year-keyed AWOTE estimate (`round()` to nearest $2,500) that diverged from `packages/core/src/superHistory.ts`'s FY-ending-keyed legislated table from FY2026-27 onward, growing to +$7,500 by FY2031. **`packages/core/src/superHistory.ts`'s `LEGISLATIVE_CONCESSIONAL_CAP` is now the single source** — `super.ts` imports `legislativeCap()`/`currentFinancialYearEnding()` instead of maintaining a second model. Fixed along the way: FY2026-27's cap was verified at **$32,500** (was returning $30,000 via the old fallback — a live wrong number in the EOFY/carry-forward paths, not just a modelling inconsistency); extrapolation beyond the table now floors to the nearest $2,500 (was rounding up, against the ATO's published rule) and anchors to the last *legislated* FY rather than the wall clock (was silently re-anchoring every 1 January). `SuperRow` gained `fyEnding`; `SuperInputs`/`ProjectionContext` gained `startFyEnding` (optional, same injection pattern as `startYear`).
- **Carry-forward now reaches the projection**: previously `/super` could show "you may contribute $145,000" (cap + carry-forward, in `ConcessionalCarryForward`) while flagging `capHit` on a $31,000 contribution (`runSuperProjection` only ever saw the bare annual cap). `HouseholdSuperInputs` gained `person1CapCarryForward`/`person2CapCarryForward`; `SuperInputs` gained `firstYearCapBonus` (applied only in the run's first year). `ConcessionalCarryForward` reports each member's computed `CarryForwardResult` up via a new `onCarryForward` callback; `SuperClient` folds eligible headroom into the projection inputs — not persisted, since carry-forward is derived from `SuperHistory` rows, not a saved setting.
- **Watchdog re-stamped**: the `concessional-cap` entry's `location` collapses to the single file (`packages/core/src/superHistory.ts`), `calibratedFyEnding` bumped to 2027, `authority` corrected `ABS`→`ATO` (the cited URL was always ato.gov.au).
- **Zero migrations, zero Prisma changes** — all new fields are optional with wall-clock-preserving defaults; the only DB-adjacent change is what `ConcessionalCarryForward` computes client-side.

#### Backlog (at the time)

Moved to the consolidated [Backlog](#backlog) below.

- **`Transaction` index — corrected scope**: the model has no `date` column (`dateStr`/`ym`/`importedAt` only). The only filtered queries are FY-window scans on `ym` (`apps/web/app/api/work-expenses/scan/route.ts`, `apps/web/app/api/donations/scan/route.ts`); a candidate would be `@@index([ym])`, not `date`. The two hottest reads (`apps/web/app/actuals/page.tsx`, `actuals/commit/route.ts`) are unfiltered full-table loads ordered by `importedAt` that no index on `ym` would help. Premature at household scale — revisit only if import volume actually warrants it.
- ~~`import type` for client-bundled engines~~ — audited: already satisfied. Every type-only consumer of `tax.ts`/`super.ts`/`cgt.ts` uses `import type`; the components that import values genuinely call them at render time. No action needed.

### Phase 16 — Auto-update: `update.sh` replaces Watchtower as the default (shipped 2026-08-15)

- **Root cause found**: a production deployment was running a build from `master` two months stale (silently — the version banner showed a bare `master`, not even a version string) despite Watchtower running nightly the whole time. Two independent bugs compounded: (1) the release workflow baked `PROVISO_VERSION` from `GITHUB_REF_NAME` directly, so the `master`-branch-triggered build (both `master` pushes and `v*` tag pushes fire `build-and-push`, see Common pitfalls) baked the literal string `master` instead of a version; (2) Watchtower's update check does an anonymous `HEAD` request against the manifest, which GHCR rejects with `403 Forbidden` **even for a fully public image** — Watchtower's fallback full pull then *also* fails "unauthorized" via the same anonymous path, and it logs `Failed=0` on every one of these no-op runs, so nothing ever signalled the failure.
- **Bug 1 fixed** (`.github/workflows/docker.yml`, `Determine version` step): non-tag pushes now bake `git describe --tags --always` instead of the bare ref name — resolves to the release tag itself when `master` and the tag share a commit, or `<tag>-<n>-g<sha>` for untagged commits ahead of the last release. Needs `fetch-depth: 0` on checkout so `git describe` can see tags.
- **Bug 2 — Watchtower demoted from default to opt-in.** Root-caused via Watchtower's own debug logs (`auth: "not present"`, `403 Forbidden` on the HEAD request) and confirmed by testing a plain `docker pull` anonymously from the same host, which succeeded — proving the image's public visibility was never the issue, only Watchtower's specific check mechanism. Authenticating Watchtower to GHCR (`docker login` + mounting `~/.docker/config.json`) does fix it, but a PAT-per-self-hoster is real onboarding friction and a slightly worse trust story for a "your data never leaves your hardware" product — not something to default every future user into.
- **New default**: `update.sh` (repo root, executable) — `docker compose pull proviso && docker compose up -d proviso`, scheduled via cron/systemd timer/Unraid User Scripts. No registry credentials (plain anonymous `GET`, always works against a public image); `up -d` only recreates the container when the pulled image actually changed, so an unchanged night is a silent no-op, not a restart — reproduces Watchtower's "only restart when needed" behaviour via Compose's own reconciliation, no custom diffing logic required.
- **`docker-compose.yml`** no longer includes a `watchtower` service. It moved to **`docker-compose.watchtower.yml`**, an optional overlay (`docker compose -f docker-compose.yml -f docker-compose.watchtower.yml up -d`) documented as "Advanced: instant updates" in `README.md`, for self-hosters who want event-driven updates and don't mind managing a `read:packages`-scoped PAT.
- **Zero migrations.**

### Phase 17 — SQLite busy_timeout + write-retry wrapper (shipped 2026-09-17)

- **Closed the last real backlog item.** `apps/web/lib/db.ts`'s Prisma singleton previously had zero protection against `SQLITE_BUSY`/"database is locked" — any lock contention fell straight through `apps/web/lib/apiHandler.ts`'s catch-all as an opaque 500, indistinguishable from a real bug.
- **`connection_limit=1`** appended to the datasource URL at runtime (`withSingleConnection()`, not `.env`) — stops Prisma's own internal pool from opening multiple concurrent handles to one SQLite file and fighting itself, the main *self-inflicted* lock source.
- **`PRAGMA busy_timeout = 3000`** set once per process via `$queryRawUnsafe` (not `$executeRawUnsafe` — SQLite's `PRAGMA busy_timeout = N` returns the new value as a result row, and Prisma's SQLite connector rejects `execute()`-style calls that return rows with `P2010`; caught by testing against a real local DB, not by inspection).
- **`withBusyRetry()`** — a Prisma Client Extension (`$extends`, `query.$allOperations`) attached once at the singleton, so it transparently covers all 47+ mutating route handlers and the 3 cron schedulers (`netWorthSnapshotScheduler`, `watchdogScheduler`, `versionCheck`) with no per-call-site changes. Bounded to 2 total attempts (1 retry) with a short ~200-400ms delay between them — deliberately *not* stacked with multiple full `busy_timeout` waits, since each attempt can itself block up to 3000ms; 3 attempts at 3000ms would have meant a ~9-15s worst-case request, an early tuning mistake caught before shipping. Exhausted retries throw the existing `ApiError(503, ...)` class instead of the raw Prisma error — reuses `toErrorResponse`'s existing handling, no new response shape.
- **`apps/web/lib/apiHandler.ts`** gained one small backstop: a raw busy error reaching `toErrorResponse` directly (e.g. contention at a `$transaction()` call's own `BEGIN`, before the callback runs — outside what `$allOperations` can intercept) also maps to a clean 503 rather than a generic 500.
- **`apps/web/lib/dbErrors.ts`** — new, tiny — holds the shared `isBusyError()` predicate so `apps/web/lib/db.ts` and `apps/web/lib/apiHandler.ts` don't need to import each other.
- **WAL mode deliberately skipped.** It's the typical companion to `busy_timeout`, but `journal_mode=WAL` produces separate `-wal`/`-shm` files that `docker-entrypoint.sh`'s filesystem `cp`-based backup doesn't account for — would silently make backups inconsistent without also updating that script. Revisit only if contention still surfaces after this ships.
- **Tests**: `apps/web/tests/dbErrors.test.ts` (6 tests, the busy-message predicate) and `apps/web/tests/dbRetry.test.ts` (4 tests, mocked retry/backoff/give-up behaviour — chosen over a real cross-process lock repro because reliably holding an OS-level SQLite lock from a second process didn't reproduce in the dev sandbox used to build this; the mocked version deterministically exercises the same code path). Suite: 150 tests.
- **Zero migrations, zero schema changes.**

### Phase 18 — Privacy purge: baseline migration + history rewrite (2026-10-04, `v1.7.0`; build fix `v1.7.1`)

- **Why**: the public history contained the developer's real household data — a committed SQLite database, the first seed versions (real budget, debts, assets, planned purchases), personal-name columns/tables in migrations `0001`–`0028`, real figures as schema defaults, a real school fee schedule, a family-plan life-phase table, and bank-statement sample data naming local merchants.
- **Migrations squashed** into `apps/web/prisma/migrations/0001_baseline` generated from `schema.prisma` (which also fixed drift: the hand-written legacy chain had diverged from the schema on defaults, autoincrement and index names). Schema defaults neutralised.
- **`apps/web/prisma/adopt-baseline.cjs`** — runs on every boot from `docker-entrypoint.sh` (no-op once done). For a DB on the old chain's head (`0029_net_worth_snapshots`) it builds a fresh DB from the baseline, copies every row verbatim with `ATTACH` + `INSERT … SELECT` (raw values, so DateTime/BLOB/BigInt storage is untouched), verifies row counts, foreign keys and integrity, then swaps files and keeps the original as `<name>-pre-baseline.bak` (outside the `.*.bak` rotation). A DB behind `0029` is refused (exit 2) and left untouched; the entrypoint then skips `migrate deploy` so no failed-migration record is written. Verified lossless with a per-value `quote()` comparison across all 35 tables.
- **Generic replacements**: `SF_BASE`/seed school levels (standard Year 1–6 naming), `INDEPENDENT_WEIGHTS`, Actuals sample CSV; `DEFAULT_LIFE_PHASES` deleted (dead code).
- **Git history rewritten** to a fresh root; old tags removed. Old GHCR image versions contain the old migrations and must be deleted from the package settings.

### Phase 19 — Renaming, projection accuracy, save feedback, validation, lint (2026-10-05, `v1.8.0`)

- **Renaming people** (`packages/core/src/members.ts`): SuperHistory, HelpDebtDetail, InvestmentParcel and the "<name> HELP debt" Debt are keyed by display name, so every rename goes through `renameMembers()` (cascade, via temporary names so swaps can't collide). `PUT /api/household` renames from Settings (CFO); onboarding re-runs cascade too. Names must be non-empty, ≤40 chars and distinct. HELP debts are matched with `findHelpDebt()` — exact name or whole-word prefix, never substring.
- **Projection engine**: mortgage payoff, Person 1 HELP, real HELP balances (was a hard-coded $50k), PPL rates — see "Projection engine" above. Simple-mode Person 2 income now uses their own net pay and growth (was a hard-coded $100k on Person 1's growth).
- **Super tab crash (shipped in v1.6.0)**: `ConcessionalCarryForward` reported results up via `onCarryForward` from an effect keyed on a `members` array recreated every render → infinite update loop ("Maximum update depth exceeded"). Fixed at both ends (memoised array; effect keyed on names and only reports changed results). Reproduced and verified in headless Chrome.
- **Failed saves are no longer silent**: `apps/web/components/ui/SaveErrorToast.tsx` (mounted in the root layout) wraps `window.fetch` once and shows a plain-language notice + Reload for any failed same-origin mutation to `/api/*` except `/api/auth/*`. A screen that shows its own inline error sends `X-Handles-Errors: 1`. Create flows must check `res.ok` before appending a response to state.
- **Validation everywhere**: every mutating route parses its body with a zod schema in `packages/core/src/schemas.ts` (ranges, ISO dates, length caps, unknown keys stripped; no raw body ever reaches Prisma — settings singletons used to accept arbitrary columns). `parseBody` turns failures into plain-language messages ("Amount must be at least 0"), shown to users by SaveErrorToast. Public auth routes are wrapped in `withErrors` so malformed input is a 400, not a 500.
- **Lint is clean** (`npx eslint .` → 0 problems; was 44 errors). Notably the Projections `Slider` was declared inside the component (remounted on every change); it's now module-level.
- **Not done here (known)**: the tax engine was still calibrated to FY2024-25, and the update banner read GitHub *Releases* — both fixed in Phase 20.

### Phase 20 — FY2026-27 tax engine, childcare subsidy, update banner (2026-10-05, `v1.9.0` tax + banner; `v1.9.1` childcare)

- **Tax engine moved to FY2026-27** (`packages/core/src/tax.ts`): bottom rate 16% → 15%; Medicare low-income threshold $28,011 with the real 10c shade-in to $35,013 (was a $26k cliff); HELP now uses the marginal system — 15c per $1 over $69,528, $9,028 + 17c over $129,717, 10% of total income over $186,050 (was the old whole-income percentage table). Constants renamed `TAX_THRESHOLDS` / `TAX_RATES` (no year suffix); `TAX_FY` records the calibration year. Watchdog entries re-stamped to 2027. Medicare thresholds for FY2026-27 weren't announced yet, so the FY2025-26 (legislated) figures are used — the watchdog note says so.
- Tests re-pinned deliberately (`packages/core/tests/tax.test.ts`, projection fixtures): every hand-computed value is recomputed in its comment; characterised trajectories shift by exactly the tax saving.
- **Update banner works again**: `apps/web/lib/versionCheck.ts` reads `/repos/…/tags` and picks the highest plain `vX.Y.Z` (`latestReleaseTag`); `/releases/latest` always 404'd because the repo has no Releases.
- **CCS childcare moved to FY2026-27** (`packages/core/src/childcare.ts`, `CCS_PARAMS_FY = 2027`): 90% to $88,520, 0% at $538,520, CBDC cap $15.19/hr. The higher rate for younger children now follows its real income test (95% to $146,437, tapering 1pt/$3k to 80%, then from $270,727 to 50%, cut off at $370,727). It was a flat "+30 points, max 95%", which overstated the subsidy for incomes over ~$150k. New watchdog entry `ccs-parameters`.

## Backlog

The single list of what's left. Each phase above records what it shipped; anything it deferred lands here. Update this list when you finish or defer something.

### Every July — recalibrate government figures
The assumptions watchdog (`/admin/watchdog` for the CFO when `WATCHDOG_ENABLED=true`; `apps/web/lib/watchdog.ts`; weekly email check) flags each figure once a new financial year starts. Verify against the cited authority, update the constants, re-pin the tests (expected values are hand-computed in comments), re-stamp `calibratedFyEnding`. Known upcoming changes:
- **1 Jul 2027**: the 15% income tax rate becomes 14% (legislated) — `packages/core/src/tax.ts`.
- **Medicare levy low-income thresholds for FY2026-27** weren't announced at the time of Phase 20; the FY2025-26 figures are in use. Update when legislated (often retrospectively).
- Annual indexation: HELP thresholds (1 Jul) and HELP CPI (1 Jun — the most time-sensitive), CCS thresholds and caps (first Monday of July), PPL (minimum wage, 1 Jul), concessional cap (AWOTE steps).

### Known model simplifications (by design, not bugs)
- Projections apply today's tax rates and thresholds to every future year (no bracket indexation), so far-out years overstate tax slightly.
- Net worth: other assets (shares, non-offset savings) grow at the investment return; debts other than the mortgage and modelled HELP are held flat (their repayments sit in the budget), so long horizons slightly understate net worth when such debts exist.
- Medicare: single low-income threshold only; family/senior thresholds and the Medicare levy surcharge aren't modelled.
- CCS: assumes Centre Based Day Care for a below-school-age child, a 10-hour session, and that the family's activity level covers the days booked; no withholding.
- Projection shortfalls (Phase 29) are carried as money owed with no interest, and repaid before anything is invested.
- The projection's school-fee model covers the two eldest children; a third child's school costs stay in the spending base as an ordinary, inflating line.
- One-off costs aren't inflated: the amount is what's paid in that year.
- `marginalRate()` ignores the LITO taper and the Medicare shade-in band (headline rate only — used for guidance figures).

### Security hardening still open
Tracked in [`docs/security-privacy-legal.md`](docs/security-privacy-legal.md) § Cybersecurity. Phase 21 closed headers/CSP, HSTS, the audit log, session lifetime and automated dependency updates. Left:
- ~~Nonce-based CSP~~ — done (Phase 24): `'unsafe-inline'` is gone from `script-src`.
- ~~SQLite encryption at rest~~ — decided (2026-10-05): **not built in-app**; README § "Protecting the data on disk" recommends drive encryption (Unraid encrypted XFS/BTRFS, LUKS, NAS volume encryption) plus encrypted off-site copies. In-app would need Prisma 5 → 7 with the libSQL adapter, an in-place conversion of live data, and a key stored on the same host as the data — little gain for the risk.
- ~~"Sign out other devices" / session list in Settings~~ — done (Phase 24): Settings → Your devices.
- `braces` (via eslint-config-next → fast-glob → micromatch): GHSA-vfj7-8cjw-p6xm, no patched version as of 2026-10-05 (3.0.3 is the latest, and Next's canary lint plugin still pins fast-glob 3.3.1). Not exploitable here: lint-only, patterns from our own config, never in the image; CI's audit gate is `--omit=dev`. `npm audit fix` suggests eslint-config-next 14 — a downgrade, don't. Dependabot will raise it when a fix exists. Since Phase 27 it also arrives through Expo's Metro tooling (`apps/client`); CI's image audit prunes the app's workspaces first, so it still never reaches the image.

### Mobile & ease of use (after Phase 22)
- ~~Two "net worth" figures disagree~~ — done: one definition in `packages/core/src/netWorth.ts` (everything on Own & owe, home counted once as equity, super excluded), used by Home, Own & owe, Projections and the monthly snapshots. Snapshots before `NET_WORTH_DEFINED_FROM` used the narrower old definition, so the Projections "actual" history line may step at the switch.
- ~~Onboarding doesn't ask the "Your situation" questions~~ — done (v1.12.0): Own/Rent on step 5, new step 6 for childcare, school fees, parental leave.
- ~~Small-text desktop layouts on phones~~ — done (v1.12.0), checked at 390px: Own & owe rows restacked, Investments labels/dropdowns fixed, work-pattern wording plain; EOFY, Super and the school-fee controls were already fine. Investment parcel cards rebuilt in Phase 24.
- ~~Native app: token auth alongside the cookie session~~ — done (Phase 24), see [`docs/app-api.md`](docs/app-api.md). Still open for the app: passkey sign-in (WebAuthn from a native app needs the platform APIs and an associated domain), and CORS if the app is ever a web view on another origin.

### The app — next steps (as of 2026-10-07)
In [`docs/architecture.md`](docs/architecture.md) order. Phase 3 there (the single-device app) is built except for a store build; Phase 4 (sync) is next. Master is clean and published (`d3f2bd9`); nothing is mid-flight.

**Start here next session**, in this order:
1. **The owner checks Settings on their phone** (about 5 minutes): restart the Expo server, set up the recovery phrase, save a backup through the share sheet, then "Restore from a file" with it. Fix anything found before building on it.
2. **Check GitHub for a Dependabot security pull request** for the Expo tooling advisories (see the last bullets below) and decide on it.
3. **ESLint for `apps/client`** — small, and worth having before the next large piece so the app's code stays consistent.
4. **Choose the next big piece with the owner** (decisions only they can make):
   - **Sync (Phase 4)** — the relay, and a partner's phone sharing the household. Needs a decision on where to run the first relay: the NAS behind Tailscale Serve (HTTPS) is the documented path for dogfooding.
   - **EAS development build first** — gets the app off Expo Go (TestFlight, the password-manager key backup). Needs an Apple Developer account (A$149 a year) for iOS; Android can start without one.
   - **Or fill NAS gaps in the app** (list below) before either.

The full list:
- **Try on the phone what the browser couldn't test** (Phase 30): saving a backup through the share sheet, the secure key store, then restoring that backup with the phrase. Restart the Expo server first (typed routes off, new native modules).
- **First development build with EAS** (Expo's build service): needed for TestFlight / Android testing and for anything Expo Go can't load. Needs an Expo project id in `app.json`, an `eas.json`, bundle ids, and an Apple Developer account (A$149 a year) for iOS.
- **Key backup to iCloud Keychain / Google Password Manager** (D4's second recovery route): platform credential APIs; needs the development build.
- **Sync (architecture Phase 4)**: `packages/sync` (HLC, per-field messages, AES-GCM with the household key — `packages/core/src/backup.ts` has the primitives; give sync its own HKDF info string), `apps/relay`, adding a partner by QR code. Every write already goes through `apps/client/src/data/mutate.ts`, where messages hook in. The household id and key are in secure storage (`src/data/identity.ts`), not the database.
- **NAS features the app doesn't have yet**: Actual spending (statement import and review; needs its own phone design), Investments (parcels and CGT), EOFY, Next 2 years (cashflow), work-pattern changes over time and parental leave, life phases, rent-then-buy plans, the HELP indexation alert, super carry-forward and extra contributions, the net-worth history line, passkey sign-in.
- **ESLint for `apps/client`** (none yet; `apps/web` has Next's).
- **Web build (architecture Phase 5)**: an instant reload can fail with "Access Handles cannot be created" (the previous page still holds the database file), and the household key falls back to `localStorage` there (`src/data/identity.ts`). Both need solving before the web client ships.
- **Dependency advisories**: GitHub lists some on master, believed to be all in Expo's build and dev-server tools (`braces`, `node-forge`, `uuid` via `xcode`, `decode-uri-component`), several with no fixed version yet. They don't reach the NAS image (CI audits exactly what it ships). Dependabot was preparing a security update for them on 2026-10-06: review it carefully, because Expo pins some of them, and React / React Native / `expo*` move only with the Expo SDK (`proviso-release` skill).
- **Starter estimates** (`packages/core/src/starter.ts`): re-check the figures yearly with the July recalibration; electricity still uses the AER's 2020 usage benchmarks (no longer updated).

### Deferred (revisit only if needed)
- `Transaction` `@@index([ym])` — premature at household scale (see Phase 15).
- **Phase 3 — CDR bank feeds**: researched, not built; CSV import stays the core. See [`docs/phase3-cdr-research.md`](docs/phase3-cdr-research.md).
- **Phase 7 Tier 2 (desktop app) and Tier 3 (managed hosting)**: not started.

### Phase 21 — Security hardening: dependencies, headers, sessions, audit log (2026-10-05)

- **Dependencies**: Next 16.2.7 → 16.3.8 (critical/high advisories, including a proxy bypass — this app's proxy is only the optimistic check, but patched anyway); node-cron 3 → 4; `npm audit fix` for the rest. Production dependencies audit clean. Docker base and CI moved from Node 20 (end-of-life) to Node 24 (`node:24-bookworm-slim`, same Debian release).
- **Automatic updates**: `.github/dependabot.yml` — weekly grouped minor/patch PRs for npm, GitHub Actions and the Docker base; majors ignored (do them deliberately). CI now runs the privacy scan and tests on pull requests (no image publish) and fails on high/critical advisories in production dependencies (`npm audit --omit=dev --audit-level=high`). Dependabot alerts + security updates are on (repo Settings → Code security); security PRs arrive even for majors. The first one, vitest 3 → 5, passed PR CI but broke the image build (vitest 5's optional peer `@types/node` ≥22 vs our ^20 failed `npm prune`) — fixed with `@types/node` ^24, and CI now dry-runs the prune. Merging a Dependabot PR locally (`git fetch origin pull/N/head`, merge, push) marks it merged on GitHub — useful without `gh`.
- **Security headers** (`apps/web/lib/securityHeaders.ts`): CSP (self-only scripts/styles/connections/workers, no framing, no `<object>`/`<base>`, forms post only to the app), `X-Frame-Options`, `nosniff`, `Referrer-Policy: no-referrer` (reset tokens live in URLs), `Permissions-Policy`, COOP; `X-Powered-By` removed. `script-src` keeps `'unsafe-inline'` — Next's hydration needs it unless every page goes nonce-based dynamic. HSTS (1 year, no subdomains) from the proxy when `COOKIE_SECURE=true`. Verified by driving headless Edge over the DevTools protocol against a production build: all pages hydrate and draw charts with no CSP violations, the pdf.js worker loads, an injected cross-origin fetch is blocked.
- **Sessions**: 7-day idle timeout, 30-day absolute limit (was a flat 30 days). Pre-existing sessions are clamped on next use. Changing a user's password in Settings ends their other sessions (the reset-password flow already did).
- **Audit log**: `AuditEvent` (migration `0002_audit_log`), 365-day retention. Buffered per request and written after the handler returns — an insert from inside a `$transaction` would deadlock on the single SQLite connection. Failed requests' writes and zero-row bulk writes are dropped; unknown usernames from failed sign-ins aren't stored (could be a mistyped password). `/settings/activity` lists it for the CFO.

### Phase 22 — Mobile-first: four hubs, Home overview, phone Budget, scrubbable charts, "Your situation" (2026-10-05, `v1.11.0`)

- **Why**: most use is on a phone (NAS-hosted, opened over the home network), desktop second, and a native app may follow. The audience is non-finance users, so fewer destinations and plainer words.
- **Navigation** (`apps/web/lib/navigation.ts`, `apps/web/components/layout/TopNav.tsx`): seven tabs → Home / Spending / Wealth / Future; bottom tab bar on phones, top tabs on desktop, segmented sub-nav per hub; account menu (name, role, Sign out). `/` is now the Home overview instead of a redirect to `/budget`.
- **Home** (`apps/web/app/page.tsx`): "$X left over each month", plain-language prompts (shortfall, thin safety net, EOFY), where you stand, yearly bills due in the next three months, your situation. Budget arithmetic moved to `packages/core/src/budgetSummary.ts` so Home and Budget can't disagree.
- **Budget on phones** (< 700px): category cards with share bars → tap a line → `ExpenseSheet` bottom sheet. "Regular" vs "annual" is one "How often?" choice (Yearly + due month = annual bill; switching kinds converts the record). Pinned In/Out/Left over bar; income folds to a one-line summary. Desktop keeps the inline table.
- **Charts** (`ScrubChart`): drag sideways to move through years (vertical drags still scroll, `touch-action: pan-y`), fixed readout instead of a floating tooltip, readout doubles as a tap-to-hide legend. Charts pass `SCRUB_BASE` (Chart.js `events: []`, no tooltip/legend) and ScrubChart sets the active point for the crosshair.
- **Projections**: headline sentence, then one chart at a time behind a picker, each with a one-line takeaway; loan/housing/school-fee views only when they apply. Controls grouped Basics / Work / Home / Plans — sidebar on desktop, half-height "What if?" drawer on phones so the chart stays visible. Read-only fence now wraps only the controls.
- **Your situation** (`apps/web/lib/situation.ts`, `SituationPanel`): one list of switches in Settings for renting (+ buying), childcare, school fees, parental leave; partner shown, changed via the wizard. Budget's childcare panel and Cashflow's parental-leave figures now follow their switch.
- **Add to Home Screen**: `apps/web/app/manifest.ts` (public in the proxy matcher — fetched without cookies), icons in `public/icons/`, theme colour, `viewport-fit=cover` with safe-area padding.
- **Fixes found on the way**: `overflow-x: hidden` on html/body/.page made them scroll containers, so `position: sticky` (the top bar) never worked → `clip`. `.two-col`/`.sidebar-layout` children lacked `min-width: 0`, so wide tables (Actuals review) widened the page instead of scrolling.
- **Verified** with a headless-Edge DevTools harness at 390px and 1280px against a scratch DB: sheet add/edit/convert/delete, scrubbing, legend toggles, live slider updates, situation switches, and a view-only partner account. Zero migrations. 246 tests (12 new: navigation, budget summary).

### Phase 23 — Setup wizard situation step, phone polish, one net worth (2026-10-05, `v1.12.0`)

- **Setup wizard**: step 5 "Cash & home" asks Own / Rent (rent amount, or the existing home-loan questions); new step 6 "Your situation" (childcare, school fees, parental leave — the last only with a partner). Optional `renting`/`monthlyRent`/`payChildcare`/`schoolFees` on `onboardingSchema`; omitted answers leave settings alone. Finishing — and any adult hitting `/onboarding` or `/child` — lands on Home.
- **Phone polish**: Own & owe rows put the name on its own line; Investments' Owner / "Plan to sell" dropdowns used the old top-bar `.nav-select` class (`display: none` on desktop until v1.11.0 — they were invisible there) and are now normal inputs; work-pattern wording plain; the What-if drawer keeps the chart readout on one row.
- **One net worth** (see "Net worth" under Key architecture decisions): the engine gained optional `investmentsValue` and `otherDebts`; Home's card and the Own & owe panel are both titled "Net worth". Verified: $25k cash + $40k shares − $18k HELP − $12k car loan shows $35k on Home, Own & owe and Projections.
- 253 tests (schema, net-worth definition, engine starting point). Zero migrations.

### Phase 25 — Workspace repo: `apps/web` + `packages/core` (2026-10-06)

- First step of [`docs/architecture.md`](docs/architecture.md) (Phase 1 there). The Next.js app moved to `apps/web`; the 20 pure modules (calculations, schemas, formatting, constants) moved to `packages/core` with their 14 test files and fixtures. 116 files had imports rewritten (`@/lib/tax` → `@proviso/core/tax`).
- `netWorth.ts` no longer imports Prisma types: it takes plain `DebtRow` / `AssetRow` shapes.
- Docker: workspace-aware install, the server at `apps/web/server.js`, `prisma`/`tsx` called from `PATH` instead of `npx` (entrypoint and `adopt-baseline.cjs`).
- CI: typecheck for every workspace, and a new smoke test that runs the built image twice (fresh, then restarted) before anything is published; branches build and test but never publish.
- No behaviour change: 261 tests (184 core + 77 web), lint and production build unchanged. The local dev database moved with the folder to `apps/web/prisma/`; local `.env` belongs in `apps/web/`.

### Phase 27 — The app: first slice (Home + Spending), shared Home figures (2026-10-06)

- Phase 3 of [`docs/architecture.md`](docs/architecture.md), first slice. **`apps/client`**: Expo SDK 57 / React Native 0.86 with expo-router. Welcome (start fresh, or bring in a NAS export file), Home, Spending (category cards → lines → add/edit sheet; Yearly + month = yearly bill, switching kinds moves the record), Wealth and Future placeholders. Light and dark themes from `packages/tokens`.
- **One React for the whole repo: 19.2.3**, set by the Expo SDK (React Native requires an exact match). Root `overrides` pin it; `apps/web` follows (Next's App Router uses its own bundled React, so pages are unaffected). Dependabot ignores react / react-dom / react-native* / expo* — upgrade them together with the Expo SDK.
- **Data on the device**: expo-sqlite through Drizzle's **async** proxy driver on every platform (sync SQLite blocks the UI thread, and on the web it fails while SQLite's worker loads). `packages/core/src/migrate.ts` applies the bundled migrations (`packages/core/src/migrations.ts`, generated by `db:generate`) on any platform. Every write goes through `apps/client/src/data/mutate.ts` — Phase 4's sync hooks in there.
- **Home figures live in core**: `computeHomeOverview` (`packages/core/src/overview.ts`) and `situation.ts`; the NAS web Home now uses them too (rendered text verified identical before and after). The app showed exactly the NAS figures for the scratch household.
- **Web build**: expo-sqlite needs a cross-origin-isolated page (COOP/COEP). Metro adds the headers, but Expo's CLI serves `/` itself without them, so `npm run web` runs `scripts/web-dev.mjs` — Expo behind a small proxy that adds them (and passes websockets through). The relay must send the same headers in production.
- **NAS image unchanged in content**: the Dockerfile copies every workspace manifest for `npm ci`, then drops `apps/client` and `packages/tokens` before `npm prune --omit=dev`, so Expo/React Native never ship (rehearsed: 656 MB pruned vs 604 MB before, the difference being Drizzle).
- **Setup questionnaire** (`apps/client/app/setup.tsx`): where you live (state, capital or regional), you, partner, children (ages, childcare days, school type), home (mortgage / own / rent / other), cars, savings → a first budget of typical costs to adjust before saving. Estimates and the rows they become are in `packages/core/src/starter.ts` (sources listed at its top; re-check yearly). Personal facts (pay, super, HELP, cash) are asked, with a "typical" figure offered but never assumed. School costs go in the budget as lines (how they meet the projection was settled in Phase 29). **Pay** (`app/income.tsx`) edits salary, days and HELP (or take-home pay for net-mode households); Home's "Add income" prompt now has its own target, `income`.
- **Verified**: 309 tests (211 core + 87 web + 11 client — the client's data layer runs against `node:sqlite` with the phone's migrator). In headless Edge at 390px through the dev proxy: import of the scratch household's export, Home and Spending matching the NAS, changing a cost and adding a yearly bill updating Spending and Home's "Coming up", dark mode. First run on an iPhone through Expo Go the same day (see the follow-ups below).

### Phase 27 follow-ups — on the phone (2026-10-06)

- First run on an iPhone (Expo Go) showed the gap: "Start fresh" made an empty household. Fixed with the setup questionnaire (above) and a **Pay** screen.
- iOS number pads have no return key: every input now goes through the kit's `Input`, which attaches a **Done** bar (`InputAccessoryView`, one per scroll container); dragging the page also puts the keyboard away. Choice labels stay on one line.
- CI: with `apps/client` in the lockfile the production audit also covered Expo's build tools, some with no fixed version. CI now prunes exactly as the Dockerfile does (dropping the app's workspaces, **pruning twice** — the first prune keeps packages the full tree flagged dev-or-optional) and audits that tree at `high`; the app's packages are audited at `critical`. `source-map-js` 1.2.2 taken (it reached the image via Next).
- Expo CLI sign-in on Windows: `npx expo login --browser` crashes (cmd's `start` splits the URL at `&`); use `$env:BROWSER="none"; npx expo login --browser` and open the printed link. `npm run web` takes `PORT` / `EXPO_PORT` so it can run beside `npm start`.

### Phase 28 — The app: Wealth (2026-10-06)

- **Wealth** (`apps/client/app/(tabs)/wealth.tsx`): net worth (same figure as Home), the cash safety net, what you own and owe (tap to change; `app/item.tsx`), the home loan with offset and payoff year (`app/loan.tsx`), super (`app/super.tsx`) and HELP with this year's compulsory repayment. Writes in `src/data/wealth.ts` keep the NAS's linked figures: the loan offset is the total of accounts marked as cash, and the budget's Mortgage line follows the repayment. The loan's end date is the one the repayment reaches (`monthsToRepay` in core). The questionnaire now asks the home's value and records it as a "Home equity" asset (value less loan), as netWorth.ts expects.
- Verified: 338 tests; in headless Edge, a Sydney owner with a $500k loan showed net worth $629k, adding an offset account updated the offset, and paying $4,000 a month moved the finish from 2051 to 2043 on Home and Wealth alike.

### Phase 29 — The app: Future; one projection set-up for NAS and app (2026-10-06)

- **Future** (`apps/client/app/(tabs)/future.tsx`): net worth in N years (today's money, with a year-by-year bar chart), milestones (loan paid off, HELP cleared, last school fees, home purchase), retirement (each person's super at retirement in today's money; whether the income goal lasts past 100), big one-off costs (`app/oneoff.tsx`) and plain-language assumptions (`app/assumptions.tsx`). Engine inputs are built by **`packages/core/src/future.ts`** — `projectionBaseline` + `buildProjectionInputs`, `superInputsFor`, `retirementIncomeGoal` — which the NAS Projections and Super pages now use too, so the two can't drift.
- **NAS behaviour changes (deliberate)**: projections now start from the budget's full spending (yearly bills and childcare after the subsidy were missing before); the default retirement goal is today's spending less the home loan and the children's costs (it was every expense line, loan and children included).
- **Engine fix**: shortfalls no longer vanish. Cash used to floor at $0 each month, so a household spending more than it earned (and any one-off in those years) lost nothing. Now a shortfall draws on investments, then is carried as money owed (`owedArr`) and subtracted from net worth until later surpluses repay it. Households with a surplus are unchanged (all pinned engine figures hold).
- **School fees decided**: the questionnaire's school-cost lines stay in today's budget; the projection models the two eldest children's fees year by year (ending after Year 12) and leaves those lines out (`isModelledSchoolLine`), so nothing is counted twice. The questionnaire switches `schoolFeesOn` on when there are children.
- Typed routes are off in `apps/client` (the generated file only existed where a dev server ran, never in CI, and misread the monorepo).
- Verified: 356 tests; the app at 390px (a Melbourne family of four: $2.32M in today's money in 20 years, HELP cleared 2028, school fees end 2039, loan paid off 2042; a $45k car in 2029 gives $2.28M); the NAS Projections and Super pages rendered against a scratch household. The NAS Super "consider a lower target" hint was fixed on the way (it would have subtracted the mortgage twice and suggested $0).

### Phase 30 — The app: Settings, recovery phrase, encrypted backups (2026-10-06)

- **Settings** (`apps/client/app/settings.tsx`, behind the gear on every tab): people (names, partner; HELP debt rows follow a rename), rent, childcare (the managed Spending lines now open these), pay; your data (encrypted backup, readable copy, restore from a file), the recovery phrase, and start again.
- **Household identity** (D4): a household id and 32-byte key in secure storage (`src/data/identity.ts`, expo-secure-store, this-device-only; localStorage on the web dev build). New for start fresh and NAS imports; restored with a backup. Never in the database or any file.
- **`packages/core/src/backup.ts`**: the recovery phrase is the key as 24 BIP-39 words (checksummed, typos named); a backup is the household export sealed with AES-256-GCM under an HKDF-derived key; nothing readable outside the ciphertext. On @noble/@scure (audited, pure JS). Backups keep removed rows; a readable copy leaves them out.
- The recovery phrase is confirmed by asking for two of its words; Home and Settings nudge until it is.
- Not yet: the optional key backup to iCloud Keychain / Google Password Manager (needs a development build, not Expo Go).
- Verified: 372 tests (the BIP-39 reference vector, base64 against Node's, a backup round trip keeping removed rows, wrong phrase / tampered file / newer format refused). In headless Edge: a backup made with a known key restored with its phrase to exactly the NAS figures ($4,782 left over); a wrong word was caught; a fresh household got its identity and the recovery prompt; the phrase check refused wrong words. Saving through the phone's share sheet and the secure store are untested until run on a phone.

### Phase 26 — Local-first data model, household export (2026-10-06)

- Phase 2 of [`docs/architecture.md`](docs/architecture.md). Nothing in the running app changes except one new Settings panel.
- **`packages/core/src/schema.ts`**: the Drizzle schema for the app — 26 household tables plus a separate pocket-money space (2 tables) per child. Text UUID ids, `deletedAt` instead of deletes, no unique indexes, ISO dates, column names = TS keys. Cleaned up on the way: the two work-pattern tables are one `workPhase` with `person`; HELP, super history and investment parcels point at `p1`/`p2` instead of a display name (so the rename cascade in `members.ts` isn't needed there); super settings lose three unused fields and their duplicate partner switch; `CategoriationRule` is spelled `categorisationRule`. Migration `packages/core/drizzle/0000_baseline.sql` (drizzle-kit, `npm run db:generate -w @proviso/core`); CI fails if the schema changes without a migration.
- **`packages/core/src/ids.ts`**: `newId()` (UUIDv7) and `contentId()` (UUIDv8 from a natural key via MurmurHash3 x86-128, checked against a reference implementation). Transactions, rules, suggestion states, school-fee levels, HELP and super history rows use content ids — they replace the old unique constraints.
- **`packages/core/src/householdExport.ts`**: the export file format and `parseHouseholdExport()`, which validates every row against the Drizzle column definitions (types, enums, required fields, settings ids, duplicates) with messages that name the table, row and field.
- **`apps/web/lib/householdExport.ts`**: reads the Prisma tables and maps them (pure `mapLegacyHousehold`). Ids are stable across exports: natural-key rows use content ids; others derive from `HouseholdSettings.householdId` (new, migration `0004_household_id`, set on first export) and the legacy id. Names that match neither person go to p1, with a plain-language note in the file. Never includes sign-in data.
- **Settings → Download all your data** (CFO): `GET /api/export`, audited as `data.export`.
- **Verified**: 290 tests (203 core + 87 web), including migrations building exactly the schema in `node:sqlite` and every exported row inserting into it; on the scratch household, two downloads gave a valid file with identical ids, and Partner / signed-out requests were refused.

### Phase 24 — Your devices, app sign-in tokens, hashed session tokens, nonce CSP (2026-10-05, `v1.13.0`)

- **Hashed tokens**: `Session.token` now stores the SHA-256 of the token, so a copy of the database (a backup, a stolen volume) can't be used to sign in. Migration `0003_session_devices` clears existing sessions — **everyone signs in once after updating**.
- **Your devices** (Settings, every adult): each signed-in browser or app with a plain name from the user-agent (`apps/web/lib/devices.ts`, "Safari on iPhone"), sign-in date and last activity; sign out one device or all others. `GET`/`DELETE /api/auth/sessions`, `DELETE /api/auth/sessions/[id]` — always scoped to the caller. Audited as `auth.sessions_revoked`.
- **App tokens**: sign-in with `X-Proviso-Client: app` returns `{ token, expiresAt }` instead of setting a cookie (password, password + authenticator code, passkey routes all go through `signInResponse`); every API route accepts `Authorization: Bearer`. App sessions last 30 days idle / 90 days max. `GET /api/auth/me` tells the app who's signed in. An app token is refused as a cookie and vice versa. Contract: [`docs/app-api.md`](docs/app-api.md).
- **Nonce-based CSP**: `apps/web/proxy.ts` gives each page a fresh nonce and sends `script-src 'self' 'nonce-…' 'strict-dynamic'`; Next stamps the nonce on its own scripts. `'unsafe-inline'` is gone from `script-src` (styles keep it — React style props). API and static responses keep the nonce-less baseline from `apps/web/next.config.ts`, now without `'unsafe-inline'` too. Verified against a production build in headless Edge: every page hydrates with zero violations, charts draw, client-side navigation loads its chunks, the pdf.js worker loads and parses a statement, the dev server works, and an injected `onerror` handler is blocked.
- **Investment parcel cards**: rebuilt on a grid (`.parcel-*` in `globals.css`) — two columns of proper inputs on a phone, one row on desktop; results as a 2×2 / 4-up grid; a real Remove button; plain labels ("Price paid", "Price now", "You'd keep", "Half the gain is taxed").
- **Verified** end to end against the scratch DB: browser vs app sign-in, bearer reads, app token refused as a cookie, signing out other devices kills the app token but keeps the browser, app logout, raw token absent from the DB, and one user can't sign out another's device (404). Settings panel checked at 390px. 261 tests.

## Security checklist for new features

> When designing features that handle user data, add new routes, or touch auth — read [`docs/security-privacy-legal.md`](docs/security-privacy-legal.md) for the full legal, privacy, and cybersecurity context first.

- [ ] Writes to DB → has `authorize()` guard; wrap the handler in `withErrors` (`apps/web/lib/apiHandler.ts`) — that's also what puts the write in the audit log
- [ ] Security-relevant action outside `authorize()` (sign-in, credentials, 2FA, passkeys) → `audit({ action: 'auth.…' })`, and add a label in `apps/web/app/settings/activity/page.tsx`
- [ ] Changes a credential → `revokeSessions(userId, { keepCurrent: true })`
- [ ] Loads anything in the browser from another origin → update the CSP in `apps/web/lib/securityHeaders.ts`
- [ ] Reads household/sensitive data → GET behind `requireAdultRead()` (`apps/web/lib/rbac.ts`); adult pages use `requireAdult()`
- [ ] Accepts user input → `parseBody(req, schema)` with a zod schema in `packages/core/src/schemas.ts` (`.partial()` for updates, `.finite()` on numbers, ranges on everything) — never `await req.json()` into Prisma
- [ ] Client save → check `res.ok` before using the response; failures surface via SaveErrorToast (or send `X-Handles-Errors: 1` and show the error inline)
- [ ] Renders user-supplied text → no `dangerouslySetInnerHTML`; use React's escaping
- [ ] Sends data off-device → explicit user consent; document in privacy policy
- [ ] Privacy gate → `node scripts/privacy-scan.mjs --tree HEAD` prints clean; no real values in code, tests, samples, docs or commit text (see § Privacy guardrails)
