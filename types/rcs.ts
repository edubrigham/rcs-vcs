/**
 * Core domain types for the RCS Visual Compatibility Simulator.
 *
 * Sources of truth:
 *  - Google "RCS for Business: Card Media Playbook" (March 2026)  → cited as [CardMedia pN]
 *  - Google "RCS for Business: X-Platform Playbook" (April 2026)  → cited as [xPlatform sN]
 */

export type Platform = "ios" | "android";

export type CardFormat = "compact" | "medium" | "tall";

// Naxai-aligned types
export type CardOrientation = "HORIZONTAL" | "VERTICAL";
export type MediaHeight = "SHORT" | "MEDIUM" | "TALL";
export type MediaType = "image" | "video";

export interface ContentInfo {
  fileUrl: string;
  thumbnailUrl?: string;
  forceRefresh?: boolean;
}
export interface Media {
  height: MediaHeight;
  contentInfo: ContentInfo;
}

export type Action =
  | { type: "openUrlAction"; url: string }
  | { type: "dialAction"; phoneNumber: string }
  | { type: "viewLocationAction"; latitude: number; longitude: number; label?: string }
  | { type: "createCalendarEventAction"; startTime: string; endTime: string; title: string; description: string };
export interface SuggestedReply {
  type: "reply";
  text: string;
  postbackData?: string;
}
export interface SuggestedAction {
  type: "action";
  text: string;
  postbackData?: string;
  action: Action;
}
export type Suggestion = SuggestedReply | SuggestedAction;

export interface CardContent {
  title?: string;
  description?: string;
  media?: Media;
  suggestions?: Suggestion[];
}
export interface StandaloneRichCard {
  type: "standaloneRichCard";
  cardOrientation: CardOrientation;
  thumbnailImageAlignment?: "LEFT" | "RIGHT";
  cardContent: CardContent;
}

/** A plain-text message [rcsContentBody.oneOf → messageText]. */
export interface MessageText {
  type: "text";
  /** ≤ 2000 chars. */
  text: string;
}

/**
 * The RCS Broadcasts API `rcsContentBody` — the exact object the Simulator API
 * receives as input. Discriminated union on `type`. The carousel arm
 * (`CarouselRichCard`) lands in Spec 2.
 */
export type RcsContentBody = MessageText | StandaloneRichCard;

export interface MediaIntrospection {
  mediaType: MediaType;
  mimeType: string;
  fileSizeBytes: number;
  thumbnailSizeBytes?: number;
  width?: number; // image only
  height?: number; // image only
  aspectRatio?: number; // image only
}

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

/** Which part of the card an improvement change applies to (for grouping). */
export type ImprovementCategory = "text" | "image" | "actions" | "format" | "general";

export interface ImprovementChange {
  category: ImprovementCategory;
  /** Human-readable change, ending with a "(citation)" the UI parses into chips. */
  message: string;
}

export interface ImprovedRcsContent {
  improvedContent: RcsContent;
  /** Non-primary actions moved out of the card [xPlatform s11: a single CTA]. */
  secondaryActions: RcsAction[];
  changes: ImprovementChange[];
}

export interface OverlayToggles {
  showSafeZone: boolean;
  showCropArea: boolean;
  showTextLineLimits: boolean;
}
