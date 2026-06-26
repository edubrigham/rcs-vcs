/**
 * Dedicated tests for the deterministic improver. Locks the line-aware
 * shortening (BUG-2/3), the gated re-crop change (BUG-6), suggestion ordering
 * (s21), and the format advice (s13). Native Naxai model.
 */
import { describe, expect, it } from "vitest";
import { improveRcsContent } from "@/lib/improveRcsContent";
import { estimateTextLines, getPlatformRules } from "@/lib/rcsRules";
import { scoreRcsContent } from "@/lib/scoreRcsContent";
import { DEFAULT_CARD, DEFAULT_FOCAL, DEFAULT_MEDIA } from "@/lib/sampleContent";
import type { FocalPoint, MediaIntrospection, Platform, StandaloneRichCard } from "@/types/rcs";

function totalLines(card: StandaloneRichCard, platform: Platform) {
  return estimateTextLines(
    card.cardContent.title ?? "",
    card.cardContent.description ?? "",
    getPlatformRules(platform, card.cardOrientation, card.cardContent.media?.height ?? null, 0),
  ).totalLines;
}

const CLEAN_MEDIA: MediaIntrospection = {
  mediaType: "image",
  mimeType: "image/png",
  fileSizeBytes: 0,
  width: 1620,
  height: 1080,
  aspectRatio: 1.5,
};
const CLEAN_FOCAL: FocalPoint = { x: 0.5, y: 0.5 };
const CLEAN: StandaloneRichCard = {
  type: "standaloneRichCard",
  cardOrientation: "VERTICAL",
  cardContent: {
    title: "Galaxy S26",
    description: "Free delivery.",
    media: { height: "TALL", contentInfo: { fileUrl: "x" } },
    suggestions: [{ type: "action", text: "View", action: { type: "openUrlAction", url: "https://x" } }],
  },
};

/** DEFAULT_CARD re-shaped to a given vertical height (or kept HORIZONTAL). */
function shaped(shape: "compact" | "medium" | "tall"): StandaloneRichCard {
  if (shape === "compact") return DEFAULT_CARD;
  return {
    ...DEFAULT_CARD,
    cardOrientation: "VERTICAL",
    cardContent: {
      ...DEFAULT_CARD.cardContent,
      media: { height: shape === "medium" ? "MEDIUM" : "TALL", contentInfo: DEFAULT_CARD.cardContent.media!.contentInfo },
    },
  };
}

describe("line-aware shortening (BUG-2/3)", () => {
  it("brings title + description within 3 rendered lines on BOTH platforms", () => {
    const out = improveRcsContent(DEFAULT_CARD, DEFAULT_MEDIA, DEFAULT_FOCAL, scoreRcsContent(DEFAULT_CARD, DEFAULT_MEDIA, DEFAULT_FOCAL)).improvedContent;
    expect(totalLines(out, "ios")).toBeLessThanOrEqual(3);
    expect(totalLines(out, "android")).toBeLessThanOrEqual(3);
  });

  it("only claims it fit 3 lines when it actually did", () => {
    const { changes, improvedContent } = improveRcsContent(
      DEFAULT_CARD,
      DEFAULT_MEDIA,
      DEFAULT_FOCAL,
      scoreRcsContent(DEFAULT_CARD, DEFAULT_MEDIA, DEFAULT_FOCAL),
    );
    if (changes.some((c) => /recommended 3 lines/.test(c.message))) {
      expect(totalLines(improvedContent, "android")).toBeLessThanOrEqual(3);
    }
  });
});

describe("re-crop change is gated (BUG-6)", () => {
  it("does NOT emit the re-crop change when the focal is already centered", () => {
    const out = improveRcsContent(CLEAN, CLEAN_MEDIA, CLEAN_FOCAL, scoreRcsContent(CLEAN, CLEAN_MEDIA, CLEAN_FOCAL));
    expect(out.changes.some((c) => /re-crop/.test(c.message))).toBe(false);
  });
  it("DOES emit it when the subject is outside the crop", () => {
    const focal: FocalPoint = { x: 0.98, y: 0.02 };
    const out = improveRcsContent(CLEAN, CLEAN_MEDIA, focal, scoreRcsContent(CLEAN, CLEAN_MEDIA, focal));
    expect(out.changes.some((c) => /re-crop/.test(c.message))).toBe(true);
  });
});

describe("suggestion ordering & format (s21, s13)", () => {
  it("places the action before replies and discloses it", () => {
    const replyFirst: StandaloneRichCard = {
      ...CLEAN,
      cardContent: {
        ...CLEAN.cardContent,
        suggestions: [
          { type: "reply", text: "Later", postbackData: "L" },
          { type: "action", text: "Buy", action: { type: "openUrlAction", url: "https://x" } },
        ],
      },
    };
    const out = improveRcsContent(replyFirst, CLEAN_MEDIA, CLEAN_FOCAL, scoreRcsContent(replyFirst, CLEAN_MEDIA, CLEAN_FOCAL));
    expect(out.improvedContent.cardContent.suggestions![0].type).not.toBe("reply");
    expect(out.changes.some((c) => /s21/.test(c.message))).toBe(true);
  });

  it("keeps the selected Medium format but advises Tall (s13)", () => {
    const medium = shaped("medium");
    const out = improveRcsContent(medium, DEFAULT_MEDIA, DEFAULT_FOCAL, scoreRcsContent(medium, DEFAULT_MEDIA, DEFAULT_FOCAL));
    expect(out.improvedContent.cardOrientation).toBe("VERTICAL");
    expect(out.improvedContent.cardContent.media?.height).toBe("MEDIUM");
    expect(out.changes.some((c) => c.category === "format" && /Tall/.test(c.message))).toBe(true);
  });
});

describe("improving never lowers the score", () => {
  for (const fmt of ["compact", "medium", "tall"] as const) {
    it(`${fmt}: improved overall >= original`, () => {
      const card = shaped(fmt);
      const before = scoreRcsContent(card, DEFAULT_MEDIA, DEFAULT_FOCAL);
      const result = improveRcsContent(card, DEFAULT_MEDIA, DEFAULT_FOCAL, before);
      const after = scoreRcsContent(result.improvedContent, result.improvedMedia, result.improvedFocal);
      expect(after.overallScore).toBeGreaterThanOrEqual(before.overallScore);
    });
  }
});
