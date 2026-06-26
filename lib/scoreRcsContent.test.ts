import { describe, expect, it } from "vitest";
import { scoreActions, scoreImage, scoreRcsContent, scoreText } from "@/lib/scoreRcsContent";
import { improveRcsContent } from "@/lib/improveRcsContent";
import { DEFAULT_CARD, DEFAULT_FOCAL, DEFAULT_MEDIA } from "@/lib/sampleContent";
import type { FocalPoint, MediaIntrospection, StandaloneRichCard, Suggestion } from "@/types/rcs";

const CLEAN_MEDIA: MediaIntrospection = {
  mediaType: "image",
  mimeType: "image/png",
  fileSizeBytes: 0,
  width: 1620,
  height: 1080,
  aspectRatio: 1620 / 1080,
};
const CLEAN_FOCAL: FocalPoint = { x: 0.5, y: 0.5 };

const CLEAN: StandaloneRichCard = {
  type: "standaloneRichCard",
  cardOrientation: "VERTICAL",
  cardContent: {
    title: "Galaxy S26 Ultra",
    description: "Free delivery and setup.",
    media: { height: "TALL", contentInfo: { fileUrl: "x" } },
    suggestions: [
      { type: "action", text: "View product", action: { type: "openUrlAction", url: "https://x.example" } },
    ],
  },
};

/** A CLEAN card with the given suggestions. */
function withSuggestions(suggestions: Suggestion[]): StandaloneRichCard {
  return { ...CLEAN, cardContent: { ...CLEAN.cardContent, suggestions } };
}
/** A CLEAN card with the media removed. */
const NO_MEDIA: StandaloneRichCard = { ...CLEAN, cardContent: { ...CLEAN.cardContent, media: undefined } };

// ───────────────────────── sub-scorers in isolation ─────────────────────────

describe("scoreActions", () => {
  it("rewards a single CTA (the recommended pattern)", () => {
    const r = scoreActions(CLEAN);
    expect(r.ios).toBe(100);
    expect(r.android).toBe(100);
    expect(r.warnings).toHaveLength(0);
  });

  it("flags two CTAs with an info warning but no hard penalty path", () => {
    const r = scoreActions(withSuggestions([
      { type: "action", text: "Buy", action: { type: "openUrlAction", url: "https://x" } },
      { type: "action", text: "Call", action: { type: "dialAction", phoneNumber: "+3220000000" } },
    ]));
    expect(r.ios).toBe(82);
    expect(r.warnings.some((w) => w.message.includes("Two CTA actions"))).toBe(true);
  });

  it("penalises iOS when 3+ actions trigger the Options dropdown (s42)", () => {
    const r = scoreActions(withSuggestions([
      { type: "action", text: "Buy", action: { type: "openUrlAction", url: "https://x" } },
      { type: "action", text: "Call", action: { type: "dialAction", phoneNumber: "+3220000000" } },
      { type: "action", text: "More", action: { type: "openUrlAction", url: "https://x/more" } },
    ]));
    expect(r.ios).toBe(55); // base 65 − 10 dropdown
    expect(r.android).toBe(65);
    expect(r.warnings.some((w) => w.message.includes("dropdown on iOS"))).toBe(true);
  });

  it("warns when no suggestions exist", () => {
    const r = scoreActions(withSuggestions([]));
    expect(r.ios).toBe(60);
    expect(r.warnings.some((w) => w.message.includes("no suggestions"))).toBe(true);
  });

  it("penalises labels over the 25-char limit (s17)", () => {
    const r = scoreActions(withSuggestions([
      {
        type: "action",
        text: "This label is definitely way too long for a suggestion",
        action: { type: "openUrlAction", url: "https://x" },
      },
    ]));
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
    const r = scoreText(DEFAULT_CARD); // long sample copy, horizontal card
    expect(r.warnings.some((w) => w.severity === "critical" && w.message.includes("6 lines"))).toBe(true);
    expect(r.ios).toBeLessThan(r.android);
  });
});

describe("scoreImage", () => {
  it("returns the neutral 55/55 with a warning when no media is present", () => {
    const r = scoreImage(NO_MEDIA, undefined, CLEAN_FOCAL);
    expect(r.ios).toBe(55);
    expect(r.android).toBe(55);
    expect(r.warnings.some((w) => w.message.includes("No media"))).toBe(true);
  });

  it("is perfect for a centred subject on a 3:2 tall card", () => {
    const r = scoreImage(CLEAN, CLEAN_MEDIA, CLEAN_FOCAL);
    expect(r.ios).toBe(100);
    expect(r.android).toBe(100);
  });

  it("compact, edge focal, long text: iOS 85 / Android 18 (monotone crop model)", () => {
    // HORIZONTAL, ~0.85 image, long text (high crop severity), subject near the
    // LEFT edge → focal outside the Android crop window (→30, −12 = 18); iOS keeps
    // the 1:1 square but loses the safe-zone (−15 = 85).
    const media: MediaIntrospection = {
      mediaType: "image",
      mimeType: "image/png",
      fileSizeBytes: 0,
      width: 850,
      height: 1000,
      aspectRatio: 0.85,
    };
    const r = scoreImage(DEFAULT_CARD, media, { x: 0.1, y: 0.5 });
    expect(r.ios).toBe(85);
    expect(r.android).toBe(18);
  });
});

// ───────────────────────── integration golden values ────────────────────────
// Locked headline numbers — proven identical to the pre-native engine.

describe("scoreRcsContent — golden integration", () => {
  it("scores the default sample card", () => {
    const r = scoreRcsContent(DEFAULT_CARD, DEFAULT_MEDIA, DEFAULT_FOCAL);
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
    const r = scoreRcsContent(CLEAN, CLEAN_MEDIA, CLEAN_FOCAL);
    expect(r.overallScore).toBe(100);
    expect(r.warnings).toHaveLength(0);
    expect(r.recommendations).toHaveLength(0);
  });

  it("scores an image-less card at 82 (image sub-score floors at 55)", () => {
    const r = scoreRcsContent(NO_MEDIA, undefined, CLEAN_FOCAL);
    expect(r.overallScore).toBe(82);
    expect(r.imageSafeZoneScore).toBe(55);
  });

  it("weights the four sub-scores as 35/30/20/15", () => {
    const r = scoreRcsContent(DEFAULT_CARD, DEFAULT_MEDIA, DEFAULT_FOCAL);
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
    const before = scoreRcsContent(DEFAULT_CARD, DEFAULT_MEDIA, DEFAULT_FOCAL);
    const result = improveRcsContent(DEFAULT_CARD, DEFAULT_MEDIA, DEFAULT_FOCAL, before);
    const after = scoreRcsContent(result.improvedContent, result.improvedMedia, result.improvedFocal);
    expect(after.overallScore).toBeGreaterThan(before.overallScore);
    expect(after.overallScore).toBe(100); // golden
  });
});
