---
name: proviso-feature
description: End-to-end checklist for building or changing a user-facing Proviso feature so it lands the same way on iOS, Android and web (and the legacy NAS web app while it lives). Use when adding a screen, field, calculation, setting, chart or flow, or when changing how an existing one behaves.
---

# Building a Proviso feature

Proviso is for people who aren't into finance. A feature is done when it works on every platform, at phone and desktop widths, in plain words, with the maths tested in one place.

## Order of work

1. **Logic first, in `packages/core`** (see `proviso-architecture`). Pure functions with tests. Expected values are hand-worked in a comment next to each test, as in the existing engine tests. Government figures cite their source and financial year.
2. **Data**: if anything new is stored, follow `proviso-schema-change` before writing code.
3. **Loader**: one loader assembles what the screen needs (query plus core calculation).
4. **Screen** in `apps/client`, built from the shared components and tokens (see `proviso-ui`). Platform files only where the platform truly differs.
5. **Legacy web app**: if the feature must work on the NAS app before web parity, its UI goes in `apps/web` but its logic is the same core function. No copies of formulas.
6. **Copy**: plain language, no jargon without an explanation, Australian spelling.

## Done means

- [ ] Core tests pass, including edge cases (zero, negative, no partner, renting, missing data).
- [ ] Typecheck and lint clean in every package touched.
- [ ] Checked on a phone width (390px or a device) **and** desktop width. Look at screenshots, not just tests:
  - nothing overflows sideways
  - touch targets are at least 44px
  - inputs are at least 16px on phones
- [ ] Works offline (local-first: no spinner waiting on a network for local data).
- [ ] Read-only roles (Partner, Child) see the right thing and can't change what they shouldn't.
- [ ] No personal data in code, fixtures or screenshots committed to the repo (public repo; privacy-scan hook).
- [ ] `CLAUDE.md` phase notes and the backlog updated when a phase ships; `docs/architecture.md` untouched unless the user agreed a change.

## Red flags — stop and rethink

- The same formula appears in two places.
- A screen needs `if (Platform.OS === …)` for its main behaviour.
- The feature needs a server to work for an app-first user (the server is optional by design).
- A number shown in two places could disagree (e.g. two definitions of net worth).
