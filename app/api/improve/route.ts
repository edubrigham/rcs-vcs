import { parseRcsContentBody } from "@/app/api/_lib/guards";
import { introspectCardMedia } from "@/app/api/_lib/fetchMedia";
import { scoreRcsContent } from "@/lib/scoreRcsContent";
import { improveRcsContent } from "@/lib/improveRcsContent";

export const runtime = "nodejs";
export const maxDuration = 10; // derives media by fetching the card's media URL

export async function POST(request: Request) {
  try {
    const card = parseRcsContentBody(await request.json());
    const media = await introspectCardMedia(card);
    const score = scoreRcsContent(card, media);
    return Response.json(improveRcsContent(card, media, undefined, score)); // focal undefined: production has none
  } catch (e) {
    const err = e as Error;
    return Response.json({ error: err.name || "Error", message: err.message }, { status: 400 });
  }
}
