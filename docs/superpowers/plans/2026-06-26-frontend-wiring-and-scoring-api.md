# Frontend Wiring + Scoring API & Swagger Testing UI — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the demo exercise the new kernel features (URL media introspection + a functional-compliance banner), then expose the kernel as thin HTTP endpoints with a classic Swagger "try it" page.

**Architecture:** All work is in the disposable shell — React components (`components/`, `app/`), web-standard route handlers (`app/api/`), and a hand-written OpenAPI doc (`docs/`). The pure kernel (`lib/`) is consumed, never modified. Route handlers use the Web `Request`/`Response` APIs (per Next 16 route-handler docs) so they unit-test in the node env with no Next runtime.

**Tech Stack:** Next 16.2.9 (App Router), React 19, TypeScript 5, Vitest 4 (node env), `swagger-ui-dist`.

## Global Constraints

- **`lib/` stays pure** — it imports nothing from `react`/`next`. ALL new code is shell (`app/`, `components/`, `docs/`). **Never modify `lib/`.**
- Native model field names are exact: card discriminant `type: "standaloneRichCard"`; `FunctionalResult.passes`; `MediaIntrospection.mediaType ∈ {"image","video"}`; focal `{ x, y }` in 0..1.
- New API handlers use web-standard `export async function POST(request: Request)` returning `Response.json(...)` with `export const runtime = "nodejs"`. Any malformed/invalid body → HTTP **400** `{ error, message }`.
- Endpoints: `POST /api/validate`, `/api/score`, `/api/improve`, `/api/analyze` (+ the existing `/api/media-info`).
- Hand-written OpenAPI (no zod/codegen) at `docs/scoring-api.openapi.json`, imported and served at `GET /api/openapi.json`.
- Classic Swagger UI via **`swagger-ui-dist`** (not `swagger-ui-react`).
- Functional banner sits **above** `ScorePanel` on `/`.
- The repo has **no component-render test harness** (vitest node env, pure-logic tests only). Do NOT add one. Pure logic is TDD-unit-tested; thin UI wiring is verified by `npx tsc --noEmit` + `npm run build` + a manual smoke check.
- After every task: `npm run test:run` and `npx tsc --noEmit` are green. The final task also runs `npm run build` green.
- DRY, YAGNI, TDD where the unit is pure, frequent commits.

## File Structure

| File | Responsibility | Task |
|---|---|---|
| `vitest.config.ts` (modify) | broaden test discovery to `components/**` + `app/**` | 1 |
| `components/cardView.ts` (modify) | add `mediaType` to the view; preserve video media on round-trip | 1 |
| `components/cardView.test.ts` (create) | adapter unit tests | 1 |
| `components/mediaClient.ts` (create) | `fetchMediaInfo(url)` → `MediaIntrospection` (client→`/api/media-info`) | 2 |
| `components/mediaClient.test.ts` (create) | client helper unit tests (mocked fetch) | 2 |
| `components/FunctionalBanner.tsx` (create) | the functional-compliance strip (presentation) | 3 |
| `app/page.tsx` (modify) | mount banner above score; URL-fetch native wiring; API-docs link | 3,4,8 |
| `components/RcsInputPanel.tsx` (modify) | URL input + fetch + video placeholder | 4 |
| `components/RcsCardPreview.tsx` (modify) | video placeholder instead of `<img>` | 4 |
| `app/api/_lib/guards.ts` (create) | shared body parse + structural guard (`_lib` ⇒ not a route) | 5 |
| `app/api/_lib/guards.test.ts` (create) | guard unit tests | 5 |
| `app/api/{validate,score,improve,analyze}/route.ts` (create) | the four endpoints | 6 |
| `app/api/scoring-endpoints.test.ts` (create) | handler tests (200 shape + 400) | 6 |
| `docs/scoring-api.openapi.json` (create) | hand-written OpenAPI 3.1 doc | 7 |
| `app/api/openapi.json/route.ts` (create) | `GET` serving the spec | 7 |
| `app/api/openapi.test.ts` (create) | spec parse + path-coverage drift guard | 7 |
| `app/api-docs/page.tsx` (create) | Swagger UI "try it" page | 8 |
| `package.json` (modify) | add `swagger-ui-dist` | 8 |

---

## Task 1: CardView gains `mediaType` + preserves video media

**Files:**
- Modify: `vitest.config.ts`
- Modify: `components/cardView.ts`
- Test: `components/cardView.test.ts`

**Interfaces:**
- Produces: `CardView.mediaType?: MediaType`. `cardToView` sets it from `media?.mediaType`. `viewToParts` preserves the prior `MediaIntrospection` when a URL is set but there are no image dimensions (the video case), instead of dropping media to `undefined`.

- [ ] **Step 1: Broaden vitest discovery.** In `vitest.config.ts`, replace the `include` line and its comment:

```ts
  // Pure-logic + shell tests. Node env is enough — no test renders a React
  // component (the route handlers use web-standard Request/Response).
  test: {
    environment: "node",
    include: ["lib/**/*.test.ts", "components/**/*.test.ts", "app/**/*.test.ts"],
  },
```

- [ ] **Step 2: Write the failing test** `components/cardView.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { cardToView, viewToParts } from "@/components/cardView";
import type { FocalPoint, MediaIntrospection, StandaloneRichCard } from "@/types/rcs";

const focal: FocalPoint = { x: 0.5, y: 0.5 };
const videoCard: StandaloneRichCard = {
  type: "standaloneRichCard",
  cardOrientation: "VERTICAL",
  cardContent: { title: "Clip", media: { height: "TALL", contentInfo: { fileUrl: "https://ex/v.mp4" } } },
};
const videoMedia: MediaIntrospection = { mediaType: "video", mimeType: "video/mp4", fileSizeBytes: 4_200_000 };

describe("cardView adapter — media type", () => {
  it("exposes mediaType on the view", () => {
    expect(cardToView(videoCard, videoMedia, focal).mediaType).toBe("video");
  });

  it("preserves video media across a round-trip (no image dimensions)", () => {
    const view = cardToView(videoCard, videoMedia, focal);
    const parts = viewToParts({ ...view, title: "Clip 2" }, videoMedia);
    expect(parts.media).toEqual(videoMedia); // not wiped to undefined
    expect(parts.card.cardContent.title).toBe("Clip 2"); // edit still applied
  });
});
```

- [ ] **Step 3: Run it — expect FAIL.**

Run: `npm run test:run -- components/cardView.test.ts`
Expected: FAIL (`mediaType` is `undefined`; round-trip `parts.media` is `undefined`).

- [ ] **Step 4: Implement** in `components/cardView.ts`:

Add `MediaType` to the type import:

```ts
import type { Action, FocalPoint, MediaHeight, MediaIntrospection, MediaType, StandaloneRichCard, Suggestion } from "@/types/rcs";
```

Add the field to the `CardView` interface (after `imageMetadata?`):

```ts
  /** Present for fetched media so the shell can branch image vs video rendering. */
  mediaType?: MediaType;
```

In `cardToView`, add `mediaType` to the returned object (e.g. after `imageMetadata`):

```ts
    mediaType: media?.mediaType,
```

In `viewToParts`, replace the `const media = ...` block so video media (URL set, no dimensions) is preserved:

```ts
  const media: MediaIntrospection | undefined = view.imageMetadata
    ? {
        mediaType: view.mediaType ?? prevMedia?.mediaType ?? "image",
        mimeType: prevMedia?.mimeType ?? "image/*",
        fileSizeBytes: prevMedia?.fileSizeBytes ?? 0,
        width: view.imageMetadata.width,
        height: view.imageMetadata.height,
        aspectRatio: view.imageMetadata.aspectRatio,
      }
    : view.imageUrl && prevMedia
      ? prevMedia // video (or dimensionless media): keep the introspection intact
      : undefined;
```

- [ ] **Step 5: Run tests + types — expect PASS.**

Run: `npm run test:run -- components/cardView.test.ts && npx tsc --noEmit`
Expected: test file passes; `tsc` prints nothing (success).

- [ ] **Step 6: Commit.**

```bash
git add vitest.config.ts components/cardView.ts components/cardView.test.ts
git commit -m "feat(shell): CardView carries mediaType; preserve video media on round-trip"
```

---

## Task 2: `fetchMediaInfo` client helper

**Files:**
- Create: `components/mediaClient.ts`
- Test: `components/mediaClient.test.ts`

**Interfaces:**
- Produces: `fetchMediaInfo(url: string, thumbnailUrl?: string): Promise<MediaIntrospection>` — POSTs to `/api/media-info`; resolves the introspection on 2xx; throws `Error(message)` (the route's `message`) otherwise.

- [ ] **Step 1: Write the failing test** `components/mediaClient.test.ts`:

```ts
import { describe, it, expect, vi, afterEach } from "vitest";
import { fetchMediaInfo } from "@/components/mediaClient";

afterEach(() => vi.restoreAllMocks());

describe("fetchMediaInfo", () => {
  it("returns the introspection on 200", async () => {
    const intro = { mediaType: "image", mimeType: "image/png", fileSizeBytes: 1234, width: 100, height: 50, aspectRatio: 2 };
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(intro), { status: 200 })));
    await expect(fetchMediaInfo("https://ex/a.png")).resolves.toEqual(intro);
  });

  it("throws the route's message on a 422", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ error: "SsrfError", message: "URL resolves to a non-public address." }), { status: 422 })),
    );
    await expect(fetchMediaInfo("https://ex/a.png")).rejects.toThrow(/non-public/);
  });
});
```

- [ ] **Step 2: Run it — expect FAIL** (module not found).

Run: `npm run test:run -- components/mediaClient.test.ts`
Expected: FAIL (`Cannot find module '@/components/mediaClient'`).

- [ ] **Step 3: Implement** `components/mediaClient.ts`:

```ts
import type { MediaIntrospection } from "@/types/rcs";

/**
 * Client helper: POST a media URL to the SSRF-guarded /api/media-info route and
 * return its MediaIntrospection. Throws Error(message) on a non-2xx (the route's
 * { error, message }) or a network failure. Shell-only — not part of the kernel.
 */
export async function fetchMediaInfo(url: string, thumbnailUrl?: string): Promise<MediaIntrospection> {
  const res = await fetch("/api/media-info", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url, thumbnailUrl }),
  });
  const data = (await res.json().catch(() => ({}))) as Partial<MediaIntrospection> & { message?: string };
  if (!res.ok) throw new Error(data.message ?? `Media fetch failed (${res.status}).`);
  return data as MediaIntrospection;
}
```

- [ ] **Step 4: Run tests + types — expect PASS.**

Run: `npm run test:run -- components/mediaClient.test.ts && npx tsc --noEmit`
Expected: PASS; `tsc` clean.

- [ ] **Step 5: Commit.**

```bash
git add components/mediaClient.ts components/mediaClient.test.ts
git commit -m "feat(shell): fetchMediaInfo client for /api/media-info"
```

---

## Task 3: `FunctionalBanner` + mount above the score

**Files:**
- Create: `components/FunctionalBanner.tsx`
- Modify: `app/page.tsx`

**Interfaces:**
- Consumes: `validateFunctional(card, media?) → FunctionalResult` (from `@/lib/validateFunctional`); `FunctionalResult = { passes: boolean, violations: { message, citation, ... }[] }`.
- Produces: `<FunctionalBanner result={FunctionalResult} />`.

No unit test — pure presentation; the logic (`validateFunctional`) is already covered in `lib/`. Verified by `tsc` + `build` + manual.

- [ ] **Step 1: Implement** `components/FunctionalBanner.tsx`:

```tsx
"use client";

import type { FunctionalResult } from "@/types/rcs";

/**
 * Functional-compliance strip: the binary "will the Naxai API accept this?" axis
 * (validateFunctional), shown above the quality score. Pure presentation.
 */
export default function FunctionalBanner({ result }: { result: FunctionalResult }) {
  if (result.passes) {
    return (
      <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-2.5 text-sm text-emerald-300">
        ✓ Functionally valid — the Naxai API would accept this card.
      </div>
    );
  }
  return (
    <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
      <p className="font-semibold">✕ The Naxai API would reject this card:</p>
      <ul className="mt-1.5 list-disc space-y-1 pl-5 text-[13px] text-rose-200/90">
        {result.violations.map((v, i) => (
          <li key={i}>
            {v.message} <span className="font-mono text-[11px] text-rose-300/70">[{v.citation}]</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
```

- [ ] **Step 2: Mount it** in `app/page.tsx`.

Add imports:

```ts
import FunctionalBanner from "@/components/FunctionalBanner";
import { validateFunctional } from "@/lib/validateFunctional";
```

Add a memo next to the existing `score` memo:

```ts
  const functional = useMemo(() => validateFunctional(card, media), [card, media]);
```

Replace the lone `<ScorePanel score={score} />` with the pair, grouped tightly:

```tsx
          <div className="flex flex-col gap-3">
            <FunctionalBanner result={functional} />
            <ScorePanel score={score} />
          </div>
```

- [ ] **Step 3: Type-check + build.**

Run: `npx tsc --noEmit && npm run build`
Expected: clean; build "Compiled successfully".

- [ ] **Step 4: Manual smoke.** `npm run dev`, open `/`. The default sample (long title) shows the **red** banner above the score listing the title/length violation with a `[Naxai sendRCS]` citation. Shorten the title under 200 chars → banner turns **green**.

- [ ] **Step 5: Commit.**

```bash
git add components/FunctionalBanner.tsx app/page.tsx
git commit -m "feat(shell): functional-compliance banner above the score"
```

---

## Task 4: URL media input + native wiring + video placeholders

**Files:**
- Modify: `components/RcsInputPanel.tsx`
- Modify: `app/page.tsx`
- Modify: `components/RcsCardPreview.tsx`

**Interfaces:**
- Consumes: `fetchMediaInfo` (Task 2); `CardView.mediaType` (Task 1).
- Produces: `RcsInputPanel` gains prop `onMediaUrlFetched: (url: string, media: MediaIntrospection) => void`; `app/page.tsx` implements it by writing native provider state directly (so the full introspection — mime/size/type — is not lost through the lossy `CardView` round-trip).

No unit test — UI wiring; verified by `tsc` + `build` + manual.

- [ ] **Step 1: Add the URL field + video placeholder to `RcsInputPanel.tsx`.**

Extend the imports and the props interface:

```ts
import { useId, useRef, useState, type ChangeEvent, type PointerEvent } from "react";
import { fetchMediaInfo } from "@/components/mediaClient";
import type { MediaIntrospection, OverlayToggles } from "@/types/rcs";
```

```ts
interface RcsInputPanelProps {
  content: CardView;
  onContentChange: (patch: Partial<CardView>) => void;
  onMediaUrlFetched: (url: string, media: MediaIntrospection) => void;
  /** Read-only here: drives the focal-point editor's safe-zone overlay. */
  toggles: OverlayToggles;
}
```

Destructure the new prop and add local state at the top of the component body:

```ts
export default function RcsInputPanel({
  content,
  onContentChange,
  onMediaUrlFetched,
  toggles,
}: RcsInputPanelProps) {
  const fileInputId = useId();
  const [urlInput, setUrlInput] = useState("");
  const [fetching, setFetching] = useState(false);
  const [urlError, setUrlError] = useState<string | null>(null);
  // ...existing refs unchanged...

  async function handleFetchUrl() {
    setFetching(true);
    setUrlError(null);
    try {
      const media = await fetchMediaInfo(urlInput.trim());
      onMediaUrlFetched(urlInput.trim(), media);
    } catch (e) {
      setUrlError((e as Error).message);
    } finally {
      setFetching(false);
    }
  }
```

Inside the `<Section title="1 · Media">`, immediately AFTER the upload-row `</div>` (the `flex items-center gap-2` block) and BEFORE the `{content.imageUrl && content.imageMetadata ? (...)}` editor, insert:

```tsx
        <div className="mt-2 flex items-center gap-2">
          <input
            type="url"
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            placeholder="…or paste a public image/video URL"
            className="min-w-0 flex-1 rounded-lg border border-line bg-field px-3 py-1.5 text-xs text-heading outline-none placeholder:text-faint focus:border-sky-500/60"
          />
          <button
            type="button"
            disabled={!urlInput.trim() || fetching}
            onClick={handleFetchUrl}
            className="shrink-0 rounded-lg border border-line bg-panel px-3 py-1.5 text-xs font-medium text-body transition hover:border-line-strong disabled:opacity-50"
          >
            {fetching ? "Fetching…" : "Fetch"}
          </button>
        </div>
        {urlError ? <p className="mt-1 text-[11px] text-rose-400">{urlError}</p> : null}
        <p className="mt-1 font-mono text-[10px] text-faint">
          Public URLs only — introspected server-side (size/dimensions, incl. video).
        </p>
```

Immediately AFTER the existing `{content.imageUrl && content.imageMetadata ? (...) : null}` image-editor block, add the video placeholder:

```tsx
        {content.imageUrl && content.mediaType === "video" ? (
          <div className="mt-3 rounded-lg border border-line bg-field p-4 text-center">
            <p className="text-2xl">🎬</p>
            <p className="mt-1 text-xs text-body">Video media</p>
            <p className="mt-0.5 font-mono text-[10px] text-muted">
              Preview not rendered — introspection captures type &amp; size only.
            </p>
          </div>
        ) : null}
```

- [ ] **Step 2: Wire the native setter in `app/page.tsx`.**

Add the type import:

```ts
import type { MediaIntrospection } from "@/types/rcs";
```

Add the handler (after `onContentChange`):

```ts
  const onMediaUrlFetched = (url: string, fetched: MediaIntrospection) => {
    // Write native state directly — the CardView round-trip would drop the
    // introspected mime/size/type, keeping only width/height/aspect.
    setCard({
      ...card,
      cardContent: {
        ...card.cardContent,
        media: { height: card.cardContent.media?.height ?? "TALL", contentInfo: { fileUrl: url } },
      },
    });
    setMedia(fetched);
    setFocal({ x: 0.5, y: 0.5 });
  };
```

Pass it to the panel:

```tsx
        <RcsInputPanel content={view} onContentChange={onContentChange} onMediaUrlFetched={onMediaUrlFetched} toggles={toggles} />
```

- [ ] **Step 3: Guard the preview against video in `RcsCardPreview.tsx`.**

In the `const media = (...)` JSX, replace the opening of the inner conditional. Change:

```tsx
      {content.imageUrl ? (
```

to a three-way branch whose first arm is the video placeholder:

```tsx
      {content.mediaType === "video" ? (
        <div className="flex h-full w-full items-center justify-center bg-zinc-800 text-[10px] font-medium text-zinc-300">
          ▶ video
        </div>
      ) : content.imageUrl ? (
```

(The existing `useExplicitWindow`/`<img>`/`no media` arms are unchanged — this only inserts the leading video arm.)

- [ ] **Step 4: Type-check + build.**

Run: `npx tsc --noEmit && npm run build`
Expected: clean; "Compiled successfully".

- [ ] **Step 5: Manual smoke.** `npm run dev`, `/`:
  - Paste a public image URL (e.g. `https://upload.wikimedia.org/wikipedia/commons/3/3f/JPEG_example_flower.jpg`) → Fetch → the focal editor shows the image with its real `W×H · ratio`, and the previews render it.
  - Paste a bad/private URL (e.g. `http://localhost/x.png`) → an inline red error from the SSRF guard; current media unchanged.
  - Paste a public `.mp4` URL → the panel and both previews show the "video" placeholder; the score/functional layers still update.

- [ ] **Step 6: Commit.**

```bash
git add components/RcsInputPanel.tsx app/page.tsx components/RcsCardPreview.tsx
git commit -m "feat(shell): URL media introspection input + video placeholders"
```

---

## Task 5: API body-guard helper

**Files:**
- Create: `app/api/_lib/guards.ts`  (a `_`-prefixed folder is a Next private folder — never routed)
- Test: `app/api/_lib/guards.test.ts`

**Interfaces:**
- Produces:
  - `class BadRequestError extends Error` (`name = "BadRequest"`)
  - `interface CardRequest { card: StandaloneRichCard; media?: MediaIntrospection; focal?: FocalPoint }`
  - `parseCardBody(body: unknown): CardRequest` — light structural guard; throws `BadRequestError` on a malformed shape.

- [ ] **Step 1: Write the failing test** `app/api/_lib/guards.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { parseCardBody, BadRequestError } from "@/app/api/_lib/guards";
import { DEFAULT_CARD } from "@/lib/sampleContent";

describe("parseCardBody", () => {
  it("accepts a well-formed card body", () => {
    expect(parseCardBody({ card: DEFAULT_CARD }).card.type).toBe("standaloneRichCard");
  });
  it("passes media + focal through", () => {
    const { media, focal } = parseCardBody({ card: DEFAULT_CARD, media: { mediaType: "image", mimeType: "image/png", fileSizeBytes: 1 }, focal: { x: 0.2, y: 0.3 } });
    expect(media?.mimeType).toBe("image/png");
    expect(focal).toEqual({ x: 0.2, y: 0.3 });
  });
  it("rejects a missing card", () => {
    expect(() => parseCardBody({})).toThrow(BadRequestError);
  });
  it("rejects a wrong discriminant", () => {
    expect(() => parseCardBody({ card: { type: "text", cardContent: {} } })).toThrow(/standaloneRichCard/);
  });
  it("rejects a non-object body", () => {
    expect(() => parseCardBody("nope")).toThrow(BadRequestError);
  });
});
```

- [ ] **Step 2: Run it — expect FAIL** (module not found).

Run: `npm run test:run -- app/api/_lib/guards.test.ts`
Expected: FAIL (`Cannot find module`).

- [ ] **Step 3: Implement** `app/api/_lib/guards.ts`:

```ts
import type { FocalPoint, MediaIntrospection, StandaloneRichCard } from "@/types/rcs";

export class BadRequestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BadRequest";
  }
}

export interface CardRequest {
  card: StandaloneRichCard;
  media?: MediaIntrospection;
  focal?: FocalPoint;
}

/**
 * Light structural guard for the scoring endpoints' shared body shape. Deeper
 * RCS-limit validity is delegated to validateFunctional. Throws BadRequestError
 * (→ HTTP 400) on a malformed shape.
 */
export function parseCardBody(body: unknown): CardRequest {
  if (typeof body !== "object" || body === null) {
    throw new BadRequestError("Request body must be a JSON object.");
  }
  const b = body as Record<string, unknown>;
  const card = b.card as Record<string, unknown> | undefined;
  if (typeof card !== "object" || card === null) {
    throw new BadRequestError("Body must include a 'card' object.");
  }
  if (card.type !== "standaloneRichCard") {
    throw new BadRequestError("card.type must be 'standaloneRichCard'.");
  }
  if (typeof card.cardContent !== "object" || card.cardContent === null) {
    throw new BadRequestError("card.cardContent is required.");
  }
  return {
    card: card as unknown as StandaloneRichCard,
    media: b.media as MediaIntrospection | undefined,
    focal: b.focal as FocalPoint | undefined,
  };
}
```

- [ ] **Step 4: Run tests + types — expect PASS.**

Run: `npm run test:run -- app/api/_lib/guards.test.ts && npx tsc --noEmit`
Expected: PASS; `tsc` clean.

- [ ] **Step 5: Commit.**

```bash
git add app/api/_lib/guards.ts app/api/_lib/guards.test.ts
git commit -m "feat(api): shared card-body structural guard"
```

---

## Task 6: The four scoring endpoints

**Files:**
- Create: `app/api/validate/route.ts`, `app/api/score/route.ts`, `app/api/improve/route.ts`, `app/api/analyze/route.ts`
- Test: `app/api/scoring-endpoints.test.ts`

**Interfaces:**
- Consumes: `parseCardBody`, `BadRequestError` (Task 5); kernel `validateFunctional`, `scoreRcsContent`, `improveRcsContent`.
- Produces: 5 route modules each exporting `runtime` + `POST`. Response shapes: `/validate` → `FunctionalResult`; `/score` → `ScoreResult`; `/improve` → `ImprovedRcsContent`; `/analyze` → `{ functional: FunctionalResult, quality: ScoreResult }`.

- [ ] **Step 1: Write the failing test** `app/api/scoring-endpoints.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { DEFAULT_CARD, DEFAULT_MEDIA, DEFAULT_FOCAL } from "@/lib/sampleContent";
import { POST as validate } from "@/app/api/validate/route";
import { POST as score } from "@/app/api/score/route";
import { POST as improve } from "@/app/api/improve/route";
import { POST as analyze } from "@/app/api/analyze/route";

const req = (body: unknown) => new Request("http://test/api", { method: "POST", body: JSON.stringify(body) });
const full = { card: DEFAULT_CARD, media: DEFAULT_MEDIA, focal: DEFAULT_FOCAL };

describe("scoring endpoints", () => {
  it("POST /validate → 200 with passes", async () => {
    const res = await validate(req(full));
    expect(res.status).toBe(200);
    expect(await res.json()).toHaveProperty("passes");
  });
  it("POST /score → 200 with overallScore", async () => {
    const res = await score(req(full));
    expect(res.status).toBe(200);
    expect(await res.json()).toHaveProperty("overallScore");
  });
  it("POST /improve → 200 with improvedContent", async () => {
    const res = await improve(req(full));
    expect(res.status).toBe(200);
    expect(await res.json()).toHaveProperty("improvedContent");
  });
  it("POST /analyze → 200 with functional + quality", async () => {
    const res = await analyze(req(full));
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json).toHaveProperty("functional.passes");
    expect(json).toHaveProperty("quality.overallScore");
  });
  it("malformed body → 400 with a message", async () => {
    const res = await validate(req({ nope: true }));
    expect(res.status).toBe(400);
    expect(await res.json()).toHaveProperty("message");
  });
});
```

- [ ] **Step 2: Run it — expect FAIL** (route modules not found).

Run: `npm run test:run -- app/api/scoring-endpoints.test.ts`
Expected: FAIL (`Cannot find module '@/app/api/validate/route'`).

- [ ] **Step 3: Implement the four handlers.**

`app/api/validate/route.ts`:

```ts
import { parseCardBody } from "@/app/api/_lib/guards";
import { validateFunctional } from "@/lib/validateFunctional";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const { card, media } = parseCardBody(await request.json());
    return Response.json(validateFunctional(card, media));
  } catch (e) {
    const err = e as Error;
    return Response.json({ error: err.name || "Error", message: err.message }, { status: 400 });
  }
}
```

`app/api/score/route.ts`:

```ts
import { parseCardBody } from "@/app/api/_lib/guards";
import { scoreRcsContent } from "@/lib/scoreRcsContent";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const { card, media, focal } = parseCardBody(await request.json());
    return Response.json(scoreRcsContent(card, media, focal));
  } catch (e) {
    const err = e as Error;
    return Response.json({ error: err.name || "Error", message: err.message }, { status: 400 });
  }
}
```

`app/api/improve/route.ts`:

```ts
import { parseCardBody } from "@/app/api/_lib/guards";
import { scoreRcsContent } from "@/lib/scoreRcsContent";
import { improveRcsContent } from "@/lib/improveRcsContent";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const { card, media, focal } = parseCardBody(await request.json());
    const score = scoreRcsContent(card, media, focal);
    return Response.json(improveRcsContent(card, media, focal, score));
  } catch (e) {
    const err = e as Error;
    return Response.json({ error: err.name || "Error", message: err.message }, { status: 400 });
  }
}
```

`app/api/analyze/route.ts`:

```ts
import { parseCardBody } from "@/app/api/_lib/guards";
import { validateFunctional } from "@/lib/validateFunctional";
import { scoreRcsContent } from "@/lib/scoreRcsContent";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const { card, media, focal } = parseCardBody(await request.json());
    return Response.json({
      functional: validateFunctional(card, media),
      quality: scoreRcsContent(card, media, focal),
    });
  } catch (e) {
    const err = e as Error;
    return Response.json({ error: err.name || "Error", message: err.message }, { status: 400 });
  }
}
```

- [ ] **Step 4: Run tests + types — expect PASS.**

Run: `npm run test:run -- app/api/scoring-endpoints.test.ts && npx tsc --noEmit`
Expected: PASS (5 tests); `tsc` clean.

- [ ] **Step 5: Commit.**

```bash
git add app/api/validate app/api/score app/api/improve app/api/analyze app/api/scoring-endpoints.test.ts
git commit -m "feat(api): validate/score/improve/analyze endpoints over the kernel"
```

---

## Task 7: Hand-written OpenAPI doc + `GET /api/openapi.json` + drift guard

**Files:**
- Create: `docs/scoring-api.openapi.json`
- Create: `app/api/openapi.json/route.ts`
- Test: `app/api/openapi.test.ts`

**Interfaces:**
- Consumes: nothing (static doc + import).
- Produces: `GET /api/openapi.json` → the spec as JSON. The spec documents exactly the five paths `/validate`, `/score`, `/improve`, `/analyze`, `/media-info` (relative to the `/api` server base).

- [ ] **Step 1: Write the failing test** `app/api/openapi.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { existsSync } from "node:fs";
import { join } from "node:path";
import spec from "@/docs/scoring-api.openapi.json";
import { GET } from "@/app/api/openapi.json/route";

const paths = () => Object.keys((spec as { paths: Record<string, unknown> }).paths);

describe("scoring-api OpenAPI", () => {
  it("is OpenAPI 3.x and documents the five endpoints", () => {
    expect((spec as { openapi: string }).openapi).toMatch(/^3\./);
    expect(paths().sort()).toEqual(["/analyze", "/improve", "/media-info", "/score", "/validate"]);
  });
  it("every documented path has a route handler (drift guard)", () => {
    for (const p of paths()) {
      expect(existsSync(join(process.cwd(), "app/api", p, "route.ts")), `missing route for ${p}`).toBe(true);
    }
  });
  it("GET returns the spec", async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    expect(await res.json()).toHaveProperty("openapi");
  });
});
```

- [ ] **Step 2: Run it — expect FAIL** (spec + route missing).

Run: `npm run test:run -- app/api/openapi.test.ts`
Expected: FAIL (`Cannot find module '@/docs/scoring-api.openapi.json'`).

- [ ] **Step 3: Author** `docs/scoring-api.openapi.json` (OpenAPI 3.1, hand-written). Schemas model the top level; deeply-nested suggestion/action objects are permissive (`additionalProperties: true`) and shown fully in the example:

```json
{
  "openapi": "3.1.0",
  "info": {
    "title": "RCS Compatibility Scoring API",
    "version": "0.1.0",
    "description": "Two axes over a Naxai standaloneRichCard: functional compliance (would the sendRCS API accept it — a 422) and quality (how well it renders on iOS vs Android). Distinct from the upstream Naxai sendRCS contract (docs/rcs-broadcasts.yaml)."
  },
  "servers": [{ "url": "/api" }],
  "paths": {
    "/validate": {
      "post": {
        "summary": "Functional compliance (would the API accept this?)",
        "requestBody": { "required": true, "content": { "application/json": { "schema": { "$ref": "#/components/schemas/CardRequest" }, "examples": { "sample": { "$ref": "#/components/examples/sample" } } } } },
        "responses": {
          "200": { "description": "Functional result", "content": { "application/json": { "schema": { "$ref": "#/components/schemas/FunctionalResult" } } } },
          "400": { "description": "Malformed body", "content": { "application/json": { "schema": { "$ref": "#/components/schemas/ApiError" } } } }
        }
      }
    },
    "/score": {
      "post": {
        "summary": "Quality score (0-100, iOS vs Android)",
        "requestBody": { "required": true, "content": { "application/json": { "schema": { "$ref": "#/components/schemas/CardRequest" }, "examples": { "sample": { "$ref": "#/components/examples/sample" } } } } },
        "responses": {
          "200": { "description": "Score result", "content": { "application/json": { "schema": { "$ref": "#/components/schemas/ScoreResult" } } } },
          "400": { "description": "Malformed body", "content": { "application/json": { "schema": { "$ref": "#/components/schemas/ApiError" } } } }
        }
      }
    },
    "/improve": {
      "post": {
        "summary": "Deterministic improved card",
        "requestBody": { "required": true, "content": { "application/json": { "schema": { "$ref": "#/components/schemas/CardRequest" }, "examples": { "sample": { "$ref": "#/components/examples/sample" } } } } },
        "responses": {
          "200": { "description": "Improved card", "content": { "application/json": { "schema": { "type": "object", "additionalProperties": true } } } },
          "400": { "description": "Malformed body", "content": { "application/json": { "schema": { "$ref": "#/components/schemas/ApiError" } } } }
        }
      }
    },
    "/analyze": {
      "post": {
        "summary": "Functional + quality in one call",
        "requestBody": { "required": true, "content": { "application/json": { "schema": { "$ref": "#/components/schemas/CardRequest" }, "examples": { "sample": { "$ref": "#/components/examples/sample" } } } } },
        "responses": {
          "200": { "description": "Both axes", "content": { "application/json": { "schema": { "type": "object", "properties": { "functional": { "$ref": "#/components/schemas/FunctionalResult" }, "quality": { "$ref": "#/components/schemas/ScoreResult" } } } } } },
          "400": { "description": "Malformed body", "content": { "application/json": { "schema": { "$ref": "#/components/schemas/ApiError" } } } }
        }
      }
    },
    "/media-info": {
      "post": {
        "summary": "Introspect a public media URL (SSRF-guarded, header bytes only)",
        "requestBody": { "required": true, "content": { "application/json": { "schema": { "type": "object", "required": ["url"], "properties": { "url": { "type": "string", "format": "uri" }, "thumbnailUrl": { "type": "string", "format": "uri" } } }, "example": { "url": "https://upload.wikimedia.org/wikipedia/commons/3/3f/JPEG_example_flower.jpg" } } } },
        "responses": {
          "200": { "description": "Media introspection", "content": { "application/json": { "schema": { "$ref": "#/components/schemas/MediaIntrospection" } } } },
          "422": { "description": "Unfetchable / blocked URL", "content": { "application/json": { "schema": { "$ref": "#/components/schemas/ApiError" } } } }
        }
      }
    }
  },
  "components": {
    "examples": {
      "sample": {
        "value": {
          "card": {
            "type": "standaloneRichCard",
            "cardOrientation": "VERTICAL",
            "cardContent": {
              "title": "Spring Collection",
              "description": "New arrivals, free returns.",
              "media": { "height": "TALL", "contentInfo": { "fileUrl": "https://example.com/a.jpg" } },
              "suggestions": [
                { "type": "action", "text": "Shop now", "action": { "type": "openUrlAction", "url": "https://example.com/shop" } },
                { "type": "reply", "text": "Notify me" }
              ]
            }
          },
          "media": { "mediaType": "image", "mimeType": "image/jpeg", "fileSizeBytes": 240000, "width": 1080, "height": 1920, "aspectRatio": 0.5625 },
          "focal": { "x": 0.5, "y": 0.5 }
        }
      }
    },
    "schemas": {
      "FocalPoint": { "type": "object", "properties": { "x": { "type": "number" }, "y": { "type": "number" } } },
      "MediaIntrospection": {
        "type": "object",
        "required": ["mediaType", "mimeType", "fileSizeBytes"],
        "properties": {
          "mediaType": { "type": "string", "enum": ["image", "video"] },
          "mimeType": { "type": "string" },
          "fileSizeBytes": { "type": "integer" },
          "thumbnailSizeBytes": { "type": "integer" },
          "width": { "type": "integer" },
          "height": { "type": "integer" },
          "aspectRatio": { "type": "number" }
        }
      },
      "CardContent": {
        "type": "object",
        "properties": {
          "title": { "type": "string" },
          "description": { "type": "string" },
          "media": { "type": "object", "properties": { "height": { "type": "string", "enum": ["SHORT", "MEDIUM", "TALL"] }, "contentInfo": { "type": "object", "properties": { "fileUrl": { "type": "string" }, "thumbnailUrl": { "type": "string" } } } } },
          "suggestions": { "type": "array", "items": { "type": "object", "additionalProperties": true } }
        }
      },
      "StandaloneRichCard": {
        "type": "object",
        "required": ["type", "cardOrientation", "cardContent"],
        "properties": {
          "type": { "type": "string", "const": "standaloneRichCard" },
          "cardOrientation": { "type": "string", "enum": ["HORIZONTAL", "VERTICAL"] },
          "thumbnailImageAlignment": { "type": "string", "enum": ["LEFT", "RIGHT"] },
          "cardContent": { "$ref": "#/components/schemas/CardContent" }
        }
      },
      "CardRequest": {
        "type": "object",
        "required": ["card"],
        "properties": {
          "card": { "$ref": "#/components/schemas/StandaloneRichCard" },
          "media": { "$ref": "#/components/schemas/MediaIntrospection" },
          "focal": { "$ref": "#/components/schemas/FocalPoint" }
        }
      },
      "FunctionalViolation": {
        "type": "object",
        "properties": {
          "limit": { "type": "string" },
          "message": { "type": "string" },
          "actual": {},
          "max": {},
          "citation": { "type": "string" }
        }
      },
      "FunctionalResult": {
        "type": "object",
        "properties": {
          "passes": { "type": "boolean" },
          "violations": { "type": "array", "items": { "$ref": "#/components/schemas/FunctionalViolation" } }
        }
      },
      "ScoreResult": {
        "type": "object",
        "properties": {
          "overallScore": { "type": "integer" },
          "iosScore": { "type": "integer" },
          "androidScore": { "type": "integer" },
          "imageSafeZoneScore": { "type": "integer" },
          "textFitScore": { "type": "integer" },
          "actionScore": { "type": "integer" },
          "layoutScore": { "type": "integer" },
          "warnings": { "type": "array", "items": { "type": "object", "additionalProperties": true } },
          "recommendations": { "type": "array", "items": { "type": "object", "additionalProperties": true } }
        }
      },
      "ApiError": { "type": "object", "properties": { "error": { "type": "string" }, "message": { "type": "string" } } }
    }
  }
}
```

- [ ] **Step 4: Implement the serving route** `app/api/openapi.json/route.ts`:

```ts
import spec from "@/docs/scoring-api.openapi.json";

export const runtime = "nodejs";

export async function GET() {
  return Response.json(spec);
}
```

- [ ] **Step 5: Run tests + types — expect PASS.**

Run: `npm run test:run -- app/api/openapi.test.ts && npx tsc --noEmit`
Expected: PASS (3 tests); `tsc` clean. (If `tsc` complains about importing JSON, confirm `resolveJsonModule: true` in `tsconfig.json` — it is already set.)

- [ ] **Step 6: Commit.**

```bash
git add docs/scoring-api.openapi.json app/api/openapi.json/route.ts app/api/openapi.test.ts
git commit -m "feat(api): hand-written OpenAPI doc + GET /api/openapi.json + drift guard"
```

---

## Task 8: Swagger UI testing page + header link

**Files:**
- Modify: `package.json` (add `swagger-ui-dist`)
- Create: `app/api-docs/page.tsx`
- Modify: `app/page.tsx` (header link to `/api-docs`)

**Interfaces:**
- Consumes: `GET /api/openapi.json` (Task 7).
- Produces: a `/api-docs` page. No unit test (third-party browser widget); verified by `build` + manual.

- [ ] **Step 1: Install the dependency.**

Run: `npm install swagger-ui-dist`
Expected: `package.json` `dependencies` gains `swagger-ui-dist`; lockfile updates.

- [ ] **Step 2: Create** `app/api-docs/page.tsx`:

```tsx
"use client";

import { useEffect, useRef } from "react";
import "swagger-ui-dist/swagger-ui.css";

/**
 * Classic Swagger UI "try it" page for the scoring API. Mounts the
 * framework-agnostic swagger-ui-dist bundle (no React-version coupling) against
 * a div, pointed at the generated /api/openapi.json. Client-only.
 */
export default function ApiDocsPage() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const mod = (await import("swagger-ui-dist/swagger-ui-bundle.js")) as unknown as {
        default?: (opts: Record<string, unknown>) => void;
      } & ((opts: Record<string, unknown>) => void);
      const SwaggerUIBundle = mod.default ?? mod;
      if (cancelled || !ref.current) return;
      SwaggerUIBundle({
        url: "/api/openapi.json",
        domNode: ref.current,
        deepLinking: true,
        tryItOutEnabled: true,
      });
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main className="mx-auto w-full max-w-[1100px] px-5 py-8">
      <h1 className="font-display mb-4 text-2xl font-bold text-heading">RCS Scoring API — try it</h1>
      <div ref={ref} className="rounded-xl bg-white p-2" />
    </main>
  );
}
```

- [ ] **Step 3: Add a header link** in `app/page.tsx`. Replace the eyebrow `<p>` line:

```tsx
        <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-accent">
          Naxai · RCS Lab
        </p>
```

with a row carrying the link:

```tsx
        <div className="flex items-center justify-between">
          <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-accent">
            Naxai · RCS Lab
          </p>
          <a href="/api-docs" className="font-mono text-[11px] text-accent hover:underline">
            API docs ↗
          </a>
        </div>
```

- [ ] **Step 4: Build.**

Run: `npx tsc --noEmit && npm run build`
Expected: clean; "Compiled successfully". If the build fails on the `swagger-ui-dist/swagger-ui-bundle.js` import or its CSS, use the documented fallback (Step 6) instead.

- [ ] **Step 5: Manual smoke.** `npm run dev`, open `/api-docs`: the classic Swagger UI renders the five endpoints. Expand `POST /analyze` → "Try it out" → Execute (the example body is pre-filled) → a 200 with `{ functional, quality }`. Click "API docs ↗" from `/` to confirm the link.

- [ ] **Step 6: (Only if Step 4/5 fails) Fallback — static HTML served from LOCAL assets.** Do NOT load Swagger UI from a CDN — copy the already-installed dist assets into `public/` so there are no external scripts (avoids CDN-compromise / SRI concerns):

```bash
mkdir -p public/swagger
cp node_modules/swagger-ui-dist/swagger-ui.css node_modules/swagger-ui-dist/swagger-ui-bundle.js node_modules/swagger-ui-dist/swagger-ui-standalone-preset.js public/swagger/
```

Create `public/api-docs.html` referencing only those local, same-origin assets:

```html
<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>RCS Scoring API</title>
    <link rel="stylesheet" href="/swagger/swagger-ui.css" />
  </head>
  <body>
    <div id="swagger"></div>
    <script src="/swagger/swagger-ui-bundle.js"></script>
    <script>
      window.SwaggerUIBundle({ url: "/api/openapi.json", domNode: document.getElementById("swagger"), tryItOutEnabled: true });
    </script>
  </body>
</html>
```

Then make `app/api-docs/page.tsx` a server component that renders `<iframe src="/api-docs.html" className="h-[85vh] w-full" />`. (Document which path was used in the commit message; if using the fallback, also `git add public/swagger public/api-docs.html`.)

- [ ] **Step 7: Commit.**

```bash
git add package.json package-lock.json app/api-docs app/page.tsx
git commit -m "feat(shell): classic Swagger UI testing page at /api-docs"
```

---

## Verification (whole branch)

- [ ] `npm run test:run` — all suites green (kernel + new shell/API tests).
- [ ] `npx tsc --noEmit` — clean.
- [ ] `npm run build` — "Compiled successfully".
- [ ] Manual: `/` shows the functional banner + URL fetch (image renders, video placeholder, bad URL errors); `/api-docs` runs `POST /analyze` end-to-end.

## Self-Review Notes (coverage vs spec)

- Part A1 URL input → Tasks 2, 4. Part A2 functional banner → Task 3. Video handling → Tasks 1 (model), 4 (panel + preview).
- Part B endpoints → Tasks 5, 6. OpenAPI doc + serving → Task 7. Swagger UI → Task 8.
- `lib/` purity preserved (no task modifies `lib/`). Hand-written spec (no zod). Classic Swagger UI via `swagger-ui-dist`. Functional banner above score. Drift guard present (Task 7). All spec requirements mapped.
