import spec from "@/docs/scoring-api.openapi.json";

export const runtime = "nodejs";

export async function GET() {
  return Response.json(spec);
}
