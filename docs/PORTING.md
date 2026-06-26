# Porting Guide — RCS Compatibility Scoring → Naxai private API

This PoC is a **port-ready reference**, not the production service. The Naxai
Core team ports the **logic kernel** (`lib/`) into the private API; the Vercel
SPA (`app/`, `components/`) is a disposable demo shell you can ignore.

## 1. What to port (and what to ignore)

| Port this | Ignore this |
|---|---|
| Everything in **`lib/`** — pure, framework-free TypeScript (imports nothing from `react`/`next`). | `app/` (Next.js pages + the `/api/media-info` route), `components/` (React UI, incl. `components/cardView.ts` — a UI-only presentation model). |

The kernel is deterministic: same input → same output, no network, no clock, no
randomness. It translates directly to any language.

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
- The production API fetches via **HTTP Range** (never download whole files) with
  the SSRF guard in `lib/media/ssrfGuard.ts`: https-only; resolve DNS and
  validate **every** address (ipaddr.js CIDR classification); **pin the
  connection to a validated IP** (defeats DNS rebinding/TOCTOU) while keeping the
  hostname for TLS SNI; cap bytes + hard timeout. `app/api/media-info/route.ts`
  is a working reference of the fetch+guard wiring.

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
