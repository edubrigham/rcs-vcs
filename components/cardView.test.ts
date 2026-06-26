import { describe, it, expect } from "vitest";
import { cardToView, viewToParts } from "@/components/cardView";
import type { FocalPoint, MediaIntrospection, StandaloneRichCard } from "@/types/rcs";

const focal: FocalPoint = { x: 0.5, y: 0.5 };
const videoCard: StandaloneRichCard = {
  type: "standaloneRichCard",
  cardOrientation: "VERTICAL",
  cardContent: { title: "Clip", media: { height: "TALL", contentInfo: { fileUrl: "https://ex/v.mp4" } } },
};
const videoMedia: MediaIntrospection = { mediaType: "video", mimeType: "video/mp4", fileSizeBytes: 4_200_000 };

describe("cardView adapter — media type", () => {
  it("exposes mediaType on the view", () => {
    expect(cardToView(videoCard, videoMedia, focal).mediaType).toBe("video");
  });

  it("preserves video media across a round-trip (no image dimensions)", () => {
    const view = cardToView(videoCard, videoMedia, focal);
    const parts = viewToParts({ ...view, title: "Clip 2" }, videoMedia);
    expect(parts.media).toEqual(videoMedia); // not wiped to undefined
    expect(parts.card.cardContent.title).toBe("Clip 2"); // edit still applied
  });
});
