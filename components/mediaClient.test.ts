import { describe, it, expect, vi, afterEach } from "vitest";
import { fetchMediaInfo } from "@/components/mediaClient";

afterEach(() => vi.restoreAllMocks());

describe("fetchMediaInfo", () => {
  it("returns the introspection on 200", async () => {
    const intro = { mediaType: "image", mimeType: "image/png", fileSizeBytes: 1234, width: 100, height: 50, aspectRatio: 2 };
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(intro), { status: 200 })));
    await expect(fetchMediaInfo("https://ex/a.png")).resolves.toEqual(intro);
  });

  it("throws the route's message on a 422", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ error: "SsrfError", message: "URL resolves to a non-public address." }), { status: 422 })),
    );
    await expect(fetchMediaInfo("https://ex/a.png")).rejects.toThrow(/non-public/);
  });
});
