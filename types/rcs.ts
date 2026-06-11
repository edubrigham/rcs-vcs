/**
 * Core domain types for the RCS Visual Compatibility Simulator.
 *
 * Sources of truth:
 *  - Google "RCS for Business: Card Media Playbook" (March 2026)  → cited as [CardMedia pN]
 *  - Google "RCS for Business: X-Platform Playbook" (April 2026)  → cited as [xPlatform sN]
 */

export type Platform = "ios" | "android";

export type CardFormat = "compact" | "medium" | "tall";

export type RcsActionType = "openUrl" | "dial" | "reply";

export interface RcsAction {
  id: string;
  type: RcsActionType;
  label: string;
  value: string;
  primary?: boolean;
}

/** Normalized image coordinates: { x: 0..1, y: 0..1 } from the top-left corner. */
export interface FocalPoint {
  x: number;
  y: number;
}

export interface ImageMetadata {
  width: number;
  height: number;
  /** width / height */
  aspectRatio: number;
}

export interface RcsContent {
  title: string;
  description: string;
  imageUrl: string | null;
  imageMetadata?: ImageMetadata;
  actions: RcsAction[];
  focalPoint: FocalPoint;
  cardFormat: CardFormat;
}

/**
 * Per-platform, per-format render rules resolved from the playbooks.
 * Dimensions are in DP; this MVP treats 1 DP = 1 CSS px.
 */
export interface PlatformRenderRules {
  mediaWidth: number;
  mediaHeight: number;
  maxTitleLines: number;
  maxDescriptionLines: number;
  maxVisibleActions: number;
  usesActionDropdown: boolean;
  cropSeverity: "low" | "medium" | "high";
  /** Layout family the platform uses for this card format. */
  mediaLayout: "thumbnail" | "horizontal" | "vertical";
  /** Approx. characters per rendered line, used for deterministic line estimates. */
  titleCharsPerLine: number;
  descriptionCharsPerLine: number;
}

export type WarningSeverity = "info" | "warning" | "critical";
export type WarningCategory = "image" | "text" | "actions" | "layout";

export interface Warning {
  severity: WarningSeverity;
  platform: Platform | "both";
  category: WarningCategory;
  message: string;
  recommendation?: string;
}

export interface Recommendation {
  category: WarningCategory;
  message: string;
}

export interface ScoreResult {
  overallScore: number;
  iosScore: number;
  androidScore: number;
  imageSafeZoneScore: number;
  textFitScore: number;
  actionScore: number;
  /** General layout / platform-parity risk (15% weight). */
  layoutScore: number;
  warnings: Warning[];
  recommendations: Recommendation[];
}

export interface ImprovedRcsContent {
  improvedContent: RcsContent;
  /** Non-primary actions moved out of the card [xPlatform s11: a single CTA]. */
  secondaryActions: RcsAction[];
  changes: string[];
}

export interface OverlayToggles {
  showSafeZone: boolean;
  showCropArea: boolean;
  showTextLineLimits: boolean;
}
