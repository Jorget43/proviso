# Plan: modelling depth, scenarios and UX (proposed 2026-10-08)

**Status: agreed 2026-10-08; Step A in progress.**

**Owner's decisions (2026-10-08):**
1. Engine changes show on the NAS charts first; new screens app-first (item 12).
2. Dark mode remembered per user account on the NAS (item 1).
3. Chart trim agreed (item 3), **plus**: super can always be broken out into its own chart. Most people can't touch it until their late 60s, so they don't count it as wealth until then.
4. Investment uncertainty: simple optimistic / pessimistic bands first, Monte Carlo later (item 8).
5. Project to age 95 by default, adjustable. Net worth on Home mentions super, with the option to show it included or broken out from other investments (items 3, 11).
6. Other income: start simple with side-gig / business revenue, high-interest savings and share income; rental, bonds and salary packaging are bookmarked for later (items 5, 6).

Original proposal follows. Written for the owner to choose from; each item says what's there today (checked in the code), what we'd build, where it lives (`packages/core` logic first, per `docs/architecture.md`), the decisions needed, and a rough size (S ≈ a short session, M ≈ a session, L ≈ several, XL ≈ a phase of its own).

## The finding that shapes most of this

The projection engine (`packages/core/src/projections.ts`) has **no life course**:

- Salaries grow every year for the whole horizon. Nobody retires, so income never stops.
- Super is a separate engine (`super.ts`), shown under Wealth → Super. It never feeds the Future projection, and net worth deliberately leaves it out.
- Investments compound at one fixed return, untaxed, with no drawdown.
- Spending only changes through calendar-dated "life phases" (seeded from one household's timeline) and the home loan ending.
- Children aren't a thing in the data: they exist only as an expense category, two school-fee start years, and life-phase rows.

So net worth rises forever. Items 9, 10, 11 and 12 below all need the same foundation: **people and children with ages, and a life course in the engine**. Building that once, first, makes the rest much smaller.

---

## 1. Dark mode toggle: System / Light / Dark, everywhere

**Today.**
- NAS web: light only (`globals.css` has one palette).
- App: follows the phone's setting only (`usePalette()` reads `useColorScheme()`).
- `packages/tokens` already has a dark palette.

**Proposal.**
- **One setting, three choices:** System (default), Light, Dark.
- **NAS:**
  - Store the choice per user account (a `themePreference` column on `User`, a Prisma migration), so it follows the person across browsers.
  - The server writes `data-theme` on `<html>`, so there's no flash of the wrong theme.
  - CSS variables are generated from `packages/tokens`, so there's one palette source. "System" uses `prefers-color-scheme`.
  - Charts read the CSS variables. There are 13 hard-coded hex colours in `apps/web/components` to replace, mostly chart colours.
  - Settings → Appearance holds the choice. The sign-in page follows the system.
- **App:**
  - The same three choices in Settings, stored on the device. There are no accounts in the app, and the household's synced data isn't the place for one person's preference.
  - `usePalette()` reads the choice; the status bar and navigation bar follow it.

**Size:** M (NAS: colour audit and migration), S (app).
**Decision:** NAS per account (recommended) or per browser?

## 2. Scenarios you can save and compare (the big one for "modelling")

**Today.**
- The NAS "What if?" changes the real plan as you drag.
- The app's What if? holds a draft until you keep it.
- Neither can hold two versions side by side. The engine runs "with/without school fees" internally (`base` / `withFees`), which shows the idea works, but it's hard-wired.

**Proposal.**
- **A scenario is a named set of changes layered on the plan**, e.g. "Private secondary", "Retire at 55", "Partner 3 days from 2028".
  - New table `scenario` (id, name, colour, enabled, `overrides` as JSON, deletedAt), following D3.
  - One JSON field means the latest edit wins for the whole scenario rather than per field. That's acceptable for a named bundle, but the rule needs noting.
  - Core: `applyScenario(inputs, overrides)` and `runScenarios(plan, scenarios[])`. The app's `whatif.ts` draft becomes "save as scenario".
- **Compare on the charts:**
  - Chips above each Future chart: Plan plus each saved scenario.
  - Switching a chip on overlays that scenario as a dashed line in its colour.
  - The scrub readout shows each value and the difference from the plan for the year you're on.
  - A **Compare** card shows, for each scenario: net worth at the end, the year money gets tight, retirement income lasting to age N, total school fees, and cash at the lowest point.
- **Where:** engine and scenarios in core; UI in both clients. The app needs a chart component: `react-native-svg` plus our own scrub chart, matching the web's behaviour. That's a native module, so it rides on the next development build.

**Size:** L.
**Depends on:** works today with existing inputs; gets far more useful after items 7, 9 and 11.

## 3. Consolidate the Future charts; bring retirement into Future

**Today.** NAS Projections has up to 7 views:
- Net worth
- Money in & out
- Good & tight years
- Home loan
- Housing costs
- Income
- School fees

Super balance and drawdown sit under Wealth → Super.

**Proposal: 7 views become 5.** The detail moves into the scrub readout rather than separate charts.

| New view | Replaces | How the detail survives |
|---|---|---|
| **Net worth** | Net worth | Super shown as a separate band, with "without super" in the readout once item 11 lands |
| **Money in & out** | Money in & out, Income, Good & tight years | Income as stacked bars by person (other income sources, item 5, stack on top); spending as a line; the gap shaded green or red; parental-leave years marked. Readout shows each person's income, spending, the year's surplus or shortfall, and cash. |
| **Home** | Home loan, Housing costs | Loan balance (or rent until a purchase). Readout shows repayments a year and that as a share of income; years above 30% are marked amber. |
| **School fees** | School fees | Unchanged; one stacked colour per child once item 7 lands |
| **Retirement** (moved from Wealth → Super) | Super balance and drawdown | Super by person, then drawdown, with the "lasts until age N" takeaway. Wealth → Super keeps what you have now: balances, contributions, carry-forward. |

This follows the agreed information layout: Wealth means now, Future means projections.

**Size:** M on the NAS. In the app it's built new, with item 2's chart component.
**Decision:** happy with this mapping?

## 4. Phone-friendly editing: Future controls and Budget

**Today.**
- The NAS work-pattern editor (`WorkPhaseTimeline`) is a 5-column table with borderless 0.78rem inputs: hard to tap, hard to read.
- Budget's desktop table has small type.
- The "+ Add" and "+ Annual" buttons don't say what they add.
- The app already solved both: work changes as cards with − / + steppers (Phase 33), and "Add a cost" with a "How often?" question that covers yearly bills (Phase 22's phone sheet).

**Proposal.**
- **Work patterns:** one card per change ("From 2028 · 3 days a week · about $57k"), with a stepper or select at 16px+, a labelled Remove button, and "+ Add a change (e.g. going part-time)". Use the same layout on desktop: wide screens get 2–3 cards per row, not a squeezed table.
- **Budget:**
  - One **"Add a cost"** button per category, plus one at the top, opening the existing `ExpenseSheet` (it already asks "How often?", and yearly with a due month makes it a yearly bill). The sheet becomes a centred dialog on desktop.
  - Retire "+ Add" and "+ Annual".
  - Body text goes to 15–16px.
  - An empty category says what belongs in it.
- Apply the same rules to the other What if? controls: the Home purchase rows, Plans, life phases and one-offs.
- **Strategic note:** the NAS UI is due to be replaced by the app's web build (D1). Fix the NAS's worst pain points now, because that's what's used daily, but keep each fix to adopting patterns the app already has. Don't design new NAS-only UI.

**Size:** M.

## 5. Other kinds of income

**Today.** Salary only (two people, tax mode or "net" mode). Investments grow at one total return and are never taxed. There's no interest, dividends, rent or business income.

**Proposal.**
- **New table `incomeSource`** (person p1/p2/joint, kind, amount, frequency, growth, start/end year), with kinds:
  - **Interest** (savings accounts, term deposits, bonds): taxable at the person's marginal rate. Better still, model cash and bond yields on the actual balances, rather than a fixed amount.
  - **Dividends and distributions**:
    - Modelled as a yield on the investment portfolio plus an assumed franked share. Franking credits are grossed up into taxable income and refunded if excess.
    - Dividend reinvestment (DRP): taxed in the year received, but no cash arrives, and the reinvested amount adds to the cost base, which matters for CGT later.
    - This means splitting today's single "investment return" into growth plus yield, with tax drag on the yield.
  - **Rental property**: rent less costs (interest, rates, insurance, management, depreciation). A net loss reduces taxable income (negative gearing). The property itself becomes an asset with its own growth and loan, so this is effectively a second home-loan model.
  - **Business, sole trader, gig work**: profit is taxed at the person's marginal rate; there's no compulsory super (with a nudge to add voluntary contributions), and lumpiness is optional.
- **The tax engine has to change:**
  - Tax is currently `calcAfterTax(salary)` per person.
  - It needs taxable income per person: salary less packaging plus interest, grossed-up dividends, net rent and business profit.
  - The franking offset; Medicare; HELP repayment income, which includes reportable fringe benefits and net investment losses; and the Child Care Subsidy income test, which uses family adjusted taxable income.
- Every government figure is cited and added to the July recalibration list.

**Size:** XL, best split.
- **5a:** interest and dividends on the portfolio (yield split, franking, DRP).
- **5b:** business income.
- **5c:** rental properties.

**Decisions:** which of these matter to your household first? And should dividends be modelled as a yield on the portfolio (recommended), or as entered amounts?

## 6. Salary packaging and fringe benefits

**Today.** None. Super's "additional contributions" exist, but aren't framed as salary sacrifice.

**Proposal.** A per-person list of packaged items:
- **Salary sacrifice to super**: concessional, counts toward the cap, taxed at 15% in the fund. The cap and carry-forward already exist.
- **Novated lease**: the pre-tax and post-tax (employee contribution method) split. Electric cars under the luxury car tax threshold are FBT-exempt; they still count as a reportable fringe benefit.
- **Exempt work items** (a portable device such as a phone or laptop, a phone plan with work use): reduce taxable income.
- **Not-for-profit, public benevolent institution and hospital packaging caps**, if the employer qualifies.
- **Employer-paid extras** (subsidised insurance, gym): usually not taxed in the employee's hands if exempt, or reportable otherwise.

**Effects:** lower taxable income, and so less tax. But reportable fringe benefits are added back for HELP repayments, the Medicare levy surcharge and the Child Care Subsidy income test. That interaction matters a lot for families with childcare, which is why it belongs in the engine rather than a calculator.

**Size:** L. It needs research with cited ATO rules, and builds on 5's taxable-income refactor.
**Do after 5a.**

## 7. School fees, properly

**Today.**
- Two children only.
- One fee schedule (tuition + fixed) by year level.
- A hard-coded 15% discount for the second child, and a hard-coded $350 "CML" household levy. These came from one particular school's fee rules.
- One school type for all years.
- An on/off switch.

**Proposal.**
- **Children become records** (new `child` table: name optional, birth year and month), shared with items 9 and 11.
- **School plan per child** as stages: e.g. Government Prep–6, then Independent 7–12. Each stage has its own fee schedule:
  - Presets: Government (voluntary contributions only), Catholic, Independent typical by state (the existing state presets).
  - A custom school with per-level tuition and fixed fees.
- **Household fee rules per school:**
  - sibling discounts by birth order (e.g. 2nd 10%, 3rd 20%, 4th free)
  - flat family fees (one per household per year: building fund, the old "CML")
  - one-off fees at entry (enrolment, uniform)
  - its own fee inflation
- Any number of children.
- **Scenarios** (item 2) make "Government all through" against "Private secondary" a toggle you compare on the Money in & out, Net worth and cashflow charts. Item 3's School fees view stacks by child.
- **Migration:** today's settings map to one Independent stage per child with the old discount and levy, so existing NAS numbers don't move.

**Size:** L.
**Depends on:** the `child` table (shared with 9 and 11).

## 8. Investment returns: ranges, not one number; lifecycle investing

**Today.** One `investReturn`, applied every year; super has its own single return.

**Proposal, in two steps.**
- **8a, ranges (M):**
  - Run the engine three times: median, optimistic and pessimistic (the median ± a spread you choose, default ± 2 points).
  - Net worth and Retirement show a shaded band; the readout gives all three.
  - Cheap and easy to understand, but it treats bad years as evenly spread, so it understates the risk of a crash just before or after retiring.
- **8b, Monte Carlo (L):**
  - A few hundred runs with year-to-year variation set by the asset mix. Volatility assumptions are documented, e.g. growth ≈ 15%, balanced ≈ 10%, conservative ≈ 5% a year.
  - Shows the 10th, 50th and 90th percentile bands, and "chance your money lasts to 95".
  - Captures sequence risk, which matters most for early retirement.
  - Runs on an annual approximation, so it's fast on phones.
- **Lifecycle (glide path):**
  - An asset mix that shifts from, say, 90% growth now to 50% by retirement.
  - Return and volatility come from the mix (growth and defensive assumptions), applied to investments and optionally to super. Super funds' own "lifecycle" options work this way too.
- **Wording:** "estimates, not advice", per `proviso-ui`.

**Decision:** start with 8a bands now and 8b later (recommended), or go straight to Monte Carlo?

## 9. A smarter savings rule (cash buffer first, then invest or enjoy)

**Today.** A fixed percentage of each year's surplus is invested; the rest piles up in cash forever.

**Proposal.**
- Replace it with a rule: **keep a cash buffer** of N months of spending (or a dollar amount, growing with prices).
- Anything above the buffer is split: X% invested, Y% spent on "fun" or lifestyle (it leaves net worth, which is honest), and the rest kept as cash. Optionally, extra home-loan repayments come first; the offset already counts.
- When cash falls below the buffer (fees, a car, leave), it's topped up before investing.
- **Defaults reproduce today's behaviour** (buffer 0, invest = today's rate, fun 0), so no numbers move until someone changes them.
- Core change in the yearly cash step. Simple to show: "Keep 6 months of spending as a safety net; invest 80% of the rest."

**Size:** M.

## 10. Life-stage costs as modifiers, not calendar rows

**Today.** Life phases are calendar-dated rows. The NAS seeds nine, built from one household's assumed timeline (newborn costs "this year", daycare "next year", and so on), switched off by default. The app reads them but can't edit them.

**Proposal.**
- **Modifiers tied to people's ages, not years:**
  - **Per child, from their birth year:** baby costs (0–2), childcare (existing settings), primary-age, teen costs (13–17), and "leaves home" at an age you choose (18–23), when their share of food, utilities and holidays drops.
  - **Per adult:** working costs that stop at retirement (commuting, work clothes); an early-retirement lifestyle step-up (travel); later-life health costs (75+).
- The library is a starter set with typical amounts (cited where possible) and each modifier can be edited, switched off or added to.
- It works for any household: no children, children already teenagers when you start, one adult.
- Existing calendar rows stay supported as "custom" items, so nothing is lost.

**Size:** L.
**Depends on:** the `child` table and people's ages (shared with 7 and 11).

## 11. Net worth that follows a life: retirement, drawdown, early retirement

**Today.** Income never stops, super is separate, and investments only grow. That's the hockey stick.

**Proposal: one life-course engine in core.**
- **Retirement per person:**
  - Salary stops at their retirement age, or steps down first through work phases (phased retirement).
  - The horizon extends to an age (e.g. 95) instead of a fixed number of years.
- **Super inside the projection:**
  - Contributions while working; preserved until 60 (the preservation age for everyone born after 30 June 1964).
  - Net worth shows super as its own band, with a "without super" figure.
- **Drawdown strategies**, chosen in the Retirement view:
  - **Spend what you need:** spending comes from investments outside super first, then super. Shows when each runs out.
  - **4% rule:** take 4% of the pot at retirement, then the same amount plus inflation each year.
  - **Percentage of balance:** a fixed percentage of whatever's there each year. The income varies, and the pot never runs out.
  - **Legislated minimum pension drawdowns:** age-based minimum rates for account-based pensions, cited and added to the July recalibration list.
- **Early retirement:** the "bridge" years before 60 are paid from investments outside super. The engine flags if that bridge money runs out before super unlocks.
- **Life events flow through:**
  - The home loan ending (already), kids leaving home (item 10), retirement costs (item 10), downsizing (a one-off: sell, buy smaller, and the difference goes to investments).
- **Later:** the Age Pension (assets and income tests), so retirement isn't understated for modest balances. It's documented, not first.

**Size:** XL. It's the core of the "modelling" promise and unlocks item 3's Retirement view and item 8's "chance it lasts".

**Decisions:**
- Horizon "to age 95" or keep "N years"?
- Should net worth on Home include super from now on? Today it deliberately doesn't (one definition, `netWorth.ts`). Recommendation: keep Home as is and show super as a separate band in Future.

## 12. Where new features land first

**Today:**
- You use the NAS daily, and the app is catching up.
- The agreed plan retires the NAS UI once the app's web build reaches parity.

**Recommendation:**
- All logic goes in `packages/core`, so both clients get identical numbers. That's already the rule.
- Engine changes (9, 11, school fees, income) appear on the NAS charts first, because that's where you'll judge them.
- New screens (scenario compare, children, income sources, modifiers) are built in the app first and ported to the NAS only where you need them daily. Doing them twice is the cost of the gap.

**Decision:** agree?

---

## Suggested order

| Step | Items | Why this order |
|---|---|---|
| **A. Quick wins** | 1 dark mode; 4 work-pattern cards and Budget "Add a cost"; 3 chart consolidation (NAS) | Visible, low risk, no model changes |
| **B. Foundation** | People's ages and a `child` table; 11 life-course engine (retirement, super inside, drawdown strategies) | Everything below builds on it |
| **C. Spending realism** | 9 cash-buffer rule; 10 life-stage modifiers | Small once B exists |
| **D. Scenarios** | 2 save and compare; 7 school fees v2 | Compare is most useful once the model is realistic; school-fee choices are its headline use |
| **E. Uncertainty** | 8a ranges, glide path; then 8b Monte Carlo | Needs B's retirement to answer "will it last" |
| **F. Income and tax** | 5a portfolio yield and franking; 6 salary packaging; 5b business; 5c rental | Biggest tax-engine change; research and citations |

Each step ships as its own phase with tests in core (hand-worked figures), both clients checked at 390px and 1280px, and a CLAUDE.md entry.

## Things to remember when building

- Schema changes follow `proviso-schema-change`: additive, D3 ids, migrations for both Prisma (the NAS) and Drizzle (the app) while both live, and the sync protocol unaffected (the relay stores ciphertext).
- Every new government figure needs a citation and a place in the July recalibration list (`CLAUDE.md` Backlog).
- Defaults must reproduce today's numbers unless a change is deliberate. Where numbers move (as in Phase 36), say so and get the owner's OK before shipping the NAS image.
- "Estimates, not advice" wording stays wherever returns, drawdown or tax appear.
