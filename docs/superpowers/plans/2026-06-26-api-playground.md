# API Playground Page — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A `/api-playground` page that mirrors the draft simulator but drives the banner/score/improve from the real HTTP API, with a devtools-style request/response console.

**Architecture:** A client page with its own local state reuses the existing editor + previews; a traffic-logging API client (`apiClient.ts`) calls `/api/analyze` (debounced), `/api/media-info`, and `/api/improve`, emitting one `TrafficEntry` per call; an `ApiConsole` renders the log. All shell — `lib/` untouched.

**Tech Stack:** Next 16 (App Router, client component), React 19, TypeScript 5, Vitest 4 (node env).

## Global Constraints

- **`lib/` stays pure** — never modified. All new code is shell (`app/`, `components/`).
- Endpoints used (all exist): `POST /api/analyze` → `{ functional: FunctionalResult, quality: ScoreResult }`; `POST /api/improve` → `ImprovedRcsContent`; `POST /api/media-info` → `MediaIntrospection`.
- The playground uses **local `useState`** (seeded from `DEFAULT_CARD`/`DEFAULT_MEDIA`/`DEFAULT_FOCAL`), NOT `SimulatorProvider` — no cross-contamination with the draft page.
- `RcsInputPanel` change is **backward-compatible** (new optional prop only) — the draft page must keep working unchanged.
- Debounce live analyze at **500 ms**.
- Tests run under vitest node env (`include` already covers `components/**` + `app/**`). Pure logic is TDD-unit-tested; UI is verified by `npx tsc --noEmit` + `npm run build` + manual. No component-render harness exists — do not add one.
- After each task: `npm run test:run` + `npx tsc --noEmit` green. Final task also `npm run build` green.
- DRY, YAGNI, frequent commits.

## File Structure

| File | Responsibility | Task |
|---|---|---|
| `components/apiClient.ts` (create) | traffic-logging HTTP client (`analyzeCard`/`improveCard`/`introspectUrl` + `TrafficEntry`) | 1 |
| `components/apiClient.test.ts` (create) | unit tests (mocked fetch) | 1 |
| `components/RcsInputPanel.tsx` (modify) | optional `fetchMedia` prop (defaults to `fetchMediaInfo`) | 2 |
| `components/ApiConsole.tsx` (create) | the request/response log panel | 3 |
| `app/api-playground/page.tsx` (create) | the page: local state, debounced analyze, improve button, layout | 4 |
| `app/page.tsx` (modify) | header link to `/api-playground` | 4 |

---

## Task 1: `apiClient.ts` — traffic-logging API client

**Files:**
- Create: `components/apiClient.ts`
- Test: `components/apiClient.test.ts`

**Interfaces:**
- Produces:
  - `interface TrafficEntry { id: number; method: "POST"; path: string; status: number; ms: number; ok: boolean; request: unknown; response: unknown; at: number }`
  - `type EmitTraffic = (entry: TrafficEntry) => void`
  - `interface CardRequestBody { card: StandaloneRichCard; media?: MediaIntrospection; focal?: FocalPoint }`
  - `interface AnalyzeResponse { functional: FunctionalResult; quality: ScoreResult }`
  - `analyzeCard(body: CardRequestBody, emit: EmitTraffic): Promise<AnalyzeResponse | null>` (null on non-2xx)
  - `improveCard(body: CardRequestBody, emit: EmitTraffic): Promise<ImprovedRcsContent | null>`
  - `introspectUrl(url: string, emit: EmitTraffic): Promise<MediaIntrospection>` (throws on non-2xx; always emits)

- [ ] **Step 1: Write the failing test** `components/apiClient.test.ts`:

```ts
import { describe, it, expect, vi, afterEach } from "vitest";
import { analyzeCard, introspectUrl, type TrafficEntry } from "@/components/apiClient";
import type { StandaloneRichCard } from "@/types/rcs";

afterEach(() => vi.restoreAllMocks());

const card: StandaloneRichCard = {
  type: "standaloneRichCard",
  cardOrientation: "VERTICAL",
  cardContent: { title: "x" },
};

describe("apiClient", () => {
  it("analyzeCard returns the parsed body and emits one traffic entry", async () => {
    const payload = { functional: { passes: true, violations: [] }, quality: { overallScore: 80 } };
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(payload), { status: 200 })));
    const log: TrafficEntry[] = [];
    const res = await analyzeCard({ card }, (e) => log.push(e));
    expect(res).toEqual(payload);
    expect(log).toHaveLength(1);
    expect(log[0]).toMatchObject({ method: "POST", path: "/api/analyze", status: 200, ok: true });
    expect(log[0].request).toEqual({ card });
    expect(log[0].response).toEqual(payload);
  });

  it("emits ok:false and returns null on a non-2xx", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ error: "BadRequest", message: "nope" }), { status: 400 })));
    const log: TrafficEntry[] = [];
    const res = await analyzeCard({ card }, (e) => log.push(e));
    expect(res).toBeNull();
    expect(log[0]).toMatchObject({ path: "/api/analyze", status: 400, ok: false });
  });

  it("introspectUrl throws on error but still emits an entry", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ message: "non-public" }), { status: 422 })));
    const log: TrafficEntry[] = [];
    await expect(introspectUrl("https://ex/a.png", (e) => log.push(e))).rejects.toThrow(/non-public/);
    expect(log[0]).toMatchObject({ path: "/api/media-info", status: 422, ok: false });
  });
});
```

- [ ] **Step 2: Run it — expect FAIL** (module not found).

Run: `npm run test:run -- components/apiClient.test.ts`
Expected: FAIL (`Cannot find module '@/components/apiClient'`).

- [ ] **Step 3: Implement** `components/apiClient.ts`:

```ts
import type {
  FocalPoint,
  FunctionalResult,
  ImprovedRcsContent,
  MediaIntrospection,
  ScoreResult,
  StandaloneRichCard,
} from "@/types/rcs";

/** One logged HTTP exchange against the scoring API (shell-only, not the kernel). */
export interface TrafficEntry {
  id: number;
  method: "POST";
  path: string;
  status: number; // HTTP status, or 0 on a network failure
  ms: number;
  ok: boolean;
  request: unknown;
  response: unknown;
  at: number; // epoch ms
}

export type EmitTraffic = (entry: TrafficEntry) => void;

export interface CardRequestBody {
  card: StandaloneRichCard;
  media?: MediaIntrospection;
  focal?: FocalPoint;
}

export interface AnalyzeResponse {
  functional: FunctionalResult;
  quality: ScoreResult;
}

let seq = 0;

async function call(path: string, body: unknown, emit: EmitTraffic): Promise<{ ok: boolean; data: unknown }> {
  const started = performance.now();
  let status = 0;
  let ok = false;
  let data: unknown = null;
  try {
    const res = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    status = res.status;
    ok = res.ok;
    data = await res.json().catch(() => null);
  } catch (e) {
    data = { error: "NetworkError", message: (e as Error).message };
  }
  const ms = Math.round(performance.now() - started);
  emit({ id: ++seq, method: "POST", path, status, ms, ok, request: body, response: data, at: Date.now() });
  return { ok, data };
}

export async function analyzeCard(body: CardRequestBody, emit: EmitTraffic): Promise<AnalyzeResponse | null> {
  const { ok, data } = await call("/api/analyze", body, emit);
  return ok ? (data as AnalyzeResponse) : null;
}

export async function improveCard(body: CardRequestBody, emit: EmitTraffic): Promise<ImprovedRcsContent | null> {
  const { ok, data } = await call("/api/improve", body, emit);
  return ok ? (data as ImprovedRcsContent) : null;
}

export async function introspectUrl(url: string, emit: EmitTraffic): Promise<MediaIntrospection> {
  const { ok, data } = await call("/api/media-info", { url }, emit);
  if (!ok) throw new Error((data as { message?: string })?.message ?? "Media fetch failed.");
  return data as MediaIntrospection;
}
```

- [ ] **Step 4: Run tests + types — expect PASS.**

Run: `npm run test:run -- components/apiClient.test.ts && npx tsc --noEmit`
Expected: 3 tests pass; `tsc` clean.

- [ ] **Step 5: Commit.**

```bash
git add components/apiClient.ts components/apiClient.test.ts
git commit -m "feat(shell): traffic-logging apiClient (analyze/improve/media-info)"
```

---

## Task 2: `RcsInputPanel` — optional `fetchMedia` prop

**Files:**
- Modify: `components/RcsInputPanel.tsx`

**Interfaces:**
- Produces: `RcsInputPanel` gains optional prop `fetchMedia?: (url: string) => Promise<MediaIntrospection>`. When omitted it uses the existing `fetchMediaInfo` (draft page unaffected); the playground passes a logged wrapper.

No unit test (UI wiring; the behavior is one substituted call). Verified by `tsc` + build (build comes in Task 4).

- [ ] **Step 1: Add the prop** to the `RcsInputPanelProps` interface (after `onMediaUrlFetched`):

```ts
  /** Override the media fetcher (the playground injects a traffic-logged one). */
  fetchMedia?: (url: string) => Promise<MediaIntrospection>;
```

- [ ] **Step 2: Destructure it** in the component signature (add `fetchMedia,` after `onMediaUrlFetched,`):

```ts
export default function RcsInputPanel({
  content,
  onContentChange,
  onMediaUrlFetched,
  fetchMedia,
  toggles,
}: RcsInputPanelProps) {
```

- [ ] **Step 3: Use it** in `handleFetchUrl` — replace the `fetchMediaInfo(...)` call:

```ts
      const media = await (fetchMedia ?? fetchMediaInfo)(urlInput.trim());
```

(The `import { fetchMediaInfo } from "@/components/mediaClient";` line stays — it's the default.)

- [ ] **Step 4: Type-check.**

Run: `npx tsc --noEmit`
Expected: clean (the draft page calls `RcsInputPanel` without `fetchMedia` — still valid since it's optional).

- [ ] **Step 5: Commit.**

```bash
git add components/RcsInputPanel.tsx
git commit -m "feat(shell): RcsInputPanel accepts an optional fetchMedia override"
```

---

## Task 3: `ApiConsole` — the request/response log panel

**Files:**
- Create: `components/ApiConsole.tsx`

**Interfaces:**
- Consumes: `TrafficEntry` (Task 1).
- Produces: `<ApiConsole entries={TrafficEntry[]} onClear={() => void} />`.

No unit test (pure presentation). Verified by `tsc` + build (Task 4).

- [ ] **Step 1: Implement** `components/ApiConsole.tsx`:

```tsx
"use client";

import { useState } from "react";
import type { TrafficEntry } from "@/components/apiClient";

/** Devtools-style request/response log for the API playground. Presentation only. */
export default function ApiConsole({ entries, onClear }: { entries: TrafficEntry[]; onClear: () => void }) {
  return (
    <section className="rounded-xl border border-line bg-panel">
      <header className="flex items-center justify-between border-b border-line px-4 py-2.5">
        <h2 className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted">API console · {entries.length}</h2>
        <button type="button" onClick={onClear} className="font-mono text-[11px] text-muted transition hover:text-body">
          clear
        </button>
      </header>
      {entries.length === 0 ? (
        <p className="px-4 py-6 text-center text-xs text-muted">No requests yet — edit the card or fetch a URL.</p>
      ) : (
        <ul className="divide-y divide-line">
          {entries.map((e) => (
            <Row key={e.id} entry={e} />
          ))}
        </ul>
      )}
    </section>
  );
}

function Row({ entry }: { entry: TrafficEntry }) {
  const [open, setOpen] = useState(false);
  return (
    <li>
      <button type="button" onClick={() => setOpen((o) => !o)} className="flex w-full items-center gap-3 px-4 py-2 text-left">
        <span className="font-mono text-[10px] text-muted">{open ? "▾" : "▸"}</span>
        <span className="font-mono text-[11px] font-semibold text-body">{entry.method}</span>
        <span className="font-mono text-[11px] text-body">{entry.path}</span>
        <span
          className={`ml-auto rounded px-1.5 py-0.5 font-mono text-[10px] ${
            entry.ok
              ? "bg-[var(--color-secondary)]/15 text-[var(--color-secondary)]"
              : "bg-[var(--color-destructive)]/15 text-[var(--color-destructive)]"
          }`}
        >
          {entry.status || "ERR"}
        </span>
        <span className="font-mono text-[10px] text-muted">{entry.ms}ms</span>
      </button>
      {open && (
        <div className="grid gap-2 px-4 pb-3 md:grid-cols-2">
          <Json label="request" value={entry.request} />
          <Json label="response" value={entry.response} />
        </div>
      )}
    </li>
  );
}

function Json({ label, value }: { label: string; value: unknown }) {
  return (
    <div>
      <p className="mb-1 font-mono text-[10px] uppercase tracking-wider text-faint">{label}</p>
      <pre className="max-h-64 overflow-auto rounded-lg border border-line bg-field p-2 font-mono text-[10px] leading-relaxed text-body">
        {JSON.stringify(value, null, 2)}
      </pre>
    </div>
  );
}
```

- [ ] **Step 2: Type-check.**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 3: Commit.**

```bash
git add components/ApiConsole.tsx
git commit -m "feat(shell): ApiConsole request/response log panel"
```

---

## Task 4: `/api-playground` page + header link

**Files:**
- Create: `app/api-playground/page.tsx`
- Modify: `app/page.tsx`

**Interfaces:**
- Consumes: `apiClient` (Task 1), `ApiConsole` (Task 3), `RcsInputPanel.fetchMedia` (Task 2), plus existing `cardToView`/`viewToParts`, `PreviewToolbar`, `PlatformPreview`, `RcsCardPreview`, `FunctionalBanner`, `ScorePanel`, `DEFAULT_CARD`/`DEFAULT_MEDIA`/`DEFAULT_FOCAL`.

- [ ] **Step 1: Implement** `app/api-playground/page.tsx`:

```tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { cardToView, viewToParts, type CardView } from "@/components/cardView";
import {
  analyzeCard,
  improveCard,
  introspectUrl,
  type AnalyzeResponse,
  type TrafficEntry,
} from "@/components/apiClient";
import ApiConsole from "@/components/ApiConsole";
import FunctionalBanner from "@/components/FunctionalBanner";
import PlatformPreview from "@/components/PlatformPreview";
import PreviewToolbar from "@/components/PreviewToolbar";
import RcsCardPreview from "@/components/RcsCardPreview";
import RcsInputPanel from "@/components/RcsInputPanel";
import ScorePanel from "@/components/ScorePanel";
import { DEFAULT_CARD, DEFAULT_FOCAL, DEFAULT_MEDIA } from "@/lib/sampleContent";
import type { FocalPoint, MediaIntrospection, OverlayToggles, StandaloneRichCard } from "@/types/rcs";

export default function ApiPlayground() {
  const [card, setCard] = useState<StandaloneRichCard>(DEFAULT_CARD);
  const [media, setMedia] = useState<MediaIntrospection | undefined>(DEFAULT_MEDIA);
  const [focal, setFocal] = useState<FocalPoint>(DEFAULT_FOCAL);
  const [toggles, setToggles] = useState<OverlayToggles>({
    showSafeZone: true,
    showCropArea: false,
    showTextLineLimits: true,
  });
  const [entries, setEntries] = useState<TrafficEntry[]>([]);
  const [result, setResult] = useState<AnalyzeResponse | null>(null);
  const [scoring, setScoring] = useState(true);
  const [improving, setImproving] = useState(false);

  const emit = (e: TrafficEntry) => setEntries((prev) => [e, ...prev]);

  const view = useMemo(() => cardToView(card, media, focal), [card, media, focal]);

  const onContentChange = (patch: Partial<CardView>) => {
    const parts = viewToParts({ ...view, ...patch }, media);
    setCard(parts.card);
    setMedia(parts.media);
    setFocal(parts.focal);
  };

  const onMediaUrlFetched = (url: string, fetched: MediaIntrospection) => {
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

  // Live analyze: POST /api/analyze ~500ms after the card settles.
  useEffect(() => {
    setScoring(true);
    const t = setTimeout(async () => {
      const res = await analyzeCard({ card, media, focal }, emit);
      setResult(res);
      setScoring(false);
    }, 500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [card, media, focal]);

  async function runImprover() {
    setImproving(true);
    await improveCard({ card, media, focal }, emit);
    setImproving(false);
  }

  return (
    <main className="mx-auto w-full max-w-[1500px] px-5 pb-24 pt-8">
      <header className="mb-8 border-b border-line pb-6">
        <div className="flex items-center justify-between">
          <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-accent">Naxai · RCS Lab</p>
          <div className="flex items-center gap-4">
            <a href="/" className="font-mono text-[11px] text-muted transition hover:text-body">
              ← Draft
            </a>
            <a href="/api-docs" className="font-mono text-[11px] text-accent hover:underline">
              API docs ↗
            </a>
          </div>
        </div>
        <h1 className="font-display mt-1 text-3xl font-bold tracking-tight text-heading sm:text-4xl">
          RCS API Playground
        </h1>
        <p className="mt-1 text-sm text-muted">
          Every score comes over HTTP from the scoring API — watch the requests in the console below.
        </p>
      </header>

      <div className="grid gap-8 lg:grid-cols-[minmax(330px,390px)_1fr]">
        <RcsInputPanel
          content={view}
          onContentChange={onContentChange}
          onMediaUrlFetched={onMediaUrlFetched}
          fetchMedia={(url) => introspectUrl(url, emit)}
          toggles={toggles}
        />

        <div className="flex flex-col gap-8">
          <div className="overflow-hidden rounded-2xl border border-line bg-[radial-gradient(ellipse_at_top,rgba(56,130,246,0.08),transparent_60%)]">
            <PreviewToolbar
              orientation={view.orientation}
              height={view.height}
              onOrientationChange={(orientation) => onContentChange({ orientation })}
              onHeightChange={(height) => onContentChange({ height })}
              toggles={toggles}
              onTogglesChange={setToggles}
            />
            <div className="flex flex-wrap items-start justify-center gap-8 p-6 pb-2">
              <PlatformPreview platform="ios" caption="iOS">
                <RcsCardPreview content={view} platform="ios" toggles={toggles} />
              </PlatformPreview>
              <PlatformPreview platform="android" caption="Android">
                <RcsCardPreview content={view} platform="android" toggles={toggles} />
              </PlatformPreview>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            {result ? (
              <>
                <FunctionalBanner result={result.functional} />
                <ScorePanel score={result.quality} />
              </>
            ) : (
              <div className="rounded-xl border border-line bg-panel px-4 py-3 text-sm text-muted">
                {scoring ? "Scoring via POST /api/analyze…" : "API error — see the console below."}
              </div>
            )}
            <button
              type="button"
              onClick={runImprover}
              disabled={improving}
              className="self-start rounded-lg border border-line bg-panel px-3 py-1.5 text-xs font-medium text-body transition hover:border-line-strong disabled:opacity-50"
            >
              {improving ? "Improving…" : "Run improver (POST /api/improve)"}
            </button>
          </div>
        </div>
      </div>

      <div className="mt-8">
        <ApiConsole entries={entries} onClear={() => setEntries([])} />
      </div>
    </main>
  );
}
```

- [ ] **Step 2: Add the header link** in `app/page.tsx` — replace the single-link header row:

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

with a two-link version:

```tsx
        <div className="flex items-center justify-between">
          <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-accent">
            Naxai · RCS Lab
          </p>
          <div className="flex items-center gap-4">
            <a href="/api-playground" className="font-mono text-[11px] text-muted transition hover:text-body">
              API playground
            </a>
            <a href="/api-docs" className="font-mono text-[11px] text-accent hover:underline">
              API docs ↗
            </a>
          </div>
        </div>
```

- [ ] **Step 3: Type-check + build.**

Run: `npx tsc --noEmit && npm run build`
Expected: clean; "Compiled successfully"; the route table lists `○ /api-playground`.

- [ ] **Step 4: Manual smoke.** `npm run dev`, open `/api-playground`:
  - On load, an `analyze` entry appears in the console (200); the banner + score render from it.
  - Edit the title → after ~500ms a new `analyze` entry appears and the score updates.
  - Paste a public image URL → Fetch → a `media-info` entry appears (200) and the image loads.
  - Click "Run improver" → an `improve` entry appears (200); expand it to see the improved card JSON.
  - Expand any row → request + response pretty-printed; "clear" empties the log.
  - From `/`, the "API playground" header link navigates here.

- [ ] **Step 5: Commit.**

```bash
git add app/api-playground/page.tsx app/page.tsx
git commit -m "feat(shell): /api-playground — live API simulator with request/response console"
```

---

## Verification (whole feature)

- [ ] `npm run test:run` — all green (kernel + shell, incl. the new apiClient tests).
- [ ] `npx tsc --noEmit` — clean.
- [ ] `npm run build` — "Compiled successfully"; `/api-playground` present.
- [ ] Manual: analyze (debounced) drives the score, media-info on URL fetch, improve on button — all visible in the console; draft page (`/`) still works unchanged.

## Self-Review Notes (coverage vs spec)

- Console (bottom, expandable rows, clear, empty state) → Task 3. Traffic logging → Task 1. Debounced analyze drives banner+score → Task 4. URL fetch logged via injected `fetchMedia` → Tasks 1+2+4. Improve button → Task 4. Local isolated state → Task 4. Header link → Task 4. Error handling (null result → "API error", red rows) → Tasks 1,3,4.
- `lib/` untouched; backward-compatible `RcsInputPanel` change; apiClient TDD-tested. All spec requirements mapped.
