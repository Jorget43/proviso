---
name: proviso-close-session
description: End-of-session checklist that brings every record of Proviso's state into line — git, CLAUDE.md (phase notes, Start here, backlog), the NAS ↔ app feature table, README, plan docs, skills, the GitHub description and the assistant's memory — so the next session (and the app and NAS streams) start from one consistent picture. Use when the user says to close off, wrap up, finish for the night/day, end the session, or hand over.
---

# Closing a Proviso session

Proviso runs as two products: the NAS web app and the Expo app. They share one engine (`packages/core`). Each record below answers a different question. They drift apart unless they're all checked at the end of every session, so go through every section, even after a small session.

| Record | Answers | Audience |
|---|---|---|
| `CLAUDE.md` phase entry | What was built and why, the gotchas | Future sessions |
| `CLAUDE.md` Backlog → "Start here next session" | What to do first next time, reminders | The next session |
| `CLAUDE.md` Backlog → "Where each feature lives (NAS ↔ app)" | Which product has what | Both streams |
| `CLAUDE.md` Backlog → simplifications, July list | What the model leaves out; figures to re-check | Engine work |
| `README.md` | What Proviso is and how to run it | The public |
| `docs/plan-*.md`, `docs/architecture.md` | Agreed direction and decisions | The owner and sessions |
| `.claude/skills/proviso-*` | How to do the work | Sessions |
| GitHub description and topics | Proviso in one line | The public |
| The assistant's memory | Pointers, preferences, open threads | The assistant |

**One fact, one home.** Status lives in CLAUDE.md. The README summarises it for the public, and memory points to CLAUDE.md rather than copying it. When two records disagree, fix the one that's wrong. Don't add a third.

## 1. Run the drift check

```bash
node scripts/session-check.mjs
```

Every `!` line needs fixing or an explanation for the owner. The script covers git state, a missing phase entry, the feature table and plan lagging the latest phase, a stale "next steps" date, schema version and migration mismatches, and the GitHub description. The rest of this list is judgement it can't make.

## 2. Code and processes

- Commit everything that's meant to land. Leave nothing half-done on the working tree without saying so in "Start here".
- **Ask before pushing** (`proviso-release`). A push to `master` publishes the NAS image. Branches waiting for the owner's OK are named in "Start here", with what they change.
- Stop what this session started: dev servers, headless browsers, background pollers. Stop them **by PID, or by matching this session's profile or scratch path in the command line**, never by image name. Ask before stopping anything this session didn't start.
- Scratch databases stay in the scratchpad. Nothing ever touches `apps/web/prisma/household.db`.

## 3. CLAUDE.md

- **Phase entry** for anything shipped, in the existing style. Include:
  - the owner's decisions
  - what changed in core, data, NAS and app
  - numbers that moved deliberately
  - how it was verified: test count, and the widths screenshotted
- **Status paragraph** near the top: the app's list of features and the NAS hubs, if either changed.
- **Backlog → "The app — next steps (as of today)"**:
  - "Start here next session" comes first. Standing reminders the owner asked for stay at the top until done, such as an untested phone build. Then pending owner decisions, then the next build step.
  - Remove or strike items that are done. Add anything deferred, with enough context to pick it up cold.
- **Feature table (NAS ↔ app)**:
  - Update every row this session touched.
  - Add a row for any new feature.
  - Bump "as of Phase N".
  - A feature built in only one product gets "—" for the other and a note on why or when.
- **Known model simplifications**: every new shortcut in the maths.
- **Every July**: every new government figure, with where it lives.

## 4. Public and planning docs

- **README.md**: update when what a user can do, install or run changed (a new screen, a new app capability, new commands). Keep it plain and public. No internal phase detail, no personal data.
- **Plan docs**: update the status line and the owner's decisions at the top of the plan in use (today `docs/plan-modelling-and-ux.md`).
- **`docs/architecture.md`**: change it only when the owner agreed an architectural change this session, and record it in its decision log.
- **Skills**: if this session learned a rule or gotcha that future work must follow (a tool quirk, a convention the owner set), put it in the matching `proviso-*` skill, not only in memory.

## 5. GitHub

- When positioning, scope or platforms changed, update the repo description and topics to match the README's opening. Read them through the public API:
  ```bash
  curl -s https://api.github.com/repos/<owner>/<repo>
  ```
  Write them with the owner's stored git credential, never printing the token:
  ```bash
  TOKEN=$(printf "protocol=https\nhost=github.com\n\n" | git credential fill | sed -n 's/^password=//p')
  ```
  Then `PATCH /repos/<owner>/<repo>` with `{"description": …}`, and `PUT /repos/<owner>/<repo>/topics` with `{"names": […]}`.
- Pushes made this session: check that CI went green (poll at most once a minute; the anonymous limit is 60 an hour).

## 6. Memory

- Update the project memory with: the commits and whether they're pushed, what awaits the owner, new preferences or corrections, and environment gotchas.
- Keep the one-line index entry current.
- Memory holds pointers and preferences. Status details belong in CLAUDE.md.

## 7. Hand over

Run `node scripts/session-check.mjs` again; it should be all `✓`, or each remaining `!` explained. Then tell the owner briefly:
- what shipped, and where (pushed, merged, published)
- anything waiting on them (decisions, merges, device tests)
- the first thing next session will do
