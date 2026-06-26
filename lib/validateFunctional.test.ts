import { describe, it, expect } from "vitest";
import { validateFunctional } from "@/lib/validateFunctional";
import { FUNCTIONAL_LIMITS, SUPPORTED_IMAGE_MIME, SUPPORTED_VIDEO_MIME } from "@/lib/rcsRules";
import type { MediaIntrospection, StandaloneRichCard, Suggestion } from "@/types/rcs";

const card = (over: Partial<StandaloneRichCard["cardContent"]> = {}): StandaloneRichCard => ({
  type: "standaloneRichCard",
  cardOrientation: "VERTICAL",
  cardContent: { title: "Hi", description: "There", ...over },
});
const reply = (text: string): Suggestion => ({ type: "reply", text });
const img = (over: Partial<MediaIntrospection> = {}): MediaIntrospection => ({
  mediaType: "image",
  mimeType: "image/png",
  fileSizeBytes: 1000,
  ...over,
});

describe("FUNCTIONAL_LIMITS / supported MIME", () => {
  it("matches the OpenAPI hard limits", () => {
    expect(FUNCTIONAL_LIMITS.TITLE_MAX).toBe(200);
    expect(FUNCTIONAL_LIMITS.DESCRIPTION_MAX).toBe(2000);
    expect(FUNCTIONAL_LIMITS.SUGGESTION_MAX).toBe(4);
    expect(FUNCTIONAL_LIMITS.LABEL_MAX).toBe(25);
    expect(FUNCTIONAL_LIMITS.THUMBNAIL_MAX_BYTES).toBe(100_000);
    expect(FUNCTIONAL_LIMITS.OPEN_URL_MAX).toBe(2048);
    expect(SUPPORTED_IMAGE_MIME).toContain("image/png");
    expect(SUPPORTED_VIDEO_MIME).toContain("video/mp4");
  });
});

describe("validateFunctional", () => {
  it("passes a clean card", () => {
    expect(validateFunctional(card()).passes).toBe(true);
  });
  it("flags title at 201", () => {
    const r = validateFunctional(card({ title: "x".repeat(201) }));
    expect(r.passes).toBe(false);
    expect(r.violations.map((v) => v.limit)).toContain("titleLength");
  });
  it("flags description at 2001", () => {
    const r = validateFunctional(card({ description: "y".repeat(2001) }));
    expect(r.violations.map((v) => v.limit)).toContain("descriptionLength");
  });
  it("flags >4 suggestions and a 26-char label", () => {
    const r = validateFunctional(card({ suggestions: [reply("a"), reply("b"), reply("c"), reply("d"), reply("y".repeat(26))] }));
    expect(r.violations.map((v) => v.limit).sort()).toEqual(["labelLength", "suggestionCount"]);
  });
  it("flags an empty card", () => {
    const r = validateFunctional(card({ title: undefined, description: undefined }));
    expect(r.violations.map((v) => v.limit)).toContain("emptyCard");
  });
  it("flags an open-url over 2048 chars", () => {
    const url = "https://x/" + "a".repeat(2050);
    const r = validateFunctional(card({ suggestions: [{ type: "action", text: "Go", action: { type: "openUrlAction", url } }] }));
    expect(r.violations.map((v) => v.limit)).toContain("openUrlLength");
  });
  it("flags an unsupported media type", () => {
    const r = validateFunctional(card(), img({ mimeType: "image/bmp" }));
    expect(r.violations.map((v) => v.limit)).toContain("mediaType");
  });
  it("accepts a supported video type", () => {
    const r = validateFunctional(card(), img({ mediaType: "video", mimeType: "video/mp4" }));
    expect(r.violations.map((v) => v.limit)).not.toContain("mediaType");
  });
  it("flags a thumbnail over 100 kB", () => {
    const r = validateFunctional(card(), img({ thumbnailSizeBytes: 100_001 }));
    expect(r.violations.map((v) => v.limit)).toContain("thumbnailSize");
  });
});
