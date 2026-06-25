# Spec 1 — Media Introspection + Guide-Rule Enrichment + Naxai-Aligned Core

- **Date:** 2026-06-24 (revised 2026-06-25: porting pivot + team-research refinements)
- **Status:** Approved design (pre-implementation)
- **Author:** Eduardo Brigham (with Claude)
- **Sequence:** Spec 1 of 3. Spec 2 = Carousels. Spec 3 = Broadcast-message envelope + adapter (and Phase 2: AI-assistant content creation).

## 0. Goal — read this first

**We are not building the production API.** The Naxai Core development team will
**port** this PoC's logic into a private production API; architecture/roles are
set at an upcoming CIO meeting. Our deliverable is a **port-ready reference**: a
framework-free logic kernel whose model mirrors the real Naxai RCS API, plus a
language-agnostic behavioral contract (golden vectors) and a porting guide. The
Vercel SPA / route handler / React components are a **disposable PoC shell**.

The tool answers **two distinct questions** about a card's media, and they must
not be conflated:

| | **Compliance** | **Visual quality** |
|---|---|---|
| Question | "Is this a **valid** file RCS accepts?" | "Will it **render well** on iOS vs Android?" |
| Needs | media **type + size** | image **dimensions** (crop / safe-zone) |
| Applies to | images **and** video | **images only** (focal-point/crop is image-specific) |
| Axis | functional (binary; `422`) | quality (0–100) |

**Media-fetch scope (decided — "B for images"):** fetch the URL/file, run the
**compliance** check (type + size) for *all* media, and additionally read
**image dimensions** so a URL-supplied image gets the same crop/safe-zone score
an uploaded image already gets. **Video is compliance-only** — type + size from
headers, no dimension parsing. Video dimension/aspect/crop scoring is deferred to
Phase 2 (vision-based focal detection).

## 1. Scope of this spec

1. **Naxai-aligned core model** — restructure the kernel's types to mirror the
   `sendRCS` OpenAPI (`standaloneRichCard`/`cardContent`/`media`/`contentInfo`/
   `suggestions`) so porter DTOs map ~1:1.
2. **Media introspection** — from upload + URL: **images** → type + size +
   dimensions (header bytes); **video** → type + size (headers only); plus the
   **thumbnail** file size.
3. **Functional-compliance layer** — pre-flight the OpenAPI hard limits (the ones
   that return `422`), beside the unchanged 0–100 quality score.
4. **Guide-rule enrichment** — fold the RBM guide's recommendations into the
   quality score under the approved precedence.
5. **Portability artifacts** — declarative rule tables, golden test vectors, and
   a porting guide.

## 2. Two axes, three sources, precedence

The 0–100 score is *quality*. The OpenAPI's hard numbers are **functional**
constraints — break them and `sendRCS` returns `422 "The request is invalid"`.
The tool pre-flights them so the user fixes them before sending.

**Source precedence (approved):**
- **Naxai OpenAPI** is authoritative for **functional hard limits**.
- **Google RBM guide** is authoritative for **canonical dimensions** (the
  Short/Medium/Tall DP heights, the supported-type list) and the recommended
  aspect set.
- **UX playbooks** are authoritative for **rendering-quality heuristics** (crop,
  safe zones, iOS-vs-Android).
- Conflicts: functional → OpenAPI; canonical dimensions → guide; UX → playbooks.
- **Cite all three.** OpenAPI + guide become cited sources beside the playbooks.

Sources: Naxai RCS `POST /rcs/agents/{agentId}/messages/send` (OpenAPI 2023-03-25);
RBM guide <https://developers.google.com/business-communications/rcs-business-messaging/guides/learn/rich-cards>.

## 3. Decisions (resolved)

1. Media scope: images **and** video; animated-GIF-on-iOS flagged (from MIME).
2. **Video = header-only** (type + size). **No dimension parsing** — no
   `image-size` for video, no MP4/WebM box parsing, no `ffprobe`. *(Research
   confirmed no guide rule needs video dimensions; this removes the single
   biggest implementation risk.)*
3. **Images = full introspection** (type + size + dimensions) so URL images are
   scored like uploads ("B for images").
4. Carousels → Spec 2. Broadcast envelope + adapter → Spec 3.
5. Functional vs quality: a functional-compliance result beside the unchanged
   0–100 `quality` score.
6. **Data-model alignment: option A — mirror the Naxai OpenAPI in the core.**
7. Thumbnail support included (`thumbnailUrl` + the 100 kB functional check).

## 4. Portability principles

1. **The kernel is the product.** `lib/` imports nothing from React/Next — keep
   that boundary absolute. Kernel = what gets ported; shell = disposable.
2. **Model mirrors the contract** (§5).
3. **Rules as declarative data** — limits, weights, canonical dimensions, and
   citations live in tables a porter translates by reading (also pays down the
   inline-magic-number debt from the initial review).
4. **Golden vectors as the contract** — JSON `input → { functional, quality }`
   in `lib/__vectors__/`, run by the TS suite; Naxai re-runs them for parity.
5. **`docs/PORTING.md`** — kernel boundary, model↔OpenAPI mapping, the
   image-introspection algorithm, vectors how-to.

## 5. Core data model (mirrors the OpenAPI)

**(a) Payload model — exact mirror** (what you'd send to `sendRCS`):

```ts
type CardOrientation = "HORIZONTAL" | "VERTICAL";
type MediaHeight = "SHORT" | "MEDIUM" | "TALL";

interface ContentInfo { fileUrl: string; thumbnailUrl?: string; forceRefresh?: boolean }
interface Media { height: MediaHeight; contentInfo: ContentInfo }  // height ignored for HORIZONTAL
interface CardContent { title?: string; description?: string; media?: Media; suggestions?: Suggestion[] }
interface StandaloneRichCard {
  type: "standaloneRichCard";
  cardOrientation: CardOrientation;
  thumbnailImageAlignment?: "LEFT" | "RIGHT";   // horizontal only
  cardContent: CardContent;
}
type Suggestion = SuggestedReply | SuggestedAction;
interface SuggestedReply  { type: "reply";  text: string; postbackData?: string }   // text ≤25
interface SuggestedAction { type: "action"; text: string; postbackData?: string; action: Action }
type Action =
  | { type: "openUrlAction"; url: string }            // url ≤2048
  | { type: "dialAction"; phoneNumber: string }
  | { type: "viewLocationAction"; latitude: number; longitude: number; label?: string }
  | { type: "createCalendarEventAction"; startTime: string; endTime: string; title: string; description: string }
  | { type: "shareLocationAction" };
```

PoC UI + improver operate on the visually-relevant subset (`reply`,
`openUrlAction`, `dialAction`); other actions are modelled for fidelity and pass
through the scorer.

**(b) Derived introspection — computed by fetching the URL** (NOT payload):

```ts
type MediaType = "image" | "video";
interface MediaIntrospection {
  mediaType: MediaType;
  mimeType: string;          // from the response content-type header (as RBM does)
  fileSizeBytes: number;
  thumbnailSizeBytes?: number;
  // IMAGE ONLY (absent for video — video is compliance-only):
  width?: number; height?: number; aspectRatio?: number;
}
```

**(c) Simulator-only annotation** — `focalPoint` (not in the API; → Phase 2
vision):

```ts
interface FocalPoint { x: number; y: number }   // normalized 0..1
```

Kernel entry points:

```ts
validateFunctional(card: StandaloneRichCard, media?: MediaIntrospection): FunctionalResult
scoreQuality(card: StandaloneRichCard, media?: MediaIntrospection, focal?: FocalPoint): ScoreResult
```

**Migration from `RcsContent`** (mechanical, ripples through preview/sample/tests):

| Legacy | New |
|---|---|
| `title`/`description` | `cardContent.title`/`.description` |
| `imageUrl` | `cardContent.media.contentInfo.fileUrl` |
| `imageMetadata` | `MediaIntrospection` (derived, separate) |
| `actions[]` (`label`,`value`,`primary`) | `cardContent.suggestions[]` (`reply`/`action`; `label→text`, `value→action.url\|phoneNumber`) |
| `focalPoint` | `FocalPoint` (sim annotation) |
| `cardFormat: compact` | `cardOrientation: HORIZONTAL` |
| `cardFormat: medium` | `cardOrientation: VERTICAL`, `media.height: MEDIUM` |
| `cardFormat: tall` | `cardOrientation: VERTICAL`, `media.height: TALL` |
| *(unmodeled)* | `media.height: SHORT` |

`primary` is dropped — derived as the first `action`-type suggestion.

## 6. Functional layer (`lib/validateFunctional.ts`)

Pure. Computable from one `standaloneRichCard` + introspection:

| `limit` | Rule | Authority |
|---|---|---|
| `mediaType` | image ∈ {`image/jpeg`,`image/png`,`image/gif`}; video ∈ {`video/h263`,`video/x-m4v`,`video/mp4`,`video/mpeg`,`video/webm`} | guide (MIME from content-type) |
| `titleLength` | ≤ 200 | OpenAPI |
| `descriptionLength` | ≤ 2000 | OpenAPI |
| `suggestionCount` | ≤ 4 | OpenAPI |
| `labelLength` | ≤ 25 (suggestion `text`) | OpenAPI |
| `thumbnailSize` | ≤ 100 kB | OpenAPI |
| `openUrlLength` | `openUrlAction.url` ≤ 2048 | OpenAPI |
| `emptyCard` | ≥1 of {media, title, description} | guide |

title/desc/label/count **move from quality warnings to the functional axis**.

## 7. Quality enrichment (guide recommendations → existing scorers)

- **Card heights → guide canonical** `GUIDE_MEDIA_HEIGHT_DP = {SHORT:112, MEDIUM:168, TALL:264}`,
  keyed by `media.height` (replaces derived 132/204). **Also raise the iOS
  `verticalMediaHeightCap` 240 → ≥264** (264 would otherwise clip a valid TALL card).
- **Aspect ratios → nearest-of-set.** The guide lists `GUIDE_VERTICAL_ASPECTS =
  [2/1, 16/9, 7/3]` for *any* vertical card and **does not bind a ratio to a
  height** (team finding). Score an image's aspect deviation against the
  **nearest** of the three. Do **not** invent a per-height ratio map or cite the
  guide for one. Playbook ratios (7:2/21:9/3:2) kept as secondary nudges.
- **Media file size → soft "≤100 MB"** warning (OpenAPI), from `fileSizeBytes`;
  applies to image and video.
- **Thumbnail ≤50 kB** → quality nudge (100 kB is the functional cap, §6).
- **Animated GIF** → iOS-doesn't-animate warning, from `mimeType`.
- **Video is excluded from dimension-based quality** (aspect/crop/safe-zone) —
  it has no introspected dimensions; this is Phase-2 vision territory.

### `rcsRules.ts` delta (from team reconciliation)

| Constant | Current | New |
|---|---|---|
| `verticalFormatMediaHeightCap` | `{medium:132, tall:204}` | `{short:112, medium:168, tall:264}` (rekey to `MediaHeight`) |
| `verticalMediaHeightCap` | `240` | ≥`264` (or remove the blanket cap) |
| `verticalContainerAspect` | `{short:7/2, medium:21/9, tall:3/2}` | keep as **secondary**; add `GUIDE_VERTICAL_ASPECTS=[2/1,16/9,7/3]` as primary |
| `recommendedAspectForFormat` | per-format single ratio | vertical = nearest of guide set; HORIZONTAL keeps `9:16` (guide silent on horizontal) |
| `horizontalCardMediaWidthDp` | `128` | no change (guide + playbook agree) |
| `maxSuggestionsPerCard`/`maxSuggestionLabelChars` | `4`/`25` | no value change; re-tag source OpenAPI; move to functional axis |

New declarative constants: the `GUIDE_*` above + a functional block
(`TITLE_MAX=200`, `DESCRIPTION_MAX=2000`, `SUGGESTION_MAX=4`, `LABEL_MAX=25`,
`THUMBNAIL_MAX_BYTES=100_000`, `OPEN_URL_MAX=2048`, `FILE_MAX_BYTES=100_000_000`).
Downstream consumers: `scoreRcsContent.ts:310`, `rcsRules.test.ts:54-56`.

## 8. Media introspection (`lib/media/introspect.ts` + `app/api/media-info/route.ts`)

**Images — `imageSize(Uint8Array)` from `image-size` v2.0.2** (pure, sync, zero
deps; same core in browser-upload and server-URL paths). Covers JPEG/PNG/GIF/WebP.
Caveat: JPEG scans SOF markers, so dimensions can sit past the first KB (large
EXIF) — read **64 KB** first (`Range: bytes=0-65535`), and on a truncated-JPEG
throw do **one** widening re-read (~256 KB) before giving up.

**Video — header-only.** MIME from the response **content-type**; size from
**Content-Length**/`Content-Range`. No body parsing.

**Thumbnail** — `HEAD` → `Content-Length`, reject > 100 kB (fall back to a small
ranged GET if HEAD is unsupported).

**File size** — prefer `Content-Range` total (on a `206`); else `Content-Length`
on a confirmed non-range `200`, still capping bytes actually read (read N then
`cancel()` the stream — never buffer the whole file).

**`/api/media-info` (PoC shell) — SSRF hardening:** https-only; **resolve DNS and
validate the resolved IP** (block loopback/private/link-local, `169.254.169.254`,
`0.0.0.0/8`, IPv4-mapped IPv6, NAT64); pin/re-validate per hop; `redirect:'manual'`,
≤3 hops; `AbortController` ~5 s timeout; enforce the byte cap on the stream.

**Next.js 16 route (16.2.9, verified against `node_modules/next/dist/docs/`):**
`export async function POST(request: NextRequest)`, body via `await request.json()`,
`export const runtime = 'nodejs'` (needed for DNS/IP checks — Edge can't),
`export const maxDuration = 10`.

## 9. Citations (`recommendationCitations.ts`)

Add two cited sources — the **Naxai OpenAPI** and the **RBM guide** (single page).
Extend `SOURCE_DOCS`/`SECTION_BLURBS`/parser; the citation-coverage test guards them.

## 10. UI / PoC shell + error handling

Extend `RcsInputPanel`'s media input to accept a URL (→ `/api/media-info`)
alongside upload; add a **functional-compliance banner** distinct from
`ScorePanel`; `/improve` shows which violations the pass clears. Errors
(bad/unreachable URL, timeout, non-2xx, blocked IP, unsupported/unparseable) →
"couldn't read this media", content scores as no-media.

## 11. Out of scope (and why)

- **Carousels** → Spec 2.
- **Payload ≤250 KB** → real guide number, but needs payload assembly → Spec 2/3.
- **Broadcast envelope + adapter**, richer action sub-limits → Spec 3.
- **Video dimensions / aspect / crop scoring** → Phase 2 (vision). **No MP4/WebM
  parsing in this spec.**

## 12. Testing + golden vectors

- `introspectMedia` (images): fixtures per format incl. a **JPEG with a large
  EXIF block** (the past-the-first-KB case) and the widening re-read path.
- Video introspection: mock `content-type`/`Content-Length`/HEAD responses —
  assert type + size only (no dimension assertions).
- `validateFunctional`: each limit boundary (200/201, 2000/2001, 25/26, 4/5,
  2048/2049, thumbnail 100 kB, type allow/deny, empty card).
- SSRF guard: reject loopback/private/link-local/metadata/non-https (pure).
- Reconciliation: `rcsRules` carries the guide's canonical heights + nearest-of-set aspect.
- Citation-coverage guard extended to OpenAPI + guide.
- **Golden vectors** (`lib/__vectors__/*.json`) — the porters' parity contract.
- Existing 87 tests migrated to the new model, kept green.

## 13. Deliverables for porting

The framework-free kernel (`lib/`) with declarative rule tables; `docs/PORTING.md`
(boundary, model↔OpenAPI mapping, image-introspection algorithm, vectors how-to);
`lib/__vectors__/`.

## 14. Dependencies / follow-ups

- **Spec 2 (Carousels):** `carouselRichCard` (2–10 cards), aggregate consistency,
  payload-size.
- **Spec 3 (Envelope + adapter + Phase 2):** `RCSMessage` envelope, adapter, full
  action taxonomy, and **Phase 2 AI-assistant content creation** (Agent SDK
  improver grounded in the `rcs-playbook-rules` skill; vision-based focal
  detection for video crop scoring).
