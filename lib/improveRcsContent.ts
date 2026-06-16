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

import { clamp, pointInWindow } from "@/lib/cropMath";
import {
  androidCropWindow,
  estimateLines,
  estimateTextLines,
  getPlatformRules,
  SAFE_ZONE_RULES,
  SUGGESTION_RULES,
} from "@/lib/rcsRules";
import type {
  CardFormat,
  ImprovedRcsContent,
  ImprovementCategory,
  ImprovementChange,
  RcsAction,
  RcsContent,
  ScoreResult,
} from "@/types/rcs";

/** Target rendered lines per field so title + description stay within ~3 [xPlatform s11]. */
const TITLE_TARGET_LINES = 1;
const DESCRIPTION_TARGET_LINES = 2;

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

/** Narrowest chars-per-line across both platforms for a field on a format. */
function worstCharsPerLine(cardFormat: CardFormat, role: "title" | "description"): number {
  const ios = getPlatformRules("ios", cardFormat, 0);
  const android = getPlatformRules("android", cardFormat, 0);
  return role === "title"
    ? Math.min(ios.titleCharsPerLine, android.titleCharsPerLine)
    : Math.min(ios.descriptionCharsPerLine, android.descriptionCharsPerLine);
}

/**
 * Shortens text until it actually renders within `maxLines` on the NARROWEST
 * platform (not merely under a character count) — so the improver's "fits the
 * recommended lines" claim is true on both iOS and Android.
 */
function shortenToLines(
  text: string,
  cardFormat: CardFormat,
  role: "title" | "description",
  maxLines: number,
): string {
  const cpl = worstCharsPerLine(cardFormat, role);
  let result = shorten(text, cpl * maxLines);
  for (let guard = 0; guard < 50 && result.includes(" ") && estimateLines(result, cpl) > maxLines; guard++) {
    result = result.slice(0, result.lastIndexOf(" ")).replace(/[,;:\-–—]$/, "").trim();
  }
  return result;
}

/** Whether the text already fits within `maxLines` on both platforms. */
function fitsLines(
  text: string,
  cardFormat: CardFormat,
  role: "title" | "description",
  maxLines: number,
): boolean {
  return estimateLines(text, worstCharsPerLine(cardFormat, role)) <= maxLines;
}

export function improveRcsContent(
  input: RcsContent,
  scoreResult: ScoreResult,
): ImprovedRcsContent {
  const changes: ImprovementChange[] = [];
  const change = (category: ImprovementCategory, message: string) =>
    changes.push({ category, message });

  // 1. Text: shorten until title + description actually render within ~3 lines
  //    on BOTH platforms (line-aware, not character-count — [xPlatform s11]).
  let title = input.title.trim().replace(/\s+/g, " ");
  if (!fitsLines(title, input.cardFormat, "title", TITLE_TARGET_LINES)) {
    title = shortenToLines(title, input.cardFormat, "title", TITLE_TARGET_LINES);
    change("text", "Shortened the title to a single line to avoid wrapping and iOS truncation (xPlatform s11, s13).");
  }
  let description = input.description.trim().replace(/\s+/g, " ");
  if (!fitsLines(description, input.cardFormat, "description", DESCRIPTION_TARGET_LINES)) {
    description = shortenToLines(description, input.cardFormat, "description", DESCRIPTION_TARGET_LINES);
    change(
      "text",
      "Shortened the description so title + description fit the recommended 3 lines on both platforms and reduce Android cropping (xPlatform s11, s15).",
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
      change(
        "actions",
        `Kept the primary CTA (“${primaryCta!.label}”)${
          keptReplies.length > 0
            ? ` and ${keptReplies.length} suggested repl${keptReplies.length > 1 ? "ies" : "y"}`
            : ""
        }; moved ${movedCtas.length} extra action(s) out of the card. Trade-off: follow-up message suggestions are transient on Android and shouldn't be combined with rich-card suggestions in one turn — consider converting them to replies instead (xPlatform s17-s18, s42).`,
      );
    }
    if (droppedReplies.length > 0) {
      change(
        "actions",
        `Moved ${droppedReplies.length} repl${droppedReplies.length > 1 ? "ies" : "y"} beyond the 3-per-card limit out of the card (xPlatform s17).`,
      );
    }
  } else if (primaryCta && input.actions[0]?.id !== primaryCta.id) {
    actions = [{ ...primaryCta, primary: true }, ...input.actions.filter((a) => a.id !== primaryCta.id)];
    change("actions", "Placed the CTA action first — iOS always shows actions above replies (xPlatform s21).");
  }
  actions = actions.map((a) => {
    if (a.label.length > SUGGESTION_RULES.maxSuggestionLabelChars) {
      const label = shorten(a.label, SUGGESTION_RULES.maxSuggestionLabelChars);
      change("actions", `Trimmed the CTA label to the 25-character suggestion limit (xPlatform s17).`);
      return { ...a, label };
    }
    return a;
  });

  // 3. Focal point: pull critical content back into the safe zone — but only
  //    emit the re-crop change when something was actually re-cropped.
  let focalPoint = { ...input.focalPoint };
  if (input.imageUrl && input.imageMetadata) {
    const lines = estimateTextLines(
      title,
      description,
      getPlatformRules("android", input.cardFormat, 0),
    );
    const window = androidCropWindow(
      input.imageMetadata.aspectRatio,
      input.cardFormat,
      lines.totalLines,
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
    let recropped = false;
    if (!insideCrop) {
      focalPoint = { x: 0.5, y: 0.5 };
      recropped = true;
      change(
        "image",
        "The subject was outside the Android visible crop area — the simulated re-crop re-centers it. Export the asset with the subject near the center (Card Media p12).",
      );
    } else if (!insideSafeZone) {
      focalPoint = {
        x: clamp(focalPoint.x, SAFE_LO + 0.1, SAFE_HI - 0.1),
        y: clamp(focalPoint.y, SAFE_LO + 0.1, SAFE_HI - 0.1),
      };
      recropped = true;
      change(
        "image",
        "The subject sat outside the central safe zone — the simulated re-crop pulls it back inside (Card Media p39).",
      );
    }
    if (recropped) {
      change(
        "image",
        "Simulated a tighter, subject-centered re-crop so the subject fills the frame instead of floating in dead space — export the real asset with this crop (Card Media p39).",
      );
    }
  }

  // 4. Format: keep the author's selected format — it is the view control on
  //    the Playbook Pass, and silently switching medium→tall made every
  //    medium card render identically to a tall one. Surface Tall as advice.
  const cardFormat = input.cardFormat;
  if (cardFormat === "medium") {
    change(
      "format",
      "Kept the Medium format you selected; for the best cross-platform parity consider the Tall (3:2) card, which renders most consistently (xPlatform s13).",
    );
  }

  if (changes.length === 0) {
    change(
      "general",
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
