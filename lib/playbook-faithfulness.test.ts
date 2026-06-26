/**
 * Faithfulness regression suite — locks the bug fixes and gap closures from the
 * playbook audit, plus boundary cases for previously-untested rules. Native model.
 */
import { describe, expect, it } from "vitest";
import { applyVerticalCrop, criticalSquareWindow, getVisibleWindow } from "@/lib/cropMath";
import { citationsFromLabels, parseRecommendationCitations } from "@/lib/recommendationCitations";
import { scoreActions, scoreImage, scoreLayout, scoreText } from "@/lib/scoreRcsContent";
import type { FocalPoint, MediaIntrospection, StandaloneRichCard, Suggestion } from "@/types/rcs";

const CLEAN: StandaloneRichCard = {
  type: "standaloneRichCard",
  cardOrientation: "VERTICAL",
  cardContent: {
    title: "Galaxy S26 Ultra",
    description: "Free delivery and setup.",
    media: { height: "TALL", contentInfo: { fileUrl: "x" } },
    suggestions: [{ type: "action", text: "View product", action: { type: "openUrlAction", url: "https://x.example" } }],
  },
};
const CLEAN_MEDIA: MediaIntrospection = {
  mediaType: "image",
  mimeType: "image/png",
  fileSizeBytes: 0,
  width: 1620,
  height: 1080,
  aspectRatio: 1620 / 1080,
};
const CLEAN_FOCAL: FocalPoint = { x: 0.5, y: 0.5 };

function media(aspectRatio: number, width: number, height: number): MediaIntrospection {
  return { mediaType: "image", mimeType: "image/png", fileSizeBytes: 0, width, height, aspectRatio };
}
/** CLEAN with overridden text + orientation/height. */
function textCard(over: Partial<{ title: string; description: string; orientation: "HORIZONTAL" | "VERTICAL"; height: "SHORT" | "MEDIUM" | "TALL" }>): StandaloneRichCard {
  return {
    ...CLEAN,
    cardOrientation: over.orientation ?? CLEAN.cardOrientation,
    cardContent: {
      ...CLEAN.cardContent,
      title: over.title ?? CLEAN.cardContent.title,
      description: over.description ?? CLEAN.cardContent.description,
      media: { height: over.height ?? "TALL", contentInfo: { fileUrl: "x" } },
    },
  };
}
/** CLEAN with the given suggestions. */
function acts(...suggestions: Suggestion[]): StandaloneRichCard {
  return { ...CLEAN, cardContent: { ...CLEAN.cardContent, suggestions } };
}

// ───────────────── BUG-5: s11 is cross-platform, not iOS-only ─────────────────
describe("s11 3-line recommendation checks BOTH platforms (BUG-5)", () => {
  const card = textCard({
    title: "Spring Sale",
    description: "Save twenty percent on all our newest phones today",
    orientation: "HORIZONTAL",
  });
  it("fires when Android wraps past 3 lines even though iOS stays at 3", () => {
    const r = scoreText(card);
    expect(
      r.warnings.some(
        (w) => w.platform === "both" && w.category === "text" && /recommended 3 lines/.test(w.message),
      ),
    ).toBe(true);
  });
  it("docks the layout score by 10 for the same Android-only breach", () => {
    expect(scoreLayout(card).score).toBe(90);
  });
});

// ───────────────── GAP-2: iOS overflow 200/2000 char caps ─────────────────
describe("iOS full-text-page caps 200/2000 (GAP-2)", () => {
  it("warns when title>200 or description>2000, distinct from the 6-line critical", () => {
    const r = scoreText(textCard({ title: "x".repeat(250), description: "y".repeat(2500), height: "TALL" }));
    expect(r.warnings.some((w) => /200/.test(w.message))).toBe(true);
    expect(r.warnings.some((w) => /2000/.test(w.message))).toBe(true);
  });
  it("does not fire at or below the caps", () => {
    const r = scoreText(textCard({ title: "x".repeat(200), description: "y".repeat(2000) }));
    expect(r.warnings.some((w) => /200-character|2000-character/.test(w.message))).toBe(false);
  });
});

// ───────────────── GAP-1: action-before-replies (s21) ─────────────────
describe("action-after-reply ordering is penalised (GAP-1, s21)", () => {
  const replyFirst = acts(
    { type: "reply", text: "Maybe later", postbackData: "LATER" },
    { type: "action", text: "Buy now", action: { type: "openUrlAction", url: "https://x" } },
  );
  it("warns and penalises iOS when an action sits after a reply", () => {
    const r = scoreActions(replyFirst);
    expect(r.warnings.some((w) => /s21/.test(w.recommendation ?? ""))).toBe(true);
    expect(r.ios).toBeLessThan(100);
  });
  it("action-first scores higher than reply-first (delta is visible)", () => {
    const s = replyFirst.cardContent.suggestions!;
    const actionFirst = acts(s[1], s[0]);
    expect(scoreActions(actionFirst).ios).toBeGreaterThan(scoreActions(replyFirst).ios);
  });
});

// ───────────────── https check is case-insensitive ─────────────────
describe("openUrl https check (RFC 3986 case-insensitive)", () => {
  const withUrl = (url: string) => acts({ type: "action", text: "Go", action: { type: "openUrlAction", url } });
  it("flags http:// but not HTTPS://", () => {
    expect(scoreActions(withUrl("http://x")).warnings.some((w) => /https/.test(w.message))).toBe(true);
    expect(scoreActions(withUrl("HTTPS://x")).warnings.some((w) => /https/.test(w.message))).toBe(false);
  });
});

// ───────────────── suggestion boundaries (s17/s42) ─────────────────
describe("suggestion boundaries", () => {
  it("2 CTAs → no iOS dropdown; 3 CTAs → dropdown", () => {
    const two = acts(
      { type: "action", text: "Buy", action: { type: "openUrlAction", url: "https://x" } },
      { type: "action", text: "Call", action: { type: "dialAction", phoneNumber: "+3220000000" } },
    );
    const three = acts(
      { type: "action", text: "Buy", action: { type: "openUrlAction", url: "https://x" } },
      { type: "action", text: "Call", action: { type: "dialAction", phoneNumber: "+3220000000" } },
      { type: "action", text: "More", action: { type: "openUrlAction", url: "https://x/m" } },
    );
    expect(scoreActions(two).warnings.some((w) => /dropdown/.test(w.message))).toBe(false);
    expect(scoreActions(three).warnings.some((w) => /dropdown/.test(w.message))).toBe(true);
  });
  it("25-char label OK, 26 flagged", () => {
    const ok = acts({ type: "action", text: "x".repeat(25), action: { type: "openUrlAction", url: "https://x" } });
    const bad = acts({ type: "action", text: "x".repeat(26), action: { type: "openUrlAction", url: "https://x" } });
    expect(scoreActions(ok).warnings.some((w) => /25-character/.test(w.message))).toBe(false);
    expect(scoreActions(bad).warnings.some((w) => /25-character/.test(w.message))).toBe(true);
  });
  it("1 action + 3 replies = clean; + 4 replies = reply-cap + 4-total criticals", () => {
    const mk = (n: number) =>
      acts(
        { type: "action", text: "Buy", action: { type: "openUrlAction", url: "https://x" } },
        ...Array.from({ length: n }, (_, i): Suggestion => ({ type: "reply", text: `R${i}`, postbackData: `R${i}` })),
      );
    expect(scoreActions(mk(3)).warnings).toHaveLength(0);
    const four = scoreActions(mk(4));
    expect(four.warnings.some((w) => /up to 3 suggested replies/.test(w.message))).toBe(true);
    expect(four.warnings.some((w) => w.severity === "critical" && /at most 4/.test(w.message))).toBe(true);
  });
});

// ───────────────── scoreImage penalties (s16, p28, p39) ─────────────────
describe("scoreImage penalties", () => {
  it("compact focal outside the 1:1 square AND safe zone → iOS 50 (−35 −15)", () => {
    const r = scoreImage(textCard({ orientation: "HORIZONTAL" }), media(0.5625, 900, 1600), { x: 0.5, y: 0.05 });
    expect(r.ios).toBe(50);
  });
  it("vertical extreme aspect → iOS −25 = 75", () => {
    const r = scoreImage(textCard({ height: "TALL" }), media(3, 3000, 1000), { x: 0.5, y: 0.5 });
    expect(r.ios).toBe(75);
  });
  it("vertical focal outside safe zone → iOS −20 = 80", () => {
    const r = scoreImage(textCard({ height: "TALL" }), media(1.5, 1620, 1080), { x: 0.5, y: 0.92 });
    expect(r.ios).toBe(80);
  });
});

// ───────────────── cropMath additions ─────────────────
describe("cropMath", () => {
  it("applyVerticalCrop keeps a centered vertical slice", () => {
    expect(applyVerticalCrop({ x0: 0, y0: 0, x1: 1, y1: 1 }, 0.5)).toEqual({
      x0: 0,
      y0: 0.25,
      x1: 1,
      y1: 0.75,
    });
  });
  it("criticalSquareWindow(a) === getVisibleWindow(a, 1) for landscape & portrait", () => {
    for (const a of [0.5625, 1.5, 0.85]) {
      const sq = criticalSquareWindow(a);
      const cover = getVisibleWindow(a, 1);
      expect(sq.x0).toBeCloseTo(cover.x0, 12);
      expect(sq.y0).toBeCloseTo(cover.y0, 12);
      expect(sq.x1).toBeCloseTo(cover.x1, 12);
      expect(sq.y1).toBeCloseTo(cover.y1, 12);
    }
  });
});

// ───────────────── citation ranges + page wording (BUG-7) ─────────────────
describe("citations", () => {
  it("expands the Card Media and xPlatform ranges the app emits", () => {
    expect(
      parseRecommendationCitations("x (Card Media Playbook p28-p29).").citations.map((c) => c.label),
    ).toEqual(["Card Media p28", "Card Media p29"]);
    expect(
      parseRecommendationCitations("x (xPlatform Playbook s28-s29).").citations.map((c) => c.label),
    ).toEqual(["xPlatform s28", "xPlatform s29"]);
  });
  it("renders Card Media citations as a PAGE, not a slide (BUG-7)", () => {
    const [c] = citationsFromLabels(["Card Media p39"]);
    expect(c.displayTitle).toContain("page");
    expect(c.displayTitle).not.toContain("slide");
  });
});
