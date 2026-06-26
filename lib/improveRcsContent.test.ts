/**
 * Dedicated tests for the deterministic improver — previously only covered by a
 * single integration golden. Locks the line-aware shortening (BUG-2/3), the
 * gated re-crop change (BUG-6), action ordering (s21), and format switch (s13).
 */
import { describe, expect, it } from "vitest";
import { improveRcsContent } from "@/lib/improveRcsContent";
import { estimateTextLines, getPlatformRulesByFormat as getPlatformRules } from "@/lib/rcsRules";
import { scoreRcsContent } from "@/lib/scoreRcsContent";
import { DEFAULT_CONTENT } from "@/lib/sampleContent";
import type { CardFormat, Platform, RcsContent } from "@/types/rcs";

function totalLines(content: RcsContent, platform: Platform, cardFormat: CardFormat) {
  return estimateTextLines(
    content.title,
    content.description,
    getPlatformRules(platform, cardFormat, 0),
  ).totalLines;
}

const CLEAN: RcsContent = {
  title: "Galaxy S26",
  description: "Free delivery.",
  imageUrl: "x",
  imageMetadata: { width: 1620, height: 1080, aspectRatio: 1.5 },
  actions: [{ id: "a", type: "openUrl", label: "View", value: "https://x" }],
  focalPoint: { x: 0.5, y: 0.5 },
  cardFormat: "tall",
};

describe("line-aware shortening (BUG-2/3)", () => {
  it("brings title + description within 3 rendered lines on BOTH platforms", () => {
    const out = improveRcsContent(DEFAULT_CONTENT, scoreRcsContent(DEFAULT_CONTENT)).improvedContent;
    expect(totalLines(out, "ios", out.cardFormat)).toBeLessThanOrEqual(3);
    expect(totalLines(out, "android", out.cardFormat)).toBeLessThanOrEqual(3);
  });

  it("only claims it fit 3 lines when it actually did", () => {
    const { changes, improvedContent } = improveRcsContent(
      DEFAULT_CONTENT,
      scoreRcsContent(DEFAULT_CONTENT),
    );
    if (changes.some((c) => /recommended 3 lines/.test(c.message))) {
      expect(totalLines(improvedContent, "android", improvedContent.cardFormat)).toBeLessThanOrEqual(3);
    }
  });
});

describe("re-crop change is gated (BUG-6)", () => {
  it("does NOT emit the re-crop change when the focal is already centered", () => {
    const out = improveRcsContent(CLEAN, scoreRcsContent(CLEAN));
    expect(out.changes.some((c) => /re-crop/.test(c.message))).toBe(false);
  });
  it("DOES emit it when the subject is outside the crop", () => {
    const offscreen: RcsContent = { ...CLEAN, focalPoint: { x: 0.98, y: 0.02 } };
    const out = improveRcsContent(offscreen, scoreRcsContent(offscreen));
    expect(out.changes.some((c) => /re-crop/.test(c.message))).toBe(true);
  });
});

describe("suggestion ordering & format (s21, s13)", () => {
  it("places the action before replies and discloses it", () => {
    const replyFirst: RcsContent = {
      ...CLEAN,
      actions: [
        { id: "r", type: "reply", label: "Later", value: "L" },
        { id: "a", type: "openUrl", label: "Buy", value: "https://x" },
      ],
    };
    const out = improveRcsContent(replyFirst, scoreRcsContent(replyFirst));
    expect(out.improvedContent.actions[0].type).not.toBe("reply");
    expect(out.changes.some((c) => /s21/.test(c.message))).toBe(true);
  });

  it("keeps the selected Medium format but advises Tall (s13)", () => {
    const medium: RcsContent = { ...CLEAN, cardFormat: "medium" };
    const out = improveRcsContent(medium, scoreRcsContent(medium));
    expect(out.improvedContent.cardFormat).toBe("medium");
    expect(out.changes.some((c) => c.category === "format" && /Tall/.test(c.message))).toBe(true);
  });
});

describe("improving never lowers the score", () => {
  for (const fmt of ["compact", "medium", "tall"] as const) {
    it(`${fmt}: improved overall >= original`, () => {
      const content: RcsContent = { ...DEFAULT_CONTENT, cardFormat: fmt };
      const before = scoreRcsContent(content);
      const after = scoreRcsContent(improveRcsContent(content, before).improvedContent);
      expect(after.overallScore).toBeGreaterThanOrEqual(before.overallScore);
    });
  }
});
