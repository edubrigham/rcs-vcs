/**
 * POST /api/media-info — fetch a publicly-reachable media URL and return its
 * MediaIntrospection (type, size, image dimensions). Reads only header bytes via
 * an HTTP Range request; never downloads a whole file. SSRF-hardened. This is
 * the disposable PoC shell around the pure `introspectMedia` kernel.
 *
 * Body: { url: string, thumbnailUrl?: string } → 200 MediaIntrospection | 422 { error, message }
 */

import { NextResponse, type NextRequest } from "next/server";
import { lookup } from "node:dns/promises";
import { Agent } from "undici";
import { introspectMedia } from "@/lib/media/introspect";
import { isBlockedAddress, requireHttps, SsrfError } from "@/lib/media/ssrfGuard";

export const runtime = "nodejs"; // needs DNS/IP resolution for the SSRF check
export const maxDuration = 10;

const HEADER_BYTES = 65_535;
const TIMEOUT_MS = 5_000;

/**
 * Resolve the host ONCE, validate EVERY returned address, and return an undici
 * dispatcher pinned to a validated IP. This closes the DNS-rebinding / TOCTOU
 * window — the connection uses the pre-validated address rather than a fresh
 * re-resolution — while TLS SNI + certificate validation still use the original
 * hostname.
 */
async function pinnedDispatcher(u: URL): Promise<Agent> {
  const results = await lookup(u.hostname, { all: true });
  if (results.length === 0) throw new SsrfError("DNS returned no addresses.");
  for (const r of results) {
    if (isBlockedAddress(r.address)) throw new SsrfError("URL resolves to a non-public address.");
  }
  const pinned = results[0];
  return new Agent({
    connect: {
      // Force every connection to the pre-validated IP. Cast: undici's lookup
      // type is stricter than the runtime contract we satisfy here.
      lookup: ((_hostname: string, options: { all?: boolean }, cb: (err: Error | null, ...rest: unknown[]) => void) => {
        if (options?.all) cb(null, [{ address: pinned.address, family: pinned.family }]);
        else cb(null, pinned.address, pinned.family);
      }) as never,
    },
  });
}

async function safeFetch(u: URL, init: RequestInit): Promise<Response> {
  const dispatcher = await pinnedDispatcher(u);
  // `dispatcher` is an undici extension to fetch's init.
  return fetch(u, { ...init, dispatcher } as RequestInit & { dispatcher: Agent });
}

async function rangedRead(u: URL): Promise<{ bytes: Uint8Array; contentType: string; fileSizeBytes: number }> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await safeFetch(u, {
      redirect: "manual",
      signal: ctrl.signal,
      headers: { Range: `bytes=0-${HEADER_BYTES}` },
    });
    if (res.status >= 300 && res.status < 400) throw new SsrfError("Redirects are not followed.");
    if (!res.ok && res.status !== 206) throw new SsrfError(`Upstream returned ${res.status}.`);

    const contentType = res.headers.get("content-type") ?? "application/octet-stream";
    const range = res.headers.get("content-range");
    const fileSizeBytes = range?.includes("/")
      ? Number(range.split("/")[1])
      : Number(res.headers.get("content-length") ?? 0);

    // Read at most HEADER_BYTES, then stop — never buffer a whole file.
    const reader = res.body!.getReader();
    const chunks: Uint8Array[] = [];
    let total = 0;
    while (total <= HEADER_BYTES) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      total += value.length;
    }
    await reader.cancel().catch(() => {});

    const bytes = new Uint8Array(total);
    let offset = 0;
    for (const c of chunks) {
      bytes.set(c, offset);
      offset += c.length;
    }
    return { bytes, contentType, fileSizeBytes: fileSizeBytes || total };
  } finally {
    clearTimeout(timer);
  }
}

async function headSize(raw: string): Promise<number | undefined> {
  const u = requireHttps(raw);
  const res = await safeFetch(u, { method: "HEAD", redirect: "manual" });
  const len = res.headers.get("content-length");
  return len ? Number(len) : undefined;
}

export async function POST(request: NextRequest) {
  try {
    const { url, thumbnailUrl } = (await request.json()) as { url: string; thumbnailUrl?: string };
    const u = requireHttps(url);
    const { bytes, contentType, fileSizeBytes } = await rangedRead(u);
    const thumbnailSizeBytes = thumbnailUrl ? await headSize(thumbnailUrl) : undefined;
    const meta = introspectMedia(bytes, { contentType, fileSizeBytes, thumbnailSizeBytes });
    return NextResponse.json(meta);
  } catch (e) {
    const err = e as Error;
    return NextResponse.json({ error: err.name || "Error", message: err.message }, { status: 422 });
  }
}
