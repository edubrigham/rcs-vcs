import { parseRcsContentBody } from "@/app/api/_lib/guards";
import { introspectCardMedia } from "@/app/api/_lib/fetchMedia";
import { scoreRcsContent } from "@/lib/scoreRcsContent";

export const runtime = "nodejs";
export const maxDuration = 10; // derives media by fetching the card's media URL

export async function POST(request: Request) {
  try {
    const card = parseRcsContentBody(await request.json());
    const media = await introspectCardMedia(card);
    return Response.json(scoreRcsContent(card, media)); // no focal → the scorer centers the subject
  } catch (e) {
    const err = e as Error;
    return Response.json({ error: err.name || "Error", message: err.message }, { status: 400 });
  }
}
