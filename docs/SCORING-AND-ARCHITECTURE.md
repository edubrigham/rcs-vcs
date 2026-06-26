# RCS Compatibility Scoring — How it works & why it's built this way

The rationale companion to **`docs/PORTING.md`**. PORTING.md tells the Naxai
Core team *what* to lift (the `lib/` kernel) and *how* it maps to the sendRCS
OpenAPI; this doc explains *why* the kernel is shaped the way it is and how to
explain any score on the spot. Two halves: (A) how the engine produces a number
you can defend, and (B) why the architecture survives the port into the private
API.

---

## A. The two axes (the first thing to understand)

The kernel answers **two different questions** with two pure functions
(`lib/`, imports nothing from React/Next — verified):

```ts
// 1. "Will the API accept this at all?" — binary, sourced from the sendRCS OpenAPI (a 422).
validateFunctional(card, media?) → FunctionalResult        // lib/validateFunctional.ts

// 2. "Will it render well on iOS vs Android?" — gradual 0–100, sourced from the UX playbooks.
scoreRcsContent(card, media?, focal?) → ScoreResult         // lib/scoreRcsContent.ts
```

Keep them separate in your head: **functional** is a hard gate (title ≤ 200,
≤ 4 suggestions, supported MIME, thumbnail ≤ 100 KB — the things that make the
API reject the payload). **Quality** is advice (a cropped logo, truncated copy)
that never blocks a send. A card can be perfectly *valid* and still score 50.

Both are deterministic: same input always gives the same output — no network, no
AI, no randomness, no clock. They run in the browser demo today and translate
directly into the body of the Naxai private API.

`scoreRcsContent` produces:

```
overallScore (0–100) + iosScore + androidScore
 4 sub-scores:  imageSafeZone 35% · textFit 30% · actions 20% · layout 15%
 warnings[]     (severity, platform, category, message, slide citation)
 recommendations[]
```

**Overall = 0.35·image + 0.30·text + 0.20·actions + 0.15·layout.** The weights
(`scoreRcsContent.ts:43`) come from the product spec, not the playbook — they
encode *our* judgment of what hurts a customer most (a cropped logo > one extra
button).

### Layer separation (the important architectural point)

| Layer | File | Responsibility | "Truth" it owns |
|---|---|---|---|
| **Functional** | `lib/validateFunctional.ts` | OpenAPI hard limits → pass/fail violations | *What the API rejects* |
| **Rules** | `lib/rcsRules.ts` | Playbook + guide facts: DP sizes, line limits, MIME lists, thresholds, citations | *What Google says* |
| **Geometry** | `lib/cropMath.ts` | Pure `object-fit: cover` math, safe-zone windows | *Where the image crops* |
| **Media** | `lib/media/introspect.ts` | Bytes + headers → type/size/dimensions | *What the asset actually is* |
| **Scoring** | `lib/scoreRcsContent.ts` | Apply rules + math → score + cited warnings | *Our verdict* |
| **Presentation** | `components/*` (+ `cardView.ts`) | Render previews & score; no logic — disposable shell | — |

Nothing in the scoring file invents a rendering rule — it *consumes* the rules
and the math. That is why every warning can cite a slide: the citation travels
with the rule. The functional and media layers are independent of scoring — a
porter can wire `validateFunctional` into the 422 path and `scoreRcsContent`
into a "quality report" field without coupling them.

---

## B. "Why is this 52 and not higher?" — answering live

Every score is a subtraction story. To answer "why not higher" you read the
penalties that fired. Worked example — the default sample (a **HORIZONTAL**
card, 0.8-aspect portrait image, long title + description, the product placed
top-right at focal `(0.82, 0.18)` — outside the safe zone) scores
**overall 50 · iOS 58 · Android 41**, and its **Image safe-zone sub-score = 52**
breaks down as:

| Platform | Start | Penalty | Reason / slide |
|---|---|---|---|
| iOS | 100 | −15 | focal outside the central safe zone |
| Android | 100 | →30 | focal **outside** the Android crop window (critical) |
| Android | 30 | −12 | high crop severity (long text) — xPlatform s15 |
| | | **avg(85, 18) ≈ 52** | |

So the honest answer in the room is: *"52 because the product sits in the corner
— outside the Android crop entirely, and outside the central safe zone on iOS.
Drag it to the centre and shorten the copy and it climbs."* The overall is just
the weighted sum — open the score panel, the four bars **are** the breakdown.

Key explanation move: **overall is a weighted average of two platforms, not a
min**. A card great on iOS but broken on Android lands mid-range, not low — a
deliberate (and debatable) product choice worth naming.

### Where & why the image/crop math lives where it does

- The geometry is in `lib/cropMath.ts` as **pure functions** (`getVisibleWindow`
  derives the real cover-crop window; `criticalSquareWindow` is the iOS centre
  square; `applyVerticalCrop` is the text-driven punch-in;
  `subjectProminenceWindow` is the simulated re-crop).
- `rcsRules.ts` composes these into
  `androidCropWindow(aspect, orientation, mediaHeight, lines)` — a fixed-container
  cover crop plus a **monotone vertical punch-in** that grows with text length
  [xPlatform s15]. Fixed container + punch-in guarantees the surviving area only
  ever *shrinks* as text grows, for every image aspect.
- That one function is the **single consumer of truth** for the score (does the
  focal survive the crop?), the live preview (what the phone draws), and the
  improver — so "what we score" and "what we draw" cannot drift.

---

## Scope boundaries — what we deliberately do not score (and what's missing)

The unit of analysis is **one rich card / one message turn**. A
`StandaloneRichCard` (the `rcsContentBody` standalone arm) is a single card:
title, description, one `media` block, suggestions, and the
`cardOrientation` × `media.height` shape. There is no conversation history, no
preceding/following messages, no turn order. Two buckets follow — and they are
different things:

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

### Closed since the 2026-06 functional/media work

- **Image *file* validation — now done.** `lib/media/introspect.ts` derives the
  real type/size/dimensions from the fetched asset, and `validateFunctional`
  checks the supported-MIME list and the thumbnail ≤ 100 KB limit. Animated-GIF
  and file-size warnings are scored. (Video is header-only — type + size — by
  design; no guide rule needs video dimensions.)
- **Naxai-aligned model — now done.** The core types mirror the sendRCS OpenAPI
  1:1 (`StandaloneRichCard`/`cardContent`/`media`/`contentInfo`/`suggestions`),
  so the kernel speaks the porters' contract directly.
- *Earlier (playbook-faithfulness audit):* the iOS 200/2000 overflow-page caps
  (s23), the cross-platform 3-line check (s11), and action-before-replies
  ordering (s21) are scored.

### Actual gaps vs. the stated goal (backlog, not boundaries)

- **Carousels.** The largest remaining gap. `RcsContentBody` currently models
  the `messageText` and `standaloneRichCard` arms; the `carouselRichCard` arm
  (2–10 cards) is future work (Spec 2). Carousel media tables and carousel
  text/CTA rules (s14) are unscored.
- **Link-preview behaviour** (s9–10, s27) — no hyperlink-in-text concept.

Naming these explicitly keeps the line clear: the conversation matrix is a
*different model*; carousels are *missing coverage of the current model's goal*
and belong on the roadmap.

---

## C. Why it's architecturally sound (for the port)

1. **Pure, deterministic core.** `(card, media, focal) → result`, no side
   effects. This is the single most important property: trivially testable,
   trivially cacheable, and it translates to any language unchanged. The golden
   vectors (`lib/__vectors__/`) are exactly this property turned into a
   cross-language parity contract — see PORTING.md §6.
2. **Separation of concerns** (table above). Functional, rules, math, scoring,
   media, and UI are independent. The playbook facts can change (Google updates a
   deck) without touching scoring logic; the functional limits can change (Naxai
   bumps a cap) without touching the playbook layer.
3. **Two axes, never conflated.** Functional rejection (422) and quality advice
   are computed by separate functions with separate sources of truth. The porter
   wires them into different parts of the API response.
4. **Explainability is structural, not bolted on.** Each warning carries its own
   recommendation + slide. The score is never a black box — required for a
   customer-facing "why did I get this score" and for trust.
5. **Strong typing** (`types/rcs.ts`) shared across UI and logic, mirroring the
   OpenAPI — the contract is explicit and compiler-enforced.
6. **The deterministic engine becomes the AI's judge.** When the LLM/agent layer
   lands, this exact function verifies its output (generate → score → fix). The
   kernel investment is not throwaway; it's the safety rail for the AI phase.

---

## D. Production-hardening status

Done:

- ✅ **Functional layer = input validation** — `validateFunctional` enforces the
  OpenAPI hard limits (title/description length, ≤ 4 suggestions, label ≤ 25,
  open-URL length, supported MIME, thumbnail ≤ 100 KB). This is the schema gate
  an API needs at its boundary, sourced from the contract that actually 422s.
- ✅ **Media fetch is SSRF-hardened** — `lib/media/ssrfGuard.ts` +
  `app/api/media-info/route.ts`: https-only, DNS resolved and every address
  CIDR-classified (ipaddr.js), connection pinned to a validated IP (defeats DNS
  rebinding/TOCTOU), byte cap + timeout, range reads only.
- ✅ **Tests** — the full kernel suite (`npx vitest run`): pure-function golden
  values, a crop-monotonicity matrix, suggestion/text/image boundaries, the
  functional-validation and media-introspection boundary cases, the improver,
  the golden parity vectors, and a citation-coverage guard.
- ✅ **Function split** — `scoreRcsContent` is four pure, independently tested
  sub-scorers (`scoreText/Image/Actions/Layout`), proven behaviour-identical to
  the pre-split version via captured goldens.
- ✅ **Magic numbers named** — ratio tolerance, the thumbnail bounds, the iOS
  overflow caps, and the functional limits (`FUNCTIONAL_LIMITS`) are named, cited
  constants.

Still PoC-grade (each is "add a layer," not "rebuild"):

| Gap | Why it matters for prod | Fix |
|---|---|---|
| **Penalty weights still inline** (−15, −12, base scores) | Tuning the model edits logic, not config | Extract a named `ScoringPolicy` object — separate playbook facts from scoring judgment. |
| **No score versioning** | API consumers need reproducible/comparable results | Stamp results with `scoringVersion`. |
| **Char-per-line text estimate** | Real wrap depends on font metrics | Documented approximation; upgradeable to real measurement. |
| **Cross-platform = average** | Hides a one-platform failure behind a mid score | Product decision — confirm average vs. worst-case. |

The line to hold: **the rules are provably faithful to the playbook and the
OpenAPI (tested), the engine is pure and explainable, and what remains is "add a
layer," not "rebuild."**

---

## E. The one-line answers

- *"Why 52?"* → open the four sub-score bars; each is a subtraction story with a
  slide reference. The overall is their weighted sum (35/30/20/15).
- *"Will the API accept it?"* → that's `validateFunctional`, a separate question
  from the score — the OpenAPI hard limits, returned as pass/fail violations.
- *"Where's the crop logic?"* → `cropMath.ts`, pure geometry, shared by score +
  preview + improver so they can't disagree.
- *"Can Naxai Core build production on this?"* → yes — the core is a pure, typed,
  explainable kernel that mirrors the sendRCS contract. Start at **PORTING.md**:
  lift `lib/`, run the golden vectors against the port, assert identical output.
