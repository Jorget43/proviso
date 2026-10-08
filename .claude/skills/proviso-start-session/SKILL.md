---
name: proviso-start-session
description: Start-of-session routine for Proviso — sync the checkout, read the handover in CLAUDE.md ("Start here next session"), give the owner any standing reminders first, and check for drift left by the last session before building. Use at the start of a session, or when the user says "let's work on …", "where were we", "what's next", or picks up after a break.
---

# Starting a Proviso session

This is the other half of `proviso-close-session`: what one session records, the next one reads before doing anything.

1. **Sync first.** A stale checkout has misled a session before.
   ```bash
   git fetch && git status -sb
   ```
   If the checkout is behind, pull before reading anything. Note any branch waiting for the owner's OK.
2. **Read the handover.** In `CLAUDE.md`, read Backlog → "The app — next steps" → **"Start here next session"**, then the newest phase entry.
3. **Reminders before work.** Items the owner asked to be reminded about (marked ⏰) go to them first, in one or two lines, even when they've asked for something else. Pending owner decisions are listed next.
4. **Check for drift.**
   ```bash
   node scripts/session-check.mjs --offline
   ```
   Any `!` left by the last session is fixed or raised before new work starts.
5. **Place the work.**
   - Look up the feature in Backlog → **"Where each feature lives (NAS ↔ app)"** to see which product has it.
   - Engine changes show on the NAS charts first; new screens are built in the app first. All maths goes in `packages/core`.
   - Then follow `proviso-feature`, plus `proviso-schema-change` if anything is stored.
   - Read `docs/architecture.md` before structural changes.
6. **Decisions that change numbers** (on the NAS or in the app) get the owner's OK before merge (`proviso-release`). Ask them early, with a recommendation.
