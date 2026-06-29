# RCS Visual Compatibility Simulator

The same RCS rich card renders differently on iOS (Apple Messages) and
Android (Google Messages). This repo is a **port-ready reference** for a
deterministic RCS scoring engine, wrapped in a demo that makes it tangible:

- a **visual simulator** — author a card once, see both renderings side by
  side, get a deterministic compatibility score with playbook-cited warnings,
  then apply recommended improvements and compare before/after;
- a **scoring API** — the same engine over HTTP (`/api/*`), with a live
  request/response playground and an OpenAPI reference.

The scoring logic is a pure, framework-free kernel in **`lib/`**.

> **For the Naxai Core dev team:** this repo is a **port-ready reference**, not
> the production service. The kernel in **`lib/`** is what gets ported into the
> private API; `app/` + `components/` are a disposable demo shell. Start at
> **[`docs/PORTING.md`](docs/PORTING.md)** (the porting contract).

> The rendering simulation is an approximation based on the RCS UX playbooks.
> Actual rendering may vary by device, font size, app version, and orientation.

## Run

```bash
npm install
npm run dev    # http://localhost:3000
npm run test:run   # the kernel suite
```

The app has three sections (top nav): **POC** (the visual simulator), **API**
(a live request/response playground), and **API Reference** (Swagger over
`docs/scoring-api.openapi.json`). The scoring endpoints are
`POST /api/{validate,score,improve,analyze}`; each takes a Naxai `rcsContentBody`
and fetches the media URL server-side (header bytes only, behind an SSRF guard).

## Two axes (the kernel's shape)

The kernel answers two separate questions — see `docs/SCORING-AND-ARCHITECTURE.md`:

- **Functional** — *"will the Naxai API accept this?"* Binary, sourced from the
  sendRCS OpenAPI (the things that 422): title ≤ 200, description ≤ 2000, ≤ 4
  suggestions, label ≤ 25, supported MIME, thumbnail ≤ 100 KB.
  → `validateFunctional(card, media?)`.
- **Quality** — *"will it render well on iOS vs Android?"* Gradual 0–100, sourced
  from the UX playbooks. → `scoreRcsContent(card, media?, focal?)`.

The kernel is pure: it takes **already-derived** `media`/`focal` and does no I/O.
The HTTP API takes just the `rcsContentBody`, derives media internally, and never
takes a focal point — the contract is in [`docs/PORTING.md`](docs/PORTING.md).

## What it simulates (source of truth: Google's RBM UX playbooks)

- **iOS 60×60 DP media** on HORIZONTAL (compact) cards — xPlatform Playbook s15
- **Android vertical cropping that worsens with longer text** — xPlatform s15
- **iOS text truncation** (3-line recommendation, 6-line tappable overflow) — xPlatform s11/s13/s23
- **iOS "Options" dropdown** when a card has more than 2 actions — xPlatform s42
- **Suggestion limits**: max 4 per card, 25 chars per label — xPlatform s17
- **Safe zone & centered 1:1 critical content area** + draggable focal point — xPlatform s12/s16, Card Media p39
- **Canonical media dimensions** (heights 112/168/264 DP, vertical aspect set
  {2:1, 16:9, 7:3}) and the supported-MIME list — Google RBM rich-cards guide

Playbooks:
[Card Media Playbook (March 2026)](https://www.gstatic.com/rbm-devsite/ux/CardMediaPlaybook_March2026.pdf) ·
[X-Platform Playbook (April 2026)](https://www.gstatic.com/rbm-devsite/ux/xPlatformPlaybook_April2026.pdf)

## Structure

```
KERNEL — port this (pure, framework-free; no React/Next, no I/O)
lib/validateFunctional.ts        functional compliance (OpenAPI hard limits → 422)
lib/scoreRcsContent.ts           deterministic quality scoring (35/30/20/15 weights)
lib/improveRcsContent.ts         deterministic improver (optional — port if /improve is exposed)
lib/rcsRules.ts                  playbook + guide rules (slide/guide-cited)
lib/recommendationCitations.ts   maps each warning to its source slide/guide
lib/cropMath.ts                  object-fit: cover geometry
lib/media/introspect.ts          header bytes → type/size/dimensions
lib/media/ssrfGuard.ts           https-only + resolved-IP validation
lib/__vectors__/                 golden parity vectors (cross-language port contract)
types/rcs.ts                     native Naxai model (mirrors docs/rcs-broadcasts.yaml)

SHELL — ignore when porting (demo UI + reference API wrappers)
app/page.tsx, app/improve/page.tsx                   the visual simulator (POC)
app/api-playground/page.tsx                          live API request/response playground
app/api-docs/page.tsx                                Swagger reference UI
app/api/{validate,score,improve,analyze}/route.ts    scoring endpoints (body = rcsContentBody)
app/api/media-info/route.ts                          media-URL introspection endpoint
app/api/openapi/route.ts                             serves docs/scoring-api.openapi.json
app/api/_lib/fetchMedia.ts                           SSRF-guarded media fetch (wrapper-side I/O)
app/api/_lib/guards.ts                               request-body validation (parse rcsContentBody)
components/*.tsx                                      nav, previews, score panels, API console
components/cardView.ts, apiClient.ts                 UI view-model + browser API client

docs/PORTING.md                  the porting contract — read first
docs/AGENT-CONTEXT.md            paste-ready brief for a coding agent doing the port
docs/MANDATE.md                  client asks → deliverables (traceability)
docs/scoring-api.openapi.json    the scoring API I/O contract
docs/rcs-broadcasts.yaml         the Naxai Broadcasts OpenAPI (rcsContentBody)
docs/SCORING-AND-ARCHITECTURE.md why the kernel is shaped this way (background)
skills/rcs-playbook-rules/       the two RBM UX playbooks + rule skill (future Agent SDK improver)
```

## Roadmap

The deterministic pieces are deliberately swappable:

- `lib/improveRcsContent.ts` → an Anthropic Agent SDK call that loads
  `skills/rcs-playbook-rules` and returns the same `ImprovedRcsContent`, with the
  deterministic scorer as its judge (generate → score → fix).
- Manual focal point → vision-based object/logo/text detection.
- `RcsContentBody` → add the `carouselRichCard` arm (Spec 2).
