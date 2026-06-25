# Spec 1 — Media Introspection + Single-Card Guide-Rule Enrichment

- **Date:** 2026-06-24
- **Status:** Approved design (pre-implementation)
- **Author:** Eduardo Brigham (with Claude)
- **Sequence:** Spec 1 of 3. Spec 2 = Carousels. Spec 3 = Broadcast-coupled compose-help API.

## 1. Goal

Two prerequisite capabilities that strengthen the deterministic scoring core
ahead of building the public API, neither of which depends on the (not-yet-
received) RCS Broadcast API spec:

1. **Media introspection** — derive real media information (type, dimensions,
   aspect ratio, file size, and for video an informational duration) from both
   an **uploaded file** and a **fetched URL**, for **images and video**.
2. **Guide-rule enrichment** — integrate the hard limits and recommendations
   from Google's RBM **rich-cards developer guide** into the rules engine,
   routing each rule to the correct axis (functional vs quality).

## 2. Background: two axes, three sources

The directive introduces a distinction the engine does not model today. Every
current output is a smooth 0–100 *quality* score. But the guide's hard numbers
are **functional constraints the downstream API enforces** — exceed them and
the Broadcast API rejects or breaks the message. They are not "low quality";
they are "won't send". The tool's job for these is **pre-flight**: catch them
before the user submits.

| | **Functional limits** | **Quality / compatibility** |
|---|---|---|
| Question | "Will the API accept this at all?" | "Will it render well on iOS vs Android?" |
| Nature | Binary — pass / fail | Gradual — 0–100 |
| Owner / source | The RBM/Broadcast **API** (guide states the limits) | Our judgment from the **UX playbooks** |
| Examples | unsupported file type, title >200, label >25, >4 suggestions, empty card | crop severity, safe zone, recommended aspect/height, animated-GIF, tall-card parity |

**Three sources, with a precedence rule (approved):**

- The **developer guide** wins for *hard limits and canonical dimensions*
  (file types, sizes, max counts, char caps, the official Short/Medium/Tall DP
  heights). It is the normative product spec.
- The **UX playbooks** (Card Media, xPlatform) win for *rendering-quality
  heuristics* (cropping, safe zones, the iOS-vs-Android divergence story).
- Where both give a recommended number for the same thing (aspect ratios),
  prefer the **guide's** canonical value; keep the playbook's as secondary
  advice.
- **Cite all three.** The guide becomes a third citation source.

Source: <https://developers.google.com/business-communications/rcs-business-messaging/guides/learn/rich-cards>

## 3. Decisions (resolved)

1. **Media scope:** images **and** video. Animated-GIF-on-iOS is flagged.
2. **Video introspection depth:** lightweight only — type, dimensions, file
   size via HTTP Range reads. No transcoding, no codec/duration *validation*
   (duration captured as informational; no guide limit to check it against).
   Serverless-friendly; no `ffprobe`/native binary.
3. **Carousels:** carved out to Spec 2 (a structural `Card[]` change, not a rule).
4. **Functional vs quality:** the guide's hard limits become a new **functional
   compliance layer** beside the unchanged 0–100 quality `ScoreResult`. Not
   weighted, not our opinion — sourced from the API's stated limits.
5. **Format taxonomy:** keep the `compact|medium|tall` enum and **remap its
   numbers** to the guide's canonical heights. A full `orientation × height`
   refactor is deferred to Spec 3 (the Broadcast payload will carry explicit
   orientation anyway).
6. **Model rename:** `imageUrl → mediaUrl`, `imageMetadata → mediaMetadata`,
   `ImageMetadata → MediaMetadata`.
7. **Functional checks in scope this round:** the six in §6 (only those
   computable from a single `RcsContent` + its media metadata today).

## 4. Architecture & data flow

```
            ┌─ upload (browser has bytes) ─┐
   media ───┤                              ├──► introspectMedia(headerBytes, {type,size})  [pure]
            └─ URL ─► /api/media-info ──────┘            │
                     (server: Range-fetch                ▼
                      header bytes + SSRF guard)     MediaMetadata
                                                         │
                          ┌──────────────────────────────┼───────────────────────────┐
                          ▼                                                            ▼
              validateFunctional(content) ──► FunctionalResult        scoreRcsContent(content) ──► ScoreResult
                 (pass/fail + violations)                                (0–100, UNCHANGED)
                 source: RBM guide limits                                source: playbooks + guide recommendations
```

**Key property preserved:** parsing stays pure, only fetching is impure.
`introspectMedia` is *bytes in → metadata out* with no I/O, so it runs
identically in the browser (uploads) and the server route (URLs) and is
unit-testable with byte fixtures. The route handler is the only new impure
surface, and it is a thin shell. This is the same brick the future scoring API
will reuse.

## 5. Data model (`types/rcs.ts`)

```ts
export type MediaType = "image" | "video";

export interface MediaMetadata {
  mediaType: MediaType;
  mimeType: string;        // "image/png", "video/mp4" — magic bytes + Content-Type
  width: number;
  height: number;
  aspectRatio: number;     // width / height
  fileSizeBytes: number;
  durationMs?: number;     // video only, informational
}

export interface RcsContent {
  title: string;
  description: string;
  mediaUrl: string | null;        // was imageUrl
  mediaMetadata?: MediaMetadata;   // was imageMetadata: ImageMetadata
  actions: RcsAction[];
  focalPoint: FocalPoint;          // unchanged — cover-crop applies to video too
  cardFormat: CardFormat;          // unchanged enum (numbers remapped, see §7)
}

export type FunctionalLimitId =
  | "mediaType" | "titleLength" | "descriptionLength"
  | "suggestionCount" | "labelLength" | "emptyCard";

export interface FunctionalViolation {
  limit: FunctionalLimitId;
  message: string;
  actual: string | number;
  max?: string | number;
  citation: string;        // RBM guide
}

export interface FunctionalResult {
  passes: boolean;
  violations: FunctionalViolation[];
}
```

`ScoreResult` and `scoreRcsContent` are **untouched**. Callers (the page and
the future endpoint) compose `{ functional, score }` by calling both pure
functions.

## 6. Functional layer (`lib/validateFunctional.ts`)

Pure `validateFunctional(content): FunctionalResult`. Only guide limits
computable from one card today:

| Check (`limit`) | Rule | Source |
|---|---|---|
| `mediaType` | image ∈ {JPEG, PNG, GIF}; video ∈ {H.263, M4V, MP4, MPEG, MPEG‑4, WebM} | guide |
| `titleLength` | ≤ 200 characters | guide |
| `descriptionLength` | ≤ 2000 characters | guide |
| `suggestionCount` | ≤ 4 suggestions per card | guide |
| `labelLength` | ≤ 25 characters per suggestion label | guide |
| `emptyCard` | at least one of {media, title, description} present | guide |

MIME ↔ guide-format matching uses a documented mapping table finalized in the
plan (e.g. H.263 ↔ `video/3gpp`, M4V/MP4/MPEG‑4 ↔ `video/mp4`). PDF media is
regional (India/Google Messages) and excluded from the supported set.

**Behavior change:** `titleLength`, `descriptionLength`, `suggestionCount`,
`labelLength` currently exist as *quality* warnings (the playbooks agree with
the guide). They **move to the functional axis** — hard API rejections, not
quality dings. `improveRcsContent` already fixes title/label/count, so the
Playbook Pass naturally clears these violations as well as improving quality.

## 7. Quality-score enrichment (guide *recommendations* → existing scorers)

Folded into the existing `scoreImage` / `scoreText` / `scoreLayout` and
`rcsRules.ts` as gradual signals, under the approved precedence (guide values
win for canonical dimensions):

- **Card heights → guide canonical:** Short 112 / Medium 168 / Tall 264 DP.
  Remap `verticalFormatMediaHeightCap` (currently `{ medium: 132, tall: 204 }`)
  to `{ medium: 168, tall: 264 }`; reconcile the general `verticalMediaHeightCap`.
  `compact` remains the horizontal 128 DP card (an orientation, not a height);
  the guide's "Short 112" has no current enum slot and is noted for Spec 3.
- **Recommended aspect ratios → guide's 2:1 / 16:9 / 7:3** for vertical cards;
  the playbook's 7:2 / 21:9 / 3:2 retained as secondary advice. The precise
  binding of which ratio maps to which height is confirmed against the guide in
  the plan (principle is fixed — guide values win — only the lookup remains).
  The horizontal `compact` card keeps its playbook ratio (the guide's vertical
  ratios do not apply to it).
- **Animated GIF** → iOS-doesn't-animate warning, driven by the new `mimeType`.
- **≤50 KB thumbnail** = a *recommendation* → quality nudge only. The 100 KB
  hard cap is **not** applied (see §10).

## 8. Citations (`recommendationCitations.ts`)

Add the RBM developer guide as a **third source**. It is a single web page
(not slide-numbered), cited as `RBM rich-cards` resolving to the guide URL
(optionally `#anchor`). Extend `SOURCE_DOCS`, `SECTION_BLURBS`, and the parser;
the existing citation-coverage test guards the new source like the others.

## 9. UI wiring, endpoint, error handling

- **`app/api/media-info/route.ts`** (Next 16 route handler — signature verified
  against `node_modules/next/dist/docs/` before writing, per `AGENTS.md`):
  - **SSRF guard:** https-only; block loopback / private / link-local /
    metadata IPs; cap and re-validate redirects per hop.
  - **HTTP Range request** for the first ~N KB only; hard timeout + total byte
    cap. Never download whole videos.
  - Returns `MediaMetadata` or a structured `{ error, message }` + status.
- **Upload path:** the browser posts only the header slice + `File.size` +
  `File.type` to the same parser (no full-file upload for large video).
- **`RcsInputPanel`:** extend the media input to accept a URL (→ `/api/media-info`)
  alongside upload. Add a **functional-compliance banner**, distinct from
  `ScorePanel`, listing violations as "this won't send" blockers. On `/improve`,
  surface which violations the pass clears.
- **Errors:** bad/unreachable URL, timeout, non-2xx, blocked IP, unsupported
  content-type, unparseable header → UI shows "couldn't read this media"; the
  content scores as no-media. Unrecognized type → a `mediaType` functional
  violation, never a throw.

## 10. Out of scope (and why)

- **Carousels** → Spec 2.
- **Payload ≤ 250 KB check** → cannot measure a payload we do not assemble;
  needs the Broadcast serialization → Spec 3.
- **Thumbnail ≤ 100 KB check** → the cap is specifically the *thumbnail*; the
  single-card model has no separate thumbnail field, and applying it to the card
  image would be incorrect. Deferred until thumbnails are modeled.
- **Video duration/codec validation, `ffprobe`** → ruled out (lightweight only).
- **Broadcast-coupled API contract** → Spec 3.

## 11. Testing

- `introspectMedia`: byte fixtures per format; heaviest coverage on video
  (MP4/WebM header parsing is the main implementation risk).
- `validateFunctional`: each limit's boundary (200/201, 2000/2001, 25/26, 4/5,
  type allow/deny, empty card).
- Reconciliation: assert `rcsRules` now carries the guide's canonical heights
  and aspect set.
- SSRF guard: reject loopback / private / non-https (pure, unit-testable).
- Extend the citation-coverage guard to the RBM source.
- Existing 87 tests must stay green (the rename and the title/desc/label/count
  move from quality → functional update affected assertions).

## 12. Dependencies / follow-ups

- **Spec 2 (Carousels):** `Card[]` model, per-card + aggregate consistency
  (equal widths, 2–10 cards), and the 250 KB total-payload check once payload
  assembly exists.
- **Spec 3 (Broadcast API):** the input contract "based on the RCS Broadcast
  API" (Geoff to send), the orientation × height taxonomy refactor, payload-size
  and thumbnail checks, and the public compose-help endpoints.
