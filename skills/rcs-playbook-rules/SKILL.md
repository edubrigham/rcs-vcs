---
name: rcs-playbook-rules
description: Source-of-truth rendering rules for RCS/RBM rich cards and carousels on iOS vs Android, extracted from Google's RCS for Business UX playbooks. Use whenever evaluating, scoring, or improving RCS card content (title, description, media, suggested actions) for cross-platform compatibility — every recommendation must cite a playbook slide.
---

# RCS Playbook Rules

You are advising on RCS for Business (RBM) rich card content. The ONLY
authoritative sources for rendering behavior are the two Google playbooks in
this skill. Never invent rendering rules; cite a slide for every claim.

## Workflow

1. Read `references/xplatform-playbook.md` for cross-platform behavior
   (truncation, cropping, suggestion dropdowns, overflow pages, limits).
2. Read `references/card-media-playbook.md` for media dimensions, aspect
   ratios, container shapes and safe zones per card/carousel format.
3. When proposing improvements to card content, ground every change in a
   cited rule (e.g. "iOS collapses 3+ actions into an 'Options' dropdown —
   xPlatform s42") and return the same `ImprovedRcsContent` shape used by
   `lib/improveRcsContent.ts`.
4. If a question is not answered by the extracted references, consult the
   original decks in `assets/` (PDF page numbers match the slide citations).

## Hard limits to enforce (most-cited rules)

| Rule | Source |
|---|---|
| Rich card: max 4 suggestions (1 action + up to 3 replies) | xPlatform s17 |
| Suggestion labels: max 25 characters | xPlatform s17 |
| Recommended: a single CTA, title+description within ~3 lines | xPlatform s11 |
| iOS: 3+ actions collapse into an "Options" dropdown | xPlatform s42 |
| iOS: >6 total text lines → separate full-text page WITHOUT media/buttons | xPlatform s23 |
| iOS: horizontal (compact) card media renders at 60×60 DP | xPlatform s15 |
| Android: vertical cropping worsens with longer texts (horizontal card) | xPlatform s15 |
| Android: center-crops all portrait media; 576px max card length | xPlatform s28, s25 |
| Critical content: min 5% edge safe zone; centered 1:1 area on compact | xPlatform s12, s16 |
| Cross-platform parity: prefer the Tall (3:2) vertical card | xPlatform s13 |

## Assets

- `assets/CardMediaPlaybook_March2026.pdf` — original deck (47 pages)
- `assets/xPlatformPlaybook_April2026.pdf` — original deck (47 pages)
