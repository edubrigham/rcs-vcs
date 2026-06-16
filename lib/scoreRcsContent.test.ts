import { describe, expect, it } from "vitest";
import {
  scoreActions,
  scoreImage,
  scoreRcsContent,
  scoreText,
} from "@/lib/scoreRcsContent";
import { improveRcsContent } from "@/lib/improveRcsContent";
import { DEFAULT_CONTENT } from "@/lib/sampleContent";
import type { RcsContent } from "@/types/rcs";

const CLEAN: RcsContent = {
  title: "Galaxy S26 Ultra",
  description: "Free delivery and setup.",
  imageUrl: "x",
  imageMetadata: { width: 1620, height: 1080, aspectRatio: 1620 / 1080 },
  actions: [{ id: "a", type: "openUrl", label: "View product", value: "https://x.example", primary: true }],
  focalPoint: { x: 0.5, y: 0.5 },
  cardFormat: "tall",
};

// ───────────────────────── sub-scorers in isolation ─────────────────────────

describe("scoreActions", () => {
  it("rewards a single CTA (the recommended pattern)", () => {
    const r = scoreActions(CLEAN);
    expect(r.ios).toBe(100);
    expect(r.android).toBe(100);
    expect(r.warnings).toHaveLength(0);
  });

  it("flags two CTAs with an info warning but no hard penalty path", () => {
    const r = scoreActions({
      ...CLEAN,
      actions: [
        { id: "1", type: "openUrl", label: "Buy", value: "https://x", primary: true },
        { id: "2", type: "dial", label: "Call", value: "+3220000000" },
      ],
    });
    expect(r.ios).toBe(82);
    expect(r.warnings.some((w) => w.message.includes("Two CTA actions"))).toBe(true);
  });

  it("penalises iOS when 3+ actions trigger the Options dropdown (s42)", () => {
    const r = scoreActions({
      ...CLEAN,
      actions: [
        { id: "1", type: "openUrl", label: "Buy", value: "https://x", primary: true },
        { id: "2", type: "dial", label: "Call", value: "+3220000000" },
        { id: "3", type: "openUrl", label: "More", value: "https://x/more" },
      ],
    });
    expect(r.ios).toBe(55); // base 65 − 10 dropdown
    expect(r.android).toBe(65);
    expect(r.warnings.some((w) => w.message.includes("dropdown on iOS"))).toBe(true);
  });

  it("warns when no suggestions exist", () => {
    const r = scoreActions({ ...CLEAN, actions: [] });
    expect(r.ios).toBe(60);
    expect(r.warnings.some((w) => w.message.includes("no suggestions"))).toBe(true);
  });

  it("penalises labels over the 25-char limit (s17)", () => {
    const r = scoreActions({
      ...CLEAN,
      actions: [
        {
          id: "1",
          type: "openUrl",
          label: "This label is definitely way too long for a suggestion",
          value: "https://x",
          primary: true,
        },
      ],
    });
    expect(r.ios).toBe(92); // 100 − 8
    expect(r.warnings.some((w) => w.message.includes("25-character"))).toBe(true);
  });
});

describe("scoreText", () => {
  it("is perfect for short copy on a tall card", () => {
    const r = scoreText(CLEAN);
    expect(r.ios).toBe(100);
    expect(r.android).toBe(100);
    expect(r.warnings).toHaveLength(0);
  });

  it("raises the >6-line critical overflow on iOS for very long copy", () => {
    const r = scoreText(DEFAULT_CONTENT); // long sample copy, compact card
    expect(r.warnings.some((w) => w.severity === "critical" && w.message.includes("6 lines"))).toBe(true);
    expect(r.ios).toBeLessThan(r.android);
  });
});

describe("scoreImage", () => {
  it("returns the neutral 55/55 with a warning when no media is present", () => {
    const r = scoreImage({ ...CLEAN, imageUrl: null, imageMetadata: undefined });
    expect(r.ios).toBe(55);
    expect(r.android).toBe(55);
    expect(r.warnings.some((w) => w.message.includes("No media"))).toBe(true);
  });

  it("is perfect for a centred subject on a 3:2 tall card", () => {
    const r = scoreImage(CLEAN);
    expect(r.ios).toBe(100);
    expect(r.android).toBe(100);
  });

  it("reproduces the documented compact case: iOS 85 / Android 53 (→ safe-zone 69)", () => {
    // compact, ~0.85 image, long text (high crop severity), subject off to the
    // edge but still inside the Android crop and the iOS 1:1 square.
    const r = scoreImage({
      ...DEFAULT_CONTENT,
      cardFormat: "compact",
      imageMetadata: { width: 850, height: 1000, aspectRatio: 0.85 },
      focalPoint: { x: 0.1, y: 0.5 },
    });
    expect(r.ios).toBe(85);
    expect(r.android).toBe(53);
    expect(Math.round((r.ios + r.android) / 2)).toBe(69);
  });
});

// ───────────────────────── integration golden values ────────────────────────
// Captured from the pre-refactor function and proven identical. These lock the
// headline numbers; any future change to a rule must update them deliberately.

describe("scoreRcsContent — golden integration", () => {
  it("scores the default sample card", () => {
    const r = scoreRcsContent(DEFAULT_CONTENT);
    expect(r).toMatchObject({
      overallScore: 50,
      iosScore: 58,
      androidScore: 41,
      imageSafeZoneScore: 52,
      textFitScore: 20,
      actionScore: 74,
      layoutScore: 70,
    });
    expect(r.warnings).toHaveLength(9);
  });

  it("scores a clean card at 100 with no warnings", () => {
    const r = scoreRcsContent(CLEAN);
    expect(r.overallScore).toBe(100);
    expect(r.warnings).toHaveLength(0);
    expect(r.recommendations).toHaveLength(0);
  });

  it("scores an image-less card at 82 (image sub-score floors at 55)", () => {
    const r = scoreRcsContent({ ...CLEAN, imageUrl: null, imageMetadata: undefined });
    expect(r.overallScore).toBe(82);
    expect(r.imageSafeZoneScore).toBe(55);
  });

  it("weights the four sub-scores as 35/30/20/15", () => {
    const r = scoreRcsContent(DEFAULT_CONTENT);
    const expected = Math.round(
      0.35 * r.imageSafeZoneScore +
        0.3 * r.textFitScore +
        0.2 * r.actionScore +
        0.15 * r.layoutScore,
    );
    expect(r.overallScore).toBe(expected);
  });
});

describe("improveRcsContent raises the score (before/after promise)", () => {
  it("the improved sample scores strictly higher than the original", () => {
    const before = scoreRcsContent(DEFAULT_CONTENT);
    const improved = improveRcsContent(DEFAULT_CONTENT, before).improvedContent;
    const after = scoreRcsContent(improved);
    expect(after.overallScore).toBeGreaterThan(before.overallScore);
    expect(after.overallScore).toBe(99); // golden
  });
});
