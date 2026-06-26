# Frontend Wiring + Scoring API & Swagger Testing UI — Design

**Date:** 2026-06-26
**Status:** Approved (pending spec review)
**Branch:** fresh `spec/api-and-ui`, cut from the current HEAD of
`spec/media-introspection-guide-rules` (so it stacks on the kernel work). Kept as
a **separate PR** so the porter-facing PR #1 stays kernel-only and uncluttered by
the disposable shell/API work.

## Context & Goal

The kernel (`lib/`) gained two capabilities the demo never exposed: **media URL
introspection** (`/api/media-info` + `introspectMedia`) and the **functional
compliance** axis (`validateFunctional`). And the kernel has never been reachable
as an HTTP API.

This spec covers two sequenced efforts:

- **Part A — Frontend wiring:** make the demo exercise the new kernel features
  (URL media introspection + a live functional-compliance banner).
- **Part B — Scoring API + Swagger testing UI:** expose the kernel over thin HTTP
  endpoints, describe them with a hand-written OpenAPI document, and embed a
  classic Swagger UI "try it" page.

**Build A, verify it, then build B.**

### Decisions locked (from brainstorming)

1. **API contract:** hand-written OpenAPI spec (no zod / no codegen). Handlers do
   light structural guards and reuse `validateFunctional` for RCS-limit checks.
2. **Testing UI:** classic Swagger UI, mounted via the framework-agnostic
   `swagger-ui-dist` bundle (sidesteps React-19 peer-dep friction).
3. **Endpoints:** granular (`/validate`, `/score`, `/improve`) + combined
   (`/analyze`) + the existing `/media-info`.
4. **Layout:** functional banner sits **above** `ScorePanel` on `/`.
5. **Scope:** one combined spec; `lib/` stays pure and untouched.

## Boundary Discipline (non-negotiable)

`lib/` imports nothing from React/Next and must stay that way — it is the artifact
the Naxai Core team ports. **All new code is shell:** route handlers under
`app/api/`, the hand-written spec under `docs/`, and the `/api-docs` page under
`app/`. The new OpenAPI describes *our scoring API* and is distinct from the
upstream Naxai sendRCS contract (`docs/rcs-broadcasts.yaml`).

---

## Part A — Frontend Wiring

### A1. Media URL introspection input

**Where:** the Media section of `components/RcsInputPanel.tsx`, beneath the
existing "Upload image…" control: a URL text field + a "Fetch" button.

**Data flow:**
1. User pastes a URL, clicks Fetch.
2. `POST /api/media-info { url }` → `MediaIntrospection | 422 { error, message }`.
3. On 200: set the card's `cardContent.media.contentInfo.fileUrl = url` and store
   the returned `MediaIntrospection` as the provider `media`; recenter focal to
   `{ x: 0.5, y: 0.5 }`.
4. On 422 / network error: show `message` inline (red), leave current media intact.

**State:** the fetch is async; the button shows a spinner and disables while
in-flight. Because the introspection round-trips through the SSRF-guarded route,
private/localhost URLs return 422 by design — a one-line hint states "public URLs
only."

**Image vs video:**
- `mediaType: "image"` → render in the focal editor (`<img src={url}>`), as today.
- `mediaType: "video"` → render a compact placeholder showing the metadata chip
  (`video · <mime> · <size>`) instead of the focal editor. Introspection is
  header-only, so there are no frames to position a focal on. The score and
  functional layers still operate off the metadata.

**Impedance note:** the input panel works on the `CardView` shell view-model
(`imageUrl`/`imageMetadata`), while the provider holds the native `media`
(`MediaIntrospection`). The fetch result updates the **native provider state**
directly (it is native already); the page's existing native↔CardView mapping then
flows it into the panel. No new adapter is introduced — the URL fetch writes to
the same provider setters the upload path ultimately feeds.

### A2. Functional-compliance banner

**Component:** `components/FunctionalBanner.tsx` (client). Calls
`validateFunctional(card, media)` — pure, recomputed on every state change like
the score.

**Render** (`FunctionalResult` is `{ passes: boolean, violations: FunctionalViolation[] }`;
each violation is `{ limit, message, actual, max?, citation }`):
- `result.passes === true` → green strip: "✓ Functionally valid — the Naxai API
  would accept this."
- `result.passes === false` → red strip: "✕ The API would reject this:" followed by
  each violation's `message` + `citation` (`Naxai sendRCS` or `RBM rich-cards`).

**Placement:** top of the score column on `app/page.tsx`, directly above
`ScorePanel`, so the two axes read top-to-bottom: **functional** (binary — *will it
send?*) then **quality** (0–100 — *will it look good?*).

### Part A files

- Modify: `components/RcsInputPanel.tsx` (URL field + fetch + video placeholder)
- Create: `components/FunctionalBanner.tsx`
- Modify: `app/page.tsx` (mount `FunctionalBanner` above `ScorePanel`)
- Possibly modify: `components/SimulatorProvider.tsx` only if a new setter helps;
  prefer existing `setCard`/`setMedia`/`setFocal`.

---

## Part B — Scoring API + Swagger Testing UI

### B1. Endpoints

Thin Node route handlers (`export const runtime = "nodejs"`) that wrap the pure
kernel. Each: read JSON body → light structural guards → call kernel →
`NextResponse.json`. A malformed/oversized body returns `400 { error, message }`.

| Route | Request body | Kernel call(s) | 200 response |
|---|---|---|---|
| `POST /api/validate` | `{ card, media? }` | `validateFunctional(card, media)` | `FunctionalResult` |
| `POST /api/score` | `{ card, media?, focal? }` | `scoreRcsContent(card, media, focal)` | `ScoreResult` |
| `POST /api/improve` | `{ card, media?, focal? }` | `scoreRcsContent` then `improveRcsContent(card, media, focal, score)` | `ImprovedRcsContent` |
| `POST /api/analyze` | `{ card, media?, focal? }` | validate + score | `{ functional, quality }` |
| `POST /api/media-info` | `{ url, thumbnailUrl? }` | `introspectMedia` (via fetch) | `MediaIntrospection` *(exists)* |

**Defaults:** `focal` defaults to `{ x: 0.5, y: 0.5 }` when omitted; `media` is
optional throughout. `improve` needs a score, so its handler computes the score
internally and does not require the caller to pass one.

**Structural guards (no zod):** a small shared helper validates that `card` is an
object with `type === "standaloneRichCard"` and a `cardContent` object; deeper
RCS-limit validity is delegated to `validateFunctional` (which already returns
structured violations). Guard failures → `400`. This is intentionally lighter than
schema validation — acceptable for a PoC testing surface; the drift risk is noted
in §Risks.

### B2. Hand-written OpenAPI document

- **File:** `docs/scoring-api.openapi.yaml` — authored by hand (OpenAPI 3.1).
  Documents the five endpoints, request/response schemas expressed against the
  native model (`StandaloneRichCard`, `MediaIntrospection`, `FocalPoint`,
  `FunctionalResult`, `ScoreResult`, `ImprovedRcsContent`), and a worked **example**:
  the default sample card as the request, its real scored output as the response.
- **Served:** `GET /api/openapi.json` (file `app/api/openapi.json/route.ts`) reads +
  parses the YAML and returns it as JSON (so Swagger UI consumes it without a YAML
  parser in the browser). Parsing the YAML adds one small dev/runtime dep (`yaml`),
  or the document is authored directly as a `.json` to avoid it — decided at plan
  time.

### B3. Swagger UI testing page

- **Route:** `app/api-docs/page.tsx` — a client-only page that mounts
  **`swagger-ui-dist`** (the framework-agnostic bundle) against a container `div`
  in a `useEffect`, configured with `url: "/api/openapi.json"` and
  `tryItOutEnabled: true`. Imports the Swagger UI CSS.
- **Why `swagger-ui-dist` not `swagger-ui-react`:** the React wrapper has known
  React-19 / Next-16 peer-dependency friction; the vanilla bundle has no React
  coupling and renders the identical classic UI.
- **Fallback (if the bundle misbehaves under the App Router):** serve a static
  `public/api-docs.html` that loads Swagger UI from the dist assets, and have the
  page route to it. Documented as the backup, not the default.
- **Discoverability:** a header link to `/api-docs` from the demo chrome.

The exact Next 16 page/route mechanics (route handler signatures, `runtime`,
client boundaries) are verified against `node_modules/next/dist/docs` during
implementation, per `AGENTS.md`.

### Part B files

- Create: `app/api/validate/route.ts`, `app/api/score/route.ts`,
  `app/api/improve/route.ts`, `app/api/analyze/route.ts`
- Create: `app/api/openapi.json/route.ts`
- Create: `app/api/_lib/guards.ts` (shared body-parse + structural guard helper)
- Create: `docs/scoring-api.openapi.yaml`
- Create: `app/api-docs/page.tsx` (+ optional `public/api-docs.html` fallback)
- Modify: the demo header to link `/api-docs`
- Add dep: `swagger-ui-dist`

---

## Testing

- **Kernel:** already covered (no change).
- **Route handlers:** add `app/api/__tests__/*` (or co-located) Vitest tests that
  invoke each handler's `POST` with (a) the default sample card → assert 200 and
  the expected top-level response shape, (b) a malformed body → assert `400`.
  These test the handlers as functions; no live server needed.
- **OpenAPI guard:** a test that `docs/scoring-api.openapi.yaml` parses and that
  every documented path has a corresponding route file (cheap drift guard, partly
  mitigating the hand-written-spec risk).
- `npm run test:run`, `tsc`, and `npm run build` stay green.

## Sequencing

1. **Part A** — wire URL input + functional banner; verify in the running demo.
2. **Part B** — endpoints → guards → OpenAPI doc → `openapi.json` route → Swagger
   page → header link.

Each is independently shippable; A delivers a usable demo on its own.

## Out of Scope (YAGNI)

- Zod / schema-codegen (explicitly rejected in favour of a hand-written spec).
- Auth, rate limiting, CORS for third-party origins (same-origin testing UI only).
- Carousels (`carouselRichCard`) — still Spec 2.
- Persisting API requests / a request history UI.
- Rendering video frames or picking a focal on video.

## Risks

- **Hand-written spec drift:** the OpenAPI can diverge from handler behaviour over
  time. Mitigated by the path-coverage test and worked examples; accepted as a PoC
  trade-off.
- **`swagger-ui-dist` under the App Router:** SSR/`window` access and CSS bundling
  can be finicky; the page is client-only and the static-HTML fallback is the
  documented escape hatch.
- **Next 16 specifics:** route/page APIs differ from older Next — consult the
  bundled docs before writing handlers (`AGENTS.md`).
