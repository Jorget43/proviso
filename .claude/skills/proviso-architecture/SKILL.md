---
name: proviso-architecture
description: Where code goes in Proviso and which direction dependencies may point. Use before creating a file, package, folder, module or dependency in this repo; before moving code; when unsure whether logic belongs in packages/core, packages/sync, apps/client, apps/relay or the legacy apps/web; and when reviewing a change for architectural drift between iOS, Android and web.
---

# Proviso architecture rules

The agreed target is `docs/architecture.md` (read it if you haven't this session). This skill is the working checklist. If a change would contradict that document, stop and ask the user. Don't quietly diverge, and don't edit the document to fit the code.

## Layout and what belongs where

| Path | Holds | Must not hold |
|---|---|---|
| `packages/core` | Drizzle schema, every calculation (tax, super, projections, HELP, CGT, childcare, school fees, budget summary, net worth), zod schemas, formatting, constants | React, Expo, Next, Prisma, `node:` imports, DOM or platform APIs, I/O |
| `packages/sync` | HLC clock, message format, merge, encryption, relay client | UI, screen logic, calculations |
| `packages/tokens` | Colours, spacing, type scale (generated for web CSS and native) | Components |
| `apps/client` | Expo app for iOS, Android and web: screens, loaders, device storage, platform glue | Calculations; SQL inside components |
| `apps/relay` | Sync relay (hosted and self-hosted are the same code); static host for the web build | Anything that reads household data — it only ever sees ciphertext |
| `apps/web` | **Legacy** Next.js app, kept until the Expo web build reaches parity | New features that aren't also planned for `apps/client` |

Today (Phase 25) the repo has `apps/web` and `packages/core`; `packages/sync`, `packages/tokens`, `apps/client` and `apps/relay` are created when their phase starts. A new pure calculation goes in `packages/core` now, never in `apps/web/lib`.

## Dependency direction

```
apps/client ──► packages/sync ──► packages/core
     │                                ▲
     └────────────────────────────────┘
apps/relay  ──► packages/sync (protocol only — never decrypts)
apps/web    ──► packages/core            (legacy)
packages/core ──► nothing in this repo
```

Never import "upwards": core must not import from sync or apps, and sync must not import from apps.

## Rules

1. **Calculations live in `packages/core` only.** A component or screen that does arithmetic on money beyond display formatting is a bug. Move the logic and test it in core.
2. **Screens get data from loaders** (query plus core calculation), never inline queries. One loader serves every platform.
3. **Platform differences go in platform files**: `Thing.ios.tsx`, `Thing.android.tsx`, `Thing.web.tsx`, behind one shared interface. No `Platform.OS` branching inside screens.
4. **`packages/core` must run everywhere:** Node (tests and relay), Hermes (phones) and browsers. Use Web Crypto and plain TS. No Node built-ins, no `Buffer`.
5. **Derived figures are never stored or synced.** Store facts; calculate the rest.
6. **The legacy app doesn't grow new architecture.** A new feature's logic goes into core first, so the new client inherits it. Its UI goes into `apps/client` if that app exists for that area, otherwise `apps/web`, plus a backlog note to port it.
7. **One schema definition.** See the `proviso-schema-change` skill before touching any table.

## Before finishing a structural change

- [ ] Every new file is in the folder this table says.
- [ ] No upward or platform-specific imports in core (grep the diff for `react`, `expo`, `next/`, `@prisma`, `node:`).
- [ ] Typecheck and tests pass for every package touched.
- [ ] `docs/architecture.md` is still true. If not, the user agreed the change, and it's recorded in its Decision log.
