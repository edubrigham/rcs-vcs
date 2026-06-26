# RCS Visual Compatibility Simulator

The same RCS rich card renders differently on iOS (Apple Messages) and
Android (Google Messages). This demo makes that visible: author a card once,
see both renderings side by side, get a deterministic compatibility score with
playbook-cited warnings, then apply recommended improvements and compare
before/after.

> **For the Naxai Core dev team:** this repo is a **port-ready reference**, not
> the production service. The logic kernel in **`lib/`** is what gets ported into
> the private API; `app/` + `components/` are a disposable demo shell. Start at
> **[`docs/PORTING.md`](docs/PORTING.md)**.

> The rendering simulation is an approximation based on the RCS UX playbooks.
> Actual rendering may vary by device, font size, app version, and orientation.

## Run

```bash
npm install
npm run dev    # http://localhost:3000
npm run test:run   # the kernel suite
```

The demo keeps uploaded images in the browser (object URLs). Media **URL**
introspection (size/dimensions) runs server-side via `/api/media-info`, which
fetches header bytes only behind an SSRF guard.

## Two axes (the kernel's shape)

The kernel answers two separate questions — see `docs/SCORING-AND-ARCHITECTURE.md`:

- **Functional** — *"will the Naxai API accept this?"* Binary, sourced from the
  sendRCS OpenAPI (the things that 422): title ≤ 200, description ≤ 2000, ≤ 4
  suggestions, label ≤ 25, supported MIME, thumbnail ≤ 100 KB.
  → `validateFunctional(card, media?)`.
- **Quality** — *"will it render well on iOS vs Android?"* Gradual 0–100, sourced
  from the UX playbooks. → `scoreRcsContent(card, media?, focal?)`.

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
KERNEL — port this (pure, framework-free)
lib/validateFunctional.ts        functional compliance (OpenAPI hard limits → 422)
lib/scoreRcsContent.ts           deterministic quality scoring (35/30/20/15 weights)
lib/improveRcsContent.ts         deterministic improver
lib/rcsRules.ts                  playbook + guide rules (slide/guide-cited)
lib/cropMath.ts                  object-fit: cover geometry
lib/media/introspect.ts          bytes + headers → type/size/dimensions
lib/media/ssrfGuard.ts           https-only + IP-pinned fetch guard
lib/__vectors__/                 golden parity vectors (cross-language port contract)
types/rcs.ts                     native Naxai model (mirrors docs/rcs-broadcasts.yaml)

SHELL — ignore when porting (disposable demo)
app/page.tsx                     phase 1: editor, previews, score
app/improve/page.tsx             phase 2: improvement studio (before/after)
app/api/media-info/route.ts      SSRF-hardened URL introspection (reference wiring)
components/*.tsx                  React previews, score panels, editors
components/cardView.ts           UI-only presentation view-model

docs/PORTING.md                  the porting guide — read first
docs/SCORING-AND-ARCHITECTURE.md why the kernel is shaped this way
docs/rcs-broadcasts.yaml         the authoritative Naxai Broadcasts OpenAPI
skills/rcs-playbook-rules/       Agent Skill for the future Anthropic Agent SDK improver
```

## Roadmap

The deterministic pieces are deliberately swappable:

- `lib/improveRcsContent.ts` → an Anthropic Agent SDK call that loads
  `skills/rcs-playbook-rules` and returns the same `ImprovedRcsContent`, with the
  deterministic scorer as its judge (generate → score → fix).
- Manual focal point → vision-based object/logo/text detection.
- `RcsContentBody` → add the `carouselRichCard` arm (Spec 2).
