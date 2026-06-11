/**
 * Phase 2: deterministic "Apply recommended improvements" simulation.
 *
 * This intentionally contains zero AI. It applies the playbook's own
 * recommendations mechanically so the before/after comparison is reproducible
 * and explainable in a demo.
 *
 * TODO: replace deterministic improveRcsContent with the Anthropic Agent SDK.
 *       The agent should load the /skills/rcs-playbook-rules skill as its
 *       source of truth and return the same ImprovedRcsContent shape.
 * TODO: replace manual focal point with vision-based object/logo/text detection.
 * TODO: add JSON import/export for actual Naxai RCS payloads.
 */

import { clamp, getVisibleWindow, pointInWindow } from "@/lib/cropMath";
import {
  estimateTextLines,
  getPlatformRules,
  SAFE_ZONE_RULES,
  SUGGESTION_RULES,
} from "@/lib/rcsRules";
import type { ImprovedRcsContent, RcsAction, RcsContent, ScoreResult } from "@/types/rcs";

/** ~1 short line of title on both platforms. */
const TITLE_TARGET_CHARS = 30;
/**
 * ~2 rendered lines of description — inside the 3-line budget [xPlatform s11].
 * The compact (horizontal) card has a much narrower text column (128dp media
 * beside it), so it gets a tighter budget; the playbook itself pairs that
 * format with a "short text block" [CardMedia p13].
 */
const DESCRIPTION_TARGET_CHARS: Record<RcsContent["cardFormat"], number> = {
  compact: 56,
  medium: 76,
  tall: 76,
};

const SAFE_LO = (1 - SAFE_ZONE_RULES.centralFraction) / 2;
const SAFE_HI = 1 - SAFE_LO;

/** Dangling words that read badly at the end of a shortened phrase. */
const TRAILING_STOPWORDS =
  /\s+(a|an|the|and|or|of|to|for|with|in|on|at|by|your|our|its)$/i;

/** Clause separators worth cutting at: , ; : and spaced dashes. */
const CLAUSE_BOUNDARY = /[,;:]|\s[—–-]\s/g;

/**
 * Shortens copy with decreasing preference: whole text → first sentence →
 * last clause boundary inside the budget → word boundary. Clause cuts keep
 * the phrase grammatically whole ("…with a 10-day battery" instead of
 * "…battery, on-wrist").
 */
function shorten(text: string, target: number): string {
  const trimmed = text.trim().replace(/\s+/g, " ");
  if (trimmed.length <= target) return trimmed;

  const firstSentence = trimmed.match(/^[^.!?]+[.!?]/)?.[0];
  if (firstSentence && firstSentence.length <= target) return firstSentence.trim();

  const cut = trimmed.slice(0, target + 1);

  // Prefer the last clause boundary in the window, if it keeps enough text.
  let clauseEnd = -1;
  for (const match of cut.matchAll(CLAUSE_BOUNDARY)) {
    if (match.index > target * 0.5) clauseEnd = Math.max(clauseEnd, match.index);
  }
  let head: string;
  if (clauseEnd > 0) {
    head = cut.slice(0, clauseEnd).trim();
  } else {
    const lastSpace = cut.lastIndexOf(" ");
    head = (lastSpace > target * 0.5 ? cut.slice(0, lastSpace) : cut.slice(0, target)).trim();
  }

  head = head.replace(/[,;:\-–—]$/, "").trim();
  // Drop dangling stopwords ("…with a") until the phrase ends on a real word.
  for (let guard = 0; guard < 4 && TRAILING_STOPWORDS.test(head); guard++) {
    head = head.replace(TRAILING_STOPWORDS, "").replace(/[,;:\-–—]$/, "").trim();
  }
  return head;
}

export function improveRcsContent(
  input: RcsContent,
  scoreResult: ScoreResult,
): ImprovedRcsContent {
  const changes: string[] = [];

  // 1. Text: bring title + description back inside the 3-line budget.
  let title = input.title.trim().replace(/\s+/g, " ");
  if (title.length > TITLE_TARGET_CHARS) {
    title = shorten(title, TITLE_TARGET_CHARS);
    changes.push("Shortened the title to reduce wrapping and iOS truncation (xPlatform s13).");
  }
  const descriptionTarget = DESCRIPTION_TARGET_CHARS[input.cardFormat];
  let description = input.description.trim().replace(/\s+/g, " ");
  if (description.length > descriptionTarget) {
    description = shorten(description, descriptionTarget);
    changes.push(
      "Shortened the description to fit the recommended 3 lines and reduce Android media cropping (xPlatform s11, s15).",
    );
  }

  // 2. Suggestions: the playbook pattern is 1 CTA action + up to 3 replies
  //    [xPlatform s11, s17]. Replies STAY in the card — they are compliant
  //    functionality, not clutter. Only extra CTA actions move out, and that
  //    trade-off is disclosed (message suggestions are transient on Android
  //    and shouldn't be mixed with rich-card suggestions in one turn, s17-s18).
  const ctas = input.actions.filter((a) => a.type !== "reply");
  const replies = input.actions.filter((a) => a.type === "reply");
  const primaryCta = ctas.find((a) => a.primary) ?? ctas[0] ?? null;
  const movedCtas = primaryCta ? ctas.filter((a) => a.id !== primaryCta.id) : [];
  const keptReplies = replies.slice(0, 3);
  const droppedReplies = replies.slice(3);

  let actions: RcsAction[] = input.actions;
  let secondaryActions: RcsAction[] = [];
  if (movedCtas.length > 0 || droppedReplies.length > 0) {
    actions = primaryCta ? [{ ...primaryCta, primary: true }, ...keptReplies] : keptReplies;
    secondaryActions = [...movedCtas, ...droppedReplies];
    if (movedCtas.length > 0) {
      changes.push(
        `Kept the primary CTA (“${primaryCta!.label}”)${
          keptReplies.length > 0
            ? ` and ${keptReplies.length} suggested repl${keptReplies.length > 1 ? "ies" : "y"}`
            : ""
        }; moved ${movedCtas.length} extra action(s) out of the card. Trade-off: follow-up message suggestions are transient on Android and shouldn't be combined with rich-card suggestions in one turn — consider converting them to replies instead (xPlatform s17-s18, s42).`,
      );
    }
    if (droppedReplies.length > 0) {
      changes.push(
        `Moved ${droppedReplies.length} repl${droppedReplies.length > 1 ? "ies" : "y"} beyond the 3-per-card limit out of the card (xPlatform s17).`,
      );
    }
  } else if (primaryCta && input.actions[0]?.id !== primaryCta.id) {
    actions = [{ ...primaryCta, primary: true }, ...input.actions.filter((a) => a.id !== primaryCta.id)];
    changes.push("Placed the CTA action first — iOS always shows actions above replies (xPlatform s21).");
  }
  actions = actions.map((a) => {
    if (a.label.length > SUGGESTION_RULES.maxSuggestionLabelChars) {
      const label = shorten(a.label, SUGGESTION_RULES.maxSuggestionLabelChars);
      changes.push(`Trimmed the CTA label to the 25-character suggestion limit (xPlatform s17).`);
      return { ...a, label };
    }
    return a;
  });

  // 3. Focal point: pull critical content back into the safe zone.
  let focalPoint = { ...input.focalPoint };
  if (input.imageUrl && input.imageMetadata) {
    const lines = estimateTextLines(
      title,
      description,
      getPlatformRules("android", input.cardFormat, 0),
    );
    const rules = getPlatformRules("android", input.cardFormat, lines.totalLines);
    const window = getVisibleWindow(
      input.imageMetadata.aspectRatio,
      rules.mediaWidth / rules.mediaHeight,
    );
    const insideCrop = pointInWindow(focalPoint, window);
    const insideSafeZone =
      focalPoint.x >= SAFE_LO &&
      focalPoint.x <= SAFE_HI &&
      focalPoint.y >= SAFE_LO &&
      focalPoint.y <= SAFE_HI;

    // The relocated focal models the RE-EXPORTED asset (subject centered) for
    // scoring; the improved preview zooms to the subject's original position
    // via its subjectPoint prop.
    if (!insideCrop) {
      focalPoint = { x: 0.5, y: 0.5 };
      changes.push(
        "The subject was outside the Android visible crop area — the simulated re-crop re-centers it. Export the asset with the subject near the center (Card Media p39).",
      );
    } else if (!insideSafeZone) {
      focalPoint = {
        x: clamp(focalPoint.x, SAFE_LO + 0.1, SAFE_HI - 0.1),
        y: clamp(focalPoint.y, SAFE_LO + 0.1, SAFE_HI - 0.1),
      };
      changes.push(
        "The subject sat outside the central safe zone — the simulated re-crop pulls it back inside (Card Media p39).",
      );
    }
    changes.push(
      "Simulated a tighter, subject-centered re-crop so the subject fills the frame instead of floating in dead space — export the real asset with this crop (Card Media p6, p39).",
    );
  }

  // 4. Format: medium vertical cards diverge most across platforms.
  let cardFormat = input.cardFormat;
  if (cardFormat === "medium") {
    cardFormat = "tall";
    changes.push(
      "Switched to the Tall (3:2) card — Google's recommended format for cross-platform parity (xPlatform s13).",
    );
  }

  if (changes.length === 0) {
    changes.push(
      scoreResult.warnings.length === 0
        ? "Content already follows the playbook recommendations — no changes applied."
        : "No automatic fix available for the remaining warnings — review them manually.",
    );
  }

  return {
    improvedContent: {
      ...input,
      title,
      description,
      actions,
      focalPoint,
      cardFormat,
    },
    secondaryActions,
    changes,
  };
}
