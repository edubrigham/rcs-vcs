/**
 * Deterministic, explainable scoring for RCS card content.
 *
 * Weights (per product spec):
 *   image safe zone 35% · text fit 30% · suggested actions 20% · layout risk 15%
 *
 * No AI involved: every number traces back to a playbook rule (see citations)
 * or an explicit threshold in this file.
 *
 * Operates on the native Naxai model: a `StandaloneRichCard` plus the derived
 * `MediaIntrospection` (image dimensions) and the simulator-only `FocalPoint`.
 * Structure: `scoreRcsContent` composes four independent, pure sub-scorers.
 */

import {
  clamp,
  criticalSquareWindow,
  pointInWindow,
  visibleAreaFraction,
} from "@/lib/cropMath";
import {
  androidCropWindow,
  estimateTextLines,
  FUNCTIONAL_LIMITS,
  getPlatformRules,
  IOS_RULES,
  nearestGuideAspect,
  RATIO_DEVIATION_TOLERANCE,
  recommendedAspectForOrientation,
  SAFE_ZONE_RULES,
  SUGGESTION_RULES,
} from "@/lib/rcsRules";
import type {
  FocalPoint,
  MediaIntrospection,
  Recommendation,
  ScoreResult,
  StandaloneRichCard,
  Suggestion,
  Warning,
} from "@/types/rcs";

const WEIGHTS = { image: 0.35, text: 0.3, actions: 0.2, layout: 0.15 } as const;

const SAFE_LO = (1 - SAFE_ZONE_RULES.centralFraction) / 2; // 0.2
const SAFE_HI = 1 - SAFE_LO; // 0.8

/** A per-platform sub-score plus the warnings/recommendations it raised. */
export interface SubScore {
  ios: number;
  android: number;
  warnings: Warning[];
  recommendations: Recommendation[];
}

/** Layout risk is platform-agnostic: a single score for both platforms. */
export interface LayoutScore {
  score: number;
  warnings: Warning[];
  recommendations: Recommendation[];
}

/**
 * The flat view of a suggestion the action-scorer reasons over: kind, label,
 * value, and a positional id. `openUrl` is distinguished because only it gets
 * the https check; every other action kind scores as a generic CTA.
 */
type ActionView = { kind: "openUrl" | "dial" | "reply"; label: string; value: string; id: string };

function toActionViews(suggestions: Suggestion[]): ActionView[] {
  return suggestions.map((s, i) => {
    if (s.type === "reply") {
      return { kind: "reply", label: s.text, value: s.postbackData ?? "", id: String(i) };
    }
    const value = s.action.type === "openUrlAction"
      ? s.action.url
      : s.action.type === "dialAction"
        ? s.action.phoneNumber
        : "";
    const kind = s.action.type === "openUrlAction" ? "openUrl" : "dial";
    return { kind, label: s.text, value, id: String(i) };
  });
}

// ───────────────────────────── Text fit (30%) ─────────────────────────────
export function scoreText(card: StandaloneRichCard): SubScore {
  const warnings: Warning[] = [];
  const recommendations: Recommendation[] = [];

  const title = card.cardContent.title ?? "";
  const description = card.cardContent.description ?? "";
  const orientation = card.cardOrientation;
  const mediaHeight = card.cardContent.media?.height ?? null;

  const iosLines = estimateTextLines(
    title,
    description,
    getPlatformRules("ios", orientation, mediaHeight, 0),
  );
  const androidLines = estimateTextLines(
    title,
    description,
    getPlatformRules("android", orientation, mediaHeight, 0),
  );
  const iosRules = getPlatformRules("ios", orientation, mediaHeight, iosLines.totalLines);
  const androidRules = getPlatformRules("android", orientation, mediaHeight, androidLines.totalLines);

  const iosTitleOverflow = Math.max(0, iosLines.titleLines - iosRules.maxTitleLines);
  const iosDescOverflow = Math.max(0, iosLines.descriptionLines - iosRules.maxDescriptionLines);
  let iosText = clamp(100 - 15 * (iosTitleOverflow + iosDescOverflow), 20, 100);

  if (iosTitleOverflow > 0) {
    warnings.push({
      severity: "warning",
      platform: "ios",
      category: "text",
      message: "Title is likely to be truncated on iOS.",
      recommendation: `Shorten the title to roughly ${iosRules.maxTitleLines * iosRules.titleCharsPerLine} characters or fewer (xPlatform Playbook s13).`,
    });
  }
  if (iosDescOverflow > 0) {
    warnings.push({
      severity: "warning",
      platform: "ios",
      category: "text",
      message: "Description is likely to be truncated on iOS.",
      recommendation: `Aim for ~${iosRules.maxDescriptionLines * iosRules.descriptionCharsPerLine} characters; longer texts get truncated on iOS (xPlatform Playbook s13).`,
    });
  }
  if (iosLines.totalLines > IOS_RULES.tappableOverflowTotalLines) {
    warnings.push({
      severity: "critical",
      platform: "ios",
      category: "text",
      message:
        "Title + description exceed 6 lines: on iOS the whole card becomes tappable and the full text opens on a separate page WITHOUT media or buttons.",
      recommendation:
        "Keep title + description within 6 total lines so users never lose the CTA (xPlatform Playbook s23).",
    });
    iosText = clamp(iosText - 20, 10, 100);
  } else if (
    iosLines.totalLines > IOS_RULES.maxRecommendedTextLines ||
    androidLines.totalLines > IOS_RULES.maxRecommendedTextLines
  ) {
    // s11 applies to BOTH platforms; Android wraps at narrower chars-per-line,
    // so check both estimates, not just iOS.
    warnings.push({
      severity: "info",
      platform: "both",
      category: "text",
      message:
        "Content exceeds the recommended 3 lines of text. What fits in those lines varies with the device's font size settings and screen orientation.",
      recommendation: "Front-load the key message in the first ~3 lines (xPlatform Playbook s11).",
    });
  }

  const androidDescOverflow = Math.max(
    0,
    androidLines.descriptionLines - androidRules.maxDescriptionLines,
  );
  const androidText = clamp(100 - 8 * androidDescOverflow, 30, 100);
  if (androidDescOverflow > 1) {
    warnings.push({
      severity: "info",
      platform: "android",
      category: "text",
      message:
        "Very long text pushes the Android card toward its 576px cap, where the rest hides behind a “More” page.",
      recommendation: "Trim the description below ~5 rendered lines (xPlatform Playbook s25).",
    });
  }

  // [xPlatform s23] Hard content caps of the overflow full-text page: beyond
  // these, even the separate page truncates.
  if (title.length > IOS_RULES.titleFullTextCapChars) {
    warnings.push({
      severity: "warning",
      platform: "ios",
      category: "text",
      message: `Title exceeds the ${IOS_RULES.titleFullTextCapChars}-character cap of the iOS overflow full-text page; the rest is dropped.`,
      recommendation: `Keep the title under ${IOS_RULES.titleFullTextCapChars} characters (xPlatform Playbook s23).`,
    });
  }
  if (description.length > IOS_RULES.descriptionFullTextCapChars) {
    warnings.push({
      severity: "warning",
      platform: "ios",
      category: "text",
      message: `Description exceeds the ${IOS_RULES.descriptionFullTextCapChars}-character cap of the iOS overflow full-text page; the rest is dropped.`,
      recommendation: `Keep the description under ${IOS_RULES.descriptionFullTextCapChars} characters (xPlatform Playbook s23).`,
    });
  }

  return { ios: iosText, android: androidText, warnings, recommendations };
}

// ─────────────────────────── Image & safe zone (35%) ───────────────────────
export function scoreImage(
  card: StandaloneRichCard,
  media?: MediaIntrospection,
  focal?: FocalPoint,
): SubScore {
  const warnings: Warning[] = [];
  const recommendations: Recommendation[] = [];

  let imageScoreIos = 100;
  let imageScoreAndroid = 100;

  // File-level checks apply to any media (image or video, dimensions or not).
  if (media && media.fileSizeBytes > FUNCTIONAL_LIMITS.FILE_MAX_BYTES) {
    warnings.push({
      severity: "info",
      platform: "both",
      category: "image",
      message: `Media file is over ${FUNCTIONAL_LIMITS.FILE_MAX_BYTES / 1_000_000} MB (the recommended maximum).`,
      recommendation: "Compress the asset below 100 MB (Naxai sendRCS).",
    });
  }
  if (media?.mimeType === "image/gif") {
    warnings.push({
      severity: "info",
      platform: "ios",
      category: "image",
      message: "Animated GIFs do not animate on iOS — only the first frame is shown.",
      recommendation: "Use a short video if motion matters (xPlatform Playbook s11).",
    });
  }

  const hasImage = card.cardContent.media != null && media != null && media.aspectRatio != null;
  if (!hasImage) {
    imageScoreIos = 55;
    imageScoreAndroid = 55;
    warnings.push({
      severity: "info",
      platform: "both",
      category: "image",
      message: "No media uploaded yet — rich cards perform best with an image.",
      recommendation: "Upload an image to evaluate cropping and safe-zone risk.",
    });
    return { ios: imageScoreIos, android: imageScoreAndroid, warnings, recommendations };
  }

  const orientation = card.cardOrientation;
  const mediaHeight = card.cardContent.media!.height;
  const title = card.cardContent.title ?? "";
  const description = card.cardContent.description ?? "";

  const androidLines = estimateTextLines(
    title,
    description,
    getPlatformRules("android", orientation, mediaHeight, 0),
  );
  const androidRules = getPlatformRules("android", orientation, mediaHeight, androidLines.totalLines);

  const aspect = media!.aspectRatio!;
  const focalPt = focal ?? { x: 0.5, y: 0.5 };

  // Android: fixed-container cover crop + a monotone vertical punch-in that
  // grows with text length [xPlatform s15, s28]. Shared with the preview.
  const androidWindow = androidCropWindow(aspect, orientation, mediaHeight, androidLines.totalLines);
  const focalInsideAndroidCrop = pointInWindow(focalPt, androidWindow);
  const focalInsideSafeZone =
    focalPt.x >= SAFE_LO && focalPt.x <= SAFE_HI && focalPt.y >= SAFE_LO && focalPt.y <= SAFE_HI;

  if (!focalInsideAndroidCrop) {
    imageScoreAndroid = 30;
    warnings.push({
      severity: "critical",
      platform: "android",
      category: "image",
      message: "The focal point is outside the Android visible crop area.",
      recommendation:
        "Move the subject toward the image center or re-crop the asset — Android center-crops media to the card container (Card Media Playbook p12).",
    });
  } else if (!focalInsideSafeZone) {
    imageScoreAndroid = 65;
    warnings.push({
      severity: "warning",
      platform: "both",
      category: "image",
      message: "The focal point sits near the image edge, outside the central safe zone.",
      recommendation:
        "Keep critical content (logo, product, face) inside the central safe zone (Card Media Playbook p39).",
    });
  }

  if (androidRules.cropSeverity !== "low") {
    // Lost AREA, not just height: cover-cropping cuts whichever axis overflows.
    const lost = Math.round((1 - visibleAreaFraction(androidWindow)) * 100);
    warnings.push({
      severity: androidRules.cropSeverity === "high" ? "warning" : "info",
      platform: "android",
      category: "image",
      message: `Android crop becomes more severe because the card text is long${
        lost > 0 ? ` (~${lost}% of the image is cropped away)` : ""
      }.`,
      recommendation:
        "Shorten title/description to give the media more room (xPlatform Playbook s15).",
    });
    imageScoreAndroid = clamp(
      imageScoreAndroid - (androidRules.cropSeverity === "high" ? 12 : 6),
      0,
      100,
    );
  }

  // iOS: compact format (HORIZONTAL) renders a 60x60 DP square thumbnail [xPlatform s15].
  if (orientation === "HORIZONTAL") {
    const square = criticalSquareWindow(aspect);
    if (!pointInWindow(focalPt, square)) {
      imageScoreIos = clamp(imageScoreIos - 35, 0, 100);
      warnings.push({
        severity: "warning",
        platform: "ios",
        category: "image",
        message:
          "The focal point falls outside the centered 1:1 critical content area — it may be cut from the iOS 60×60 DP thumbnail.",
        recommendation:
          "Place critical content in the centered square of the image (xPlatform Playbook s16).",
      });
    }
    if (
      aspect > IOS_RULES.compactThumbnailAspectAbove ||
      aspect < IOS_RULES.compactThumbnailAspectBelow
    ) {
      imageScoreIos = clamp(imageScoreIos - 10, 0, 100);
      warnings.push({
        severity: "warning",
        platform: "ios",
        category: "image",
        message: "The image may not work well as a 60×60 DP thumbnail.",
        recommendation:
          "Use a 9:16 asset with the subject centered; iOS shows only a tiny square of it (xPlatform Playbook s15-s16).",
      });
    }
    if (!focalInsideSafeZone) {
      imageScoreIos = clamp(imageScoreIos - 15, 0, 100);
    }
  } else {
    // iOS vertical cards keep native aspect unless extreme [CardMedia p28].
    const extreme = aspect > IOS_RULES.extremeAspectAbove || aspect < IOS_RULES.extremeAspectBelow;
    if (extreme) {
      imageScoreIos = clamp(imageScoreIos - 25, 0, 100);
      warnings.push({
        severity: "warning",
        platform: "ios",
        category: "image",
        message:
          "Extreme aspect ratio: iOS only preserves the native ratio for non-extreme media; this asset may be cropped or look oversized.",
        recommendation:
          "Stick to 3:2 or 4:3 for cross-platform vertical cards (Card Media Playbook p28-p29).",
      });
    }
    if (!focalInsideSafeZone) {
      imageScoreIos = clamp(imageScoreIos - 20, 0, 100);
    }
    if (aspect < 1) {
      warnings.push({
        severity: "info",
        platform: "both",
        category: "image",
        message:
          "Portrait media renders very differently across platforms: iOS shows it natively (tall card), Android center-crops it into the fixed container.",
        recommendation:
          "Prefer landscape 3:2 media for vertical cards (xPlatform Playbook s28-s29).",
      });
    }
  }

  // Recommended source ratio. VERTICAL → nearest of the guide set {2:1, 16:9,
  // 7:3} (the guide doesn't bind a ratio to a height). HORIZONTAL → playbook 9:16.
  if (orientation === "VERTICAL") {
    const { ratio, deviation } = nearestGuideAspect(aspect);
    if (deviation > RATIO_DEVIATION_TOLERANCE) {
      warnings.push({
        severity: "info",
        platform: "both",
        category: "image",
        message: `The uploaded image (${aspect.toFixed(2)}:1) is far from the nearest recommended vertical ratio (${ratio.toFixed(2)}:1).`,
        recommendation: "Export close to one of 2:1, 16:9 or 7:3 (RBM rich-cards).",
      });
    }
  } else {
    const rec = recommendedAspectForOrientation(orientation, mediaHeight);
    if (Math.abs(aspect - rec.aspect) / rec.aspect > RATIO_DEVIATION_TOLERANCE) {
      warnings.push({
        severity: "info",
        platform: "both",
        category: "image",
        message: `The uploaded image (${aspect.toFixed(2)}:1) deviates from the recommended ${rec.label} ratio for this format.`,
        recommendation: `Export the asset at ${rec.label} (${rec.citation}).`,
      });
    }
  }

  return { ios: imageScoreIos, android: imageScoreAndroid, warnings, recommendations };
}

// ───────────────────────── Suggested actions (20%) ─────────────────────────
export function scoreActions(card: StandaloneRichCard): SubScore {
  const warnings: Warning[] = [];
  const recommendations: Recommendation[] = [];

  // The playbooks treat suggested ACTIONS (device actions: open URL, dial)
  // and suggested REPLIES differently: the recommended pattern is a single
  // CTA action plus up to 3 replies [xPlatform s11, s17], and only ACTIONS
  // collapse into the iOS "Options" dropdown [xPlatform s42].
  const actions = toActionViews(card.cardContent.suggestions ?? []);
  const ctas = actions.filter((a) => a.kind !== "reply");
  const replies = actions.filter((a) => a.kind === "reply");
  const actionCount = actions.length;

  const baseActionScore =
    actionCount === 0
      ? 60 // no tap target at all
      : ctas.length === 0
        ? 78 // replies only — engaging, but no CTA
        : ctas.length === 1
          ? 100 // the recommended single-CTA pattern [s11]
          : ctas.length === 2
            ? 82
            : 65;

  let iosActionScore = baseActionScore;
  let androidActionScore = baseActionScore;

  if (actionCount === 0) {
    warnings.push({
      severity: "info",
      platform: "both",
      category: "actions",
      message: "The card has no suggestions — users have no tap target.",
      recommendation: "Add a single clear CTA (xPlatform Playbook s11).",
    });
  } else if (ctas.length === 0) {
    warnings.push({
      severity: "info",
      platform: "both",
      category: "actions",
      message: "The card has only suggested replies — there is no CTA action.",
      recommendation: "Add one suggested action as the CTA (xPlatform Playbook s11).",
    });
  }
  if (ctas.length === 2) {
    warnings.push({
      severity: "info",
      platform: "both",
      category: "actions",
      message: "Two CTA actions: Google recommends a single CTA per card; replies can carry the rest.",
      recommendation:
        "Keep one suggested action and convert secondary intents to suggested replies (xPlatform Playbook s11, s17).",
    });
  }
  if (ctas.length > IOS_RULES.maxInlineActions) {
    iosActionScore = clamp(iosActionScore - 10, 0, 100);
    warnings.push({
      severity: "warning",
      platform: "ios",
      category: "actions",
      message: "More suggested actions may appear inside a dropdown on iOS.",
      recommendation:
        "iOS collapses 3+ actions into an “Options” dropdown; keep a single primary CTA visible (xPlatform Playbook s42).",
    });
  }
  if (replies.length > 3) {
    iosActionScore = clamp(iosActionScore - 8, 0, 100);
    androidActionScore = clamp(androidActionScore - 8, 0, 100);
    warnings.push({
      severity: "warning",
      platform: "both",
      category: "actions",
      message: "Rich cards support up to 3 suggested replies; extras may be dropped.",
      recommendation: "Keep at most 3 suggested replies per card (xPlatform Playbook s17).",
    });
  }
  if (actionCount > SUGGESTION_RULES.maxSuggestionsPerCard) {
    iosActionScore = clamp(iosActionScore - 20, 0, 100);
    androidActionScore = clamp(androidActionScore - 20, 0, 100);
    warnings.push({
      severity: "critical",
      platform: "both",
      category: "actions",
      message: `Rich cards support at most ${SUGGESTION_RULES.maxSuggestionsPerCard} suggestions (1 action + up to 3 replies); extras may be dropped.`,
      recommendation: "Remove suggestions beyond the first four (xPlatform Playbook s17).",
    });
  }
  const longLabels = actions.filter(
    (a) => a.label.length > SUGGESTION_RULES.maxSuggestionLabelChars,
  );
  if (longLabels.length > 0) {
    const penalty = Math.min(16, 8 * longLabels.length);
    iosActionScore = clamp(iosActionScore - penalty, 0, 100);
    androidActionScore = clamp(androidActionScore - penalty, 0, 100);
    warnings.push({
      severity: "warning",
      platform: "both",
      category: "actions",
      message: `${longLabels.length} action label(s) exceed the 25-character suggestion limit and will be cut off.`,
      recommendation: "Keep every suggestion label at 25 characters or fewer (xPlatform Playbook s17).",
    });
  }
  // [xPlatform s21] "Primary" = the first non-reply action by position.
  const firstAction = actions.find((a) => a.kind !== "reply");
  const primaryIsFirst = firstAction != null && actions[0]?.id === firstAction.id;
  if (ctas.length >= 2 && !primaryIsFirst) {
    recommendations.push({
      category: "actions",
      message:
        "Place the CTA action first — iOS always shows actions above replies (xPlatform Playbook s21).",
    });
  }
  // [xPlatform s21] An action placed AFTER a reply gets reordered above it on
  // iOS, so the authored order is misleading. A small penalty makes the
  // improver's reorder visible in the before/after delta.
  const firstReplyIndex = actions.findIndex((a) => a.kind === "reply");
  const actionAfterReply =
    firstReplyIndex >= 0 &&
    actions.some((a, i) => a.kind !== "reply" && i > firstReplyIndex);
  if (actionAfterReply) {
    iosActionScore = clamp(iosActionScore - 5, 0, 100);
    warnings.push({
      severity: "info",
      platform: "ios",
      category: "actions",
      message: "A suggested action is placed after a reply; iOS always shows actions above replies, changing the order.",
      recommendation: "Place the suggested action before the replies (xPlatform Playbook s21).",
    });
  }
  const insecureUrl = actions.find(
    (a) =>
      a.kind === "openUrl" &&
      a.value.trim() !== "" &&
      // URI schemes are case-insensitive (RFC 3986) — lowercase before checking.
      !a.value.trim().toLowerCase().startsWith("https://"),
  );
  if (insecureUrl) {
    warnings.push({
      severity: "info",
      platform: "both",
      category: "actions",
      message: `Open-URL action “${insecureUrl.label}” should use a full https:// URL.`,
      recommendation: "Use correct URLs starting with https:// (xPlatform Playbook s9).",
    });
  }

  return { ios: iosActionScore, android: androidActionScore, warnings, recommendations };
}

// ─────────────────────── Layout / platform risk (15%) ──────────────────────
export function scoreLayout(card: StandaloneRichCard): LayoutScore {
  const warnings: Warning[] = [];
  const recommendations: Recommendation[] = [];

  const orientation = card.cardOrientation;
  const mediaHeight = card.cardContent.media?.height ?? null;
  const title = card.cardContent.title ?? "";
  const description = card.cardContent.description ?? "";
  const hasMedia = card.cardContent.media != null;

  const iosLines = estimateTextLines(
    title,
    description,
    getPlatformRules("ios", orientation, mediaHeight, 0),
  );
  const androidLines = estimateTextLines(
    title,
    description,
    getPlatformRules("android", orientation, mediaHeight, 0),
  );
  const androidRules = getPlatformRules("android", orientation, mediaHeight, androidLines.totalLines);

  let layoutScore = 100;
  // s11 is cross-platform: penalise when EITHER platform exceeds 3 lines.
  const overRecommended =
    iosLines.totalLines > IOS_RULES.maxRecommendedTextLines ||
    androidLines.totalLines > IOS_RULES.maxRecommendedTextLines;
  if (iosLines.totalLines > IOS_RULES.tappableOverflowTotalLines) layoutScore -= 20;
  else if (overRecommended) layoutScore -= 10;
  if (!hasMedia) layoutScore -= 15;
  if (androidRules.cropSeverity === "high") layoutScore -= 10;
  if (orientation === "VERTICAL" && mediaHeight === "MEDIUM") {
    layoutScore -= 5;
    recommendations.push({
      category: "layout",
      message:
        "For cross-platform campaigns Google recommends the Tall (3:2) vertical card to minimize rendering differences (xPlatform Playbook s13).",
    });
  }
  layoutScore = clamp(layoutScore, 20, 100);

  return { score: layoutScore, warnings, recommendations };
}

// ───────────────────────────── Composition ─────────────────────────────────
export function scoreRcsContent(
  card: StandaloneRichCard,
  media?: MediaIntrospection,
  focal?: FocalPoint,
): ScoreResult {
  const text = scoreText(card);
  const image = scoreImage(card, media, focal);
  const actions = scoreActions(card);
  const layout = scoreLayout(card);

  // Push order (text, image, actions, layout) drives recommendation order;
  // the returned warnings list is sorted by severity separately.
  const orderedWarnings = [
    ...text.warnings,
    ...image.warnings,
    ...actions.warnings,
    ...layout.warnings,
  ];

  // Standalone recommendations first (actions, then layout), then every
  // warning's recommendation in push order, de-duplicated.
  const recommendations: Recommendation[] = [
    ...actions.recommendations,
    ...layout.recommendations,
  ];
  const seen = new Set(recommendations.map((r) => r.message));
  for (const w of orderedWarnings) {
    if (w.recommendation && !seen.has(w.recommendation)) {
      seen.add(w.recommendation);
      recommendations.push({ category: w.category, message: w.recommendation });
    }
  }

  const warnings = sortWarnings(orderedWarnings);

  const imageSafeZoneScore = Math.round((image.ios + image.android) / 2);
  const textFitScore = Math.round((text.ios + text.android) / 2);
  const actionScore = Math.round((actions.ios + actions.android) / 2);
  const layoutScore = layout.score;

  const overallScore = Math.round(
    WEIGHTS.image * imageSafeZoneScore +
      WEIGHTS.text * textFitScore +
      WEIGHTS.actions * actionScore +
      WEIGHTS.layout * layoutScore,
  );

  const platformTotal = (img: number, txt: number, act: number) =>
    WEIGHTS.image * img + WEIGHTS.text * txt + WEIGHTS.actions * act + WEIGHTS.layout * layoutScore;

  return {
    overallScore,
    iosScore: Math.round(platformTotal(image.ios, text.ios, actions.ios)),
    androidScore: Math.round(platformTotal(image.android, text.android, actions.android)),
    imageSafeZoneScore,
    textFitScore,
    actionScore,
    layoutScore,
    warnings,
    recommendations,
  };
}

const SEVERITY_ORDER: Record<Warning["severity"], number> = {
  critical: 0,
  warning: 1,
  info: 2,
};

function sortWarnings(warnings: Warning[]): Warning[] {
  return [...warnings].sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);
}
