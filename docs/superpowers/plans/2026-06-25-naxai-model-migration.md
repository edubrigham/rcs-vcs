# Naxai-Aligned Model Migration — Implementation Plan (Plan 1 of 2)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restructure the kernel's data model to mirror the Naxai `sendRCS` OpenAPI (`standaloneRichCard` / `cardContent` / `media` / `contentInfo` / `suggestions`), with **zero behavior change** — all existing tests stay green.

**Architecture:** Strangler migration. Introduce the new Naxai-shaped types + a bidirectional adapter (`legacy ↔ card`), lock current behavior with golden characterization tests, migrate the pure kernel (`rcsRules` → scorers → improver) to the new model behind the adapter, then migrate the UI/state, then delete the legacy `RcsContent` and the adapter. The crop **geometry** (`cropMath.ts`) is untouched.

**Tech Stack:** TypeScript 5, React 19, Next.js 16.2.9, Vitest 4. No new dependencies in this plan.

## Global Constraints

- `lib/` must import nothing from `react`/`next` — it is the port-ready kernel. (Verify after each kernel task.)
- The model mirrors the Naxai OpenAPI **exactly** in names/shape: `cardOrientation` (`HORIZONTAL`|`VERTICAL`), `media.height` (`SHORT`|`MEDIUM`|`TALL`), `contentInfo.fileUrl`/`thumbnailUrl`, suggestions as a `reply`|`action` union with `text` (≤25) and a typed `action`.
- `focalPoint` is a **simulator-only** annotation — NOT part of the payload model.
- `primary` is **dropped**; "the primary CTA" is derived as the first `action`-type suggestion.
- The legacy `cardFormat` maps: `compact→HORIZONTAL`, `medium→VERTICAL+MEDIUM`, `tall→VERTICAL+TALL`.
- **Behavior invariant:** for every existing fixture, `scoreRcsContent` and `improveRcsContent` outputs must be byte-identical before and after each task (golden tests enforce this).
- All 87 existing tests stay green throughout; `npx vitest run` is the gate at every "run tests" step.
- `MediaIntrospection` is introduced as a type here and populated by the **existing** browser image measurement; the URL-fetch source is Plan 2.

## File Structure

- **Create** `lib/model/cardModel.ts` — the new Naxai-aligned types + the `legacyToCard` / `cardToLegacy` adapter + `cardFormatToOrientationHeight`.
- **Create** `lib/model/cardModel.test.ts` — adapter + mapping tests.
- **Create** `lib/__golden__/behavior.golden.test.ts` — characterization tests locking current score/improve output.
- **Modify** `types/rcs.ts` — add new types; mark legacy fields deprecated; remove them in the final task.
- **Modify** `lib/rcsRules.ts` — `getPlatformRules` keyed on `(platform, orientation, mediaHeight, lines)`.
- **Modify** `lib/scoreRcsContent.ts`, `lib/improveRcsContent.ts` — consume the new model.
- **Modify** `components/RcsCardPreview.tsx`, `RcsInputPanel.tsx`, `PreviewToolbar.tsx`, `SimulatorProvider.tsx` — new model + 2-axis format control.
- **Modify** `lib/sampleContent.ts`, `app/page.tsx`, `app/improve/page.tsx` — plumbing.
- **Modify** the four `lib/*.test.ts` fixtures.

---

### Task 1: New model types + format mapping helper

**Files:**
- Modify: `types/rcs.ts`
- Create: `lib/model/cardModel.ts`
- Test: `lib/model/cardModel.test.ts`

**Interfaces:**
- Produces: the types below, and `cardFormatToOrientationHeight(cf: CardFormat): { orientation: CardOrientation; mediaHeight: MediaHeight | null }` (null for HORIZONTAL — compact has no height).

- [ ] **Step 1: Add the new types to `types/rcs.ts`** (alongside the existing ones; do not delete anything yet)

```ts
export type CardOrientation = "HORIZONTAL" | "VERTICAL";
export type MediaHeight = "SHORT" | "MEDIUM" | "TALL";
export type MediaType = "image" | "video";

export interface ContentInfo { fileUrl: string; thumbnailUrl?: string; forceRefresh?: boolean }
export interface Media { height: MediaHeight; contentInfo: ContentInfo }

export type Action =
  | { type: "openUrlAction"; url: string }
  | { type: "dialAction"; phoneNumber: string }
  | { type: "viewLocationAction"; latitude: number; longitude: number; label?: string }
  | { type: "createCalendarEventAction"; startTime: string; endTime: string; title: string; description: string }
  | { type: "shareLocationAction" };
export interface SuggestedReply  { type: "reply";  text: string; postbackData?: string }
export interface SuggestedAction { type: "action"; text: string; postbackData?: string; action: Action }
export type Suggestion = SuggestedReply | SuggestedAction;

export interface CardContent {
  title?: string;
  description?: string;
  media?: Media;
  suggestions?: Suggestion[];
}
export interface StandaloneRichCard {
  type: "standaloneRichCard";
  cardOrientation: CardOrientation;
  thumbnailImageAlignment?: "LEFT" | "RIGHT";
  cardContent: CardContent;
}

export interface MediaIntrospection {
  mediaType: MediaType;
  mimeType: string;
  fileSizeBytes: number;
  thumbnailSizeBytes?: number;
  width?: number;       // image only
  height?: number;      // image only
  aspectRatio?: number; // image only
}
```

- [ ] **Step 2: Write the failing test** `lib/model/cardModel.test.ts`

```ts
import { describe, it, expect } from "vitest";
import { cardFormatToOrientationHeight } from "@/lib/model/cardModel";

describe("cardFormatToOrientationHeight", () => {
  it("maps compact to HORIZONTAL with no height", () => {
    expect(cardFormatToOrientationHeight("compact")).toEqual({ orientation: "HORIZONTAL", mediaHeight: null });
  });
  it("maps medium to VERTICAL+MEDIUM", () => {
    expect(cardFormatToOrientationHeight("medium")).toEqual({ orientation: "VERTICAL", mediaHeight: "MEDIUM" });
  });
  it("maps tall to VERTICAL+TALL", () => {
    expect(cardFormatToOrientationHeight("tall")).toEqual({ orientation: "VERTICAL", mediaHeight: "TALL" });
  });
});
```

- [ ] **Step 3: Run it — expect FAIL** (`cardFormatToOrientationHeight` not defined)

Run: `npx vitest run lib/model/cardModel.test.ts`
Expected: FAIL — "Failed to resolve import" / not a function.

- [ ] **Step 4: Create `lib/model/cardModel.ts` with the helper**

```ts
import type { CardFormat, CardOrientation, MediaHeight } from "@/types/rcs";

export function cardFormatToOrientationHeight(cf: CardFormat): {
  orientation: CardOrientation;
  mediaHeight: MediaHeight | null;
} {
  switch (cf) {
    case "compact": return { orientation: "HORIZONTAL", mediaHeight: null };
    case "medium":  return { orientation: "VERTICAL", mediaHeight: "MEDIUM" };
    case "tall":    return { orientation: "VERTICAL", mediaHeight: "TALL" };
  }
}
```

- [ ] **Step 5: Run it — expect PASS**

Run: `npx vitest run lib/model/cardModel.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 6: Commit**

```bash
git add types/rcs.ts lib/model/cardModel.ts lib/model/cardModel.test.ts
git commit -m "feat(model): add Naxai-aligned card types + format mapping helper"
```

---

### Task 2: Bidirectional adapter (legacy ↔ card)

**Files:**
- Modify: `lib/model/cardModel.ts`
- Test: `lib/model/cardModel.test.ts`

**Interfaces:**
- Consumes: `RcsContent`, `RcsAction` (legacy), and the Task 1 types.
- Produces:
  - `legacyToCard(c: RcsContent): { card: StandaloneRichCard; media: MediaIntrospection | undefined; focal: FocalPoint }`
  - `cardToLegacy(card: StandaloneRichCard, media: MediaIntrospection | undefined, focal: FocalPoint): RcsContent`
  - `legacyActionToSuggestion(a: RcsAction): Suggestion` and `suggestionToLegacyAction(s: Suggestion, primary: boolean): RcsAction`

- [ ] **Step 1: Write the failing round-trip test** (append to `cardModel.test.ts`)

```ts
import { legacyToCard, cardToLegacy } from "@/lib/model/cardModel";
import type { RcsContent } from "@/types/rcs";

const legacy: RcsContent = {
  title: "Hi", description: "There",
  imageUrl: "https://x/y.png",
  imageMetadata: { width: 1080, height: 720, aspectRatio: 1.5 },
  actions: [
    { id: "a", type: "openUrl", label: "Shop", value: "https://shop", primary: true },
    { id: "b", type: "reply", label: "Maybe", value: "maybe" },
  ],
  focalPoint: { x: 0.5, y: 0.5 },
  cardFormat: "tall",
};

it("round-trips legacy → card → legacy", () => {
  const { card, media, focal } = legacyToCard(legacy);
  expect(card.cardOrientation).toBe("VERTICAL");
  expect(card.cardContent.media?.height).toBe("TALL");
  expect(card.cardContent.media?.contentInfo.fileUrl).toBe("https://x/y.png");
  expect(card.cardContent.suggestions?.[0]).toEqual({ type: "action", text: "Shop", action: { type: "openUrlAction", url: "https://shop" } });
  expect(card.cardContent.suggestions?.[1]).toEqual({ type: "reply", text: "Maybe", postbackData: "maybe" });
  const back = cardToLegacy(card, media, focal);
  expect(back.cardFormat).toBe("tall");
  expect(back.actions[0].type).toBe("openUrl");
  expect(back.actions[0].primary).toBe(true);     // first action-type → primary
});
```

- [ ] **Step 2: Run it — expect FAIL** (`legacyToCard` not defined)

Run: `npx vitest run lib/model/cardModel.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement the adapter** in `lib/model/cardModel.ts`

```ts
import type {
  Action, CardContent, FocalPoint, MediaIntrospection, RcsAction, RcsContent,
  StandaloneRichCard, Suggestion,
} from "@/types/rcs";

const HEIGHT_TO_FORMAT = { MEDIUM: "medium", TALL: "tall" } as const;

export function legacyActionToSuggestion(a: RcsAction): Suggestion {
  if (a.type === "reply") return { type: "reply", text: a.label, postbackData: a.value };
  const action: Action = a.type === "dial"
    ? { type: "dialAction", phoneNumber: a.value }
    : { type: "openUrlAction", url: a.value };
  return { type: "action", text: a.label, action };
}

export function suggestionToLegacyAction(s: Suggestion, primary: boolean): RcsAction {
  if (s.type === "reply") return { id: crypto.randomUUID(), type: "reply", label: s.text, value: s.postbackData ?? "" };
  const url = s.action.type === "openUrlAction" ? s.action.url
    : s.action.type === "dialAction" ? s.action.phoneNumber : "";
  const legacyType = s.action.type === "dialAction" ? "dial" : "openUrl";
  return { id: crypto.randomUUID(), type: legacyType, label: s.text, value: url, primary };
}

export function legacyToCard(c: RcsContent): {
  card: StandaloneRichCard; media: MediaIntrospection | undefined; focal: FocalPoint;
} {
  const { orientation, mediaHeight } = cardFormatToOrientationHeight(c.cardFormat);
  const cardContent: CardContent = {
    title: c.title || undefined,
    description: c.description || undefined,
    media: c.imageUrl
      ? { height: mediaHeight ?? "TALL", contentInfo: { fileUrl: c.imageUrl } }
      : undefined,
    suggestions: c.actions.length ? c.actions.map(legacyActionToSuggestion) : undefined,
  };
  const media: MediaIntrospection | undefined = c.imageMetadata
    ? { mediaType: "image", mimeType: "image/*",
        fileSizeBytes: 0, width: c.imageMetadata.width, height: c.imageMetadata.height,
        aspectRatio: c.imageMetadata.aspectRatio }
    : undefined;
  return {
    card: { type: "standaloneRichCard", cardOrientation: orientation, cardContent },
    media,
    focal: c.focalPoint,
  };
}

export function cardToLegacy(
  card: StandaloneRichCard, media: MediaIntrospection | undefined, focal: FocalPoint,
): RcsContent {
  const sugg = card.cardContent.suggestions ?? [];
  const firstActionIdx = sugg.findIndex((s) => s.type === "action");
  return {
    title: card.cardContent.title ?? "",
    description: card.cardContent.description ?? "",
    imageUrl: card.cardContent.media?.contentInfo.fileUrl ?? null,
    imageMetadata: media && media.width != null
      ? { width: media.width, height: media.height!, aspectRatio: media.aspectRatio! }
      : undefined,
    actions: sugg.map((s, i) => suggestionToLegacyAction(s, i === firstActionIdx)),
    focalPoint: focal,
    cardFormat: card.cardOrientation === "HORIZONTAL"
      ? "compact"
      : HEIGHT_TO_FORMAT[(card.cardContent.media?.height as "MEDIUM" | "TALL") ?? "TALL"],
  };
}
```

- [ ] **Step 4: Run it — expect PASS**

Run: `npx vitest run lib/model/cardModel.test.ts`
Expected: PASS.

- [ ] **Step 5: Verify kernel purity**

Run: `grep -rnE "from \"react\"|from \"next" lib/ | grep -v ".test.ts"`
Expected: no output.

- [ ] **Step 6: Commit**

```bash
git add lib/model/cardModel.ts lib/model/cardModel.test.ts
git commit -m "feat(model): bidirectional legacy<->Naxai-card adapter"
```

---

### Task 3: Lock current behavior with golden characterization tests

**Files:**
- Create: `lib/__golden__/behavior.golden.test.ts`

**Interfaces:**
- Consumes: `scoreRcsContent`, `improveRcsContent`, `DEFAULT_CONTENT`.

- [ ] **Step 1: Write a snapshot test capturing current output** (this is the behavior contract the refactor must preserve)

```ts
import { describe, it, expect } from "vitest";
import { scoreRcsContent } from "@/lib/scoreRcsContent";
import { improveRcsContent } from "@/lib/improveRcsContent";
import { DEFAULT_CONTENT } from "@/lib/sampleContent";
import type { RcsContent } from "@/types/rcs";

const cases: Record<string, RcsContent> = {
  default: DEFAULT_CONTENT,
  compactNoImage: { ...DEFAULT_CONTENT, cardFormat: "compact", imageUrl: null, imageMetadata: undefined },
  longText: { ...DEFAULT_CONTENT, title: "A very long title ".repeat(6), description: "Long ".repeat(80) },
};

describe("behavior golden", () => {
  for (const [name, content] of Object.entries(cases)) {
    it(`score:${name}`, () => {
      expect(scoreRcsContent(content)).toMatchSnapshot();
    });
    it(`improve:${name}`, () => {
      expect(improveRcsContent(content, scoreRcsContent(content))).toMatchSnapshot();
    });
  }
});
```

- [ ] **Step 2: Run to generate snapshots** (first run writes them)

Run: `npx vitest run lib/__golden__/behavior.golden.test.ts`
Expected: PASS — "6 snapshots written".

- [ ] **Step 3: Run again to confirm stability**

Run: `npx vitest run lib/__golden__/behavior.golden.test.ts`
Expected: PASS — snapshots matched, 0 written.

- [ ] **Step 4: Commit**

```bash
git add lib/__golden__/
git commit -m "test(model): golden characterization of score/improve before refactor"
```

---

### Task 4: Re-key `getPlatformRules` on orientation + mediaHeight

**Files:**
- Modify: `lib/rcsRules.ts`
- Test: `lib/rcsRules.test.ts`

**Interfaces:**
- Produces: `getPlatformRules(platform: Platform, orientation: CardOrientation, mediaHeight: MediaHeight | null, totalTextLines: number): PlatformRenderRules`. A legacy shim `getPlatformRulesByFormat(platform, cardFormat, lines)` delegates via `cardFormatToOrientationHeight` so callers migrate one at a time.
- Note: `androidCropWindow` and `recommendedAspectForFormat` gain orientation/height params in the same shape.

- [ ] **Step 1: Write failing tests for the 6 orientation×height rule cells** in `lib/rcsRules.test.ts`

```ts
import { getPlatformRules } from "@/lib/rcsRules";

it("HORIZONTAL iOS renders the 60x60 thumbnail", () => {
  const r = getPlatformRules("ios", "HORIZONTAL", null, 0);
  expect(r.mediaWidth).toBe(60);
  expect(r.mediaLayout).toBe("thumbnail");
});
it("VERTICAL+TALL iOS uses the tall media cap", () => {
  const r = getPlatformRules("ios", "VERTICAL", "TALL", 0);
  expect(r.mediaLayout).toBe("vertical");
});
it("legacy shim maps compact==HORIZONTAL", () => {
  const a = getPlatformRules("android", "HORIZONTAL", null, 0);
  expect(a.mediaWidth).toBe(128);
});
```

- [ ] **Step 2: Run — expect FAIL** (signature mismatch / TS error)

Run: `npx vitest run lib/rcsRules.test.ts`
Expected: FAIL.

- [ ] **Step 3: Refactor `getPlatformRules`** to take `(platform, orientation, mediaHeight, totalTextLines)`. Replace `cardFormat === "compact"` with `orientation === "HORIZONTAL"`, and the `medium`/`tall` branches with `mediaHeight === "MEDIUM"` / `"TALL"`. Add the legacy shim:

```ts
import { cardFormatToOrientationHeight } from "@/lib/model/cardModel";
export function getPlatformRulesByFormat(platform: Platform, cardFormat: CardFormat, lines: number) {
  const { orientation, mediaHeight } = cardFormatToOrientationHeight(cardFormat);
  return getPlatformRules(platform, orientation, mediaHeight, lines);
}
```

(Apply the same orientation/height parameterization to `androidCropWindow` and `recommendedAspectForFormat`; keep `*ByFormat` shims for both.)

- [ ] **Step 4: Update the existing `rcsRules.test.ts` callers** to the new signature (or the `*ByFormat` shim) so the suite compiles.

- [ ] **Step 5: Run — expect PASS**

Run: `npx vitest run lib/rcsRules.test.ts`
Expected: PASS.

- [ ] **Step 6: Run the golden suite — behavior unchanged**

Run: `npx vitest run lib/__golden__`
Expected: PASS (snapshots still match — the scorers still call via shims).

- [ ] **Step 7: Commit**

```bash
git add lib/rcsRules.ts lib/rcsRules.test.ts
git commit -m "refactor(rules): key getPlatformRules on orientation+mediaHeight (legacy shim kept)"
```

---

### Task 5: Migrate the scorers + improver to call the orientation/height rules

**Files:**
- Modify: `lib/scoreRcsContent.ts`, `lib/improveRcsContent.ts`

**Interfaces:**
- These still accept legacy `RcsContent` at their public signature in this task (UI not migrated yet); internally they convert `content.cardFormat` via `cardFormatToOrientationHeight` and call the new `getPlatformRules`, and replace `a.primary` with the position rule.

- [ ] **Step 1: In `scoreRcsContent.ts`, derive orientation/height once** at the top of each sub-scorer and replace every `getPlatformRules("ios", content.cardFormat, lines)` with `getPlatformRules("ios", orientation, mediaHeight, lines)`. Replace the `content.cardFormat === "compact"` branches with `orientation === "HORIZONTAL"`.

- [ ] **Step 2: Replace the `primary` read at `scoreActions`** — `!ctas.some((a) => a.primary)` becomes the position rule:

```ts
const firstAction = content.actions.find((a) => a.type !== "reply");
const primaryIsFirst = firstAction && content.actions[0]?.id === firstAction.id;
// ...used where the old code checked `.primary`:
if (ctas.length >= 2 && !primaryIsFirst) { /* recommend marking/placing the CTA first */ }
```

- [ ] **Step 3: In `improveRcsContent.ts`, replace the primary lookup** (lines ~153):

```ts
// OLD: const primaryCta = ctas.find((a) => a.primary) ?? ctas[0] ?? null;
const primaryCta = (input.actions[0] && input.actions[0].type !== "reply" ? input.actions[0] : ctas[0]) ?? null;
```

and update its `getPlatformRules`/`androidCropWindow` calls to the orientation/height signature.

- [ ] **Step 4: Run the golden suite — behavior must be unchanged**

Run: `npx vitest run lib/__golden__`
Expected: PASS (no snapshot diffs). If any snapshot changed, the refactor altered behavior — fix until identical.

- [ ] **Step 5: Run the full suite**

Run: `npx vitest run`
Expected: PASS (all 87 + new).

- [ ] **Step 6: Commit**

```bash
git add lib/scoreRcsContent.ts lib/improveRcsContent.ts
git commit -m "refactor(score,improve): consume orientation+height rules; primary by position"
```

---

### Task 6: Migrate the preview + state to the new model natively

**Files:**
- Modify: `components/RcsCardPreview.tsx`, `components/SimulatorProvider.tsx`

- [ ] **Step 1: In `RcsCardPreview.tsx`** replace the `getPlatformRules(..., content.cardFormat, ...)` calls (lines ~77,79) with the orientation/height form (derive via `cardFormatToOrientationHeight(content.cardFormat)` for now — UI still holds `cardFormat`), and replace the two `action.primary` style checks (lines ~251,343) with the positional check:

```ts
const primaryCta = content.actions.find((a) => a.type !== "reply");
const isPrimary = (a: RcsAction) => primaryCta?.id === a.id && content.actions[0]?.id === a.id;
```

- [ ] **Step 2: In `SimulatorProvider.tsx`** keep `RcsContent` as the stored shape for now; no logic change beyond confirming the `imageUrl` blob-URL rejection still compiles. (Native new-model state is Task 7.)

- [ ] **Step 3: Manually verify the app renders** (dev server) — Draft + Playbook Pass look identical to before.

Run: `npm run dev` → open `/` and `/improve`; confirm previews and scores match pre-refactor.

- [ ] **Step 4: Run the full suite + commit**

```bash
npx vitest run
git add components/RcsCardPreview.tsx components/SimulatorProvider.tsx
git commit -m "refactor(preview): primary-by-position; rules via orientation+height"
```

---

### Task 7: 2-axis format control + input panel on the new fields

**Files:**
- Modify: `components/RcsInputPanel.tsx`, `components/PreviewToolbar.tsx`

- [ ] **Step 1: In `PreviewToolbar.tsx`** replace the single `compact|medium|tall` selector with an orientation toggle (`HORIZONTAL`/`VERTICAL`) plus, when `VERTICAL`, a height picker (`SHORT`/`MEDIUM`/`TALL`). Emit changes by mapping back to `cardFormat` for now via a local map (`HORIZONTAL→compact`, `VERTICAL+MEDIUM→medium`, `VERTICAL+TALL→tall`; `SHORT` shows but maps to `medium` until the model drops `cardFormat` in Task 9). Add a small badge showing the resolved render ("1:1 thumbnail" / "3:2 vertical").

- [ ] **Step 2: In `RcsInputPanel.tsx`** remove the primary checkbox (line ~277); add a "Make primary" button that moves the action to index 0 (`setActions([a, ...rest])`). Update the action mutation at line ~109 from `{ ...a, primary: a.id === id }` to a reorder.

- [ ] **Step 3: Manually verify** mark-primary and the 2-axis selector update state + preview correctly.

- [ ] **Step 4: Run suite + commit**

```bash
npx vitest run
git add components/RcsInputPanel.tsx components/PreviewToolbar.tsx
git commit -m "feat(ui): 2-axis orientation/height control; primary by reorder"
```

---

### Task 8: Migrate fixtures + sample to the new fields

**Files:**
- Modify: `lib/sampleContent.ts`, `lib/scoreRcsContent.test.ts`, `lib/improveRcsContent.test.ts`, `lib/playbook-faithfulness.test.ts`, `lib/rcsRules.test.ts`

- [ ] **Step 1: Update fixtures** to drop the `primary` flag (use array position) and keep `cardFormat` for now (removed in Task 9). Re-run each test file as you edit it.

Run: `npx vitest run lib/scoreRcsContent.test.ts lib/improveRcsContent.test.ts lib/playbook-faithfulness.test.ts`
Expected: PASS.

- [ ] **Step 2: Update `sampleContent.ts`** — same (position-based primary).

- [ ] **Step 3: Run full suite + commit**

```bash
npx vitest run
git add lib/sampleContent.ts lib/*.test.ts
git commit -m "test(model): fixtures use position-based primary"
```

---

### Task 9: Flip state to the native Naxai model; delete legacy + adapter

**Files:**
- Modify: `components/SimulatorProvider.tsx`, `RcsInputPanel.tsx`, `PreviewToolbar.tsx`, `RcsCardPreview.tsx`, `app/page.tsx`, `app/improve/page.tsx`, `lib/scoreRcsContent.ts`, `lib/improveRcsContent.ts`, `lib/sampleContent.ts`, `types/rcs.ts`, `lib/model/cardModel.ts`

**Interfaces:**
- After this task, `scoreQuality(card: StandaloneRichCard, media?: MediaIntrospection, focal?: FocalPoint)` and `improve...(card, ...)` are the public kernel signatures; `RcsContent`, `RcsAction`, `CardFormat`, `ImageMetadata`, the `*ByFormat` shims, and `legacyToCard`/`cardToLegacy` are deleted.

- [ ] **Step 1: Rename the public scorer entry points** to take `(card, media, focal)` and update `scoreText/Image/Actions/Layout` to read `card.cardContent.*`, `card.cardOrientation`, `card.cardContent.media?.height`, `media?.aspectRatio`, and the suggestion union. Keep all internal math identical.

- [ ] **Step 2: Convert `SimulatorProvider` state** to hold `{ card: StandaloneRichCard; media?: MediaIntrospection; focal: FocalPoint }`; update `sessionStorage` (re)hydration to the new shape (bump a `version` key; on mismatch, reset to `DEFAULT_CARD`).

- [ ] **Step 3: Update `sampleContent.ts`** to export `DEFAULT_CARD: StandaloneRichCard` + `DEFAULT_MEDIA` + `DEFAULT_FOCAL`; update the pages and components to the new props.

- [ ] **Step 4: Delete** the `*ByFormat` shims, `legacyToCard`/`cardToLegacy`, and the legacy `RcsContent`/`RcsAction`/`CardFormat`/`ImageMetadata` types.

- [ ] **Step 5: Regenerate goldens against the new API** (the inputs change shape, behavior shouldn't):

```bash
npx vitest run lib/__golden__ -u   # update snapshots once
git diff -- lib/__golden__         # eyeball: numbers identical to Task 3 goldens
```

Inspect the diff: the `ScoreResult`/`ImprovedRcsContent` *values* must match Task 3's recorded numbers; only the input fixtures' shape changed. If a score moved, a refactor step introduced a bug — bisect and fix.

- [ ] **Step 6: Run full suite + purity check + commit**

Run: `npx vitest run` (expect all green) and `grep -rnE "from \"react\"|from \"next" lib/ | grep -v ".test.ts"` (expect empty).

```bash
git add -A
git commit -m "refactor(model): native Naxai card model; remove legacy types + adapter"
```

---

## Self-Review

- **Spec coverage:** This plan covers spec §5 (Naxai-aligned core model) and the model parts of §3 decision 6, §4.1. It deliberately does **not** cover introspection (§8), the functional layer (§6), quality enrichment (§7), citations (§9), or portability artifacts (§4.3–4.5, §13) — those are **Plan 2**. `MediaIntrospection` is introduced as a type here, populated by existing browser measurement; the URL fetch source is Plan 2.
- **Behavior preservation:** Tasks 3/5/9 use golden snapshots to guarantee the refactor changes no scores.
- **Type consistency:** the new entry points `scoreQuality(card, media, focal)` / `getPlatformRules(platform, orientation, mediaHeight, lines)` are named identically wherever referenced; the `*ByFormat` shims exist only Tasks 4–8 and are deleted in Task 9.
- **Known follow-up for Plan 2:** the `SHORT` height has no legacy `cardFormat` equivalent (it maps to `medium` transitionally in Task 7); once `cardFormat` is gone (Task 9) the toolbar exposes real `SHORT`.
