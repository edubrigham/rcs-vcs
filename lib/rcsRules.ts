/**
 * Platform render rules derived from the Google RCS for Business playbooks.
 *
 * Citations:
 *  - [CardMedia pN] = "Card Media Playbook", March 2026, PDF page N
 *    https://www.gstatic.com/rbm-devsite/ux/CardMediaPlaybook_March2026.pdf
 *  - [xPlatform sN] = "X-Platform Playbook", April 2026, slide/PDF page N
 *    https://www.gstatic.com/rbm-devsite/ux/xPlatformPlaybook_April2026.pdf
 *
 * Card format mapping used by this simulator:
 *  - "compact" → Horizontal Rich Card  [xPlatform s15-s16, CardMedia p13]
 *  - "medium"  → Vertical Rich Card, medium media (21:9 container) [CardMedia p8]
 *  - "tall"    → Vertical Rich Card, tall media (3:2 container)    [CardMedia p8]
 *
 * This MVP treats 1 DP = 1 CSS px.
 *
 * TODO: replace approximate rules with complete extracted rules from Google
 * playbooks (see /skills/rcs-playbook-rules for the extracted reference docs).
 */

import { applyVerticalCrop, getVisibleWindow, type VisibleWindow } from "@/lib/cropMath";
import { cardFormatToOrientationHeight } from "@/lib/model/cardModel";
import type { CardFormat, CardOrientation, MediaHeight, Platform, PlatformRenderRules } from "@/types/rcs";

export const IOS_RULES = {
  /** [xPlatform s15] "iOS renders the media at 60x60 DP." (Horizontal Rich Card) */
  compactMediaSizeDp: 60,
  /** [xPlatform s11/s13] "3 lines of title & description text max." */
  maxRecommendedTextLines: 3,
  /** [xPlatform s13] "Longer texts will get truncated on iOS." */
  truncatesLongText: true,
  /** [xPlatform s42] actions collapse into an "Options" dropdown "if more than 2". */
  usesActionDropdownForExtraActions: true,
  /** [xPlatform s31/s35/s42] dropdown threshold. */
  maxInlineActions: 2,
  /**
   * [xPlatform s23] If title + description exceed 6 lines in total, the whole
   * card becomes tappable and full text opens on a separate page WITHOUT media
   * or suggestions (200 chars title / 2000 chars description).
   */
  tappableOverflowTotalLines: 6,
  /**
   * [CardMedia p28] iOS vertical cards preserve the native aspect ratio and
   * avoid cropping "unless the format is extreme (ultra-wide or portrait) or
   * text content is long". We treat these bounds as "extreme".
   */
  extremeAspectAbove: 2.2,
  extremeAspectBelow: 0.5,
  /** Cap (DP) we apply to iOS vertical-card media height in the simulation. */
  verticalMediaHeightCap: 240,
  /** Format-specific vertical-card caps (DP): medium 21:9, tall 3:2. */
  verticalFormatMediaHeightCap: {
    medium: 132,
    tall: 204,
  },
  /**
   * [xPlatform s23] iOS overflow full-text-page content caps: beyond these the
   * text is hard-truncated even on the separate page.
   */
  titleFullTextCapChars: 200,
  descriptionFullTextCapChars: 2000,
  /**
   * Compact 60×60 thumbnail suitability bounds — a simulator heuristic (NOT a
   * playbook number): an asset far from square reads poorly as a tiny square.
   * Kept distinct from the vertical-card extremeAspect bounds above.
   */
  compactThumbnailAspectAbove: 1.4,
  compactThumbnailAspectBelow: 0.4,
} as const;

/**
 * How far the uploaded source ratio may stray from a format's recommended ratio
 * before we warn. Simulator tolerance — the playbook gives no numeric value.
 */
export const RATIO_DEVIATION_TOLERANCE = 0.25;

export const ANDROID_RULES = {
  /** [xPlatform s15] "On Android, vertical cropping becomes more severe with longer texts." */
  cropIncreasesWithTextLength: true,
  /** [xPlatform s11] same 3-line recommendation as iOS. */
  maxRecommendedTextLines: 3,
  /** [CardMedia p13] Horizontal Rich Card "utilizes a fixed media width of 128dp". */
  horizontalCardMediaWidthDp: 128,
  /** [xPlatform s25] Android caps card length at 576px, then shows a "More" page. */
  maxCardLengthPx: 576,
  /** [xPlatform s28] "Android applies center cropping to all portrait media." */
  centerCropsPortraitMedia: true,
  /**
   * [CardMedia p8] Vertical Rich Card best aspect ratios (container shapes):
   * short 7:2, medium 21:9, tall 3:2.
   */
  verticalContainerAspect: { short: 7 / 2, medium: 21 / 9, tall: 3 / 2 },
} as const;

export const SUGGESTION_RULES = {
  /** [xPlatform s17] "Up to 4 suggestions: 1 action and up to 3 replies." */
  maxSuggestionsPerCard: 4,
  /** [xPlatform s17] "25 characters max per each suggestion." */
  maxSuggestionLabelChars: 25,
  /** [xPlatform s11] "A single CTA (suggested action)" is the recommended pattern. */
  recommendedCtaCount: 1,
} as const;

export const SAFE_ZONE_RULES = {
  /**
   * Default central safe zone for this MVP: central 60% of width and height
   * (per product spec — deliberately conservative for demo clarity).
   * The playbooks themselves recommend a min. 5% edge safe zone
   * [xPlatform s12/s16] and keeping critical content within the central
   * 80–90% of the image [CardMedia p39].
   */
  centralFraction: 0.6,
  /** [xPlatform s16] compact cards add a centered 1:1 critical content area. */
  compactRequiresCentralSquare: true,
} as const;

/** Card content width (DP≈px) inside the chat, per platform. Approximation. */
export const CARD_WIDTH: Record<Platform, number> = {
  android: 280,
  ios: 272,
};

/**
 * Deterministic, explainable line estimate: greedy word wrap at a fixed
 * characters-per-line budget. Real rendering varies with device font size and
 * orientation [xPlatform s11], which is exactly why the simulator surfaces a
 * range rather than pretending to be pixel-perfect.
 */
export function estimateLines(text: string, charsPerLine: number): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  const words = trimmed.split(/\s+/);
  let lines = 1;
  let current = 0;
  for (const word of words) {
    const needed = word.length + (current > 0 ? 1 : 0);
    if (current > 0 && current + needed > charsPerLine) {
      lines += 1;
      current = word.length;
    } else {
      current += needed;
    }
  }
  return lines;
}

export interface TextLineEstimate {
  titleLines: number;
  descriptionLines: number;
  totalLines: number;
}

export function estimateTextLines(
  title: string,
  description: string,
  rules: Pick<PlatformRenderRules, "titleCharsPerLine" | "descriptionCharsPerLine">,
): TextLineEstimate {
  const titleLines = estimateLines(title, rules.titleCharsPerLine);
  const descriptionLines = estimateLines(description, rules.descriptionCharsPerLine);
  return { titleLines, descriptionLines, totalLines: titleLines + descriptionLines };
}

/**
 * Crop severity from estimated total text lines.
 * [xPlatform s15] documents the direction (longer text → more severe vertical
 * cropping on Android); the thresholds below are this simulator's explainable
 * approximation around the recommended 3-line budget [xPlatform s11] and the
 * 6-line iOS overflow threshold [xPlatform s23].
 */
export function cropSeverityForLines(totalLines: number): "low" | "medium" | "high" {
  if (totalLines <= ANDROID_RULES.maxRecommendedTextLines) return "low";
  if (totalLines <= IOS_RULES.tappableOverflowTotalLines) return "medium";
  return "high";
}

/**
 * Fraction of the cover window's HEIGHT that survives at each text severity,
 * modelling [xPlatform s15] "Android vertical cropping becomes more severe with
 * longer texts". The media container aspect is FIXED per format; longer text
 * punches a larger centred vertical slice out of the image. Because this only
 * ever shrinks the window, the surviving area is guaranteed MONOTONICALLY
 * non-increasing as text grows — for every image aspect — which a
 * text-driven container-aspect change could not guarantee (the cropped axis
 * could flip and reduce crop). The magnitudes are a documented approximation;
 * only the direction is from the playbook.
 */
const ANDROID_VERTICAL_CROP_KEEP: Record<"low" | "medium" | "high", number> = {
  low: 1,
  medium: 0.82,
  high: 0.62,
};

/**
 * Resolves the render rules for a platform + card orientation + media height +
 * current text. `totalTextLines` should come from `estimateTextLines` for the
 * same platform.
 *
 * Orientation × mediaHeight cells:
 *  - HORIZONTAL + null  → Horizontal Rich Card (formerly "compact")
 *  - VERTICAL + MEDIUM  → Vertical Rich Card, medium container (21:9)
 *  - VERTICAL + TALL    → Vertical Rich Card, tall container   (3:2)
 */
export function getPlatformRules(
  platform: Platform,
  orientation: CardOrientation,
  mediaHeight: MediaHeight | null,
  totalTextLines: number,
): PlatformRenderRules {
  const severity = cropSeverityForLines(totalTextLines);

  if (platform === "ios") {
    if (orientation === "HORIZONTAL") {
      // [xPlatform s15] Horizontal Rich Card on iOS: 60x60 DP thumbnail.
      return {
        mediaWidth: IOS_RULES.compactMediaSizeDp,
        mediaHeight: IOS_RULES.compactMediaSizeDp,
        maxTitleLines: 1,
        maxDescriptionLines: 2,
        maxVisibleActions: IOS_RULES.maxInlineActions,
        usesActionDropdown: true,
        cropSeverity: "high", // a 60x60 square from any real asset is a severe crop
        mediaLayout: "thumbnail",
        titleCharsPerLine: 24,
        descriptionCharsPerLine: 30,
      };
    }
    // [CardMedia p28] iOS vertical cards keep native aspect; the height
    // parameter selects the container family (MEDIUM 21:9 vs TALL 3:2),
    // so we apply distinct caps. Long text tightens the cap.
    const baseCap =
      mediaHeight === "MEDIUM"
        ? IOS_RULES.verticalFormatMediaHeightCap.medium
        : IOS_RULES.verticalFormatMediaHeightCap.tall;
    const cap =
      severity === "low"
        ? baseCap
        : Math.round(baseCap * 0.85);
    return {
      mediaWidth: CARD_WIDTH.ios,
      mediaHeight: cap,
      maxTitleLines: 2,
      maxDescriptionLines: 3,
      maxVisibleActions: IOS_RULES.maxInlineActions,
      usesActionDropdown: true,
      cropSeverity: severity === "low" ? "low" : "medium",
      mediaLayout: "vertical",
      titleCharsPerLine: 28,
      descriptionCharsPerLine: 36,
    };
  }

  // ─── Android ───
  // Media box size is FIXED per orientation/height (independent of text);
  // "more crop with longer text" is modelled by androidCropWindow's vertical
  // punch-in, not by shrinking the box (see ANDROID_VERTICAL_CROP_KEEP).
  if (orientation === "HORIZONTAL") {
    // [CardMedia p13] fixed 128dp media width.
    return {
      mediaWidth: ANDROID_RULES.horizontalCardMediaWidthDp,
      mediaHeight: 204,
      maxTitleLines: 2,
      maxDescriptionLines: 4,
      maxVisibleActions: SUGGESTION_RULES.maxSuggestionsPerCard,
      usesActionDropdown: false,
      cropSeverity: severity,
      mediaLayout: "horizontal",
      titleCharsPerLine: 16,
      descriptionCharsPerLine: 21,
    };
  }

  const containerAspect =
    mediaHeight === "MEDIUM"
      ? ANDROID_RULES.verticalContainerAspect.medium // 21:9 [CardMedia p8]
      : ANDROID_RULES.verticalContainerAspect.tall; // 3:2  [CardMedia p8]
  return {
    mediaWidth: CARD_WIDTH.android,
    mediaHeight: Math.round(CARD_WIDTH.android / containerAspect),
    maxTitleLines: 2,
    maxDescriptionLines: 5, // beyond this Android heads toward the 576px "More" page [xPlatform s25]
    maxVisibleActions: SUGGESTION_RULES.maxSuggestionsPerCard,
    usesActionDropdown: false,
    cropSeverity: severity,
    mediaLayout: "vertical",
    titleCharsPerLine: 30,
    descriptionCharsPerLine: 38,
  };
}

/** Legacy shim: resolves rules from a CardFormat by delegating via cardFormatToOrientationHeight. */
export function getPlatformRulesByFormat(
  platform: Platform,
  cardFormat: CardFormat,
  totalTextLines: number,
): PlatformRenderRules {
  const { orientation, mediaHeight } = cardFormatToOrientationHeight(cardFormat);
  return getPlatformRules(platform, orientation, mediaHeight, totalTextLines);
}

/**
 * The part of the source image visible inside the Android media container for a
 * given orientation+mediaHeight and text length: the fixed-container cover crop,
 * then a centred vertical punch-in that grows with text severity [xPlatform s15].
 * Guaranteed monotonic: more text → never more visible area. Shared by the
 * scorer and the preview so "what we score" and "what we draw" cannot diverge.
 */
export function androidCropWindow(
  imageAspect: number,
  orientation: CardOrientation,
  mediaHeight: MediaHeight | null,
  totalTextLines: number,
): VisibleWindow {
  const rules = getPlatformRules("android", orientation, mediaHeight, totalTextLines);
  const base = getVisibleWindow(imageAspect, rules.mediaWidth / rules.mediaHeight);
  return applyVerticalCrop(base, ANDROID_VERTICAL_CROP_KEEP[rules.cropSeverity]);
}

/** Legacy shim: androidCropWindow keyed by CardFormat. */
export function androidCropWindowByFormat(
  imageAspect: number,
  cardFormat: CardFormat,
  totalTextLines: number,
): VisibleWindow {
  const { orientation, mediaHeight } = cardFormatToOrientationHeight(cardFormat);
  return androidCropWindow(imageAspect, orientation, mediaHeight, totalTextLines);
}

/** Recommended source-asset aspect ratio per orientation+mediaHeight [xPlatform s12/s16, CardMedia p8]. */
export function recommendedAspectForOrientation(
  orientation: CardOrientation,
  mediaHeight: MediaHeight | null,
): {
  aspect: number;
  label: string;
  citation: string;
} {
  if (orientation === "HORIZONTAL") {
    return { aspect: 9 / 16, label: "9:16", citation: "xPlatform Playbook s15-s16" };
  }
  if (mediaHeight === "MEDIUM") {
    return { aspect: 21 / 9, label: "21:9", citation: "Card Media Playbook p8" };
  }
  // VERTICAL + TALL (default for vertical)
  // Comma-separated so the citation parser splits the two sources.
  return { aspect: 3 / 2, label: "3:2", citation: "Card Media Playbook p8, xPlatform s12" };
}

/** Legacy shim: recommendedAspectForOrientation keyed by CardFormat. */
export function recommendedAspectForFormat(cardFormat: CardFormat): {
  aspect: number;
  label: string;
  citation: string;
} {
  const { orientation, mediaHeight } = cardFormatToOrientationHeight(cardFormat);
  return recommendedAspectForOrientation(orientation, mediaHeight);
}
