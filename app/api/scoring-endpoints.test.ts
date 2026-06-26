import { describe, it, expect } from "vitest";
import { DEFAULT_CARD, DEFAULT_MEDIA, DEFAULT_FOCAL } from "@/lib/sampleContent";
import { POST as validate } from "@/app/api/validate/route";
import { POST as score } from "@/app/api/score/route";
import { POST as improve } from "@/app/api/improve/route";
import { POST as analyze } from "@/app/api/analyze/route";

const req = (body: unknown) => new Request("http://test/api", { method: "POST", body: JSON.stringify(body) });
const full = { card: DEFAULT_CARD, media: DEFAULT_MEDIA, focal: DEFAULT_FOCAL };

describe("scoring endpoints", () => {
  it("POST /validate → 200 with passes", async () => {
    const res = await validate(req(full));
    expect(res.status).toBe(200);
    expect(await res.json()).toHaveProperty("passes");
  });
  it("POST /score → 200 with overallScore", async () => {
    const res = await score(req(full));
    expect(res.status).toBe(200);
    expect(await res.json()).toHaveProperty("overallScore");
  });
  it("POST /improve → 200 with improvedContent", async () => {
    const res = await improve(req(full));
    expect(res.status).toBe(200);
    expect(await res.json()).toHaveProperty("improvedContent");
  });
  it("POST /analyze → 200 with functional + quality", async () => {
    const res = await analyze(req(full));
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json).toHaveProperty("functional.passes");
    expect(json).toHaveProperty("quality.overallScore");
  });
  it("malformed body → 400 with a message", async () => {
    const res = await validate(req({ nope: true }));
    expect(res.status).toBe(400);
    expect(await res.json()).toHaveProperty("message");
  });
});
