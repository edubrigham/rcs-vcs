/**
 * POST /api/media-info — fetch a publicly-reachable media URL and return its
 * MediaIntrospection (type, size, image dimensions). Reads only header bytes via
 * an HTTP Range request; never downloads a whole file. SSRF-hardened. A utility
 * for the demo editor; the scoring endpoints derive media the same way internally
 * (see app/api/_lib/fetchMedia).
 *
 * Body: { url: string, thumbnailUrl?: string } → 200 MediaIntrospection | 422 { error, message }
 */

import { NextResponse, type NextRequest } from "next/server";
import { introspectRemoteMedia } from "@/app/api/_lib/fetchMedia";

export const runtime = "nodejs"; // needs DNS/IP resolution for the SSRF check
export const maxDuration = 10;

export async function POST(request: NextRequest) {
  try {
    const { url, thumbnailUrl } = (await request.json()) as { url: string; thumbnailUrl?: string };
    return NextResponse.json(await introspectRemoteMedia(url, thumbnailUrl));
  } catch (e) {
    const err = e as Error;
    return NextResponse.json({ error: err.name || "Error", message: err.message }, { status: 422 });
  }
}
