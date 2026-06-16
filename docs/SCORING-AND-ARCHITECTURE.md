# RCS Compatibility Scoring — How it works & why it's built this way

A briefing for the technical review. Two halves: (A) how to explain any score
on the spot, and (B) why the architecture is sound — and what is deliberately
POC-grade and would be hardened for production.

---

## A. The engine in one breath

`scoreRcsContent(content) → ScoreResult` is **one pure function**
(`lib/scoreRcsContent.ts`). Same input always gives the same output — no
network, no AI, no randomness, no clock. It runs in the browser today and is
literally the body of the future scoring API unchanged.

It produces:

```
overall (0–100) + iosScore + androidScore
 4 sub-scores:  imageSafeZone 35% · textFit 30% · actions 20% · layout 15%
 warnings[]     (severity, platform, category, message, slide citation)
 recommendations[]
```

**Overall = 0.35·image + 0.30·text + 0.20·actions + 0.15·layout.** The weights
(`scoreRcsContent.ts:34`) come from the product spec, not the playbook — they
encode *our* judgment of what hurts a customer most (a cropped logo > one extra
button).

### Three-layer separation (the important architectural point)

| Layer | File | Responsibility | "Truth" it owns |
|---|---|---|---|
| **Rules** | `lib/rcsRules.ts` | Playbook facts: DP sizes, line limits, thresholds, citations | *What Google says* |
| **Geometry** | `lib/cropMath.ts` | Pure `object-fit: cover` math, safe-zone windows | *Where the image crops* |
| **Scoring** | `lib/scoreRcsContent.ts` | Apply rules + math → score + cited warnings | *Our verdict* |
| **Presentation** | `components/*` | Render previews & score; no logic | — |

Nothing in the scoring file invents a rendering rule — it *consumes* the rules
and the math. That is why every warning can cite a slide: the citation travels
with the rule.

---

## B. "Why is this 58 and not higher?" — answering live

Every score is a subtraction story. To answer "why not higher" you read the
penalties that fired. Worked example — the default sample's **Image safe-zone =
52** (compact card, 0.8 image, long text, subject in the top-right corner):

| Platform | Start | Penalty | Reason / slide |
|---|---|---|---|
| iOS | 100 | −15 | focal outside the central safe zone |
| Android | 100 | →30 | focal **outside** the Android crop window (critical) |
| Android | 30 | −12 | high crop severity (long text) — xPlatform s15 |
| | | **avg(85, 18) = 52** | |

So the honest answer in the room is: *"52 because the product sits in the corner
— outside the Android crop entirely, and outside the central safe zone on iOS.
Drag it to the centre and shorten the copy and it climbs."* The overall is just
the weighted sum — open the score panel, the four bars **are** the breakdown.

Key explanation move: **overall is a weighted average of two platforms, not a
min**. A card great on iOS but broken on Android lands mid-range, not low — a
deliberate (and debatable) product choice worth naming.

### Where & why the image/crop math lives where it does

- The geometry is in `lib/cropMath.ts` as **pure functions** (`getVisibleWindow`
  derives the real cover-crop window; `criticalSquareWindow` is the iOS 60×60
  centre square; `applyVerticalCrop` is the text-driven punch-in;
  `subjectProminenceWindow` is the simulated re-crop).
- `rcsRules.ts` composes these into `androidCropWindow(aspect, format, lines)` —
  a fixed-container cover crop plus a **monotone vertical punch-in** that grows
  with text length [xPlatform s15]. Fixed container + punch-in guarantees the
  surviving area only ever *shrinks* as text grows, for every image aspect.
- That one function is the **single consumer of truth** for the score (does the
  focal survive the crop?), the live preview (what the phone draws), and the
  improver — so "what we score" and "what we draw" cannot drift.

---

## Scope boundaries — what we deliberately do not score (and what's missing)

The unit of analysis is **one rich card / one message turn**. `RcsContent` is a
single card: title, description, one image, suggestions, format. There is no
conversation history, no preceding/following messages, no turn order. Two
buckets follow from that — and they are different things:

### Defensible boundaries (out of scope by construction)

- **The slide 32–41 suggestion-behaviour matrix.** Those slides describe how
  suggestions render *following* a text/card/carousel and how mixes behave
  *across turns* (persistent vs. transient on Android). A single-card payload
  can't express any of it. We distil only the one single-card-relevant rule from
  that range: iOS collapses >2 actions into an "Options" dropdown (s42). Full
  fidelity needs a **conversation-level model** (`Turn[]`), not a card — which is
  naturally an agent-layer concern, not a scorer concern.
- **Device variability** (font size, orientation) — surfaced as a caveat, not
  computed; the playbook itself says the 3-line budget varies by device.

### Actual gaps vs. the stated goal (backlog, not boundaries)

These are in the brief ("verify the images and content … score for Apple-only
and Android-only", and the carousel example) but **not yet modelled** — they are
genuine gaps, not scoping decisions:

- **Carousels.** The brief explicitly asks for a 3-product carousel; the format
  enum is single-card only (`compact|medium|tall`). Carousel media tables
  (CardMedia) and carousel text/CTA rules (s14) are unscored. This is the
  largest remaining gap.
- **Image *file* validation.** "Verify the images" implies checking the file
  itself — format (JPEG/PNG/GIF), file size (≤100 MB), resolution vs the 1080p
  baseline, GIF-not-animated-on-iOS (s11). We score aspect ratio and crop but
  the data model carries no file type/size, so the file is never inspected.
- **Link-preview behaviour** (s9–10, s27) — no hyperlink-in-text concept.

*Closed by the playbook-faithfulness audit (2026-06):* the iOS 200/2000
overflow-page caps (s23), the cross-platform 3-line check (s11, previously
iOS-only), and action-before-replies ordering (s21) are now scored.

Naming these explicitly keeps the line clear: the conversation matrix is a
*different model*; carousels and file validation are *missing coverage of the
current model's goal* and belong on the roadmap.

---

## C. Why it's architecturally sound (for production)

1. **Pure, deterministic core.** `(content) → result`, no side effects. This is
   the single most important property: trivially testable, trivially cacheable,
   and it *is already* the API handler — wrap it in a route, done. No rewrite
   between PoC and prod.
2. **Separation of concerns** (table above). Rules, math, scoring, UI are
   independent. The playbook facts can change (Google updates a deck) without
   touching scoring logic.
3. **Explainability is structural, not bolted on.** Each warning carries its own
   recommendation + slide. The score is never a black box — required for a
   customer-facing "why did I get this score" and for trust.
4. **Strong typing** (`types/rcs.ts`) shared across UI and logic — the contract
   is explicit and compiler-enforced.
5. **The deterministic engine becomes the AI's judge.** When the LLM/agent layer
   lands, this exact function verifies its output (generate → score → fix). The
   PoC investment is not throwaway; it's the safety rail for the AI phase.

---

## D. Production-hardening status

Done (playbook-faithfulness audit, 2026-06):

- ✅ **Tests** — 86 unit tests (`lib/*.test.ts`, `npm run test:run`): pure-function
  golden values, a 15-case crop-monotonicity matrix, suggestion/text/image
  boundaries, the improver, and a citation-coverage guard.
- ✅ **Function split** — `scoreRcsContent` is now four pure, independently
  tested sub-scorers (`scoreText/Image/Actions/Layout`), proven
  behaviour-identical to the pre-split version via captured goldens.
- ✅ **Magic numbers named** — `RATIO_DEVIATION_TOLERANCE`, the compact thumbnail
  bounds, and the iOS overflow caps are now named, cited constants.

Still PoC-grade (each is "add a layer," not "rebuild"):

| Gap | Why it matters for prod | Fix |
|---|---|---|
| **Penalty weights still inline** (−15, −12, base scores) | Tuning the model edits logic, not config | Extract a named `ScoringPolicy` object — separate playbook facts from scoring judgment. |
| **No input validation** | As an API it takes untrusted payloads | Add a schema (zod) at the API boundary. |
| **No score versioning** | API consumers need reproducible/comparable results | Stamp results with `scoringVersion`. |
| **Char-per-line text estimate** | Real wrap depends on font metrics | Documented approximation; upgradeable to real measurement. |
| **Cross-platform = average** | Hides a one-platform failure behind a mid score | Product decision — confirm average vs. worst-case. |

The line to hold: **the rules are now provably faithful to the playbook (tested),
the engine is pure and explainable, and what remains is "add a layer," not
"rebuild."**

---

## E. The one-line answers

- *"Why 58?"* → open the four sub-score bars; each is a subtraction story with a
  slide reference. The overall is their weighted sum (35/30/20/15).
- *"Where's the crop logic?"* → `cropMath.ts`, pure geometry, shared by score +
  preview + improver so they can't disagree.
- *"Can we build production on this?"* → yes — the core is a pure, typed,
  explainable function that already is the API. First three steps to productionise:
  **tests, split the function, externalise the scoring policy.**
