import { parseCardBody } from "@/app/api/_lib/guards";
import { validateFunctional } from "@/lib/validateFunctional";
import { scoreRcsContent } from "@/lib/scoreRcsContent";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const { card, media, focal } = parseCardBody(await request.json());
    return Response.json({
      functional: validateFunctional(card, media),
      quality: scoreRcsContent(card, media, focal),
    });
  } catch (e) {
    const err = e as Error;
    return Response.json({ error: err.name || "Error", message: err.message }, { status: 400 });
  }
}
