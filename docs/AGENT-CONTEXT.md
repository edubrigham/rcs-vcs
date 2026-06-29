# Agent Context — Porting the RCS Scoring Kernel to a Naxai Private API

*A self-contained brief for a coding agent tasked with (or assisting) the port.*

## What this project is
A deterministic **RCS rich-card scoring engine**, currently a PoC (Next.js on
Vercel). It scores a Naxai RCS card on two axes:
- **Functional compliance** — would the Naxai `sendRCS` (RCS Broadcasts) API accept
  it? (binary; the values that 422)
- **Quality** — how well does it render on iOS vs Android? (0–100, from Google's
  RBM UX playbooks)

The scoring logic lives in **`lib/`**: pure, framework-free TypeScript — no
network, no clock, no randomness. Same input → same output; it translates to any
language.

- Repo: `github.com/edubrigham/rcs-vcs` (branch `main`)
- Live demo: `https://rcs-vcs.vercel.app`

## The task
Re-implement the **`lib/` kernel** as a **private production API** at Naxai. Only
`lib/` is ported; `app/` and `components/` are a demo shell (use `app/api/*` only
as reference wrappers).

## Read these (ignore everything else)
1. **`docs/PORTING.md`** — the porting contract. **START HERE.**
2. **`lib/`** — the kernel to re-implement.
3. **`docs/scoring-api.openapi.json`** — the API I/O contract.
4. **`docs/rcs-broadcasts.yaml`** — the Naxai input definition (`rcsContentBody`).
5. **`lib/__vectors__/`** — golden parity vectors.
6. **`docs/MANDATE.md`** — client requests → deliverables (traceability only).

Ignore `app/`, `components/`, `docs/superpowers/`, and
`docs/SCORING-AND-ARCHITECTURE.md`.

## The API contract (the critical part)
- **Input = the Naxai `rcsContentBody`** (the `standaloneRichCard` arm) — and
  nothing else. This is the object passed to RCS Broadcasts' `sendRCS`.
- The API **fetches `cardContent.media.contentInfo.fileUrl` internally** to derive
  media metadata (SSRF-guarded, header bytes only). Media is not a caller input.
- **No focal point in the input** — the scorer centers the subject.
- **Required kernel functions:**
  - `validateFunctional(card, media?)` → functional result (limits: title ≤ 200,
    description ≤ 2000, ≤ 4 suggestions, label ≤ 25, openUrl ≤ 2048, supported
    MIME, thumbnail ≤ 100 KB).
  - `scoreRcsContent(card, media?, focal?)` → quality 0–100 (iOS/Android).
  - **Optional:** `improveRcsContent(...)` — port only if the API exposes `/improve`.
- **Purity boundary:** the kernel takes already-derived `media`/`focal` and does no
  I/O; the API wrapper fetches media, then calls it. Reference:
  `app/api/{validate,score,improve,analyze}/route.ts` + `app/api/_lib/fetchMedia.ts`.

## Parity (definition of done)
`lib/__vectors__/` holds representative `rcsContentBody` inputs + their
`{ functional, quality }` output. **Run the same inputs through the port and assert
identical output.** The full kernel suite (`npx vitest run`) is the behavioral spec.

## Out of scope
- **Carousel** (`carouselRichCard` arm) — scoring covers `standaloneRichCard` today.
- **Video dimensions** — videos yield MIME type + file size only.
- **AI-assistant content creation** (Phase 2).
- Open design decision: one endpoint (the `rcsContentBody` discriminates by `type`)
  vs two (standalone/carousel).
