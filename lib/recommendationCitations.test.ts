import { describe, expect, it } from "vitest";
import { citationsFromLabels, parseRecommendationCitations } from "@/lib/recommendationCitations";

describe("parseRecommendationCitations", () => {
  it("splits text from a trailing single citation", () => {
    const r = parseRecommendationCitations("Shorten the title (xPlatform Playbook s13).");
    expect(r.text).toBe("Shorten the title");
    expect(r.citations.map((c) => c.label)).toEqual(["xPlatform s13"]);
  });

  it("carries the document across comma-separated slide numbers", () => {
    const r = parseRecommendationCitations("Trim it (xPlatform Playbook s11, s17).");
    expect(r.citations.map((c) => c.label)).toEqual(["xPlatform s11", "xPlatform s17"]);
  });

  it("expands a slide range", () => {
    const r = parseRecommendationCitations("Export at 9:16 (xPlatform Playbook s15-s16).");
    expect(r.citations.map((c) => c.label)).toEqual(["xPlatform s15", "xPlatform s16"]);
  });

  it("handles a two-document citation (the tall-format export)", () => {
    const r = parseRecommendationCitations("Export at 3:2 (Card Media Playbook p8, xPlatform s12).");
    expect(r.citations.map((c) => c.label)).toEqual(["Card Media p8", "xPlatform s12"]);
  });

  it("builds a deep link into the right PDF page", () => {
    const [c] = parseRecommendationCitations("x (xPlatform Playbook s15).").citations;
    expect(c.url).toContain("xPlatformPlaybook");
    expect(c.url).toContain("#page=15");
  });

  it("returns no citations for plain text", () => {
    expect(parseRecommendationCitations("Just a note.").citations).toHaveLength(0);
  });
});

describe("citation coverage — every label cited in the app must resolve", () => {
  // The full set of labels emitted across lib/ + the InlineSlideCitation calls
  // in components/. If a citation is added in code without a blurb, this fails.
  const ALL_CITED = [
    "xPlatform s9",
    "xPlatform s11",
    "xPlatform s12",
    "xPlatform s13",
    "xPlatform s15",
    "xPlatform s16",
    "xPlatform s17",
    "xPlatform s18",
    "xPlatform s21",
    "xPlatform s23",
    "xPlatform s25",
    "xPlatform s28",
    "xPlatform s29",
    "xPlatform s42",
    "Card Media p6",
    "Card Media p8",
    "Card Media p12",
    "Card Media p13",
    "Card Media p28",
    "Card Media p29",
    "Card Media p39",
  ];

  it("resolves a blurb + url for every cited label (no silent drops)", () => {
    const resolved = citationsFromLabels(ALL_CITED);
    expect(resolved).toHaveLength(ALL_CITED.length);
    for (const c of resolved) {
      expect(c.description.length).toBeGreaterThan(0);
      expect(c.url).toMatch(/#page=\d+$/);
    }
  });
});
