# Porting Contract — RCS Scoring Kernel → Naxai Private API

Implementation brief for porting the deterministic RCS scoring kernel into a
private Naxai API. Client/stakeholder traceability is in
[`docs/MANDATE.md`](MANDATE.md); rationale/background is in
`docs/SCORING-AND-ARCHITECTURE.md`. Neither is required to do the port.

## 1. Scope

- **Port:** everything in **`lib/`** — pure, framework-free TypeScript (no
  React/Next, no network, no clock, no randomness; same input → same output, so it
  translates to any language).
- **Do not port:** `app/` and `components/` (the Vercel UI and demo endpoints).
  Use `app/api/*` only as reference wrappers (§4).
- **Reference inputs:**
  - `docs/scoring-api.openapi.json` — the API I/O contract.
  - `docs/rcs-broadcasts.yaml` — the Naxai `rcsContentBody` definition.
  - `lib/__vectors__/` — golden parity vectors (§7).

## 2. Required API contract

- The request body **must be exactly the `rcsContentBody`** — the
  `standaloneRichCard` arm (§3). No wrapper object, no `media` field, no focal point.
- The API **must fetch `cardContent.media.contentInfo.fileUrl` internally** to
  derive media metadata before scoring (§5). Media is never a caller input.
- There is no focal point in the input; the scorer centers the image subject.
- Responses are the functional result and/or the quality score — schemas in
  `docs/scoring-api.openapi.json`.

## 3. Required kernel functions

Port these from `lib/`:

```ts
validateFunctional(card: StandaloneRichCard, media?: MediaIntrospection): FunctionalResult
scoreRcsContent(card: StandaloneRichCard, media?: MediaIntrospection, focal?: FocalPoint): ScoreResult
```

- **`validateFunctional`** — binary compliance. Hard limits (the values that make
  `sendRCS` return 422): title ≤ 200, description ≤ 2000, ≤ 4 suggestions, label
  ≤ 25, open-URL ≤ 2048, supported MIME, thumbnail ≤ 100 KB.
- **`scoreRcsContent`** — 0–100 quality (iOS vs Android rendering).

Optional:

```ts
improveRcsContent(card, media, focal, scoreResult): ImprovedRcsContent
```

- Port **only if** the production API exposes an `/improve` endpoint.

**Purity boundary:** these functions take **already-derived** `media`/`focal` and
perform no I/O. The API wrapper fetches media (§5), then calls them. `focal` is
optional — omit it and the scorer centers the subject.

### Model ↔ OpenAPI mapping

`types/rcs.ts` mirrors `docs/rcs-broadcasts.yaml`:

| Kernel type | OpenAPI schema |
|---|---|
| `StandaloneRichCard` | `messageStandaloneRichCard` (`cardOrientation`, `thumbnailImageAlignment`, `cardContent`) |
| `CardContent` | `cardContent` (`title`, `description`, `media`, `suggestions`) |
| `Media` / `ContentInfo` | `media` (`height` SHORT/MEDIUM/TALL) / `contentInfo` (`fileUrl`, `thumbnailUrl`) |
| `Suggestion` = `SuggestedReply \| SuggestedAction` | `suggestions[]` (`reply` / `action` + `Action` union) |
| `MediaIntrospection` | derived by the API — not in the input |

## 4. Reference wrapper

`app/api/{validate,score,improve,analyze}/route.ts` + `app/api/_lib/fetchMedia.ts`
demonstrate the production shape: parse `rcsContentBody` → fetch media (§5) → call
the kernel → return JSON. The kernel stays I/O-free; the wrapper owns the fetch.

## 5. Media metadata behavior

**Required behavior (must preserve):**

- Fetch only enough bytes to determine metadata; do not download whole media files.
- Images: derive MIME type, file size, width, height.
- Videos: derive MIME type and file size only (no dimensions).
- Apply an SSRF guard: https-only, validate the resolved IP, cap bytes, enforce a
  timeout.
- If the media URL is absent or unfetchable, score without media metadata.

**Reference implementation detail (PoC-specific, not binding):**

- The PoC fetches via an HTTP Range request and reads ~64 KB, retrying once for
  JPEGs with large headers. See `lib/media/introspect.ts` (byte parsing) and
  `app/api/_lib/fetchMedia.ts` (fetch + SSRF guard).

## 6. Rule precedence (conflicting specs)

When sources disagree, the winner is:

1. **Functional hard limits** → the Naxai `sendRCS` OpenAPI (it defines the 422).
2. **Canonical dimensions** (media heights 112/168/264, supported-MIME list,
   vertical aspect set) → the Google RBM rich-cards guide.
3. **Rendering/UX heuristics** (cropping, safe zones, iOS-vs-Android) → the UX
   playbooks (`skills/rcs-playbook-rules/`).

Do not create a height-to-aspect-ratio mapping. Score vertical media against the
**nearest** supported aspect ratio from `{2:1, 16:9, 7:3}`.

## 7. Parity tests (definition of done)

`lib/__vectors__/` holds representative `rcsContentBody` inputs and the snapshot of
their `{ functional, quality }` output. **Run the same inputs through the port and
assert identical output.** The full kernel suite (`npx vitest run`) is the
behavioral spec; keep it green.

```bash
npx vitest run lib/__vectors__   # verify the reference snapshots
```

## 8. Out of scope

- **Carousel** (`carouselRichCard` arm of `rcsContentBody`) — the kernel handles
  the `standaloneRichCard` arm; carousel scoring is a later spec.
- **Video dimensions** (width/height) — videos yield MIME type + file size only.
- **AI-assistant content creation** (Phase 2).
