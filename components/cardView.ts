/**
 * PRESENTATION view-model for the disposable PoC shell (NOT the kernel).
 *
 * The kernel (`lib/`) speaks the native Naxai model (`StandaloneRichCard` +
 * `MediaIntrospection` + `FocalPoint`). The large legacy UI components
 * (`RcsCardPreview`, `RcsInputPanel`, `BeforeAfterComparison`) author/render a
 * flat shape; this module converts between the two at the page boundary so the
 * shell did not need a risky rewrite. Porters ignore `components/` — this view
 * is shell-only and never reaches the ported logic.
 */

import { DEFAULT_CARD, DEFAULT_FOCAL, DEFAULT_MEDIA } from "@/lib/sampleContent";
import type { Action, FocalPoint, MediaHeight, MediaIntrospection, StandaloneRichCard, Suggestion } from "@/types/rcs";

export type ViewActionType = "openUrl" | "dial" | "reply";
export interface ViewAction { id: string; type: ViewActionType; label: string; value: string }

export interface CardView {
  title: string;
  description: string;
  imageUrl: string | null;
  imageMetadata?: { width: number; height: number; aspectRatio: number };
  actions: ViewAction[];
  focalPoint: FocalPoint;
  orientation: "HORIZONTAL" | "VERTICAL";
  height: MediaHeight;
}

export function suggestionToView(s: Suggestion, i: number): ViewAction {
  if (s.type === "reply") return { id: String(i), type: "reply", label: s.text, value: s.postbackData ?? "" };
  const value =
    s.action.type === "openUrlAction" ? s.action.url : s.action.type === "dialAction" ? s.action.phoneNumber : "";
  const type: ViewActionType = s.action.type === "dialAction" ? "dial" : "openUrl";
  return { id: String(i), type, label: s.text, value };
}

export function suggestionsToViews(suggestions: Suggestion[]): ViewAction[] {
  return suggestions.map(suggestionToView);
}

function viewActionToSuggestion(a: ViewAction): Suggestion {
  if (a.type === "reply") return { type: "reply", text: a.label, postbackData: a.value };
  const action: Action = a.type === "dial" ? { type: "dialAction", phoneNumber: a.value } : { type: "openUrlAction", url: a.value };
  return { type: "action", text: a.label, action };
}

export function cardToView(
  card: StandaloneRichCard,
  media: MediaIntrospection | undefined,
  focal: FocalPoint,
): CardView {
  return {
    title: card.cardContent.title ?? "",
    description: card.cardContent.description ?? "",
    imageUrl: card.cardContent.media?.contentInfo.fileUrl ?? null,
    imageMetadata:
      media && media.width != null && media.height != null && media.aspectRatio != null
        ? { width: media.width, height: media.height, aspectRatio: media.aspectRatio }
        : undefined,
    actions: suggestionsToViews(card.cardContent.suggestions ?? []),
    focalPoint: focal,
    orientation: card.cardOrientation,
    height: card.cardContent.media?.height ?? "TALL",
  };
}

export function viewToParts(
  view: CardView,
  prevMedia?: MediaIntrospection,
): { card: StandaloneRichCard; media: MediaIntrospection | undefined; focal: FocalPoint } {
  const media: MediaIntrospection | undefined = view.imageMetadata
    ? {
        mediaType: prevMedia?.mediaType ?? "image",
        mimeType: prevMedia?.mimeType ?? "image/*",
        fileSizeBytes: prevMedia?.fileSizeBytes ?? 0,
        width: view.imageMetadata.width,
        height: view.imageMetadata.height,
        aspectRatio: view.imageMetadata.aspectRatio,
      }
    : undefined;
  const card: StandaloneRichCard = {
    type: "standaloneRichCard",
    cardOrientation: view.orientation,
    cardContent: {
      title: view.title || undefined,
      description: view.description || undefined,
      media: view.imageUrl ? { height: view.height, contentInfo: { fileUrl: view.imageUrl } } : undefined,
      suggestions: view.actions.length ? view.actions.map(viewActionToSuggestion) : undefined,
    },
  };
  return { card, media, focal: view.focalPoint };
}

export const DEFAULT_VIEW: CardView = cardToView(DEFAULT_CARD, DEFAULT_MEDIA, DEFAULT_FOCAL);
