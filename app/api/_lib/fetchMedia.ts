/**
 * Shell-side media fetching: the "API fetches the URL to gather size/dimensions"
 * step (CIO ask #2). SSRF-hardened, reads header bytes only. Shared by
 * /api/media-info and the scoring endpoints (which derive media internally from
 * the card's contentInfo). NOT part of the pure kernel — it does network I/O.
 */

import { lookup } from "node:dns/promises";
import { Agent, fetch as undiciFetch } from "undici";
import { introspectMedia } from "@/lib/media/introspect";
import { isBlockedAddress, requireHttps, SsrfError } from "@/lib/media/ssrfGuard";
import type { MediaIntrospection, StandaloneRichCard } from "@/types/rcs";

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
  // Use undici's OWN fetch, NOT Node's global fetch. The global fetch is bundled
  // with a different undici build and rejects our undici@8 Agent dispatcher
  // (UND_ERR_INVALID_ARG: "invalid onRequestStart") → surfaces as "fetch failed".
  // undici.fetch + undici.Agent are version-matched. The casts bridge undici's
  // WHATWG types to the DOM lib types the rest of this file reads.
  return undiciFetch(u, { ...init, dispatcher } as never) as unknown as Promise<Response>;
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

/** Fetch a public media URL (header bytes only, SSRF-guarded) → MediaIntrospection. Throws SsrfError on a blocked/unreachable URL. */
export async function introspectRemoteMedia(url: string, thumbnailUrl?: string): Promise<MediaIntrospection> {
  const u = requireHttps(url);
  const { bytes, contentType, fileSizeBytes } = await rangedRead(u);
  const thumbnailSizeBytes = thumbnailUrl ? await headSize(thumbnailUrl) : undefined;
  return introspectMedia(bytes, { contentType, fileSizeBytes, thumbnailSizeBytes });
}

/**
 * Derive media for a card by fetching the URL in its contentInfo — the production
 * API's internal "fetch the media URL" step. Returns undefined when the card has
 * no media URL, or when the URL can't be fetched (the score then proceeds without
 * image dimensions rather than failing the whole request).
 */
export async function introspectCardMedia(card: StandaloneRichCard): Promise<MediaIntrospection | undefined> {
  const info = card.cardContent.media?.contentInfo;
  if (!info?.fileUrl) return undefined;
  try {
    return await introspectRemoteMedia(info.fileUrl, info.thumbnailUrl);
  } catch {
    return undefined;
  }
}
