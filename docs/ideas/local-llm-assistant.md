# Idea: a local LLM assistant (not planned)

**Status:** an idea to explore, evaluated 2026-10-09. Not a planned phase, and nothing is built. Model names and speeds below reflect the landscape as of mid-2026; re-check them before acting.

**The idea (owner, 2026-10-09):** a lightweight model hosted entirely locally (on the NAS, or on the phone) that could:
1. categorise Actual spending transactions more accurately than the rules, and
2. give a plain-language interface for exploring scenarios ("what would it look like if my savings rate was 10% instead of 5%?").

**Constraints:**
- Inference is fully local. Data is never sent anywhere; that's Proviso's core promise.
- The model may never change stored data. It may only help configure scenarios.

## Verdict

Feasible, if the model is a translator, not a calculator or an editor. It turns language into structured proposals, which `packages/core` checks and calculates, and which the user accepts or discards. Finance-tuned models aren't the key; small general-purpose models with good tool calling suit these two tasks better.

## 1. Categorisation

- **First, no LLM:**
  - Merchant normalisation: strip `SQ *`, card numbers and suburbs, so the same merchant always matches.
  - Similarity to the user's own categorised history, using a tiny embedding model (tens of MB, milliseconds per transaction, runs on a phone).
  - It builds on the existing rules (`categorisationRule`, hit counts) and the review flow (`suggestionState`).
  - Likely most of the gain, on any hardware.
- **Then, optionally, an LLM for the low-confidence leftovers:**
  - It runs in a batch (overnight) and produces suggestions that go into the review queue, never straight into the data.
  - It helps with merchants never seen before.
  - Small models know Australian merchants only patchily.
- **Measure first:** build a private test set of labelled transactions, kept outside the repo since it's personal data, and score today's rules against each layer.

## 2. Plain-language scenarios

1. The user types a request.
2. The model may only return one action from a fixed list, as JSON constrained by a schema, e.g. `{ savingsRate: 10 }`.
3. The proposal is checked with the zod schemas in core.
4. The engine runs the projection. Every number shown comes from core, never from the model.
5. The result appears as a draft against the plan; nothing changes until the user taps **Keep**. This matches the app's What if? (Phase 33).
6. Read-only questions ("when's the loan paid off?") work the same way: the model picks a question, core answers it, and the model only phrases the answer.

**Depends on:** saved scenarios (`docs/plan-modelling-and-ux.md` item 2). A sentence becomes a named scenario you can compare on the charts.

**Advice boundary:** the assistant sticks to the mechanics of "what if". "Should I …?" questions risk personal financial advice (ASIC); it declines them and offers the what-if version. "Estimates, not advice" stays.

## Hardware (rough, unmeasured)

| Where | Fits | Speed |
|---|---|---|
| Weak NAS (N100 class, 8–16 GB RAM, no GPU) | 1–4B-parameter models, compressed to about 4 bits per weight | Batch categorising fine; a chat answer roughly 5–30 seconds |
| NAS with a GPU | 7–8B models | Near-instant |
| Phones | iOS: Apple's on-device model (Foundation Models framework, iOS 26+). Android: Gemini Nano on some devices. Or a bundled 1–2B model (a 1–2 GB download). | Fast on recent phones; availability varies |

**Model choice:** small instruct models with tool calling (the Qwen, Gemma, Phi and Llama small families). Pick on:
- **Licence:** these range from Apache 2.0 or MIT to custom terms; it matters once Proviso is a product.
- **Scores** on our own test sets.

## The architecture question

- **Most app-first users won't have a NAS.** A NAS-only assistant serves the homelab minority.
- **The relay only ever sees ciphertext.** A NAS model needs plaintext, so for app users the NAS would have to join the household as a device holding the key. The legacy NAS web app already holds plaintext.
- **Shape:** one shared definition of the allowed actions and questions in `packages/core`, with local backends that plug in:
  - the NAS, as an optional `assistant` container under its own compose profile, like the sync relay
  - the phone's built-in model
  - a bundled small model

  No cloud backends, ever. Where no local model exists, the plain-language box is simply absent.

## Making the privacy promise checkable

- The model container has no outbound network access (internal Docker network only), and users can confirm it with `docker inspect`.
- Weights are downloaded once, checked against a published checksum, and named in the docs.
- The interface says "Runs on this device" or "Runs on your NAS".
- A log of everything the assistant proposed and what was kept.
- It's kept separate from the main image, so users who don't want it never download it.

## If it's picked up

| Step | What | Size |
|---|---|---|
| 1 | Private test set; measure today's rules | S |
| 2 | Categorising v2 without an LLM (normalisation, learning from corrections) | M |
| 3 | Saved scenarios (plan item 2) | L |
| 4 | Shared core definition of allowed actions and questions, plus validation | M |
| 5 | Optional NAS `assistant` container, no network: LLM categorising suggestions and plain-language what-ifs | M–L |
| 6 | Phone backends (Apple's and Android's built-in models) | M per platform |

Steps 1–2 are worth doing regardless of the LLM.

**Main risks:**
- small models' accuracy on Australian merchant names
- the upkeep of several model backends
- memory pressure on small NAS boxes
