import { describe, it, expect } from "vitest";
import { cardFormatToOrientationHeight, legacyToCard, cardToLegacy } from "@/lib/model/cardModel";
import type { RcsContent } from "@/types/rcs";

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

describe("bidirectional legacy↔card adapter", () => {
  it("round-trips legacy → card → legacy", () => {
    const legacy: RcsContent = {
      title: "Hi", description: "There",
      imageUrl: "https://x/y.png",
      imageMetadata: { width: 1080, height: 720, aspectRatio: 1.5 },
      actions: [
        { id: "a", type: "openUrl", label: "Shop", value: "https://shop", primary: true },
        { id: "b", type: "reply", label: "Maybe", value: "maybe" },
      ],
      focalPoint: { x: 0.5, y: 0.5 },
      cardFormat: "tall",
    };

    const { card, media, focal } = legacyToCard(legacy);
    expect(card.cardOrientation).toBe("VERTICAL");
    expect(card.cardContent.media?.height).toBe("TALL");
    expect(card.cardContent.media?.contentInfo.fileUrl).toBe("https://x/y.png");
    expect(card.cardContent.suggestions?.[0]).toEqual({ type: "action", text: "Shop", action: { type: "openUrlAction", url: "https://shop" } });
    expect(card.cardContent.suggestions?.[1]).toEqual({ type: "reply", text: "Maybe", postbackData: "maybe" });
    const back = cardToLegacy(card, media, focal);
    expect(back.cardFormat).toBe("tall");
    expect(back.actions[0].type).toBe("openUrl");
    expect(back.actions[0].primary).toBe(true);     // first action-type → primary
  });

  it("round-trips compact format", () => {
    const legacy: RcsContent = {
      title: "Compact", description: "Card",
      imageUrl: "https://x/compact.png",
      imageMetadata: { width: 1200, height: 400, aspectRatio: 3.0 },
      actions: [{ id: "1", type: "openUrl", label: "Go", value: "https://example.com", primary: true }],
      focalPoint: { x: 0.5, y: 0.5 },
      cardFormat: "compact",
    };

    const { card, media, focal } = legacyToCard(legacy);
    expect(card.cardOrientation).toBe("HORIZONTAL");
    const back = cardToLegacy(card, media, focal);
    expect(back.cardFormat).toBe("compact");
  });
});
