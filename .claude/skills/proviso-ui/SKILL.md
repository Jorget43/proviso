---
name: proviso-ui
description: Proviso's UI and wording conventions for people who aren't into finance, shared by the iOS, Android and web clients. Use when building or changing any screen, component, chart, form, empty state, error message or label, or when reviewing UI for consistency between platforms.
---

# Proviso UI conventions

## Who it's for

Households who aren't finance people. Every screen should answer a plain question ("Are we okay this month?", "What do we owe?") before showing detail.

## Structure

- **Four destinations: Home, Spending, Wealth, Future.**
  - Phones: a bottom tab bar. Desktop: top tabs.
  - Sections within a destination use a segmented control.
  - Don't add a fifth destination without asking the user.
- **Home answers "are we okay?"**: money left over each month, things worth a look, where you stand, what's coming up.
- **Situational features** (childcare, renting, school fees, parental leave, partner) are switched on under "Your situation", never as separate tabs. A switched-off feature disappears entirely.

## Patterns

- **Edit in a bottom sheet** on phones (centred dialog on desktop); one question per field.
- **Charts are scrubbed**: drag sideways to move through time, with a fixed readout above the chart (no floating tooltips). The readout doubles as the legend. Vertical drags scroll the page.
- **One number, one definition**: if a figure appears twice (e.g. net worth on Home and Wealth), both come from the same core function and have the same name.
- **Empty states invite the next step** ("Add your take-home pay so we can…"), never "No data".

## Styling

- **Use design tokens only** (`packages/tokens`; `app/globals.css` variables in the legacy web app). No hard-coded colours, spacing or font sizes.
- **Light and dark themes** both work.
- **Touch targets at least 44px**; text inputs at least 16px on phones (stops iOS zooming on focus).
- **Respect safe areas** (notch, home indicator) and the bottom tab bar's height.
- **Layout must not overflow** at 360–430px phone widths. Long names wrap or truncate, and pages never scroll sideways.

## Wording

- Plain words first, the jargon second if needed:
  - "What you own minus what you owe" (net worth)
  - "Half the gain is taxed (held 12 months+)" (CGT discount)
  - "Take-home pay"
- Use "you" and "your household", and Australian spelling.
- **Errors say what happened and what to do**, never codes.
- **No advice language.** Proviso shows estimates, not recommendations; keep the "estimates only" disclaimers where they exist.
- **Numbers:**
  - whole dollars in summaries
  - `$12.4k` / `$1.2M` on charts and compact cards
  - signs and colour for gains and losses (green up, red down), never colour alone

## Checking a screen

Use screenshots at phone width (390px) and desktop width (1280px), plus both themes for new components:
- Read the screen as someone who doesn't know what "offset", "CGT" or "concessional" mean. Anything unexplained gets plainer words or a one-line note.
- Compare the same screen on each platform. Differences in content or wording are bugs; differences in native controls (pickers, switches) are expected.
