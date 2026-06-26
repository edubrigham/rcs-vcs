/**
 * Phase 2: deterministic "Apply recommended improvements" simulation.
 *
 * This intentionally contains zero AI. It applies the playbook's own
 * recommendations mechanically so the before/after comparison is reproducible
 * and explainable in a demo. Operates on the native Naxai model.
 *
 * TODO: replace deterministic improveRcsContent with the Anthropic Agent SDK.
 *       The agent should load the /skills/rcs-playbook-rules skill as its
 *       source of truth and return the same ImprovedRcsContent shape.
 * TODO: replace manual focal point with vision-based object/logo/text detection.
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
  CardOrientation,
  FocalPoint,
  ImprovedRcsContent,
  ImprovementCategory,
  ImprovementChange,
  MediaHeight,
  MediaIntrospection,
  ScoreResult,
  StandaloneRichCard,
  Suggestion,
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
 * last clause boundary inside the budget → word boundary.
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
    if (match.index! > target * 0.5) clauseEnd = Math.max(clauseEnd, match.index!);
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

/** Narrowest chars-per-line across both platforms for a field on this card shape. */
function worstCharsPerLine(
  orientation: CardOrientation,
  mediaHeight: MediaHeight | null,
  role: "title" | "description",
): number {
  const ios = getPlatformRules("ios", orientation, mediaHeight, 0);
  const android = getPlatformRules("android", orientation, mediaHeight, 0);
  return role === "title"
    ? Math.min(ios.titleCharsPerLine, android.titleCharsPerLine)
    : Math.min(ios.descriptionCharsPerLine, android.descriptionCharsPerLine);
}

/**
 * Shortens text until it actually renders within `maxLines` on the NARROWEST
 * platform (not merely under a character count).
 */
function shortenToLines(
  text: string,
  orientation: CardOrientation,
  mediaHeight: MediaHeight | null,
  role: "title" | "description",
  maxLines: number,
): string {
  const cpl = worstCharsPerLine(orientation, mediaHeight, role);
  let result = shorten(text, cpl * maxLines);
  for (let guard = 0; guard < 50 && result.includes(" ") && estimateLines(result, cpl) > maxLines; guard++) {
    result = result.slice(0, result.lastIndexOf(" ")).replace(/[,;:\-–—]$/, "").trim();
  }
  return result;
}

/** Whether the text already fits within `maxLines` on both platforms. */
function fitsLines(
  text: string,
  orientation: CardOrientation,
  mediaHeight: MediaHeight | null,
  role: "title" | "description",
  maxLines: number,
): boolean {
  return estimateLines(text, worstCharsPerLine(orientation, mediaHeight, role)) <= maxLines;
}

export function improveRcsContent(
  card: StandaloneRichCard,
  media: MediaIntrospection | undefined,
  focal: FocalPoint | undefined,
  scoreResult: ScoreResult,
): ImprovedRcsContent {
  const changes: ImprovementChange[] = [];
  const change = (category: ImprovementCategory, message: string) =>
    changes.push({ category, message });

  const orientation = card.cardOrientation;
  const mediaHeight = card.cardContent.media?.height ?? null;
  const suggestionsIn = card.cardContent.suggestions ?? [];

  // 1. Text: shorten until title + description actually render within ~3 lines
  //    on BOTH platforms (line-aware, not character-count — [xPlatform s11]).
  let title = (card.cardContent.title ?? "").trim().replace(/\s+/g, " ");
  if (title && !fitsLines(title, orientation, mediaHeight, "title", TITLE_TARGET_LINES)) {
    title = shortenToLines(title, orientation, mediaHeight, "title", TITLE_TARGET_LINES);
    change("text", "Shortened the title to a single line to avoid wrapping and iOS truncation (xPlatform s11, s13).");
  }
  let description = (card.cardContent.description ?? "").trim().replace(/\s+/g, " ");
  if (description && !fitsLines(description, orientation, mediaHeight, "description", DESCRIPTION_TARGET_LINES)) {
    description = shortenToLines(description, orientation, mediaHeight, "description", DESCRIPTION_TARGET_LINES);
    change(
      "text",
      "Shortened the description so title + description fit the recommended 3 lines on both platforms and reduce Android cropping (xPlatform s11, s15).",
    );
  }

  // 2. Suggestions: the playbook pattern is 1 CTA action + up to 3 replies
  //    [xPlatform s11, s17]. Replies STAY in the card. Only extra CTA actions
  //    move out, and that trade-off is disclosed.
  const ctas = suggestionsIn.filter((s) => s.type !== "reply");
  const replies = suggestionsIn.filter((s) => s.type === "reply");
  // Primary CTA = first non-reply suggestion by position.
  const primaryCta = (suggestionsIn[0] && suggestionsIn[0].type !== "reply" ? suggestionsIn[0] : ctas[0]) ?? null;
  const movedCtas = primaryCta ? ctas.filter((s) => s !== primaryCta) : [];
  const keptReplies = replies.slice(0, 3);
  const droppedReplies = replies.slice(3);

  let suggestions: Suggestion[] = suggestionsIn;
  let secondaryActions: Suggestion[] = [];
  if (movedCtas.length > 0 || droppedReplies.length > 0) {
    suggestions = primaryCta ? [primaryCta, ...keptReplies] : keptReplies;
    secondaryActions = [...movedCtas, ...droppedReplies];
    if (movedCtas.length > 0) {
      change(
        "actions",
        `Kept the primary CTA (“${primaryCta!.text}”)${
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
  } else if (primaryCta && suggestionsIn[0] !== primaryCta) {
    suggestions = [primaryCta, ...suggestionsIn.filter((s) => s !== primaryCta)];
    change("actions", "Placed the CTA action first — iOS always shows actions above replies (xPlatform s21).");
  }
  suggestions = suggestions.map((s) => {
    if (s.text.length > SUGGESTION_RULES.maxSuggestionLabelChars) {
      const text = shorten(s.text, SUGGESTION_RULES.maxSuggestionLabelChars);
      change("actions", `Trimmed the CTA label to the 25-character suggestion limit (xPlatform s17).`);
      return { ...s, text };
    }
    return s;
  });

  // 3. Focal point: pull critical content back into the safe zone — but only
  //    emit the re-crop change when something was actually re-cropped.
  let improvedFocal: FocalPoint = { ...(focal ?? { x: 0.5, y: 0.5 }) };
  if (card.cardContent.media && media && media.aspectRatio != null) {
    const lines = estimateTextLines(
      title,
      description,
      getPlatformRules("android", orientation, mediaHeight, 0),
    );
    const window = androidCropWindow(media.aspectRatio, orientation, mediaHeight, lines.totalLines);
    const insideCrop = pointInWindow(improvedFocal, window);
    const insideSafeZone =
      improvedFocal.x >= SAFE_LO &&
      improvedFocal.x <= SAFE_HI &&
      improvedFocal.y >= SAFE_LO &&
      improvedFocal.y <= SAFE_HI;

    // The relocated focal models the RE-EXPORTED asset (subject centered).
    let recropped = false;
    if (!insideCrop) {
      improvedFocal = { x: 0.5, y: 0.5 };
      recropped = true;
      change(
        "image",
        "The subject was outside the Android visible crop area — the simulated re-crop re-centers it. Export the asset with the subject near the center (Card Media p12).",
      );
    } else if (!insideSafeZone) {
      improvedFocal = {
        x: clamp(improvedFocal.x, SAFE_LO + 0.1, SAFE_HI - 0.1),
        y: clamp(improvedFocal.y, SAFE_LO + 0.1, SAFE_HI - 0.1),
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

  // 4. Format: keep the author's selected card shape. Surface Tall as advice
  //    for a MEDIUM vertical card.
  if (orientation === "VERTICAL" && mediaHeight === "MEDIUM") {
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

  const improvedContent: StandaloneRichCard = {
    ...card,
    cardContent: {
      ...card.cardContent,
      title: title || undefined,
      description: description || undefined,
      suggestions: suggestions.length ? suggestions : undefined,
    },
  };

  return {
    improvedContent,
    improvedMedia: media,
    improvedFocal,
    secondaryActions,
    changes,
  };
}
