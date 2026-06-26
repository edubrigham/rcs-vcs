import type { MediaIntrospection } from "@/types/rcs";

/**
 * Client helper: POST a media URL to the SSRF-guarded /api/media-info route and
 * return its MediaIntrospection. Throws Error(message) on a non-2xx (the route's
 * { error, message }) or a network failure. Shell-only — not part of the kernel.
 */
export async function fetchMediaInfo(url: string, thumbnailUrl?: string): Promise<MediaIntrospection> {
  const res = await fetch("/api/media-info", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url, thumbnailUrl }),
  });
  const data = (await res.json().catch(() => ({}))) as Partial<MediaIntrospection> & { message?: string };
  if (!res.ok) throw new Error(data.message ?? `Media fetch failed (${res.status}).`);
  return data as MediaIntrospection;
}
