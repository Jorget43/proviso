# Phase 3 — CDR Bank Feeds: Cost & Vendor Map

**Researched June 2026.** Deep-research synthesis (5 parallel source sweeps, cross-verified). Informs the Phase 3 roadmap item: replacing/augmenting CSV import with automated bank feeds via the Consumer Data Right (CDR / Open Banking).

> **Confidence caveat:** During research, `WebFetch` was HTTP-403 blocked on vendor/regulator pages, so figures derive from search-result summaries of those primary pages, not full reads. **Every vendor gates pricing behind "contact sales"** — all dollar figures are ballpark (low–medium confidence). Structural/legal facts are cross-corroborated (high confidence). Re-verify exact figures with vendor sales + an assurance firm before committing.

## Bottom line

For a small/self-hosted product, the only economically viable route to live bank feeds is the **CDR Representative model** via an intermediary (~**$15k–60k all-in first year**, ~2-week onboarding, no assurance audit). Direct accreditation is **$100k–500k+/yr** — out of reach. **CSV stays the permanent $0 core**, reinforced by the macro picture: the government is *narrowing* CDR ("rightsize, don't expand"), bank data quality is patchy, and consumer adoption is **~0.3%**.

## Accreditation tiers (read-only data path)

| Tier | Accredited? | Infosec burden | Ballpark cost | Time | Proviso fit |
|------|:-----------:|----------------|---------------|------|-------------|
| **CDR Representative** | No — Principal liable | None of your own (contractual) | Platform fee only | ~1–8 wks | ✅ Best |
| **Sponsored / Affiliate** | Yes (via sponsor) | Self-attest infosec (no ASAE 3150) | < unrestricted | 1–3 mo | ~ Maybe later |
| **Unrestricted ADR** | Yes | ASAE 3150 report (Type 1, then Type 2 every 2 yrs) | $100k–500k+/yr¹ | 4–9 mo | ✗ Overkill |
| **Trusted Adviser** | No | None | n/a | n/a | ✗ Advisers only |
| **OSP** | No | Infosec via contract | n/a | n/a | ✗ Vendor-side |
| **Action initiation / business consent** | varies | n/a | n/a | n/a | ✗ Write-access; dormant |

¹ ASAE 3150 audit *alone*: ~$12k–35k (specialist) → $70k–160k+ (Big Four); historical floor cited as "$60k+". Total program (security uplift + legal + audit + first-year ongoing) lands at $100k–500k+.

## Vendor map

| Vendor | Owner (2026) | Model for you | Self-serve sandbox | Pricing | Scraping? | Indie fit |
|--------|--------------|---------------|:------------------:|---------|:---------:|-----------|
| **Fiskil** | Independent | Rep / sponsored / ADR | ✅ | Contact sales | CDR-only | ✅ Most API-first, fastest |
| **Basiq** | Cuscal² | CDR Representative | ✅ | ~$0.39/user/mo (unconfirmed); 12-mo min, per-billable-user | Yes (sunsetting) | ✅ Established, billing unfriendly to 1-household |
| **Adatree** | Fat Zebra | Rep / sponsored | ✗ | Contact sales (premium) | CDR-only | ~ ~2-wk go-live (clearest figure) |
| **Frollo** | Independent ADR | Rep / sponsor | ✗ | Contact sales | CDR-only | ~ Lending-focused |
| **Biza.io** | Independent | Rep + migration path | ✗ (test lab) | Contact sales | CDR-only | ~ Infra-heavy |
| **Mastercard Open Banking** | Mastercard | Rep under their ADR | ✗ | Contact sales | CDR | ✗ Enterprise/SME |
| **illion / Experian** | Experian³ | Via Experian ADR | ✗ | Contact sales | Both | ✗ Enterprise/lending |
| **Yodlee** | Envestnet | Rep / intermediary | ✗ | Contact sales | Both (FastLink) | ✗ Enterprise; scraping-exposed |
| **Worldline** | — | N/A | — | — | — | ✗ Non-starter — AU presence is the ANZ *payments* JV; its open-banking is EU/PSD2 only |

² Basiq: Cuscal acquired it (2024); Mastercard held an earlier stake. ³ Experian completed its ~A$820m illion acquisition 30 Sep 2024.

## Regulatory context (affects cost/availability)

- **CDR "reset" (Aug 2024)** — Assistant Treasurer called it "a good idea, badly executed." Scope being narrowed; telecoms/insurance/super expansion paused; **non-bank lending the only active expansion** (rules commenced Mar 2025, phased compliance 2026–27).
- **Productivity Commission final report (Dec 2025)** — "rightsize" CDR: fix banking + energy before expanding. No government response located as of research date.
- **Banking coverage ~99.7% of household deposits**, but **data quality is a real weakness** (a 2025 analysis: 97% of banks had ≥1 open-banking data issue; HSBC paid $33k in infringement notices). Plan reconciliation, not a clean drop-in.
- **Screen scraping is NOT banned** and won't be imminently — advice-stage only, and *conditional* on CDR being "a viable alternative" (which current gaps mean it isn't yet). Legacy aggregators aren't at near-term risk, but CDR is the politically favoured path.
- **Action initiation** — law passed Aug 2024 but dormant; irrelevant to read-only feeds.
- **Adoption ~0.3%** of bank customers; ADR market thin and consolidating (~15% have surrendered accreditation).

## Ranked shortlist for Proviso

1. **CSV-only (status quo) — $0, permanent core.** Zero compliance, zero regulatory risk, and it *is* the data-sovereignty moat. Keep it as the default forever.
2. **CDR Representative via Fiskil** (or Basiq) — the only indie-scale paid path. ~$15k–60k first year, dominated by a 12-month platform minimum; ~2–8 week onboarding; no ASAE 3150. Fiskil is the most developer/API-first; Basiq is most established but its per-billable-user + 12-mo-minimum billing is awkward for a single-household app. Get a written per-active-user quote before committing.
3. **Do not** pursue direct accreditation (only if Proviso becomes a funded multi-tenant SaaS), and **avoid** building on screen-scraping (sunset risk + it requires handing over bank credentials, contradicting the positioning).

## The strategic tension (for later, not forced now)

Every CDR Representative route pipes the user's data through the **Principal's accredited cloud** — the opposite of "data never leaves your Unraid box." So CDR feeds can only ever be an **opt-in convenience layer**, never the default, if the self-hosting moat is to survive.

## Architecture note (deferred — "research first, then decide")

When/if implemented, the seam is `parseCsvText(raw, customRules): ParsedTransaction[]` in `lib/actuals.ts`. A CDR adapter should emit the same `ParsedTransaction[]` behind a shared `TransactionSource` interface, with CSV remaining one adapter (permanent fallback). No code written yet.

## Sources

- **Regulator/legal:** cdr.gov.au accreditation guidelines v6 (Aug 2025) & supplementary infosec guidelines v6 (Apr 2025), OAIC participant/sponsored/OSP/trusted-adviser guidance, RSM "Definitive Guide to CDR Access," King & Wood Mallesons, Ashurst (action initiation; CDR reset), Productivity Commission "Harnessing data and digital technology" (No. 111, Dec 2025), Treasury reset materials.
- **Vendors:** basiq.io, adatree.com.au, frollo.com.au, biza.io, fiskil.com, experian.com.au (Open Data Solutions), yodlee.com, mastercard.com newsroom, worldline.com.
- **Cost:** AssuranceLab CDR, SOC2Auditors Australia, Fiskil compliance guide, Cornwalls "CDR as a service."
- **Market/state:** ABA CDR Strategic Review (Jul 2024), iTnews, The Adviser, Open Banking Expo, SmartCompany, Cuscal, Fat Zebra / Open Banking Expo (Adatree acquisition), Experian plc newsroom (illion acquisition).
