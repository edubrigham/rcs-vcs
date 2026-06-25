import { describe, it, expect } from "vitest";
import { cardFormatToOrientationHeight } from "@/lib/model/cardModel";

describe("cardFormatToOrientationHeight", () => {
  it("maps compact to HORIZONTAL with no height", () => {
    expect(cardFormatToOrientationHeight("compact")).toEqual({ orientation: "HORIZONTAL", mediaHeight: null });
  });
  it("maps medium to VERTICAL+MEDIUM", () => {
    expect(cardFormatToOrientationHeight("medium")).toEqual({ orientation: "VERTICAL", mediaHeight: "MEDIUM" });
  });
  it("maps tall to VERTICAL+TALL", () => {
    expect(cardFormatToOrientationHeight("tall")).toEqual({ orientation: "VERTICAL", mediaHeight: "TALL" });
  });
});
