import { describe, expect, it } from "vitest";
import { visibleAreaFraction } from "@/lib/cropMath";
import {
  androidCropWindow,
  ANDROID_RULES,
  cropSeverityForLines,
  estimateLines,
  estimateTextLines,
  getPlatformRules,
  IOS_RULES,
  recommendedAspectForOrientation,
} from "@/lib/rcsRules";
import type { CardOrientation, MediaHeight } from "@/types/rcs";

describe("estimateLines (greedy word wrap)", () => {
  it("is 0 for empty/whitespace", () => {
    expect(estimateLines("", 20)).toBe(0);
    expect(estimateLines("   ", 20)).toBe(0);
  });

  it("is 1 when the text fits on one line", () => {
    expect(estimateLines("hello there", 20)).toBe(1);
  });

  it("wraps at the word boundary", () => {
    // "aaaa bbbb" = 9 chars fits 9-wide; "cccc" pushes to a 2nd line.
    expect(estimateLines("aaaa bbbb cccc", 9)).toBe(2);
  });

  it("does NOT break a single over-long word (known approximation)", () => {
    expect(estimateLines("supercalifragilistic", 10)).toBe(1);
  });
});

describe("cropSeverityForLines", () => {
  it("maps line counts to severity around the 3-line and 6-line thresholds", () => {
    expect(cropSeverityForLines(3)).toBe("low");
    expect(cropSeverityForLines(6)).toBe("medium");
    expect(cropSeverityForLines(7)).toBe("high");
  });
});

describe("estimateTextLines", () => {
  it("sums title and description line estimates", () => {
    const r = estimateTextLines("one two", "three four five", {
      titleCharsPerLine: 100,
      descriptionCharsPerLine: 100,
    });
    expect(r).toEqual({ titleLines: 1, descriptionLines: 1, totalLines: 2 });
  });
});

describe("getPlatformRules — orientation + mediaHeight (key playbook facts)", () => {
  it("HORIZONTAL iOS renders the 60×60 thumbnail (xPlatform s15)", () => {
    const r = getPlatformRules("ios", "HORIZONTAL", null, 0);
    expect(r.mediaWidth).toBe(IOS_RULES.compactMediaSizeDp);
    expect(r.mediaHeight).toBe(60);
    expect(r.mediaLayout).toBe("thumbnail");
    expect(r.maxVisibleActions).toBe(IOS_RULES.maxInlineActions);
  });

  it("VERTICAL+TALL iOS uses the tall media cap", () => {
    const r = getPlatformRules("ios", "VERTICAL", "TALL", 0);
    expect(r.mediaLayout).toBe("vertical");
    expect(r.mediaHeight).toBe(IOS_RULES.verticalFormatMediaHeightCap.tall);
  });

  it("VERTICAL+MEDIUM iOS uses the medium media cap", () => {
    const r = getPlatformRules("ios", "VERTICAL", "MEDIUM", 0);
    expect(r.mediaLayout).toBe("vertical");
    expect(r.mediaHeight).toBe(IOS_RULES.verticalFormatMediaHeightCap.medium);
  });

  it("HORIZONTAL Android uses fixed 128 DP media width (CardMedia p13)", () => {
    const r = getPlatformRules("android", "HORIZONTAL", null, 0);
    expect(r.mediaWidth).toBe(ANDROID_RULES.horizontalCardMediaWidthDp);
    expect(r.mediaLayout).toBe("horizontal");
  });

  it("gives each vertical height a DISTINCT media box (MEDIUM 21:9 ≠ TALL 3:2)", () => {
    const medium = getPlatformRules("android", "VERTICAL", "MEDIUM", 0);
    const tall = getPlatformRules("android", "VERTICAL", "TALL", 0);
    expect(medium.mediaHeight).toBe(Math.round(medium.mediaWidth / (21 / 9)));
    expect(tall.mediaHeight).toBe(Math.round(tall.mediaWidth / (3 / 2)));
    expect(medium.mediaHeight).not.toBe(tall.mediaHeight);
    expect(tall.mediaHeight).toBeGreaterThan(medium.mediaHeight);
  });

  it("keeps a FIXED media-box size regardless of text (crop is the punch-in, not the box)", () => {
    const low = getPlatformRules("android", "HORIZONTAL", null, 2);
    const high = getPlatformRules("android", "HORIZONTAL", null, 8);
    expect(high.mediaHeight).toBe(low.mediaHeight);
    expect(high.cropSeverity).toBe("high");
  });

  it("recommendedAspectForOrientation returns the playbook source ratios", () => {
    expect(recommendedAspectForOrientation("HORIZONTAL", null)).toMatchObject({ aspect: 9 / 16, label: "9:16" });
    expect(recommendedAspectForOrientation("VERTICAL", "MEDIUM")).toMatchObject({ aspect: 21 / 9, label: "21:9" });
    expect(recommendedAspectForOrientation("VERTICAL", "TALL")).toMatchObject({ aspect: 3 / 2, label: "3:2" });
  });
});

describe("androidCropWindow — monotone crop with text (xPlatform s15, BUG-1 guard)", () => {
  // The crux of the fix: for EVERY shape × aspect, more text must never show
  // MORE of the image. lines 2/5/8 → low/med/high severity.
  const SHAPES: { name: string; orientation: CardOrientation; height: MediaHeight | null }[] = [
    { name: "HORIZONTAL", orientation: "HORIZONTAL", height: null },
    { name: "VERTICAL+MEDIUM", orientation: "VERTICAL", height: "MEDIUM" },
    { name: "VERTICAL+TALL", orientation: "VERTICAL", height: "TALL" },
  ];
  const ASPECTS = [1.5, 21 / 9, 9 / 16, 1.0, 0.85];
  for (const shape of SHAPES) {
    for (const aspect of ASPECTS) {
      it(`${shape.name} @ aspect ${aspect.toFixed(3)}: visible area is non-increasing as text grows`, () => {
        const area = (lines: number) =>
          visibleAreaFraction(androidCropWindow(aspect, shape.orientation, shape.height, lines));
        const lo = area(2);
        const mid = area(5);
        const hi = area(8);
        expect(mid).toBeLessThanOrEqual(lo + 1e-9);
        expect(hi).toBeLessThanOrEqual(mid + 1e-9);
      });
    }
  }
});
