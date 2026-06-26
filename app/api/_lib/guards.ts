import type { FocalPoint, MediaIntrospection, StandaloneRichCard } from "@/types/rcs";

export class BadRequestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BadRequest";
  }
}

export interface CardRequest {
  card: StandaloneRichCard;
  media?: MediaIntrospection;
  focal?: FocalPoint;
}

/**
 * Light structural guard for the scoring endpoints' shared body shape. Deeper
 * RCS-limit validity is delegated to validateFunctional. Throws BadRequestError
 * (→ HTTP 400) on a malformed shape.
 */
export function parseCardBody(body: unknown): CardRequest {
  if (typeof body !== "object" || body === null) {
    throw new BadRequestError("Request body must be a JSON object.");
  }
  const b = body as Record<string, unknown>;
  const card = b.card as Record<string, unknown> | undefined;
  if (typeof card !== "object" || card === null) {
    throw new BadRequestError("Body must include a 'card' object.");
  }
  if (card.type !== "standaloneRichCard") {
    throw new BadRequestError("card.type must be 'standaloneRichCard'.");
  }
  if (typeof card.cardContent !== "object" || card.cardContent === null) {
    throw new BadRequestError("card.cardContent is required.");
  }
  return {
    card: card as unknown as StandaloneRichCard,
    media: b.media as MediaIntrospection | undefined,
    focal: b.focal as FocalPoint | undefined,
  };
}
