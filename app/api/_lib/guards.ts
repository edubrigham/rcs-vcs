import type { StandaloneRichCard } from "@/types/rcs";

export class BadRequestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BadRequest";
  }
}

/**
 * Parse the request body as an RCS `rcsContentBody` standalone rich card — the
 * production API input (CIO: "the rcsContentBody is passed to the Simulator API
 * in the Input"). Light structural guard; deeper RCS-limit validity is delegated
 * to validateFunctional. Throws BadRequestError (→ HTTP 400) on a malformed shape.
 */
export function parseRcsContentBody(body: unknown): StandaloneRichCard {
  if (typeof body !== "object" || body === null) {
    throw new BadRequestError("Request body must be a JSON object (an rcsContentBody).");
  }
  const c = body as Record<string, unknown>;
  if (c.type !== "standaloneRichCard") {
    throw new BadRequestError("Body must be an rcsContentBody with type 'standaloneRichCard'.");
  }
  if (typeof c.cardContent !== "object" || c.cardContent === null) {
    throw new BadRequestError("cardContent is required.");
  }
  return body as StandaloneRichCard;
}
