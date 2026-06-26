# API Playground Page — Design

**Date:** 2026-06-26
**Status:** Approved (pending spec review)
**Branch:** `spec/api-and-ui` (extends PR #2 — more disposable shell)

## Goal

A new page `/api-playground` that mirrors the draft simulator but routes **every**
result through the real HTTP scoring API, with a live **API console** (a
browser-devtools-style Network log) showing each request and response — so you can
watch the API work as you enter a URL, fetch image info, and get scores.

## Context

The draft page (`app/page.tsx`) computes `scoreRcsContent`/`validateFunctional`
**in-process** and only the URL fetch hits a real endpoint (`/api/media-info`).
The playground instead calls `/api/analyze`, `/api/improve`, and `/api/media-info`
over HTTP and surfaces the traffic. All endpoints already exist (PR #2). This is
**shell-only**; `lib/` is untouched.

## Layout (approved)

Simulator on top (editor + dual previews, reused unchanged), full-width API console
below — like devtools' Network tab.

```
┌ RCS API Playground ──────────────── API docs ↗ ┐
├──────────────┬──────────────────────────────────┤
│ 1·Media(URL) │  iOS         Android              │
│ 2·Text       │ [card]       [card]               │
│ 3·Actions    │ ✓ functional · score 62/100      │  ← from POST /api/analyze
├──────────────┴──────────────────────────────────┤
│ API CONSOLE                                clear │
│ ▾ POST /api/analyze        200 · 12ms            │
│     request  { card, media, focal }              │
│     response { functional, quality }             │
│ ▸ POST /api/media-info     200 · 41ms            │
│ ▸ POST /api/improve        200 · 18ms            │
└──────────────────────────────────────────────────┘
```

## Components

- **`app/api-playground/page.tsx`** (client) — owns **local** state (card/media/focal
  seeded from the sample; independent of the draft page's `SimulatorProvider` so the
  two don't cross-contaminate), the traffic log, and the latest analyze result.
  Reuses `RcsInputPanel`, `PreviewToolbar`, `PlatformPreview`, `RcsCardPreview`,
  `FunctionalBanner`, `ScorePanel`, and `cardToView`/`viewToParts`.
- **`components/apiClient.ts`** — typed, traffic-logging client:
  - `TrafficEntry = { id, method:"POST", path, status, ms, request, response, ok, at }`
  - `analyzeCard(body, emit) → AnalyzeResponse` (`POST /api/analyze`)
  - `improveCard(body, emit) → ImprovedRcsContent` (`POST /api/improve`)
  - `introspectUrl(body, emit) → MediaIntrospection` (`POST /api/media-info`)
  - Internal `call(path, body, emit)`: times the request (`performance.now`), parses
    the JSON, **emits one `TrafficEntry`** (success or failure), returns the parsed
    data. `id` is a module counter (stable, no RNG); `AnalyzeResponse = { functional:
    FunctionalResult, quality: ScoreResult }`.
- **`components/ApiConsole.tsx`** — presentation: `{ entries: TrafficEntry[], onClear }`.
  Chronological rows (newest first): method · path · color-coded status · `ms`.
  Click a row to expand → pretty-printed (`JSON.stringify(x, null, 2)`) request and
  response in `<pre>`. A "Clear" button. Empty state: "No requests yet."
- **`RcsInputPanel`** — add ONE optional, backward-compatible prop
  `fetchMedia?: (url: string) => Promise<MediaIntrospection>` defaulting to the
  existing `fetchMediaInfo`. The draft page omits it (unchanged behavior); the
  playground passes a logged wrapper so the URL fetch appears in the console.
- Header link to `/api-playground` (beside "API docs ↗"), added on both `app/page.tsx`
  and the playground header.

## Data flow

1. **URL fetch** — `RcsInputPanel` calls the injected `fetchMedia` → playground's
   `introspectUrl(...)` → `POST /api/media-info` → logged → media set in local state.
2. **Edit text/actions/toggles** — a **debounced** (~500 ms) effect on
   `[card, media, focal]` calls `analyzeCard({ card, media, focal }, emit)` →
   `POST /api/analyze` → logged → `analyzeResult` set → drives `FunctionalBanner`
   (`result={analyzeResult.functional}`) + `ScorePanel` (`score={analyzeResult.quality}`).
3. **"Run improver" button** — `improveCard({ card, media, focal }, emit)` →
   `POST /api/improve` → logged; the improved card JSON is visible in the console
   (the improver does not mutate the editor in v1 — see Out of scope).

## Error handling

- `call()` never throws to the UI: on a non-2xx or network error it still emits a
  `TrafficEntry` (status = the code, or 0 for network failure; response = the error
  body). The console row renders red.
- While a debounced analyze is in flight (or before the first one), the score area
  shows a subtle "scoring…" state. If the latest analyze failed, it shows
  "API error — see console" instead of stale numbers.
- The SSRF/redirect realities of `/api/media-info` apply (public, non-redirecting
  URLs only) — surfaced as a red console entry + the existing inline panel error.

## Testing

- **`components/apiClient.ts`** — TDD unit tests (mocked `fetch`, like
  `mediaClient.test.ts`): `analyzeCard` returns the parsed `{functional,quality}` and
  emits exactly one `TrafficEntry` with `ok/status/path/request/response` correct; a
  non-2xx still emits an entry with `ok:false`.
- `ApiConsole`, the page, and the `RcsInputPanel` prop are verified by
  `tsc --noEmit` + `next build` + manual smoke (no component-render harness in repo).
- Suite + `tsc` + build stay green.

## Out of scope (YAGNI)

- Separate `/api/validate` and `/api/score` buttons (`/api/analyze` returns both).
- Applying the improver's output back into the editor (console display only in v1).
- Persisting/exporting the traffic log; replaying requests; auth.
- Editing the raw JSON request by hand (use `/api-docs` Swagger for that).
