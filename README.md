# RCS Visual Compatibility Simulator (local MVP)

The same RCS rich card renders differently on iOS (Apple Messages) and
Android (Google Messages). This local demo makes that visible: author a card
once, see both renderings side by side, get a deterministic compatibility
score with playbook-cited warnings, then apply recommended improvements and
compare before/after.

> This is an approximation based on the RCS UX playbooks. Actual rendering
> may vary by device, font size, app version, and orientation.

## Run

```bash
npm install
npm run dev   # http://localhost:3000
```

No database, no auth, no network calls — images stay in the browser
(object URLs).

## What it simulates (source of truth: Google's RBM UX playbooks)

- **iOS 60×60 DP media** on compact (horizontal) cards — xPlatform Playbook s15
- **Android vertical cropping that worsens with longer text** — xPlatform s15
- **iOS text truncation** (3-line recommendation, 6-line tappable overflow) — xPlatform s11/s13/s23
- **iOS "Options" dropdown** when a card has more than 2 actions — xPlatform s42
- **Suggestion limits**: max 4 per card, 25 chars per label — xPlatform s17
- **Safe zone & centered 1:1 critical content area** + draggable focal point — xPlatform s12/s16, Card Media p39

Playbooks:
[Card Media Playbook (March 2026)](https://www.gstatic.com/rbm-devsite/ux/CardMediaPlaybook_March2026.pdf) ·
[X-Platform Playbook (April 2026)](https://www.gstatic.com/rbm-devsite/ux/xPlatformPlaybook_April2026.pdf)

## Structure

```
app/page.tsx                     phase 1: editor, previews, score
app/improve/page.tsx             phase 2: improvement studio (before/after)
components/SimulatorProvider.tsx shared state (context + sessionStorage)
components/RcsInputPanel.tsx     upload, texts, actions editor, focal-point drag
components/RcsCardPreview.tsx    platform-divergent card renderer
components/PlatformPreview.tsx   iOS / Google Messages phone frames
components/SafeZoneOverlay.tsx   safe zone, 1:1 critical area, focal marker
components/ScorePanel.tsx        weighted scores, warnings, recommendations
components/BeforeAfterComparison.tsx
lib/rcsRules.ts                  playbook-derived rules (slide-cited)
lib/cropMath.ts                  object-fit: cover geometry
lib/scoreRcsContent.ts           deterministic scoring (35/30/20/15 weights)
lib/improveRcsContent.ts         deterministic phase-2 improver
types/rcs.ts                     domain types
skills/rcs-playbook-rules/       Agent Skill for the future Anthropic Agent SDK
                                 integration (SKILL.md + extracted rules + PDFs)
```

## Adding the real agent later

The deterministic pieces are deliberately swappable:

- `lib/improveRcsContent.ts` → replace with an Anthropic Agent SDK call that
  loads `skills/rcs-playbook-rules` and returns the same `ImprovedRcsContent`.
- Manual focal point → vision-based object/logo/text detection.
- `lib/rcsRules.ts` approximations → complete extracted playbook rules.
- JSON import/export of real Naxai RCS payloads.

Search the codebase for `TODO:` to find each integration point.
