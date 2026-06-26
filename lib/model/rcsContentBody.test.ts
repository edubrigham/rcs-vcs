import { describe, it, expect } from "vitest";
import type { Action, RcsContentBody } from "@/types/rcs";

describe("rcsContentBody (Naxai Broadcasts input contract)", () => {
  it("discriminates a text message from a standalone rich card", () => {
    const text: RcsContentBody = { type: "text", text: "Hello" };
    const card: RcsContentBody = {
      type: "standaloneRichCard",
      cardOrientation: "VERTICAL",
      cardContent: { title: "Hi" },
    };
    expect(text.type).toBe("text");
    expect(card.type).toBe("standaloneRichCard");
  });

  it("Action union mirrors the Broadcasts contract (no shareLocationAction)", () => {
    const allowed: Action["type"][] = [
      "openUrlAction",
      "dialAction",
      "viewLocationAction",
      "createCalendarEventAction",
    ];
    // @ts-expect-error shareLocationAction is not part of rcsContentBody
    const removed: Action = { type: "shareLocationAction" };
    expect(allowed).toHaveLength(4);
    expect(removed).toBeDefined();
  });
});
