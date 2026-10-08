# Proviso architecture: app-first, local-first

**Status: AGREED (2026-10-06).** This file is the source of truth that the project skills in `.claude/skills/` enforce. A change to anything here is a decision; record it in the Decision log at the bottom.

## Why the architecture changes

Proviso started as a NAS-hosted web app: the server owns the SQLite database, pages read it directly, and every phone or browser is a client. The product direction is now:

- **App first.** Most people will install an app from the App Store or Google Play and never run a server.
- **Public release eventually.** Today there's one household; the design must hold for many.
- **NAS hosting stays, as an option** for homelab users.
- **Data sharing between household members** without anyone but the household being able to read the data — including Proviso's makers.

A server-authoritative design can't serve the app-first majority, who have no server. So the data moves onto the device, and servers become optional sync relays.

## The shape

```
          ┌──────────── one client codebase (Expo / React Native) ────────────┐
          │   iOS app          Android app          Web (desktop & phone)      │
          │                                                                    │
          │   UI (apps/client) ── reads/writes ── local SQLite (Drizzle)       │
          │                                          │                         │
          │   calculations (packages/core) ◄─────────┘                         │
          │   sync engine  (packages/sync) ── end-to-end encrypted messages ─┐ │
          └──────────────────────────────────────────────────────────────────┼─┘
                                                                             │
                     one relay protocol, two places to run it                │
                  ┌──────────────────────────────┬───────────────────────────┘
                  ▼                              ▼
          Proviso Sync (hosted)          Self-hosted relay (NAS)
          default for app users          homelab option; also serves
          ciphertext only                the web client
```

**Every device holds a full copy** of its household's data in SQLite and works offline. Edits become small change messages, which are encrypted on the device and exchanged through the household's relay — Proviso Sync by default, or their own. Every device applies the same messages, so they converge on the same data. This is the pattern Actual Budget uses, a proven local-first budgeting app with optional self-hosted sync.

## Decisions

### D1. One client codebase: Expo (React Native) for iOS, Android and web
- The desktop and phone web experience is the **same app built for web** (React Native Web), not a second UI. This is the single biggest protection against drift between platforms.
- The current Next.js UI is **retired gradually**: it keeps running on the NAS while the Expo web build reaches parity, then the NAS serves the Expo web build instead.
- Platform-specific code lives in `*.ios.tsx` / `*.android.tsx` / `*.web.tsx` files only, and only for things like biometrics or file pickers. Never `if (Platform.OS === …)` in screen code.
- Risk: Expo's SQLite on web is alpha (it needs cross-origin isolation headers for SharedArrayBuffer). Spiked in Phase 3: it works through the async API, behind COOP/COEP headers (`apps/client/scripts/web-dev.mjs` in development; the relay must send them in production).

### D2. Local-first data: SQLite on every device, Drizzle as the one schema
- The schema is defined **once**, in Drizzle, in `packages/core/schema`. The same definitions drive SQLite on phones (`expo-sqlite`), on web (wasm), and on the relay server.
- **Prisma is retired.** It doesn't run on devices, and keeping two schema definitions is guaranteed drift. (This also removes the pending Prisma 5 → 7 upgrade.)
- Migrations ship inside the app and run at start-up: `packages/core/src/migrations.ts` (generated) applied by `packages/core/src/migrate.ts`, the same on every platform.
- **Async database access everywhere** (Drizzle's proxy driver over expo-sqlite's async API): synchronous SQLite blocks the UI thread on phones and can't work on the web.

### D3. Sync-ready data model (rules every table follows)
- **IDs are UUIDv7 strings**, created on the device. Never autoincrement integers: two offline devices would both create record 42.
- **Natural keys become content IDs, not unique constraints.** A row that has a natural key (a bank transaction's date + description + amount, a categorisation rule's pattern, a person's HELP record for a year) gets an id calculated from that key (`contentId` in `packages/core/src/ids.ts`). Two devices that create the same row independently produce the same id, and sync merges them. Unique indexes other than `id` are not allowed: offline devices can't both honour them.
- **Single-row settings tables** use a fixed, named id (e.g. `'household'`), not `1`.
- **No hard deletes.** A row is deleted by setting `deletedAt`; queries filter it out.
- **Changes are recorded per field**: each message is *(table, row id, column, value, timestamp)*.
- **Conflict rule: the latest edit wins, per field.** Timestamps are hybrid logical clocks (HLC), which order events correctly even when phone clocks disagree. Two people editing different fields of the same expense both keep their edits.
- **Derived numbers are never stored.** Net worth, tax, projections etc. are always calculated from inputs by `packages/core`. Only facts are synced.
- **Schema changes are additive.** Add columns with defaults; never rename or repurpose a column, because older app versions still send messages naming it. Removing a column takes two releases: stop using it, then drop it.

### D4. Encryption
- **Sync messages are end-to-end encrypted** with a household key (AES-GCM). Row ids travel inside the ciphertext (only table names are in clear), so a content id can't be used to guess what a row contains. Relays and cloud drives only ever store ciphertext. Proviso's makers never hold anyone's financial data, and the hosted options never see it.
- The household key lives in the device's secure storage (iOS Keychain / Android Keystore). New devices get it by scanning a QR code on an existing device, or by entering a recovery phrase.
- **Recovery has two routes, and setup offers both:**
  - a recovery phrase the user writes down or prints
  - an optional key backup to the platform's synced password store: iCloud Keychain on iOS, Google Password Manager on Android, via the platform credential APIs
- Losing every device *and* both recovery routes means losing the data. The setup flow must make that unmissable.
- On-device data at rest relies on the OS's device encryption (on by default on modern iOS and Android). The 2026-10-05 decision not to build SQLite encryption into the NAS app still stands for the relay.

### D5. Sync: one relay protocol, hosted or self-hosted
Each household uses exactly one of:

| Option | For | Notes |
|---|---|---|
| **This device only** | Trying it out; one person, one device | No sync. Backups by export. |
| **Proviso Sync** (hosted relay) | **The default** for app users | Adding a partner = scanning a QR code; no other accounts. Hosted in an Australian region. The natural paid tier if the product is commercialised. |
| **Self-hosted relay** | Homelab users | The same relay as a Docker image on a NAS; it also serves the web client. Must be on **HTTPS** (iOS and Android block plain http) — Tailscale Serve is the documented easy path. |

How ownership is protected — technical guarantees, not promises:
1. **End-to-end encryption**: the relay stores ciphertext only. Neither the hosted service nor its operator can read household data.
2. **No personal details**: no email, no name. The relay knows a random household ID and an access key derived from the household key.
3. **No lock-in**: the relay is open source and self-hostable with the same protocol; a household can move between hosted and self-hosted at any time.
4. **Full export at any time**: a readable CSV/JSON export and an encrypted backup file, saved wherever the user likes (their own Drive, Dropbox, Files).
5. **Deleting the household** in the app deletes its data from the relay (also an Apple requirement).

Rules:
- **The database file is never synced** — only messages.
- **Google Drive / Dropbox are not sync transports.** They're only places a user can save export or backup files. (Considered and rejected 2026-10-06: multi-step setup for non-technical users, a Google or Dropbox account needed by every member, polling delays, third-party app reviews, and two integrations to maintain.)
- iCloud/CloudKit was also rejected: it fails for households mixing iPhone and Android.

### D6. Household members and roles
- A household is a set of devices sharing one household key. Members join by QR code from an existing device.
- **Adult roles (CFO / Partner) are enforced by the app.** The relay can also reject writes from a member's devices to tables they may not change (table names travel unencrypted alongside the ciphertext for exactly this; values never do).
- **Children get a separate space.** Pocket money lives in its own small dataset with its own key, shared between the parents and the child's device. A child's device never receives household finances, which is stronger than today's role check.

### D7. Shared packages, one repository
```
apps/client      Expo app (iOS, Android, web)
apps/relay       sync relay — the same code for Proviso Sync and self-hosting; also hosts the web build (Docker image, eventually replaces apps/web)
apps/web         today's Next.js app, kept running until the Expo web build reaches parity
packages/core    schema (Drizzle), calculations (tax, super, projections, HELP, CGT,
                 childcare, school fees, budget summary), zod schemas, formatting, constants
packages/sync    HLC, message format, merge, encryption, relay client
packages/tokens  colours, spacing, type scale → generated for web CSS and native styles
```
- `packages/core` has **no** dependency on React, Expo, Next or any platform. It runs in Node tests.
- Screens read data through **loaders** in `apps/client` (query plus core calculation), never inline queries. The same loader serves every platform.
- One CI pipeline: privacy scan, typecheck, tests for every package, relay Docker image, and app builds through Expo's cloud build service (EAS), which also covers iOS builds without a Mac.

### D8. Versions and releases
- **The sync protocol is versioned** (message format version plus the schema version). A device that receives messages from a newer schema stores them and asks the user to update instead of dropping them.
- **App releases:** JavaScript-only fixes go out as over-the-air updates (EAS Update). Native changes go through store review.
- **Release order when the schema changes:** relay first (it only stores ciphertext, so it's rarely affected), then the app. Every app version must read every older schema version.
- **July government-figure updates** are a `packages/core` change, shipped as an over-the-air update. No server change is needed, because calculations run on devices.

### D9. iOS and Android specifics we design for
- **No passkeys for self-hosted relays** (the app can't know every household's domain at build time). Use Face ID or fingerprint to unlock the stored key instead.
- **Notifications are scheduled on the device** (e.g. "car rego due next week"). Server push needs Apple and Google credentials on a relay and is out of scope.
- **Statement PDFs** arrive through the share sheet or document picker. Parsing runs on the device with the existing `pdfStatement` rules.
- **Store compliance:** privacy labels (target: "Data Not Collected"); in-app deletion of a household and all its synced data (Apple guideline 5.1.1(v)); financial-advice disclaimer on first run.

## Migration path from today's NAS app

| Phase | Work | Visible change |
|---|---|---|
| **1. Restructure** | Split into a workspace repo; move the calculation code into `packages/core` unchanged; the Next app imports it from there. | None |
| **2. Data model** | Drizzle schema in `packages/core` following D3; the household export file format; a NAS exporter that writes today's database in it (the migration path for existing NAS users, and "Download all your data"). | Settings → Download all your data |
| **3. Client MVP** | Expo app, single device (no sync): onboarding, Home, Spending, Wealth, Future, recovery phrase. Spike Expo SQLite on web. **Built 2026-10-06 (Phases 27–30) except the store build; the password-manager key backup followed on 2026-10-08 (Phase 35).** | Household TestFlight / Android test |
| **4. Sync** | `packages/sync` and `apps/relay`; dogfood the self-hosted relay on your NAS; import your current data. **Built 2026-10-08 (Phase 34): protocol, relay, app sync and joining by QR code; not yet: roles enforced by the relay (D6), pocket-money spaces, the relay serving the web build.** | Phones and desktop sync |
| **5. Web parity** | Expo web build reaches the Next app's features; the NAS image serves it; the Next app is removed. | Desktop moves to the new client |
| **6. Public release** | Hosted Proviso Sync (Australian region, privacy policy), store listings, privacy labels, help pages, closed testing (Google requires 12 testers for 14 days on new personal accounts). | Public |

## Conventions the skills will enforce

Project skills in `.claude/skills/` (written 2026-10-06). Each one points back here rather than repeating this document:

- **`proviso-architecture`**: where code goes (core vs client vs sync vs relay); platform-file rules; no calculations in components; loaders only.
- **`proviso-schema-change`**: D3's rules as a checklist: UUIDv7, `deletedAt`, additive-only, defaults, migration plus sync-protocol version bump, tests for old-version messages.
- **`proviso-feature`**: end-to-end checklist for a feature: core logic and tests → schema → loader → screen on every platform at phone and desktop widths → plain-language copy → privacy scan.
- **`proviso-release`**: release order, OTA vs store build, relay compatibility, changelog, July recalibration.
- **`proviso-ui`**: design tokens only (no hard-coded colours or sizes), the four hubs, bottom sheets, scrub charts, plain wording for non-finance users, 16px+ touch inputs.

## Open questions
- Pricing and the hosted relay: decide before public release, not now.
- Actuals (bank-statement import) on phones: the review-and-categorise flow is desktop-shaped today. It needs its own phone design in Phase 3 or 5.

## Decision log
- 2026-10-05: in-app SQLite encryption for the NAS app: not built; drive encryption documented instead.
- 2026-10-06: direction set: app first, public release eventually, self-hosted NAS stays as an option, workspace repo agreed.
- 2026-10-06: agreed: one Expo client for iOS/Android/web (Next.js UI retired at web parity); Drizzle replaces Prisma; local-first with end-to-end encrypted sync.
- 2026-10-06: recovery = recovery phrase plus optional key backup to iCloud Keychain / Google Password Manager.
- 2026-10-06: sync = Proviso Sync (hosted, default) or self-hosted relay, same protocol. Google Drive / Dropbox only as backup destinations, not sync.
- 2026-10-06 (Phase 3, Settings): the recovery phrase is the household key as 24 BIP-39 words; backups are the export sealed with AES-256-GCM (HKDF-derived key, so backups and sync never share a key); the key lives in secure storage, this device only (a new phone gets it from the phrase, not a device backup). Crypto on @noble/@scure in `packages/core/src/backup.ts`.
- 2026-10-06 (Phase 3): one React version repo-wide, set by the Expo SDK; async SQLite on every platform; Home's figures computed once in `packages/core/src/overview.ts` and used by both the NAS web app and the app.
- 2026-10-08 (Phase 4, sync): the relay is its own container next to the NAS app (owner's choice), behind Tailscale Serve. Protocol v1: the relay numbers envelopes as they arrive and devices pull "everything after N"; one envelope per table per push, the table name, format and schema versions in clear and bound to the ciphertext as AES-GCM associated data; HLC timestamps and row ids inside. Keys from the household key by HKDF: `proviso sync v1` (encryption), `proviso relay auth v1` (access key; the relay keeps only its SHA-256, registered by the first push). Sync bookkeeping (clock, field timestamps, outbox, changes waiting for a newer app) lives in device-local `_sync*` tables outside the household schema, never exported or synced. A new device joins with a code (shown as a QR code) holding the relay address, household id and key; a joining device's own household is replaced. Import, restore and set-up-again are refused while sync is on (they replace rows wholesale, which wouldn't reach the other devices).
- 2026-10-08 (Phase 4): the relay names a household by an id derived from the household key (HKDF `proviso relay id v1`, UUID-shaped), not the household id: the recovery phrase plus the relay's address is enough to get a synced household back with no device left, and the relay never sees the household id. A device recovered that way uses the relay id as its household id.
- 2026-10-08 (Phase 3, D4's second route): the key saved to iCloud Keychain (a synchronizable Keychain item) or Google Password Manager (Credential Manager password) by the app's own native module, `apps/client/modules/key-backup`, as `proviso-key-1:<household id>:<key hex>` under the account "Proviso household <first 8 of the id>". Used instead of typing the phrase, to open a backup or to recover from the relay. Only in builds with the native module (not Expo Go or the web).
- 2026-10-06 (Phase 2): natural keys → content ids (no unique constraints); row ids encrypted in sync messages; people as `p1`/`p2` keys rather than names; pocket money in its own space per child; one JSON export format for migration, backup and data download. Existing NAS data moves as an export file rather than as sync messages — the app turns an imported file into messages.
