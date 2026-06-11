/**
 * Deterministic, explainable scoring for RCS card content.
 *
 * Weights (per product spec):
 *   image safe zone 35% · text fit 30% · suggested actions 20% · layout risk 15%
 *
 * No AI involved: every number traces back to a playbook rule (see citations)
 * or an explicit threshold in this file.
 */

import {
  clamp,
  criticalSquareWindow,
  getVisibleWindow,
  pointInWindow,
  visibleAreaFraction,
} from "@/lib/cropMath";
import {
  estimateTextLines,
  getPlatformRules,
  IOS_RULES,
  recommendedAspectForFormat,
  SAFE_ZONE_RULES,
  SUGGESTION_RULES,
} from "@/lib/rcsRules";
import type {
  Platform,
  RcsContent,
  Recommendation,
  ScoreResult,
  Warning,
} from "@/types/rcs";

const WEIGHTS = { image: 0.35, text: 0.3, actions: 0.2, layout: 0.15 } as const;

const SAFE_LO = (1 - SAFE_ZONE_RULES.centralFraction) / 2; // 0.2
const SAFE_HI = 1 - SAFE_LO; // 0.8

interface PlatformBreakdown {
  image: number;
  text: number;
  actions: number;
}

export function scoreRcsContent(content: RcsContent): ScoreResult {
  const warnings: Warning[] = [];
  const recommendations: Recommendation[] = [];

  const perPlatform: Record<Platform, PlatformBreakdown> = {
    ios: { image: 100, text: 100, actions: 100 },
    android: { image: 100, text: 100, actions: 100 },
  };

  // ───────────────────────── Text fit (30%) ─────────────────────────
  const iosLines = estimateTextLines(
    content.title,
    content.description,
    getPlatformRules("ios", content.cardFormat, 0),
  );
  const androidLines = estimateTextLines(
    content.title,
    content.description,
    getPlatformRules("android", content.cardFormat, 0),
  );
  const iosRules = getPlatformRules("ios", content.cardFormat, iosLines.totalLines);
  const androidRules = getPlatformRules("android", content.cardFormat, androidLines.totalLines);

  const iosTitleOverflow = Math.max(0, iosLines.titleLines - iosRules.maxTitleLines);
  const iosDescOverflow = Math.max(0, iosLines.descriptionLines - iosRules.maxDescriptionLines);
  perPlatform.ios.text = clamp(100 - 15 * (iosTitleOverflow + iosDescOverflow), 20, 100);

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
    perPlatform.ios.text = clamp(perPlatform.ios.text - 20, 10, 100);
  } else if (iosLines.totalLines > IOS_RULES.maxRecommendedTextLines) {
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
  perPlatform.android.text = clamp(100 - 8 * androidDescOverflow, 30, 100);
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

  // ─────────────────── Image & safe zone (35%) ───────────────────
  let imageScoreIos = 100;
  let imageScoreAndroid = 100;

  if (!content.imageUrl || !content.imageMetadata) {
    imageScoreIos = 55;
    imageScoreAndroid = 55;
    warnings.push({
      severity: "info",
      platform: "both",
      category: "image",
      message: "No media uploaded yet — rich cards perform best with an image.",
      recommendation: "Upload an image to evaluate cropping and safe-zone risk.",
    });
  } else {
    const aspect = content.imageMetadata.aspectRatio;
    const focal = content.focalPoint;

    // Android: center crop into the format's media container [xPlatform s28].
    const androidWindow = getVisibleWindow(
      aspect,
      androidRules.mediaWidth / androidRules.mediaHeight,
    );
    const focalInsideAndroidCrop = pointInWindow(focal, androidWindow);
    const focalInsideSafeZone =
      focal.x >= SAFE_LO && focal.x <= SAFE_HI && focal.y >= SAFE_LO && focal.y <= SAFE_HI;

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

    // iOS: compact format renders a 60x60 DP square thumbnail [xPlatform s15].
    if (content.cardFormat === "compact") {
      const square = criticalSquareWindow(aspect);
      if (!pointInWindow(focal, square)) {
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
      if (aspect > 1.4 || aspect < 0.4) {
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
      const extreme =
        aspect > IOS_RULES.extremeAspectAbove || aspect < IOS_RULES.extremeAspectBelow;
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

    // Recommended source ratio per format.
    const rec = recommendedAspectForFormat(content.cardFormat);
    if (Math.abs(aspect - rec.aspect) / rec.aspect > 0.25) {
      warnings.push({
        severity: "info",
        platform: "both",
        category: "image",
        message: `The uploaded image (${aspect.toFixed(2)}:1) deviates from the recommended ${rec.label} ratio for this format.`,
        recommendation: `Export the asset at ${rec.label} (${rec.citation}).`,
      });
    }
  }

  perPlatform.ios.image = imageScoreIos;
  perPlatform.android.image = imageScoreAndroid;

  // ───────────────────── Suggested actions (20%) ─────────────────────
  // The playbooks treat suggested ACTIONS (device actions: open URL, dial)
  // and suggested REPLIES differently: the recommended pattern is a single
  // CTA action plus up to 3 replies [xPlatform s11, s17], and only ACTIONS
  // collapse into the iOS "Options" dropdown [xPlatform s42].
  const ctas = content.actions.filter((a) => a.type !== "reply");
  const replies = content.actions.filter((a) => a.type === "reply");
  const actionCount = content.actions.length;

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
  const longLabels = content.actions.filter(
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
  if (ctas.length >= 2 && !ctas.some((a) => a.primary)) {
    recommendations.push({
      category: "actions",
      message:
        "Mark one action as primary and place it first — iOS always shows actions above replies (xPlatform Playbook s21).",
    });
  }
  const insecureUrl = content.actions.find(
    (a) => a.type === "openUrl" && a.value.trim() !== "" && !a.value.trim().startsWith("https://"),
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

  perPlatform.ios.actions = iosActionScore;
  perPlatform.android.actions = androidActionScore;

  // ─────────────────── Layout / platform risk (15%) ───────────────────
  let layoutScore = 100;
  if (iosLines.totalLines > IOS_RULES.tappableOverflowTotalLines) layoutScore -= 20;
  else if (iosLines.totalLines > IOS_RULES.maxRecommendedTextLines) layoutScore -= 10;
  if (!content.imageUrl) layoutScore -= 15;
  if (androidRules.cropSeverity === "high") layoutScore -= 10;
  if (content.cardFormat === "medium") {
    layoutScore -= 5;
    recommendations.push({
      category: "layout",
      message:
        "For cross-platform campaigns Google recommends the Tall (3:2) vertical card to minimize rendering differences (xPlatform Playbook s13).",
    });
  }
  layoutScore = clamp(layoutScore, 20, 100);

  // ───────────────────────── Aggregate ─────────────────────────
  const platformTotal = (p: PlatformBreakdown) =>
    WEIGHTS.image * p.image +
    WEIGHTS.text * p.text +
    WEIGHTS.actions * p.actions +
    WEIGHTS.layout * layoutScore;

  const imageSafeZoneScore = Math.round((imageScoreIos + imageScoreAndroid) / 2);
  const textFitScore = Math.round((perPlatform.ios.text + perPlatform.android.text) / 2);
  const actionScore = Math.round((iosActionScore + androidActionScore) / 2);

  const overallScore = Math.round(
    WEIGHTS.image * imageSafeZoneScore +
      WEIGHTS.text * textFitScore +
      WEIGHTS.actions * actionScore +
      WEIGHTS.layout * layoutScore,
  );

  // Surface every warning's recommendation, de-duplicated.
  const seen = new Set(recommendations.map((r) => r.message));
  for (const w of warnings) {
    if (w.recommendation && !seen.has(w.recommendation)) {
      seen.add(w.recommendation);
      recommendations.push({ category: w.category, message: w.recommendation });
    }
  }

  return {
    overallScore,
    iosScore: Math.round(platformTotal(perPlatform.ios)),
    androidScore: Math.round(platformTotal(perPlatform.android)),
    imageSafeZoneScore,
    textFitScore,
    actionScore,
    layoutScore,
    warnings: sortWarnings(warnings),
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
