import { describe, it, expect } from "vitest";
import { parseCardBody, BadRequestError } from "@/app/api/_lib/guards";
import { DEFAULT_CARD } from "@/lib/sampleContent";

describe("parseCardBody", () => {
  it("accepts a well-formed card body", () => {
    expect(parseCardBody({ card: DEFAULT_CARD }).card.type).toBe("standaloneRichCard");
  });
  it("passes media + focal through", () => {
    const { media, focal } = parseCardBody({
      card: DEFAULT_CARD,
      media: { mediaType: "image", mimeType: "image/png", fileSizeBytes: 1 },
      focal: { x: 0.2, y: 0.3 },
    });
    expect(media?.mimeType).toBe("image/png");
    expect(focal).toEqual({ x: 0.2, y: 0.3 });
  });
  it("rejects a missing card", () => {
    expect(() => parseCardBody({})).toThrow(BadRequestError);
  });
  it("rejects a wrong discriminant", () => {
    expect(() => parseCardBody({ card: { type: "text", cardContent: {} } })).toThrow(/standaloneRichCard/);
  });
  it("rejects a non-object body", () => {
    expect(() => parseCardBody("nope")).toThrow(BadRequestError);
  });
});
