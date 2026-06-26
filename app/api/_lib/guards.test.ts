import { describe, it, expect } from "vitest";
import { parseRcsContentBody, BadRequestError } from "@/app/api/_lib/guards";
import { DEFAULT_CARD } from "@/lib/sampleContent";

describe("parseRcsContentBody", () => {
  it("accepts a standaloneRichCard rcsContentBody", () => {
    expect(parseRcsContentBody(DEFAULT_CARD).type).toBe("standaloneRichCard");
  });
  it("rejects a wrong discriminant", () => {
    expect(() => parseRcsContentBody({ type: "text", cardContent: {} })).toThrow(/standaloneRichCard/);
  });
  it("rejects a missing cardContent", () => {
    expect(() => parseRcsContentBody({ type: "standaloneRichCard" })).toThrow(BadRequestError);
  });
  it("rejects a non-object body", () => {
    expect(() => parseRcsContentBody("nope")).toThrow(BadRequestError);
  });
});
