import type {
  Action, CardContent, CardFormat, CardOrientation, FocalPoint, MediaHeight, MediaIntrospection,
  RcsAction, RcsContent, StandaloneRichCard, Suggestion,
} from "@/types/rcs";

export function cardFormatToOrientationHeight(cf: CardFormat): {
  orientation: CardOrientation;
  mediaHeight: MediaHeight | null;
} {
  switch (cf) {
    case "compact": return { orientation: "HORIZONTAL", mediaHeight: null };
    case "medium":  return { orientation: "VERTICAL", mediaHeight: "MEDIUM" };
    case "tall":    return { orientation: "VERTICAL", mediaHeight: "TALL" };
  }
}

const HEIGHT_TO_FORMAT = { MEDIUM: "medium", TALL: "tall" } as const;

export function legacyActionToSuggestion(a: RcsAction): Suggestion {
  if (a.type === "reply") return { type: "reply", text: a.label, postbackData: a.value };
  const action: Action = a.type === "dial"
    ? { type: "dialAction", phoneNumber: a.value }
    : { type: "openUrlAction", url: a.value };
  return { type: "action", text: a.label, action };
}

export function suggestionToLegacyAction(s: Suggestion, primary: boolean): RcsAction {
  // reply suggestions are never primary CTAs
  if (s.type === "reply") return { id: crypto.randomUUID(), type: "reply", label: s.text, value: s.postbackData ?? "" };
  const url = s.action.type === "openUrlAction" ? s.action.url
    : s.action.type === "dialAction" ? s.action.phoneNumber : "";
  const legacyType = s.action.type === "dialAction" ? "dial" : "openUrl";
  return { id: crypto.randomUUID(), type: legacyType, label: s.text, value: url, primary };
}

export function legacyToCard(c: RcsContent): {
  card: StandaloneRichCard; media: MediaIntrospection | undefined; focal: FocalPoint;
} {
  const { orientation, mediaHeight } = cardFormatToOrientationHeight(c.cardFormat);
  const cardContent: CardContent = {
    title: c.title || undefined,
    description: c.description || undefined,
    media: c.imageUrl
      ? { height: mediaHeight ?? "TALL", contentInfo: { fileUrl: c.imageUrl } }
      : undefined,
    suggestions: c.actions.length ? c.actions.map(legacyActionToSuggestion) : undefined,
  };
  const media: MediaIntrospection | undefined = c.imageMetadata
    ? { mediaType: "image", mimeType: "image/*",
        fileSizeBytes: 0, width: c.imageMetadata.width, height: c.imageMetadata.height,
        aspectRatio: c.imageMetadata.aspectRatio }
    : undefined;
  return {
    card: { type: "standaloneRichCard", cardOrientation: orientation, cardContent },
    media,
    focal: c.focalPoint,
  };
}

export function cardToLegacy(
  card: StandaloneRichCard, media: MediaIntrospection | undefined, focal: FocalPoint,
): RcsContent {
  const sugg = card.cardContent.suggestions ?? [];
  const firstActionIdx = sugg.findIndex((s) => s.type === "action");
  return {
    title: card.cardContent.title ?? "",
    description: card.cardContent.description ?? "",
    imageUrl: card.cardContent.media?.contentInfo.fileUrl ?? null,
    // safe: legacyToCard always sets width/height/aspectRatio together
    imageMetadata: media && media.width != null
      ? { width: media.width, height: media.height!, aspectRatio: media.aspectRatio! }
      : undefined,
    actions: sugg.map((s, i) => suggestionToLegacyAction(s, i === firstActionIdx)),
    focalPoint: focal,
    cardFormat: card.cardOrientation === "HORIZONTAL"
      ? "compact"
      : HEIGHT_TO_FORMAT[(card.cardContent.media?.height as "MEDIUM" | "TALL") ?? "TALL"],
  };
}
