import { describe, it, expect, vi, afterEach } from "vitest";
import { analyzeCard, introspectUrl, type TrafficEntry } from "@/components/apiClient";
import type { StandaloneRichCard } from "@/types/rcs";

afterEach(() => vi.restoreAllMocks());

const card: StandaloneRichCard = {
  type: "standaloneRichCard",
  cardOrientation: "VERTICAL",
  cardContent: { title: "x" },
};

describe("apiClient", () => {
  it("analyzeCard posts the rcsContentBody, returns the parsed body, emits one entry", async () => {
    const payload = { functional: { passes: true, violations: [] }, quality: { overallScore: 80 } };
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(payload), { status: 200 })));
    const log: TrafficEntry[] = [];
    const res = await analyzeCard(card, (e) => log.push(e));
    expect(res).toEqual(payload);
    expect(log).toHaveLength(1);
    expect(log[0]).toMatchObject({ method: "POST", path: "/api/analyze", status: 200, ok: true });
    expect(log[0].request).toEqual(card);
    expect(log[0].response).toEqual(payload);
  });

  it("emits ok:false and returns null on a non-2xx", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ error: "BadRequest", message: "nope" }), { status: 400 })));
    const log: TrafficEntry[] = [];
    const res = await analyzeCard(card, (e) => log.push(e));
    expect(res).toBeNull();
    expect(log[0]).toMatchObject({ path: "/api/analyze", status: 400, ok: false });
  });

  it("introspectUrl throws on error but still emits an entry", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ message: "non-public" }), { status: 422 })));
    const log: TrafficEntry[] = [];
    await expect(introspectUrl("https://ex/a.png", (e) => log.push(e))).rejects.toThrow(/non-public/);
    expect(log[0]).toMatchObject({ path: "/api/media-info", status: 422, ok: false });
  });
});
