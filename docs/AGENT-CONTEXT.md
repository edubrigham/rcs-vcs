# Agent Context — Porting the RCS Scoring PoC to a Naxai Private API

*A self-contained brief for a coding agent tasked with (or assisting) the port.*

## What this project is
A deterministic **RCS rich-card scoring engine**, currently a PoC (Next.js on
Vercel). It scores a Naxai RCS card on two axes:
- **Functional compliance** — would the Naxai `sendRCS` (RCS Broadcasts) API accept
  it? (binary; the things that 422)
- **Quality** — how well does it render on iOS vs Android? (0–100, from Google's
  RBM UX playbooks)

The scoring logic lives in **`lib/`**: pure, framework-free TypeScript — no
network, no clock, no randomness. Same input → same output. It translates to any
language.

- Repo: `github.com/edubrigham/rcs-vcs` (branch `main`)
- Live demo: `https://rcs-vcs.vercel.app` (POC · API · API Reference tabs)

## The task
Re-implement the **`lib/` kernel** as a **private production API** at Naxai. The
Vercel app (`app/`, `components/`) is a disposable demo shell — **only `lib/` gets
ported.** We were mandated to make the code port-ready, not to build the prod API.

## Read these (ignore everything else)
1. **`docs/PORTING.md`** — the porting guide. **START HERE.**
2. **`lib/`** — the kernel to re-implement.
3. **`docs/scoring-api.openapi.json`** — the API I/O contract.
4. **`docs/rcs-broadcasts.yaml`** — the Naxai input definition (`rcsContentBody`).
5. **`lib/__vectors__/`** — golden parity vectors.
6. **`docs/MANDATE.md`** — what the client (CIO) asked → where each piece lives.

Ignore `app/`, `components/`, `docs/superpowers/` (process notes), and
`docs/SCORING-AND-ARCHITECTURE.md` (optional rationale).

## The API contract (the critical part)
- **Input = the Naxai `rcsContentBody`** (the `standaloneRichCard` arm) — *and
  nothing else.* This is exactly the object passed to RCS Broadcasts' `sendRCS`.
- The API **fetches the media URL** in `cardContent.media.contentInfo.fileUrl`
  **itself** to derive size/dimensions (SSRF-guarded, header bytes only). Media is
  NOT a caller input.
- **There is no focal point in the input** — the scorer centers the subject
  (vision-based subject detection is a future phase).
- **Two entry points** (the kernel functions to port):
  - `validateFunctional(card, media?)` → functional result (limits: title ≤200,
    description ≤2000, ≤4 suggestions, label ≤25, openUrl ≤2048, supported MIME,
    thumbnail ≤100 KB — sourced from the sendRCS OpenAPI).
  - `scoreRcsContent(card, media?, focal?)` → quality score (iOS/Android, from the
    RBM playbooks). Plus `improveRcsContent(...)` for a deterministic improver.
- **Reference HTTP wrapper** (shows the exact production shape):
  `app/api/{validate,score,improve,analyze}/route.ts` + `app/api/_lib/fetchMedia.ts`
  — body = `rcsContentBody` → fetch media → call the pure kernel. The kernel stays
  I/O-free; the wrapper does the fetch.

## Parity requirement (how to prove the port is correct)
`lib/__vectors__/` holds representative `rcsContentBody` inputs + the snapshot of
their `{ functional, quality }` output. **Run the same inputs through your port and
assert identical output.** The full kernel suite (`npx vitest run`) is the
behavioral spec.

## Scope notes
- **Carousel** (`carouselRichCard` arm of `rcsContentBody`) = next spec; today's
  scoring covers `messageText` + `standaloneRichCard`.
- **Video** introspection is lightweight (type + size, no pixel dimensions).
- **Phase 2** (AI-assistant content creation) = future.
- Open question with the client: one endpoint (the `rcsContentBody` discriminates
  by `type`) vs two (standalone/carousel).
