import { describe, it, expect } from "vitest";
import { existsSync } from "node:fs";
import { join } from "node:path";
import spec from "@/docs/scoring-api.openapi.json";
import { GET } from "@/app/api/openapi.json/route";

const paths = () => Object.keys((spec as { paths: Record<string, unknown> }).paths);

describe("scoring-api OpenAPI", () => {
  it("is OpenAPI 3.x and documents the five endpoints", () => {
    expect((spec as { openapi: string }).openapi).toMatch(/^3\./);
    expect(paths().sort()).toEqual(["/analyze", "/improve", "/media-info", "/score", "/validate"]);
  });
  it("every documented path has a route handler (drift guard)", () => {
    for (const p of paths()) {
      expect(existsSync(join(process.cwd(), "app/api", p, "route.ts")), `missing route for ${p}`).toBe(true);
    }
  });
  it("GET returns the spec", async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    expect(await res.json()).toHaveProperty("openapi");
  });
});
