# Spec 1 — Media Introspection + Guide-Rule Enrichment + Naxai-Aligned Core

- **Date:** 2026-06-24 (revised 2026-06-25 after the CIO direction change)
- **Status:** Approved design (pre-implementation)
- **Author:** Eduardo Brigham (with Claude)
- **Sequence:** Spec 1 of 3. Spec 2 = Carousels. Spec 3 = Broadcast-message envelope + adapter (and Phase 2: AI-assistant content creation).

## 0. Goal change — read this first

**We are not building the production API.** The Naxai Core development team will
**port** this PoC's logic into a private production API; architecture and
ownership are set at an upcoming CIO meeting. Our deliverable is therefore a
**port-ready reference**: a framework-free logic kernel whose model mirrors the
real Naxai RCS API, plus a language-agnostic behavioral contract (golden
vectors) and a porting guide. The Vercel SPA, the route handler, and the React
components are a **disposable PoC shell** that demonstrates the kernel — not the
production surface.

Everything below is shaped by one priority: **minimise the porters' friction.**

## 1. Scope of this spec

1. **Naxai-aligned core model** — restructure the kernel's types to mirror the
   Naxai RCS `sendRCS` OpenAPI (`standaloneRichCard` / `cardContent` / `media` /
   `contentInfo` / `suggestions`) so the porters' DTOs map ~1:1.
2. **Media introspection** — derive media info (type, dimensions, aspect, file
   size, video duration) from an uploaded file and a fetched URL, for **images
   and video**, plus the **thumbnail** file size.
3. **Functional-compliance layer** — pre-flight the API's hard limits (the ones
   that produce `422`), sourced from the OpenAPI, beside the unchanged 0–100
   quality score.
4. **Guide-rule enrichment** — fold Google's RBM rich-cards guide
   recommendations into the quality score under the approved precedence.
5. **Portability artifacts** — declarative rule tables, golden test vectors, and
   a porting guide.

## 2. Two axes, three sources

Every current output is a smooth 0–100 *quality* score. The API's hard numbers
are a different kind of thing: **functional constraints the API enforces** — break
them and `sendRCS` returns `422 "The request is invalid"`. The tool pre-flights
them so the user fixes them before sending.

| | **Functional limits** | **Quality / compatibility** |
|---|---|---|
| Question | "Will `sendRCS` accept it?" | "Will it render well on iOS vs Android?" |
| Nature | Binary — pass / fail | Gradual — 0–100 |
| Authority | **Naxai RCS OpenAPI** (the real contract) | Our judgment from the **UX playbooks** |
| Examples | unsupported type, title >200, label >25, >4 suggestions, thumbnail >100 kB | crop severity, safe zone, recommended aspect/height, animated-GIF, ≤50 kB / ≤100 MB advice |

**Source precedence (approved):**
- **Naxai OpenAPI** is authoritative for **functional hard limits** (it is the
  contract that rejects). Confirmed limits: title ≤200, description ≤2000,
  suggestions/card ≤4, label `text` ≤25, thumbnail ≤100 kB, file ≤100 MB
  (recommended), `openUrlAction.url` ≤2048, carousel 2–10 (Spec 2).
- **Google developer guide** explains/sources rules the OpenAPI doesn't spell
  out (supported MIME list, the Short/Medium/Tall canonical DP heights,
  recommended aspect ratios, the "≥1 of media/title/description" rule).
- **UX playbooks** (Card Media, xPlatform) are authoritative for
  **rendering-quality heuristics** (cropping, safe zones, iOS-vs-Android).
- Where sources give a different number for the same thing, **functional →
  OpenAPI wins; canonical dimensions → guide wins; UX → playbooks win.**
- **Cite all three.** The OpenAPI and the guide become cited sources alongside
  the playbooks.

Sources:
- Naxai RCS API — `POST /rcs/agents/{agentId}/messages/send` (OpenAPI 2023-03-25)
- <https://developers.google.com/business-communications/rcs-business-messaging/guides/learn/rich-cards>

## 3. Decisions (resolved)

1. Media scope: images **and** video; animated-GIF-on-iOS flagged.
2. Video introspection: lightweight (type, dimensions, file size via Range
   reads); duration informational; no `ffprobe`/native binary.
3. Carousels → Spec 2. Broadcast envelope + adapter → Spec 3.
4. Functional vs quality: a new functional-compliance result beside the
   unchanged 0–100 `quality` score.
5. **Data-model alignment: option A — mirror the Naxai OpenAPI in the core.**
6. Thumbnail support **included** (`thumbnailUrl` + the 100 kB functional check).
7. Functional checks this round: those computable from one `standaloneRichCard`
   + introspected media (see §6).

## 4. Portability principles (the new frame)

1. **The kernel is the product.** `lib/` already imports nothing from React/Next
   — keep that boundary absolute. The kernel is what gets ported. The route
   handler + components are the disposable shell.
2. **Model mirrors the contract** (§5) so porter DTOs are a near 1:1 lift.
3. **Rules as declarative data.** Limits, weights, canonical dimensions, and
   citations live in tables/constants a porter translates by reading — not buried
   in `if` branches. (Also pays down the inline-magic-number debt noted in the
   initial code review.)
4. **Golden vectors as the contract.** JSON `input → expected { functional,
   quality }` files (`lib/__vectors__/`). Language-agnostic: Naxai runs the same
   vectors against their implementation to prove parity.
5. **Porting guide** — `docs/PORTING.md`: the kernel boundary, the model↔OpenAPI
   mapping, the introspection algorithm, and how to run the vectors.

## 5. Core data model (mirrors the Naxai OpenAPI)

The kernel separates three things the production API also separates:

**(a) The payload model — exact mirror of the OpenAPI** (what you'd send to
`sendRCS`):

```ts
type CardOrientation = "HORIZONTAL" | "VERTICAL";
type MediaHeight = "SHORT" | "MEDIUM" | "TALL";

interface ContentInfo {
  fileUrl: string;
  thumbnailUrl?: string;     // optional; ≤100 kB
  forceRefresh?: boolean;
}
interface Media {
  height: MediaHeight;       // required when media present; ignored for HORIZONTAL
  contentInfo: ContentInfo;
}
interface CardContent {
  title?: string;            // ≤200
  description?: string;      // ≤2000
  media?: Media;
  suggestions?: Suggestion[];// ≤4
}
interface StandaloneRichCard {
  type: "standaloneRichCard";
  cardOrientation: CardOrientation;
  thumbnailImageAlignment?: "LEFT" | "RIGHT";   // horizontal only
  cardContent: CardContent;
}

type Suggestion = SuggestedReply | SuggestedAction;
interface SuggestedReply  { type: "reply";  text: string; postbackData?: string }   // text ≤25
interface SuggestedAction { type: "action"; text: string; postbackData?: string; action: Action } // text ≤25
type Action =
  | { type: "openUrlAction"; url: string }            // url ≤2048
  | { type: "dialAction"; phoneNumber: string }
  | { type: "viewLocationAction"; latitude: number; longitude: number; label?: string }
  | { type: "createCalendarEventAction"; startTime: string; endTime: string; title: string; description: string }
  | { type: "shareLocationAction" };
```

The PoC UI + improver operate on the visually-relevant subset
(`reply`, `openUrlAction`, `dialAction`); the others are modelled for fidelity
and treated as valid pass-through by the scorer.

**(b) Derived introspection — what the production API computes by fetching the
URL** (NOT part of the payload):

```ts
type MediaType = "image" | "video";
interface MediaIntrospection {
  mediaType: MediaType;
  mimeType: string;          // from the response content-type header (as RBM does)
  width: number; height: number; aspectRatio: number;
  fileSizeBytes: number;
  durationMs?: number;       // video, informational
  thumbnailSizeBytes?: number;
}
```

**(c) Simulator-only annotation** — `focalPoint` is our crop-scoring invention,
**not in the API** (in production it becomes vision-based detection — Phase 2).
Kept in a clearly-labelled extension, never in the payload model:

```ts
interface FocalPoint { x: number; y: number }   // normalized 0..1
```

The kernel entry points become explicit about these three inputs:

```ts
validateFunctional(card: StandaloneRichCard, media?: MediaIntrospection): FunctionalResult
scoreQuality(card: StandaloneRichCard, media?: MediaIntrospection, focal?: FocalPoint): ScoreResult
```

**Migration from today's `RcsContent`** (mechanical, ripples through
preview/sample/tests — the accepted cost of option A):

| Legacy `RcsContent` | New model |
|---|---|
| `title` / `description` | `cardContent.title` / `.description` |
| `imageUrl` | `cardContent.media.contentInfo.fileUrl` |
| `imageMetadata` | `MediaIntrospection` (derived, separate) |
| `actions[]` (`openUrl/dial/reply`, `label`, `value`, `primary`) | `cardContent.suggestions[]` (`reply` / `action`; `label→text`, `value→action.url\|phoneNumber`) |
| `focalPoint` | `FocalPoint` (sim annotation) |
| `cardFormat: compact` | `cardOrientation: HORIZONTAL` |
| `cardFormat: medium` | `cardOrientation: VERTICAL`, `media.height: MEDIUM` |
| `cardFormat: tall` | `cardOrientation: VERTICAL`, `media.height: TALL` |
| *(unmodeled)* | `media.height: SHORT` (now available) |

`primary` is dropped — the API has no such field; "primary" is derived as the
first `action`-type suggestion (the action-before-replies playbook rule already
covers ordering).

## 6. Functional layer (`lib/validateFunctional.ts`)

Pure. Checks computable from one `standaloneRichCard` + introspection:

| `limit` | Rule | Authority |
|---|---|---|
| `mediaType` | image ∈ {JPEG,PNG,GIF}; video ∈ {H.263,M4V,MP4,MPEG,MPEG‑4,WebM} | guide (MIME from content-type, as OpenAPI describes) |
| `titleLength` | ≤ 200 | OpenAPI `maxLength` |
| `descriptionLength` | ≤ 2000 | OpenAPI `maxLength` |
| `suggestionCount` | ≤ 4 | OpenAPI `maxItems` |
| `labelLength` | ≤ 25 (suggestion `text`) | OpenAPI |
| `thumbnailSize` | ≤ 100 kB | OpenAPI `thumbnailUrl` |
| `openUrlLength` | `openUrlAction.url` ≤ 2048 | OpenAPI |
| `emptyCard` | ≥1 of {media, title, description} | guide |

Title/desc/label/count currently exist as *quality* warnings (playbooks agree);
they **move to the functional axis** as hard rejections. `improveRcsContent`
already fixes title/label/count, so the Playbook Pass clears these violations.

## 7. Quality enrichment (guide *recommendations* → existing scorers)

- **Card heights → guide canonical Short 112 / Medium 168 / Tall 264 DP**
  (replaces derived 132/204), keyed by `media.height`.
- **Recommended aspect ratios → guide's 2:1 / 16:9 / 7:3** for vertical;
  playbook's 7:2/21:9/3:2 kept as secondary. Exact ratio↔height binding
  confirmed against the guide in the plan (principle fixed: guide wins).
- **Media file size → soft "≤100 MB recommended"** warning (OpenAPI), using the
  introspected `fileSizeBytes`; applies to image and video.
- **Thumbnail ≤50 kB** → quality nudge (the 100 kB is the functional cap in §6).
- **Animated GIF** → iOS-doesn't-animate warning, from `mimeType`.

`ScoreResult` and the 0–100 weighting (35/30/20/15) are otherwise unchanged.

## 8. Media introspection (`lib/media/introspect.ts` + `app/api/media-info/route.ts`)

- **`introspectMedia(headerBytes, { contentType, fileSize })`** — pure; magic
  bytes → type, format headers → dimensions; unrecognised → typed result that
  becomes a `mediaType` violation, never a throw. **Algorithm documented in
  `docs/PORTING.md`** so a non-Node porter can reimplement it.
- **`/api/media-info`** (PoC shell; Next 16 handler signature verified against
  `node_modules/next/dist/docs/` before writing per `AGENTS.md`): SSRF guard
  (https-only; block loopback/private/link-local/metadata IPs; cap + re-validate
  redirects), **HTTP Range** read of the first ~N KB only, hard timeout + byte
  cap. Introspects `fileUrl`; HEADs `thumbnailUrl` for its `Content-Length`.
- **Upload path** posts only the header slice + size + type to the same parser.

## 9. Citations (`recommendationCitations.ts`)

Add two cited sources: the **Naxai OpenAPI** (functional limits) and the **RBM
developer guide** (single page). Extend `SOURCE_DOCS`, `SECTION_BLURBS`, and the
parser; the citation-coverage test guards them like the playbooks.

## 10. UI / PoC shell + error handling

Extend `RcsInputPanel`'s media input to accept a URL (→ `/api/media-info`)
alongside upload; add a **functional-compliance banner** distinct from
`ScorePanel` listing "won't send" violations; `/improve` shows which violations
the pass clears. Errors (bad/unreachable URL, timeout, non-2xx, blocked IP,
unsupported/unparseable) → "couldn't read this media", content scores as
no-media.

## 11. Out of scope (and why)

- **Carousels** → Spec 2.
- **Payload ≤250 KB** → not in this OpenAPI; needs payload assembly → Spec 2/3.
- **Broadcast envelope** (`to`, `fallback`, `expireAfter`, `revoke`, top-level
  suggestions), the **adapter** to/from `RCSMessage`, and the richer action
  sub-limits (calendar/location) → Spec 3.
- **Video duration/codec validation**, `ffprobe` → ruled out.
- **Vision-based focal detection** → Phase 2 (replaces the `focalPoint` stand-in).

## 12. Testing + golden vectors

- `introspectMedia`: byte fixtures per format (heaviest on MP4/WebM — the main
  implementation risk).
- `validateFunctional`: each limit boundary (200/201, 2000/2001, 25/26, 4/5,
  2048/2049, thumbnail 100 kB, type allow/deny, empty card).
- Reconciliation: `rcsRules` carries the guide's canonical heights/ratios.
- SSRF guard unit tests (pure).
- Citation-coverage guard extended to OpenAPI + guide sources.
- **Golden vectors** (`lib/__vectors__/*.json`): representative cards →
  expected `{ functional, quality }`, run by the TS suite and shipped as the
  porters' parity contract.
- Existing 87 tests migrated to the new model and kept green.

## 13. Deliverables for porting

- The framework-free kernel (`lib/`) with declarative rule tables.
- `docs/PORTING.md`: kernel boundary, model↔OpenAPI mapping (the §5 table),
  introspection algorithm, vectors how-to.
- `lib/__vectors__/` golden vectors.

## 14. Dependencies / follow-ups

- **Spec 2 (Carousels):** `carouselRichCard` (`cardWidth SMALL/MEDIUM`,
  `cardContents` 2–10), per-card + aggregate consistency, payload-size.
- **Spec 3 (Envelope + adapter + Phase 2):** `RCSMessage` envelope, adapter,
  full action taxonomy, the orientation×height-only refactor if needed, and the
  AI-assistant content-creation phase.
