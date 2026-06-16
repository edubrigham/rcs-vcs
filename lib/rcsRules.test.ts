import { describe, expect, it } from "vitest";
import {
  ANDROID_RULES,
  cropSeverityForLines,
  estimateLines,
  estimateTextLines,
  getPlatformRules,
  IOS_RULES,
  recommendedAspectForFormat,
} from "@/lib/rcsRules";

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

describe("recommendedAspectForFormat", () => {
  it("returns the playbook source ratio per format", () => {
    expect(recommendedAspectForFormat("compact")).toMatchObject({ aspect: 9 / 16, label: "9:16" });
    expect(recommendedAspectForFormat("medium")).toMatchObject({ aspect: 21 / 9, label: "21:9" });
    expect(recommendedAspectForFormat("tall")).toMatchObject({ aspect: 3 / 2, label: "3:2" });
  });
});

describe("getPlatformRules — key playbook facts", () => {
  it("renders iOS compact media as a 60×60 DP thumbnail (xPlatform s15)", () => {
    const r = getPlatformRules("ios", "compact", 0);
    expect(r.mediaWidth).toBe(IOS_RULES.compactMediaSizeDp);
    expect(r.mediaHeight).toBe(60);
    expect(r.mediaLayout).toBe("thumbnail");
    expect(r.maxVisibleActions).toBe(IOS_RULES.maxInlineActions);
  });

  it("uses the fixed 128 DP media width for the Android compact card (CardMedia p13)", () => {
    const r = getPlatformRules("android", "compact", 0);
    expect(r.mediaWidth).toBe(ANDROID_RULES.horizontalCardMediaWidthDp);
    expect(r.mediaLayout).toBe("horizontal");
  });

  it("shrinks Android compact media height as text grows (xPlatform s15)", () => {
    const low = getPlatformRules("android", "compact", 2); // low severity
    const high = getPlatformRules("android", "compact", 8); // high severity
    expect(high.mediaHeight).toBeLessThan(low.mediaHeight);
    expect(high.cropSeverity).toBe("high");
  });
});
