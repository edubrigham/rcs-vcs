# Porting Guide — RCS Compatibility Scoring → Naxai private API

This PoC is a **port-ready reference**, not the production service. The Naxai
Core team ports the **logic kernel** (`lib/`) into the private API; the Vercel
SPA (`app/`, `components/`) is a disposable demo shell you can ignore.

## 1. What you need (read these; ignore the rest)

- **`lib/`** — the pure, framework-free kernel to re-implement. No React/Next, no
  network/clock/randomness: same input → same output, translates to any language.
  **Start here.**
- **`docs/scoring-api.openapi.json`** — your API's I/O contract (input =
  `rcsContentBody`; see §2).
- **`docs/rcs-broadcasts.yaml`** — the Naxai input definition (`rcsContentBody`).
- **`lib/__vectors__/`** — parity vectors: same input → identical output (§6).

**Ignore** (not ported, not required): `app/` + `components/` (the disposable
Vercel demo/SPA), `docs/superpowers/` (our process notes), and
`docs/SCORING-AND-ARCHITECTURE.md` (optional rationale/background).

## 2. The two entry points

```ts
// "Will the API accept this?" — binary, sourced from the sendRCS OpenAPI (a 422).
validateFunctional(card: StandaloneRichCard, media?: MediaIntrospection): FunctionalResult

// "Will it render well on iOS vs Android?" — gradual 0–100, sourced from the UX playbooks.
scoreRcsContent(card: StandaloneRichCard, media?: MediaIntrospection, focal?: FocalPoint): ScoreResult
```

- `card` is the Naxai `rcsContentBody` **standaloneRichCard** arm (see §3).
- `media` is **derived** by fetching the media URL (§4) — NOT part of the payload.
- `focal` is a simulator stand-in for vision-based subject detection (Phase 2);
  omit it and the scorer centers the subject.
- The improver `improveRcsContent(card, media, focal, score)` returns a native
  improved card + the relocated focal.

### Production API contract (what you build)

**The request body is the `rcsContentBody` (the card) — nothing else.** That is
exactly the CIO's input ("the rcsContentBody is passed to the Simulator API in the
Input"). Your API:

1. accepts the `rcsContentBody`,
2. **fetches `cardContent.media.contentInfo.fileUrl` itself** to derive `media`
   (size/dimensions — the CIO's "fetch the URL" ask), then
3. calls the kernel. **`focal` is not an input** — the scorer centers the subject;
   vision-based subject detection is a future phase.

The kernel functions take pre-fetched `media`/`focal` only so the kernel stays
pure and I/O-free — your API wraps them. The reference endpoints
`app/api/{validate,score,improve,analyze}/route.ts` do exactly this, deriving
media via `app/api/_lib/fetchMedia.ts`; `docs/scoring-api.openapi.json` documents
the contract (input = `rcsContentBody`, media derived, no focal).

## 3. Model ↔ OpenAPI mapping

The kernel types in `types/rcs.ts` mirror `docs/rcs-broadcasts.yaml` 1:1:

| Kernel type | OpenAPI schema |
|---|---|
| `StandaloneRichCard` | `messageStandaloneRichCard` (`cardOrientation`, `thumbnailImageAlignment`, `cardContent`) |
| `CardContent` | `cardContent` (`title`, `description`, `media`, `suggestions`) |
| `Media` / `ContentInfo` | `media` (`height` SHORT/MEDIUM/TALL) / `contentInfo` (`fileUrl`, `thumbnailUrl`) |
| `Suggestion` = `SuggestedReply \| SuggestedAction` | `suggestions[]` (`reply` / `action` + `Action` union) |
| `MediaIntrospection` | *derived* — not in the payload |

`RcsContentBody = MessageText | StandaloneRichCard` (carousel arm → future work).

## 4. Media introspection algorithm

`lib/media/introspect.ts` is pure (`bytes + headers → MediaIntrospection`):

- **Images:** dimensions via `image-size` on the file's **header bytes**. JPEG
  dimensions can sit past the first KB (large EXIF) — read ~64 KB and widen once
  on a truncated-buffer throw.
- **Video:** **header-only** — type (from `content-type`) + size. No dimension
  parsing; no guide rule needs video dimensions.
- **Fetch safely:** use an HTTP Range request (never download whole files) behind
  an SSRF guard (https-only, validate the resolved IP, cap bytes + timeout).
  Working reference: `app/api/_lib/fetchMedia.ts` (+ `lib/media/ssrfGuard.ts`) —
  replicate the *intent* in your stack; you don't need our exact IP-pinning code.

## 5. Source precedence (when sources disagree)

- **Functional hard limits** → the Naxai **sendRCS OpenAPI** wins (it's what 422s).
- **Canonical dimensions** (heights 112/168/264, the supported-MIME list, the
  vertical aspect set) → the **Google RBM rich-cards guide** wins.
- **Rendering/UX heuristics** (cropping, safe zones, iOS-vs-Android) → the **UX
  playbooks** win (`skills/rcs-playbook-rules/`).
- The guide lists vertical aspects `{2:1, 16:9, 7:3}` for *any* vertical card and
  does **not** bind a ratio to a height — score against the **nearest** of the
  set; never invent a per-height map.

## 6. The parity contract: golden vectors

`lib/__vectors__/` holds representative `rcsContentBody` inputs and the snapshot
of their `{ functional, quality }` output. **Run the same inputs through your
port and assert identical output** — that proves parity with this reference.

```bash
npx vitest run lib/__vectors__   # regenerate/verify the reference snapshots
```

The full kernel suite (`npx vitest run`) is the behavioral spec; keep it green.

## 7. Mandate coverage (what the CIO asked → where it lives)

| CIO ask | Delivered | Where |
|---|---|---|
| **Specs for API input + output**, based on the RCS Broadcast API (`rcsContentBody` is the input) | Input = `rcsContentBody` (mirrored 1:1, verified); output = the scoring I/O | `docs/rcs-broadcasts.yaml` (input source) · `docs/scoring-api.openapi.json` (I/O) · `types/rcs.ts` |
| **Fetch URL (images/videos) for size/dimensions** | `introspectMedia` (images: dims + size; video: type + size, header-only) + SSRF-guarded fetch, used internally by the scoring endpoints | `lib/media/introspect.ts` · `app/api/_lib/fetchMedia.ts` · `app/api/media-info/route.ts` |
| **Extra rules from the Google RBM rich-cards guide** | Canonical heights 112/168/264, vertical aspect set {2:1,16:9,7:3} nearest-of-set, supported-MIME list, file-size/animated-GIF checks (cited `RBM rich-cards`) | `lib/rcsRules.ts` · `lib/validateFunctional.ts` · `lib/scoreRcsContent.ts` |
| **Port-ready code for the transfer** | Pure kernel + golden vectors (parity) + this guide | `lib/` · `lib/__vectors__/` · `docs/PORTING.md` |

**Scoped deferrals (deliberate, agreed):** the `carouselRichCard` arm of
`rcsContentBody` is future work (Spec 2) — scoring covers `messageText` +
`standaloneRichCard`; video introspection is lightweight (type + size, no pixel
dimensions). **Phase 2** (AI-assistant content creation) is out of the current
mandate. The `app/` + `components/` SPA — including the `/api-playground` demo and
the `/api-docs` reference — is the disposable shell for CIO/stakeholder
confirmation; it is **not** ported.
