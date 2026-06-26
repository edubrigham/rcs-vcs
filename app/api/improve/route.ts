import { parseCardBody } from "@/app/api/_lib/guards";
import { scoreRcsContent } from "@/lib/scoreRcsContent";
import { improveRcsContent } from "@/lib/improveRcsContent";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const { card, media, focal } = parseCardBody(await request.json());
    const score = scoreRcsContent(card, media, focal);
    return Response.json(improveRcsContent(card, media, focal, score));
  } catch (e) {
    const err = e as Error;
    return Response.json({ error: err.name || "Error", message: err.message }, { status: 400 });
  }
}
