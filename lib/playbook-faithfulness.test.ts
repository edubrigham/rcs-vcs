/**
 * Faithfulness regression suite — locks the bug fixes and gap closures from the
 * multi-agent playbook audit, plus boundary cases for previously-untested rules.
 */
import { describe, expect, it } from "vitest";
import { applyVerticalCrop, criticalSquareWindow, getVisibleWindow } from "@/lib/cropMath";
import { citationsFromLabels, parseRecommendationCitations } from "@/lib/recommendationCitations";
import { scoreActions, scoreImage, scoreLayout, scoreText } from "@/lib/scoreRcsContent";
import type { RcsContent } from "@/types/rcs";

const CLEAN: RcsContent = {
  title: "Galaxy S26 Ultra",
  description: "Free delivery and setup.",
  imageUrl: "x",
  imageMetadata: { width: 1620, height: 1080, aspectRatio: 1620 / 1080 },
  actions: [{ id: "a", type: "openUrl", label: "View product", value: "https://x.example" }],
  focalPoint: { x: 0.5, y: 0.5 },
  cardFormat: "tall",
};

// ───────────────── BUG-5: s11 is cross-platform, not iOS-only ─────────────────
describe("s11 3-line recommendation checks BOTH platforms (BUG-5)", () => {
  // Keep the image (centered, in-spec) so the only layout penalty isolated here
  // is the −10 for the Android-only 3-line breach.
  const content: RcsContent = {
    ...CLEAN,
    title: "Spring Sale",
    description: "Save twenty percent on all our newest phones today",
    cardFormat: "compact",
  };
  it("fires when Android wraps past 3 lines even though iOS stays at 3", () => {
    const r = scoreText(content);
    expect(
      r.warnings.some(
        (w) => w.platform === "both" && w.category === "text" && /recommended 3 lines/.test(w.message),
      ),
    ).toBe(true);
  });
  it("docks the layout score by 10 for the same Android-only breach", () => {
    expect(scoreLayout(content).score).toBe(90);
  });
});

// ───────────────── GAP-2: iOS overflow 200/2000 char caps ─────────────────
describe("iOS full-text-page caps 200/2000 (GAP-2)", () => {
  it("warns when title>200 or description>2000, distinct from the 6-line critical", () => {
    const r = scoreText({
      ...CLEAN,
      title: "x".repeat(250),
      description: "y".repeat(2500),
      cardFormat: "tall",
    });
    expect(r.warnings.some((w) => /200/.test(w.message))).toBe(true);
    expect(r.warnings.some((w) => /2000/.test(w.message))).toBe(true);
  });
  it("does not fire at or below the caps", () => {
    const r = scoreText({ ...CLEAN, title: "x".repeat(200), description: "y".repeat(2000) });
    expect(r.warnings.some((w) => /200-character|2000-character/.test(w.message))).toBe(false);
  });
});

// ───────────────── GAP-1: action-before-replies (s21) ─────────────────
describe("action-after-reply ordering is penalised (GAP-1, s21)", () => {
  const replyFirst: RcsContent = {
    ...CLEAN,
    actions: [
      { id: "r", type: "reply", label: "Maybe later", value: "LATER" },
      { id: "a", type: "openUrl", label: "Buy now", value: "https://x" },
    ],
  };
  it("warns and penalises iOS when an action sits after a reply", () => {
    const r = scoreActions(replyFirst);
    expect(r.warnings.some((w) => /s21/.test(w.recommendation ?? ""))).toBe(true);
    expect(r.ios).toBeLessThan(100);
  });
  it("action-first scores higher than reply-first (delta is visible)", () => {
    const actionFirst: RcsContent = {
      ...replyFirst,
      actions: [replyFirst.actions[1], replyFirst.actions[0]],
    };
    expect(scoreActions(actionFirst).ios).toBeGreaterThan(scoreActions(replyFirst).ios);
  });
});

// ───────────────── https check is case-insensitive ─────────────────
describe("openUrl https check (RFC 3986 case-insensitive)", () => {
  const withUrl = (value: string): RcsContent => ({
    ...CLEAN,
    actions: [{ id: "a", type: "openUrl", label: "Go", value }],
  });
  it("flags http:// but not HTTPS://", () => {
    expect(scoreActions(withUrl("http://x")).warnings.some((w) => /https/.test(w.message))).toBe(true);
    expect(scoreActions(withUrl("HTTPS://x")).warnings.some((w) => /https/.test(w.message))).toBe(false);
  });
});

// ───────────────── suggestion boundaries (s17/s42) ─────────────────
describe("suggestion boundaries", () => {
  const acts = (...a: RcsContent["actions"]): RcsContent => ({ ...CLEAN, actions: a });
  it("2 CTAs → no iOS dropdown; 3 CTAs → dropdown", () => {
    const two = acts(
      { id: "1", type: "openUrl", label: "Buy", value: "https://x" },
      { id: "2", type: "dial", label: "Call", value: "+3220000000" },
    );
    const three = acts(
      { id: "1", type: "openUrl", label: "Buy", value: "https://x" },
      { id: "2", type: "dial", label: "Call", value: "+3220000000" },
      { id: "3", type: "openUrl", label: "More", value: "https://x/m" },
    );
    expect(scoreActions(two).warnings.some((w) => /dropdown/.test(w.message))).toBe(false);
    expect(scoreActions(three).warnings.some((w) => /dropdown/.test(w.message))).toBe(true);
  });
  it("25-char label OK, 26 flagged", () => {
    const ok = acts({ id: "1", type: "openUrl", label: "x".repeat(25), value: "https://x" });
    const bad = acts({ id: "1", type: "openUrl", label: "x".repeat(26), value: "https://x" });
    expect(scoreActions(ok).warnings.some((w) => /25-character/.test(w.message))).toBe(false);
    expect(scoreActions(bad).warnings.some((w) => /25-character/.test(w.message))).toBe(true);
  });
  it("1 action + 3 replies = clean; + 4 replies = reply-cap + 4-total criticals", () => {
    const mk = (n: number) =>
      acts(
        { id: "a", type: "openUrl", label: "Buy", value: "https://x" },
        ...Array.from({ length: n }, (_, i) => ({
          id: `r${i}`,
          type: "reply" as const,
          label: `R${i}`,
          value: `R${i}`,
        })),
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
    const r = scoreImage({
      ...CLEAN,
      cardFormat: "compact",
      imageMetadata: { width: 900, height: 1600, aspectRatio: 0.5625 },
      focalPoint: { x: 0.5, y: 0.05 },
    });
    expect(r.ios).toBe(50);
  });
  it("vertical extreme aspect → iOS −25 = 75", () => {
    const r = scoreImage({
      ...CLEAN,
      cardFormat: "tall",
      imageMetadata: { width: 3000, height: 1000, aspectRatio: 3 },
      focalPoint: { x: 0.5, y: 0.5 },
    });
    expect(r.ios).toBe(75);
  });
  it("vertical focal outside safe zone → iOS −20 = 80", () => {
    const r = scoreImage({
      ...CLEAN,
      cardFormat: "tall",
      imageMetadata: { width: 1620, height: 1080, aspectRatio: 1.5 },
      focalPoint: { x: 0.5, y: 0.92 },
    });
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
