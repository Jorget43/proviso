---
name: proviso-release
description: How Proviso ships across its streams — the NAS Docker image (relay and legacy web app), the iOS and Android apps, over-the-air app updates and the hosted Proviso Sync relay — without breaking older versions in the wild. Use when committing for release, pushing, tagging, bumping versions, publishing app builds, changing the sync protocol, or doing the July government-figures update.
---

# Releasing Proviso

## Ground rules (from the user)

- **Ask before every push.** A push to `master` publishes `ghcr.io/…/proviso:latest`, and NAS installs pick it up automatically.
- Tags (`vX.Y.Z`) drive the in-app "update available" banner; tag user-visible releases only.
- The privacy-scan hook runs on commit and push. Never bypass it.
- Test against scratch databases only, never `prisma/household.db`.

## Streams

| Stream | Ships by | Reaches users |
|---|---|---|
| NAS image (relay + legacy web app) | push to `master` → CI builds Docker image | nightly `update.sh` on each NAS |
| App: JavaScript-only change | EAS Update (over the air) | next app launch |
| App: native change (new native module, permissions, SDK upgrade) | EAS Build → TestFlight / Play closed track → store review | days |
| Hosted Proviso Sync | relay image deployed by the operator | immediately |

## Compatibility rules

- The **sync protocol version** and **schema version** travel in every message (see `proviso-schema-change`).
- **Every app version must read every older schema.** Messages from a *newer* schema are kept and the user is asked to update; they're never dropped.
- The relay only stores ciphertext, so it rarely needs changing. When it does (protocol or permissions), **ship the relay first** and keep it accepting the previous protocol until no supported app uses it.
- **Release order for a schema change:** relay (if needed) → app OTA/store build → legacy web app.
- An OTA update must not change native code or the app's purpose (store rules). If a change needs both, ship the store build first, then later OTA updates target that runtime version.

## Checklist

- [ ] Tests, typecheck, lint and production builds green for every package touched.
- [ ] Old-schema message tests pass (sync changes).
- [ ] `CLAUDE.md` phase entry and backlog updated; `docs/architecture.md` Decision log if anything structural changed.
- [ ] Commit messages end with the attribution line the session asks for.
- [ ] User approved the push. Then watch CI (GitHub Actions API: `curl https://api.github.com/repos/<owner>/<repo>/actions/runs?head_sha=<sha>`; `gh` isn't installed on this machine).
- [ ] Tag if user-visible, after CI is green on that commit.
- [ ] Anything that forces users to act (sign in again, update the app) is called out to the user before the push.

## Every July — government figures

Tax rates, HELP thresholds and indexation, CCS, PPL, super caps: see the "Every July" section of `CLAUDE.md`. These live in `packages/core` and ship to apps as an OTA update. No relay change is needed, because calculations run on devices.
