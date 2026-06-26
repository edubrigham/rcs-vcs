import { parseCardBody } from "@/app/api/_lib/guards";
import { validateFunctional } from "@/lib/validateFunctional";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const { card, media } = parseCardBody(await request.json());
    return Response.json(validateFunctional(card, media));
  } catch (e) {
    const err = e as Error;
    return Response.json({ error: err.name || "Error", message: err.message }, { status: 400 });
  }
}
