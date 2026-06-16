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
penalties that fired. Worked example — the **Image safe-zone = 69** we verified
(compact card, ~0.85 image, long text, subject near the edge):

| Platform | Start | Penalty (file:line) | Reason / slide |
|---|---|---|---|
| iOS | 100 | −15 (`:223`) | focal outside central safe zone |
| Android | 100 | →65 (`:165`) | focal inside crop but outside safe zone |
| Android | 65 | −12 (`:190`) | high crop severity (long text shrinks media) — xPlatform s15 |
| | | **avg(85, 53) = 69** | |

So the honest answer in the room is: *"69 because the subject sits outside the
central safe zone (costs both platforms) and the long text forces a severe
Android crop. Move the subject in and shorten the copy and it climbs."* Then
the overall is just the weighted sum — open the score panel, the four bars
**are** the breakdown.

Key explanation move: **overall is a weighted average of two platforms, not a
min** (`:418-420`). A card great on iOS but broken on Android lands mid-range,
not low — a deliberate (and debatable) product choice worth naming.

### Where & why the image/crop math lives where it does

- The geometry is in `lib/cropMath.ts` as **pure functions** (`getVisibleWindow`
  derives the real cover-crop window; `criticalSquareWindow` is the iOS 60×60
  centre square; `subjectProminenceWindow` is the simulated re-crop).
- It's separated from scoring because the **same math has three consumers**:
  the score (does the focal point survive the crop?), the live preview (what the
  phone shows), and the improver (the re-crop suggestion). One source of truth,
  no drift between "what we score" and "what we draw."
- Scoring calls it at `scoreRcsContent.ts:147` (Android centre-crop window) and
  `:199` (iOS critical square), then asks one question: *is the focal point
  inside?* That's the entire safe-zone check — geometry + a point-in-rect test.

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
  largest gap.
- **Image *file* validation.** "Verify the images" implies checking format
  (JPEG/PNG/GIF), file size (≤100 MB), and resolution against the 1080p
  baseline. We score *aspect ratio and crop* but never inspect the file itself.
- **GIF-not-animated-on-iOS** (s11) and **video** media specifics — unhandled.
- **Hard character caps** (3072 body, 200/2000 overflow page) and **link-preview
  behaviour** (s9–10, s27) — unhandled (no hyperlink-in-text concept).

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

## D. What is deliberately PoC-grade (raise these first)

Honesty here is the strongest move — these are the questions a CTO asks, and
each has a clear, cheap fix because the core is already clean.

| Gap | Why it matters for prod | Fix (and why it's cheap) |
|---|---|---|
| **No tests** | This would be the scoring basis — it must be provably correct | The function is pure → golden-file unit tests are trivial. Highest-value next step; would let us *prove* every score. |
| **One 459-line function** | Can't test image scoring in isolation | Split into `scoreText/Image/Actions/Layout`, each pure & tested. Mechanical refactor, no behaviour change. |
| **Penalty weights inline** (−15, −12, 0.25 tolerance, base scores) | Tuning the model means editing logic; not reviewable by a non-dev | Extract a named `ScoringPolicy` config object. Separates *playbook facts* (already external) from *our scoring judgment* (currently buried). |
| **No input validation** | As an API it takes untrusted payloads | Add a schema (zod) at the API boundary; the in-browser path doesn't need it. |
| **No score versioning** | API consumers need reproducible/comparable results over time | Stamp results with `scoringVersion`; bump on rule changes. |
| **Char-per-line text estimate** | Real wrap depends on font metrics; ours is an approximation | Documented as approximate; acceptable for scoring, can be upgraded to real measurement if needed. |
| **Cross-platform = average** | Hides a one-platform failure behind a mid score | Product decision — confirm average vs. worst-case is intended. |

None of these are rework — they're hardening on top of a sound core. The line
to hold in the meeting: **the rules are faithful to the playbook, the engine is
pure and explainable, and the gaps are all "add a layer," not "rebuild."**

---

## E. The one-line answers

- *"Why 58?"* → open the four sub-score bars; each is a subtraction story with a
  slide reference. The overall is their weighted sum (35/30/20/15).
- *"Where's the crop logic?"* → `cropMath.ts`, pure geometry, shared by score +
  preview + improver so they can't disagree.
- *"Can we build production on this?"* → yes — the core is a pure, typed,
  explainable function that already is the API. First three steps to productionise:
  **tests, split the function, externalise the scoring policy.**
