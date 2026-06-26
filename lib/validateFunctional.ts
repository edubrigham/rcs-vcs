/**
 * Functional-compliance pre-flight: would the Naxai `sendRCS` API accept this
 * card? Binary pass/fail against the API's hard limits (a `422` otherwise) —
 * distinct from the gradual 0–100 quality score. Only checks computable from a
 * single `standaloneRichCard` + its introspected media.
 */

import { FUNCTIONAL_LIMITS as L, SUPPORTED_IMAGE_MIME, SUPPORTED_VIDEO_MIME } from "@/lib/rcsRules";
import type { FunctionalResult, FunctionalViolation, MediaIntrospection, StandaloneRichCard } from "@/types/rcs";

const OPENAPI = "Naxai sendRCS";
const GUIDE = "RBM rich-cards";

export function validateFunctional(card: StandaloneRichCard, media?: MediaIntrospection): FunctionalResult {
  const v: FunctionalViolation[] = [];
  const c = card.cardContent;
  const title = c.title ?? "";
  const desc = c.description ?? "";
  const sugg = c.suggestions ?? [];

  if (!c.title && !c.description && !c.media) {
    v.push({ limit: "emptyCard", message: "A card must include at least a title, description, or media.", actual: "empty", citation: GUIDE });
  }
  if (title.length > L.TITLE_MAX) {
    v.push({ limit: "titleLength", message: `Title exceeds ${L.TITLE_MAX} characters.`, actual: title.length, max: L.TITLE_MAX, citation: OPENAPI });
  }
  if (desc.length > L.DESCRIPTION_MAX) {
    v.push({ limit: "descriptionLength", message: `Description exceeds ${L.DESCRIPTION_MAX} characters.`, actual: desc.length, max: L.DESCRIPTION_MAX, citation: OPENAPI });
  }
  if (sugg.length > L.SUGGESTION_MAX) {
    v.push({ limit: "suggestionCount", message: `A card allows at most ${L.SUGGESTION_MAX} suggestions.`, actual: sugg.length, max: L.SUGGESTION_MAX, citation: OPENAPI });
  }
  for (const s of sugg) {
    if (s.text.length > L.LABEL_MAX) {
      v.push({ limit: "labelLength", message: `Suggestion “${s.text.slice(0, 12)}…” exceeds ${L.LABEL_MAX} characters.`, actual: s.text.length, max: L.LABEL_MAX, citation: OPENAPI });
    }
  }
  for (const s of sugg) {
    if (s.type === "action" && s.action.type === "openUrlAction" && s.action.url.length > L.OPEN_URL_MAX) {
      v.push({ limit: "openUrlLength", message: `Open-URL action exceeds ${L.OPEN_URL_MAX} characters.`, actual: s.action.url.length, max: L.OPEN_URL_MAX, citation: OPENAPI });
    }
  }
  if (media?.thumbnailSizeBytes != null && media.thumbnailSizeBytes > L.THUMBNAIL_MAX_BYTES) {
    v.push({ limit: "thumbnailSize", message: `Thumbnail exceeds ${L.THUMBNAIL_MAX_BYTES / 1000} kB.`, actual: media.thumbnailSizeBytes, max: L.THUMBNAIL_MAX_BYTES, citation: OPENAPI });
  }
  if (media) {
    const allow: readonly string[] = media.mediaType === "image" ? SUPPORTED_IMAGE_MIME : SUPPORTED_VIDEO_MIME;
    if (!allow.includes(media.mimeType)) {
      v.push({ limit: "mediaType", message: `Unsupported media type “${media.mimeType}”.`, actual: media.mimeType, citation: GUIDE });
    }
  }

  return { passes: v.length === 0, violations: v };
}
