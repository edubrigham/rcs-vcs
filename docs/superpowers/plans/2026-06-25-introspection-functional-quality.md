# Media Introspection + Functional Compliance + Quality Enrichment — Implementation Plan (Plan 2 of 2)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add (a) URL/file media introspection — image dimensions + type/size, video type/size only; (b) a functional-compliance layer that pre-flights the Naxai `sendRCS` hard limits; (c) Google-guide quality enrichment; and (d) the portability artifacts (golden vectors + `docs/PORTING.md`).

**Architecture:** A pure `introspectMedia(bytes, headers)` kernel function (shared by browser uploads and the server URL path), exposed via a thin `POST /api/media-info` route with an SSRF-hardened ranged fetch. A pure `validateFunctional(card, media)` layer sits beside the unchanged 0–100 quality scorer; the guide's canonical numbers replace the derived ones in `rcsRules.ts`. Golden JSON vectors become the language-agnostic parity contract for the Naxai port.

**Tech Stack:** TypeScript 5, Next.js 16.2.9 (Node runtime route handler), Vitest 4, `image-size` v2.0.2 (new dependency).

## Global Constraints

- **Builds on Plan 1.** The native model exists: `StandaloneRichCard`, `MediaIntrospection`, `FocalPoint`, and `scoreQuality(card, media?, focal?): ScoreResult`. No legacy `RcsContent`.
- `lib/` imports nothing from `react`/`next` — the route handler (`app/api/...`) and components are the only impure/shell code.
- **Source precedence:** functional hard limits → **Naxai OpenAPI**; canonical dimensions → **Google guide**; UX heuristics → **playbooks**. Cite all three.
- **Functional limits (verbatim):** title ≤ 200, description ≤ 2000, suggestions/card ≤ 4, suggestion `text` ≤ 25, `thumbnailUrl` ≤ 100 000 bytes, `openUrlAction.url` ≤ 2048, file ≤ 100 000 000 bytes (soft).
- **Canonical heights (DP):** `SHORT 112 / MEDIUM 168 / TALL 264`. **Vertical aspect set:** `{2:1, 16:9, 7:3}` — **nearest-of-set**, never a per-height map.
- **Supported MIME:** images `{image/jpeg, image/png, image/gif}`; video `{video/h263, video/x-m4v, video/mp4, video/mpeg, video/webm}`.
- **Video is header-only:** type from `content-type`, size from `Content-Length`/`Content-Range`. **No body parsing.** Images use `image-size` v2 on a 64 KB ranged read.
- **Route:** `export const runtime = "nodejs"`, `export const maxDuration = 10`; verify the handler signature against `node_modules/next/dist/docs/` before writing.
- All tests stay green; `npx vitest run` is the gate.

## File Structure

- **Create** `lib/media/introspect.ts` (+ `.test.ts`) — pure `introspectMedia(bytes, headers)`.
- **Create** `lib/media/ssrfGuard.ts` (+ `.test.ts`) — pure URL/IP validation.
- **Create** `app/api/media-info/route.ts` — server fetch + ranged read + thumbnail HEAD.
- **Create** `lib/validateFunctional.ts` (+ `.test.ts`) — the compliance layer.
- **Create** `components/FunctionalBanner.tsx` — "won't send" violations UI.
- **Create** `lib/__vectors__/` (JSON fixtures + `vectors.test.ts`) — parity contract.
- **Create** `docs/PORTING.md` — kernel boundary, model↔OpenAPI map, introspection algorithm, vectors how-to.
- **Modify** `types/rcs.ts` — `FunctionalViolation`, `FunctionalResult`, `FunctionalLimitId`.
- **Modify** `lib/rcsRules.ts` (+ test) — declarative `FUNCTIONAL_LIMITS`, `GUIDE_MEDIA_HEIGHT_DP`, `GUIDE_VERTICAL_ASPECTS`, `nearestGuideAspect`, supported-MIME sets; replace derived heights.
- **Modify** `lib/scoreRcsContent.ts` — nearest-of-set aspect via `media.aspectRatio`, file-size soft warning, animated-GIF warning.
- **Modify** `lib/recommendationCitations.ts` (+ test) — add the OpenAPI + guide sources.
- **Modify** `components/RcsInputPanel.tsx`, `app/page.tsx`, `app/improve/page.tsx` — URL input + banner wiring.

---

### Task 1: Functional types + declarative limit constants

**Files:**
- Modify: `types/rcs.ts`, `lib/rcsRules.ts`
- Test: `lib/rcsRules.test.ts`

**Interfaces:**
- Produces (types): `FunctionalLimitId`, `FunctionalViolation`, `FunctionalResult`.
- Produces (constants): `FUNCTIONAL_LIMITS`, `SUPPORTED_IMAGE_MIME`, `SUPPORTED_VIDEO_MIME`.

- [ ] **Step 1: Add types to `types/rcs.ts`**

```ts
export type FunctionalLimitId =
  | "mediaType" | "titleLength" | "descriptionLength"
  | "suggestionCount" | "labelLength" | "thumbnailSize" | "openUrlLength" | "emptyCard";
export interface FunctionalViolation {
  limit: FunctionalLimitId;
  message: string;
  actual: string | number;
  max?: string | number;
  citation: string;
}
export interface FunctionalResult { passes: boolean; violations: FunctionalViolation[] }
```

- [ ] **Step 2: Write the failing constants test** in `lib/rcsRules.test.ts`

```ts
import { FUNCTIONAL_LIMITS, SUPPORTED_IMAGE_MIME, SUPPORTED_VIDEO_MIME } from "@/lib/rcsRules";
it("exposes the OpenAPI functional limits", () => {
  expect(FUNCTIONAL_LIMITS.TITLE_MAX).toBe(200);
  expect(FUNCTIONAL_LIMITS.DESCRIPTION_MAX).toBe(2000);
  expect(FUNCTIONAL_LIMITS.SUGGESTION_MAX).toBe(4);
  expect(FUNCTIONAL_LIMITS.LABEL_MAX).toBe(25);
  expect(FUNCTIONAL_LIMITS.THUMBNAIL_MAX_BYTES).toBe(100_000);
  expect(FUNCTIONAL_LIMITS.OPEN_URL_MAX).toBe(2048);
  expect(SUPPORTED_IMAGE_MIME).toContain("image/png");
  expect(SUPPORTED_VIDEO_MIME).toContain("video/mp4");
});
```

- [ ] **Step 3: Run — expect FAIL.** Run: `npx vitest run lib/rcsRules.test.ts`

- [ ] **Step 4: Add the constants to `lib/rcsRules.ts`**

```ts
/** Functional hard limits — Naxai sendRCS OpenAPI (a 422 if exceeded). */
export const FUNCTIONAL_LIMITS = {
  TITLE_MAX: 200, DESCRIPTION_MAX: 2000, SUGGESTION_MAX: 4, LABEL_MAX: 25,
  THUMBNAIL_MAX_BYTES: 100_000, OPEN_URL_MAX: 2048, FILE_MAX_BYTES: 100_000_000,
} as const;
/** Supported MIME — Google RBM rich-cards guide. */
export const SUPPORTED_IMAGE_MIME = ["image/jpeg", "image/png", "image/gif"] as const;
export const SUPPORTED_VIDEO_MIME = ["video/h263", "video/x-m4v", "video/mp4", "video/mpeg", "video/webm"] as const;
```

- [ ] **Step 5: Run — expect PASS.** Run: `npx vitest run lib/rcsRules.test.ts`

- [ ] **Step 6: Commit**

```bash
git add types/rcs.ts lib/rcsRules.ts lib/rcsRules.test.ts
git commit -m "feat(rules): functional limit + supported-MIME constants"
```

---

### Task 2: `validateFunctional` compliance layer

**Files:**
- Create: `lib/validateFunctional.ts`, `lib/validateFunctional.test.ts`

**Interfaces:**
- Consumes: `StandaloneRichCard`, `MediaIntrospection`, `FUNCTIONAL_LIMITS`, the MIME sets.
- Produces: `validateFunctional(card: StandaloneRichCard, media?: MediaIntrospection): FunctionalResult`.

- [ ] **Step 1: Write the failing boundary tests** `lib/validateFunctional.test.ts`

```ts
import { describe, it, expect } from "vitest";
import { validateFunctional } from "@/lib/validateFunctional";
import type { StandaloneRichCard } from "@/types/rcs";

const card = (over: Partial<StandaloneRichCard["cardContent"]> = {}): StandaloneRichCard => ({
  type: "standaloneRichCard", cardOrientation: "VERTICAL",
  cardContent: { title: "Hi", description: "There", ...over },
});

describe("validateFunctional", () => {
  it("passes a clean card", () => {
    expect(validateFunctional(card()).passes).toBe(true);
  });
  it("flags title at 201", () => {
    const r = validateFunctional(card({ title: "x".repeat(201) }));
    expect(r.passes).toBe(false);
    expect(r.violations.map(v => v.limit)).toContain("titleLength");
  });
  it("flags >4 suggestions and a 26-char label", () => {
    const s = (t: string) => ({ type: "reply" as const, text: t });
    const r = validateFunctional(card({ suggestions: [s("a"), s("b"), s("c"), s("d"), s("y".repeat(26))] }));
    expect(r.violations.map(v => v.limit).sort()).toEqual(["labelLength", "suggestionCount"]);
  });
  it("flags an empty card", () => {
    const r = validateFunctional(card({ title: undefined, description: undefined }));
    expect(r.violations.map(v => v.limit)).toContain("emptyCard");
  });
  it("flags an unsupported media type", () => {
    const r = validateFunctional(card({}), { mediaType: "image", mimeType: "image/bmp", fileSizeBytes: 1000 });
    expect(r.violations.map(v => v.limit)).toContain("mediaType");
  });
  it("flags a thumbnail over 100kB", () => {
    const r = validateFunctional(card({}), { mediaType: "image", mimeType: "image/png", fileSizeBytes: 1000, thumbnailSizeBytes: 100_001 });
    expect(r.violations.map(v => v.limit)).toContain("thumbnailSize");
  });
});
```

- [ ] **Step 2: Run — expect FAIL.** Run: `npx vitest run lib/validateFunctional.test.ts`

- [ ] **Step 3: Implement `lib/validateFunctional.ts`**

```ts
import { FUNCTIONAL_LIMITS as L, SUPPORTED_IMAGE_MIME, SUPPORTED_VIDEO_MIME } from "@/lib/rcsRules";
import type { FunctionalResult, FunctionalViolation, MediaIntrospection, StandaloneRichCard } from "@/types/rcs";

const OPENAPI = "Naxai sendRCS";
const GUIDE = "RBM rich-cards";

export function validateFunctional(card: StandaloneRichCard, media?: MediaIntrospection): FunctionalResult {
  const v: FunctionalViolation[] = [];
  const c = card.cardContent;
  const title = c.title ?? "", desc = c.description ?? "", sugg = c.suggestions ?? [];

  if (!c.title && !c.description && !c.media)
    v.push({ limit: "emptyCard", message: "A card must include at least a title, description, or media.", actual: "empty", citation: GUIDE });
  if (title.length > L.TITLE_MAX)
    v.push({ limit: "titleLength", message: `Title exceeds ${L.TITLE_MAX} characters.`, actual: title.length, max: L.TITLE_MAX, citation: OPENAPI });
  if (desc.length > L.DESCRIPTION_MAX)
    v.push({ limit: "descriptionLength", message: `Description exceeds ${L.DESCRIPTION_MAX} characters.`, actual: desc.length, max: L.DESCRIPTION_MAX, citation: OPENAPI });
  if (sugg.length > L.SUGGESTION_MAX)
    v.push({ limit: "suggestionCount", message: `A card allows at most ${L.SUGGESTION_MAX} suggestions.`, actual: sugg.length, max: L.SUGGESTION_MAX, citation: OPENAPI });
  for (const s of sugg)
    if (s.text.length > L.LABEL_MAX)
      v.push({ limit: "labelLength", message: `Suggestion "${s.text.slice(0, 12)}…" exceeds ${L.LABEL_MAX} characters.`, actual: s.text.length, max: L.LABEL_MAX, citation: OPENAPI });
  for (const s of sugg)
    if (s.type === "action" && s.action.type === "openUrlAction" && s.action.url.length > L.OPEN_URL_MAX)
      v.push({ limit: "openUrlLength", message: `Open-URL action exceeds ${L.OPEN_URL_MAX} characters.`, actual: s.action.url.length, max: L.OPEN_URL_MAX, citation: OPENAPI });
  if (media?.thumbnailSizeBytes != null && media.thumbnailSizeBytes > L.THUMBNAIL_MAX_BYTES)
    v.push({ limit: "thumbnailSize", message: `Thumbnail exceeds ${L.THUMBNAIL_MAX_BYTES / 1000} kB.`, actual: media.thumbnailSizeBytes, max: L.THUMBNAIL_MAX_BYTES, citation: OPENAPI });
  if (media) {
    const allow: readonly string[] = media.mediaType === "image" ? SUPPORTED_IMAGE_MIME : SUPPORTED_VIDEO_MIME;
    if (!allow.includes(media.mimeType))
      v.push({ limit: "mediaType", message: `Unsupported media type "${media.mimeType}".`, actual: media.mimeType, citation: GUIDE });
  }
  return { passes: v.length === 0, violations: v };
}
```

- [ ] **Step 4: Run — expect PASS.** Run: `npx vitest run lib/validateFunctional.test.ts`

- [ ] **Step 5: Commit**

```bash
git add lib/validateFunctional.ts lib/validateFunctional.test.ts
git commit -m "feat(functional): pre-flight Naxai hard limits as a compliance layer"
```

---

### Task 3: Canonical guide dimensions + nearest-of-set aspect

**Files:**
- Modify: `lib/rcsRules.ts`, `lib/rcsRules.test.ts`

**Interfaces:**
- Produces: `GUIDE_MEDIA_HEIGHT_DP`, `GUIDE_VERTICAL_ASPECTS`, `nearestGuideAspect(aspect): { ratio: number; deviation: number }`. `verticalFormatMediaHeightCap` rekeyed to `{ SHORT:112, MEDIUM:168, TALL:264 }`; `verticalMediaHeightCap` raised to 264.

- [ ] **Step 1: Write failing tests** in `lib/rcsRules.test.ts`

```ts
import { GUIDE_MEDIA_HEIGHT_DP, nearestGuideAspect } from "@/lib/rcsRules";
it("uses the guide canonical heights", () => {
  expect(GUIDE_MEDIA_HEIGHT_DP).toEqual({ SHORT: 112, MEDIUM: 168, TALL: 264 });
});
it("nearest-of-set picks 16:9 for ~1.78 and 2:1 for ~2.0", () => {
  expect(nearestGuideAspect(1.78).ratio).toBeCloseTo(16 / 9, 2);
  expect(nearestGuideAspect(2.0).ratio).toBe(2);
});
```

- [ ] **Step 2: Run — expect FAIL.** Run: `npx vitest run lib/rcsRules.test.ts`

- [ ] **Step 3: Add constants + helper; replace derived heights** in `lib/rcsRules.ts`

```ts
export const GUIDE_MEDIA_HEIGHT_DP = { SHORT: 112, MEDIUM: 168, TALL: 264 } as const;
export const GUIDE_VERTICAL_ASPECTS = [2 / 1, 16 / 9, 7 / 3] as const;

export function nearestGuideAspect(aspect: number): { ratio: number; deviation: number } {
  let ratio = GUIDE_VERTICAL_ASPECTS[0];
  for (const r of GUIDE_VERTICAL_ASPECTS)
    if (Math.abs(aspect - r) < Math.abs(aspect - ratio)) ratio = r;
  return { ratio, deviation: Math.abs(aspect - ratio) / ratio };
}
```

Replace `IOS_RULES.verticalFormatMediaHeightCap` with `{ SHORT: 112, MEDIUM: 168, TALL: 264 }` and set `IOS_RULES.verticalMediaHeightCap = 264`. Update the rule lookups that read those caps to key on `MediaHeight`.

- [ ] **Step 4: Run — expect PASS.** Run: `npx vitest run lib/rcsRules.test.ts`

- [ ] **Step 5: Commit** (goldens are re-baselined in Task 4, after the scorer consumes these)

```bash
git add lib/rcsRules.ts lib/rcsRules.test.ts
git commit -m "feat(rules): guide canonical heights + nearest-of-set aspect"
```

---

### Task 4: Wire introspection into the quality scorer

**Files:**
- Modify: `lib/scoreRcsContent.ts`, `lib/__golden__/behavior.golden.test.ts`

**Interfaces:**
- Consumes: `media?: MediaIntrospection`, `nearestGuideAspect`, `FUNCTIONAL_LIMITS.FILE_MAX_BYTES`.

- [ ] **Step 1: In `scoreImage`, replace the recommended-aspect check** with nearest-of-set, guarded on having image dimensions:

```ts
if (media?.aspectRatio != null) {
  const { ratio, deviation } = nearestGuideAspect(media.aspectRatio);
  if (deviation > RATIO_DEVIATION_TOLERANCE) {
    warnings.push({ severity: "info", platform: "both", category: "image",
      message: `Aspect ${media.aspectRatio.toFixed(2)} is far from the nearest recommended ${ratio.toFixed(2)} (2:1 / 16:9 / 7:3).`,
      recommendation: "Export close to one of the recommended vertical ratios (RBM rich-cards)." });
  }
}
```

- [ ] **Step 2: Add the soft file-size + animated-GIF warnings** (images and video):

```ts
if (media && media.fileSizeBytes > FUNCTIONAL_LIMITS.FILE_MAX_BYTES) {
  warnings.push({ severity: "info", platform: "both", category: "image",
    message: `Media file is over ${FUNCTIONAL_LIMITS.FILE_MAX_BYTES / 1e6} MB (recommended max).`,
    recommendation: "Compress the asset below 100 MB (Naxai sendRCS)." });
}
if (media?.mimeType === "image/gif") {
  warnings.push({ severity: "info", platform: "ios", category: "image",
    message: "Animated GIFs do not animate on iOS — the first frame is shown.",
    recommendation: "Use a short video if motion matters (xPlatform Playbook s11)." });
}
```

- [ ] **Step 3: Re-baseline goldens — the image score MOVES on purpose** (canonical heights 132/204→168/264 and the new aspect rule). Update and inspect:

```bash
npx vitest run lib/__golden__ -u
git diff -- lib/__golden__
```

Verify the diff only touches image-related sub-scores/warnings for cases that have media; text/action/layout numbers for media-less cases must be unchanged. If a media-less case moved, a wiring bug leaked — fix before committing.

- [ ] **Step 4: Run the full suite + commit**

```bash
npx vitest run
git add lib/scoreRcsContent.ts lib/__golden__
git commit -m "feat(score): nearest-of-set aspect, file-size + animated-GIF warnings"
```

---

### Task 5: Pure media introspection (`introspectMedia`)

**Files:**
- Create: `lib/media/introspect.ts`, `lib/media/introspect.test.ts`
- Modify: `package.json` (add `image-size`)

**Interfaces:**
- Produces: `introspectMedia(bytes: Uint8Array, headers: { contentType: string; fileSizeBytes: number; thumbnailSizeBytes?: number }): MediaIntrospection`.

- [ ] **Step 1: Install the dependency**

Run: `npm install image-size@^2.0.2`
Expected: `image-size` added to `dependencies`.

- [ ] **Step 2: Write the failing tests** `lib/media/introspect.test.ts`

```ts
import { describe, it, expect } from "vitest";
import { introspectMedia } from "@/lib/media/introspect";

// 1x1 PNG (67 bytes), base64-decoded to a Uint8Array.
const PNG_1x1 = Uint8Array.from(atob(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=="
), c => c.charCodeAt(0));

describe("introspectMedia", () => {
  it("reads PNG dimensions", () => {
    const m = introspectMedia(PNG_1x1, { contentType: "image/png", fileSizeBytes: 67 });
    expect(m).toMatchObject({ mediaType: "image", mimeType: "image/png", width: 1, height: 1, aspectRatio: 1, fileSizeBytes: 67 });
  });
  it("treats video as header-only (no dimensions)", () => {
    const m = introspectMedia(new Uint8Array(0), { contentType: "video/mp4; codecs=avc1", fileSizeBytes: 5_000_000 });
    expect(m).toEqual({ mediaType: "video", mimeType: "video/mp4", fileSizeBytes: 5_000_000, thumbnailSizeBytes: undefined });
    expect(m.width).toBeUndefined();
  });
});
```

- [ ] **Step 3: Run — expect FAIL.** Run: `npx vitest run lib/media/introspect.test.ts`

- [ ] **Step 4: Implement `lib/media/introspect.ts`**

```ts
import { imageSize } from "image-size";
import type { MediaIntrospection } from "@/types/rcs";

export function introspectMedia(
  bytes: Uint8Array,
  headers: { contentType: string; fileSizeBytes: number; thumbnailSizeBytes?: number },
): MediaIntrospection {
  const mimeType = headers.contentType.split(";")[0].trim().toLowerCase();
  const base = { mimeType, fileSizeBytes: headers.fileSizeBytes, thumbnailSizeBytes: headers.thumbnailSizeBytes };
  if (mimeType.startsWith("video/")) return { mediaType: "video", ...base };
  const { width, height } = imageSize(bytes);
  return {
    mediaType: "image", ...base, width, height,
    aspectRatio: width && height ? width / height : undefined,
  };
}
```

- [ ] **Step 5: Run — expect PASS.** Run: `npx vitest run lib/media/introspect.test.ts`

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json lib/media/introspect.ts lib/media/introspect.test.ts
git commit -m "feat(media): pure introspectMedia (image-size for images, header-only for video)"
```

---

### Task 6: SSRF guard (pure)

**Files:**
- Create: `lib/media/ssrfGuard.ts`, `lib/media/ssrfGuard.test.ts`

**Interfaces:**
- Produces: `requireHttps(raw: string): URL` (throws `SsrfError`), `isBlockedIpv4(ip: string): boolean`, `isBlockedIpv6(ip: string): boolean`, `class SsrfError extends Error`.

- [ ] **Step 1: Write the failing tests** `lib/media/ssrfGuard.test.ts`

```ts
import { describe, it, expect } from "vitest";
import { requireHttps, isBlockedIpv4, isBlockedIpv6, SsrfError } from "@/lib/media/ssrfGuard";

describe("ssrfGuard", () => {
  it("allows https, rejects others", () => {
    expect(requireHttps("https://ex.com/a.png").hostname).toBe("ex.com");
    expect(() => requireHttps("http://ex.com")).toThrow(SsrfError);
    expect(() => requireHttps("file:///etc/passwd")).toThrow(SsrfError);
  });
  it("blocks private / loopback / link-local / metadata IPv4", () => {
    for (const ip of ["127.0.0.1", "10.0.0.5", "192.168.1.1", "169.254.169.254", "172.16.0.1", "0.0.0.0"])
      expect(isBlockedIpv4(ip)).toBe(true);
    expect(isBlockedIpv4("93.184.216.34")).toBe(false);
  });
  it("blocks loopback / ULA / link-local IPv6", () => {
    for (const ip of ["::1", "fc00::1", "fe80::1"]) expect(isBlockedIpv6(ip)).toBe(true);
    expect(isBlockedIpv6("2606:2800:220:1:248:1893:25c8:1946")).toBe(false);
  });
});
```

- [ ] **Step 2: Run — expect FAIL.** Run: `npx vitest run lib/media/ssrfGuard.test.ts`

- [ ] **Step 3: Implement `lib/media/ssrfGuard.ts`**

```ts
export class SsrfError extends Error { constructor(m: string) { super(m); this.name = "SsrfError"; } }

export function requireHttps(raw: string): URL {
  let u: URL;
  try { u = new URL(raw); } catch { throw new SsrfError("Invalid URL."); }
  if (u.protocol !== "https:") throw new SsrfError("Only https URLs are allowed.");
  return u;
}

const BLOCKED_V4 = [
  /^127\./, /^10\./, /^192\.168\./, /^169\.254\./, /^0\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
];
export function isBlockedIpv4(ip: string): boolean { return BLOCKED_V4.some((r) => r.test(ip)); }

export function isBlockedIpv6(ip: string): boolean {
  const x = ip.toLowerCase();
  return x === "::1" || x.startsWith("fc") || x.startsWith("fd") || x.startsWith("fe80") || x.startsWith("::ffff:");
}
```

- [ ] **Step 4: Run — expect PASS.** Run: `npx vitest run lib/media/ssrfGuard.test.ts`

- [ ] **Step 5: Commit**

```bash
git add lib/media/ssrfGuard.ts lib/media/ssrfGuard.test.ts
git commit -m "feat(media): pure SSRF URL/IP guard"
```

---

### Task 7: `POST /api/media-info` route (ranged fetch + DNS-validated SSRF)

**Files:**
- Create: `app/api/media-info/route.ts`

**Interfaces:**
- Consumes: `introspectMedia`, `requireHttps`, `isBlockedIpv4`, `isBlockedIpv6`.
- HTTP: `POST { url: string, thumbnailUrl?: string }` → `200 MediaIntrospection` | `422 { error, message }`.

- [ ] **Step 1: Confirm the Next 16 route API** — Run: `ls node_modules/next/dist/docs` and read the route-handler guide; confirm `export async function POST(request: NextRequest)` + `await request.json()` + `runtime`/`maxDuration` exports.

- [ ] **Step 2: Implement `app/api/media-info/route.ts`**

```ts
import { NextResponse, type NextRequest } from "next/server";
import { lookup } from "node:dns/promises";
import { introspectMedia } from "@/lib/media/introspect";
import { requireHttps, isBlockedIpv4, isBlockedIpv6, SsrfError } from "@/lib/media/ssrfGuard";

export const runtime = "nodejs";
export const maxDuration = 10;

const HEADER_BYTES = 65_535;
const TIMEOUT_MS = 5_000;

async function assertReachableHost(u: URL): Promise<void> {
  const { address, family } = await lookup(u.hostname);
  const blocked = family === 4 ? isBlockedIpv4(address) : isBlockedIpv6(address);
  if (blocked) throw new SsrfError("URL resolves to a non-public address.");
}

async function rangedRead(u: URL): Promise<{ bytes: Uint8Array; contentType: string; fileSizeBytes: number }> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(u, { redirect: "manual", signal: ctrl.signal, headers: { Range: `bytes=0-${HEADER_BYTES}` } });
    if (res.status >= 300 && res.status < 400) throw new SsrfError("Redirects are not followed.");
    if (!res.ok && res.status !== 206) throw new SsrfError(`Upstream returned ${res.status}.`);
    const contentType = res.headers.get("content-type") ?? "application/octet-stream";
    const range = res.headers.get("content-range");
    const fileSizeBytes = range?.includes("/")
      ? Number(range.split("/")[1])
      : Number(res.headers.get("content-length") ?? 0);
    // Read at most HEADER_BYTES, then stop — never buffer a whole file.
    const reader = res.body!.getReader();
    const chunks: Uint8Array[] = []; let total = 0;
    while (total <= HEADER_BYTES) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value); total += value.length;
    }
    await reader.cancel().catch(() => {});
    const bytes = new Uint8Array(total); let o = 0;
    for (const c of chunks) { bytes.set(c, o); o += c.length; }
    return { bytes, contentType, fileSizeBytes: fileSizeBytes || total };
  } finally { clearTimeout(timer); }
}

async function headSize(raw: string): Promise<number | undefined> {
  const u = requireHttps(raw); await assertReachableHost(u);
  const res = await fetch(u, { method: "HEAD", redirect: "manual" });
  const len = res.headers.get("content-length");
  return len ? Number(len) : undefined;
}

export async function POST(request: NextRequest) {
  try {
    const { url, thumbnailUrl } = (await request.json()) as { url: string; thumbnailUrl?: string };
    const u = requireHttps(url);
    await assertReachableHost(u);
    const { bytes, contentType, fileSizeBytes } = await rangedRead(u);
    const thumbnailSizeBytes = thumbnailUrl ? await headSize(thumbnailUrl) : undefined;
    const meta = introspectMedia(bytes, { contentType, fileSizeBytes, thumbnailSizeBytes });
    return NextResponse.json(meta);
  } catch (e) {
    const err = e as Error;
    return NextResponse.json({ error: err.name, message: err.message }, { status: 422 });
  }
}
```

- [ ] **Step 3: Smoke-test the happy + blocked paths**

Run: `npm run dev`, then in another shell:
```bash
curl -s localhost:3000/api/media-info -XPOST -H 'content-type: application/json' \
  -d '{"url":"https://upload.wikimedia.org/wikipedia/commons/3/3a/Cat03.jpg"}'   # → {mediaType:"image",...}
curl -s localhost:3000/api/media-info -XPOST -H 'content-type: application/json' \
  -d '{"url":"http://169.254.169.254/"}'                                          # → 422 SsrfError
```

- [ ] **Step 4: Commit**

```bash
git add app/api/media-info/route.ts
git commit -m "feat(api): /api/media-info ranged fetch with DNS-validated SSRF guard"
```

---

### Task 8: UI — URL input + functional-compliance banner

**Files:**
- Create: `components/FunctionalBanner.tsx`
- Modify: `components/RcsInputPanel.tsx`, `app/page.tsx`, `app/improve/page.tsx`

**Interfaces:**
- Consumes: `validateFunctional`, the `/api/media-info` endpoint, `MediaIntrospection`.

- [ ] **Step 1: Create `components/FunctionalBanner.tsx`** — renders nothing when `result.passes`, else a red "This won't send" list of `violations` (message + `actual`/`max`).

```tsx
import type { FunctionalResult } from "@/types/rcs";
export default function FunctionalBanner({ result }: { result: FunctionalResult }) {
  if (result.passes) return null;
  return (
    <div className="rounded-lg border border-[var(--color-destructive)] bg-[color-mix(in_srgb,var(--color-destructive)_8%,transparent)] p-3">
      <p className="font-semibold text-[var(--color-destructive)]">This card won’t send</p>
      <ul className="mt-1 list-disc pl-5 text-sm text-body">
        {result.violations.map((v, i) => (
          <li key={i}>{v.message}{v.max != null ? ` (${v.actual}/${v.max})` : ""}</li>
        ))}
      </ul>
    </div>
  );
}
```

- [ ] **Step 2: In `RcsInputPanel.tsx`** add a "Media URL" text field; on blur/submit `POST /api/media-info` with `{ url, thumbnailUrl }`, set the returned `MediaIntrospection` into provider state, and surface a "couldn’t read this media" inline error on a 422.

- [ ] **Step 3: In `app/page.tsx` and `app/improve/page.tsx`** compute `const functional = useMemo(() => validateFunctional(card, media), [card, media])` and render `<FunctionalBanner result={functional} />` above `ScorePanel`.

- [ ] **Step 4: Manually verify** — paste an image URL → dimensions populate and the visual score updates; paste a `.bmp` URL → "won’t send: unsupported media type"; a 201-char title → banner shows.

- [ ] **Step 5: Run suite + commit**

```bash
npx vitest run
git add components/FunctionalBanner.tsx components/RcsInputPanel.tsx app/page.tsx app/improve/page.tsx
git commit -m "feat(ui): media URL introspection + functional-compliance banner"
```

---

### Task 9: Citations — add the OpenAPI + guide sources

**Files:**
- Modify: `lib/recommendationCitations.ts`, `lib/recommendationCitations.test.ts`

- [ ] **Step 1: Write the failing test** — every label emitted by `validateFunctional`/scorer (`"Naxai sendRCS"`, `"RBM rich-cards"`) resolves to a citation:

```ts
import { citationsFromLabels } from "@/lib/recommendationCitations";
it("resolves the new sources", () => {
  const got = citationsFromLabels(["Naxai sendRCS", "RBM rich-cards"]);
  expect(got.map(c => c.label).sort()).toEqual(["Naxai sendRCS", "RBM rich-cards"]);
  expect(got.every(c => c.url.startsWith("https://"))).toBe(true);
});
```

- [ ] **Step 2: Run — expect FAIL.** Run: `npx vitest run lib/recommendationCitations.test.ts`

- [ ] **Step 3: Add the two sources** to `SOURCE_DOCS` + `SECTION_BLURBS` and teach the parser the `Naxai sendRCS` / `RBM rich-cards` labels (URLs: the docs.naxai.com reference and the developer guide). Keep the existing playbook handling.

- [ ] **Step 4: Run the full citation-coverage suite — expect PASS.** Run: `npx vitest run lib/recommendationCitations.test.ts`

- [ ] **Step 5: Commit**

```bash
git add lib/recommendationCitations.ts lib/recommendationCitations.test.ts
git commit -m "feat(citations): add Naxai OpenAPI + RBM guide sources"
```

---

### Task 10: Golden vectors — the porters' parity contract

**Files:**
- Create: `lib/__vectors__/cases.json`, `lib/__vectors__/vectors.test.ts`

- [ ] **Step 1: Author 6–8 representative input cards** in `lib/__vectors__/cases.json` (clean vertical card; horizontal; over-long title; 5 suggestions; unsupported media; oversized thumbnail; portrait image; no media). Each entry: `{ name, card, media? }`.

- [ ] **Step 2: Write `vectors.test.ts`** that runs each case through `validateFunctional` + `scoreQuality` and snapshots the pair:

```ts
import { describe, it, expect } from "vitest";
import cases from "./cases.json";
import { validateFunctional } from "@/lib/validateFunctional";
import { scoreQuality } from "@/lib/scoreRcsContent";

describe("golden vectors (parity contract)", () => {
  for (const c of cases as any[]) {
    it(c.name, () => {
      expect({
        functional: validateFunctional(c.card, c.media),
        quality: scoreQuality(c.card, c.media),
      }).toMatchSnapshot();
    });
  }
});
```

- [ ] **Step 3: Generate + verify stable**

Run: `npx vitest run lib/__vectors__` (writes snapshots), then again (matches).

- [ ] **Step 4: Commit**

```bash
git add lib/__vectors__/
git commit -m "test(vectors): golden parity contract for the Naxai port"
```

---

### Task 11: `docs/PORTING.md`

**Files:**
- Create: `docs/PORTING.md`

- [ ] **Step 1: Write `docs/PORTING.md`** with: (a) the kernel boundary ("port everything in `lib/`; ignore `app/` + `components/`"); (b) the model↔OpenAPI mapping table (from spec §5); (c) the introspection algorithm (image: `image-size` on a 64 KB ranged read, widen to 256 KB on truncated JPEG; video: header-only; SSRF checklist; the route is a thin shell); (d) the source-precedence rule; (e) how to run the golden vectors as the parity contract.

- [ ] **Step 2: Commit**

```bash
git add docs/PORTING.md
git commit -m "docs: porting guide (kernel boundary, model map, vectors)"
```

---

## Self-Review

- **Spec coverage:** §6 functional layer → Tasks 1–2; §7 quality enrichment → Tasks 3–4; §8 introspection → Tasks 5–7; §9 citations → Task 9; §4.3 declarative rules → Tasks 1, 3; §4.4 golden vectors → Task 10; §4.5/§13 PORTING.md → Task 11; §10 UI/banner → Task 8. The `openUrlLength` and `emptyCard` checks (spec §6 table) are in Task 2.
- **Placeholder scan:** every code step shows real code; no "add validation"/"handle edge cases" stand-ins; the route handler is complete including the SSRF + ranged-read body.
- **Type consistency:** `introspectMedia(bytes, headers)`, `validateFunctional(card, media)`, `scoreQuality(card, media, focal)`, `nearestGuideAspect(aspect)`, `requireHttps`/`isBlockedIpv4`/`isBlockedIpv6` are named identically wherever referenced across tasks. Citation labels `"Naxai sendRCS"` / `"RBM rich-cards"` emitted in Task 2/4 are exactly the labels resolved in Task 9.
- **Behavior change is intentional and contained:** only Task 4 moves scores (canonical heights + aspect), re-baselined against the Plan 1 goldens with an inspection step.
- **Depends on Plan 1:** the native `scoreQuality(card, media, focal)` signature and the `MediaIntrospection`/`StandaloneRichCard` types must exist first.
