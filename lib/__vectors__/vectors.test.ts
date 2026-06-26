/**
 * Golden vectors — the language-agnostic PARITY CONTRACT for the Naxai port.
 *
 * Each representative `rcsContentBody` card runs through the two kernel entry
 * points (validateFunctional + scoreRcsContent); the snapshot is the expected
 * output. The Naxai team runs the same inputs against their ported
 * implementation and asserts identical `{ functional, quality }` — proving the
 * port matches this reference. See docs/PORTING.md.
 */

import { describe, it, expect } from "vitest";
import { validateFunctional } from "@/lib/validateFunctional";
import { scoreRcsContent } from "@/lib/scoreRcsContent";
import type { MediaIntrospection, StandaloneRichCard } from "@/types/rcs";

type Vector = { name: string; card: StandaloneRichCard; media?: MediaIntrospection };

const img = (over: Partial<MediaIntrospection> = {}): MediaIntrospection => ({
  mediaType: "image",
  mimeType: "image/jpeg",
  fileSizeBytes: 240_000,
  width: 1080,
  height: 720,
  aspectRatio: 1.5,
  ...over,
});
const vcard = (cardContent: StandaloneRichCard["cardContent"]): StandaloneRichCard => ({
  type: "standaloneRichCard",
  cardOrientation: "VERTICAL",
  cardContent,
});

const vectors: Vector[] = [
  {
    name: "clean-vertical",
    card: vcard({
      title: "Spring Collection",
      description: "New arrivals, free returns.",
      media: { height: "TALL", contentInfo: { fileUrl: "https://ex/a.jpg" } },
      suggestions: [
        { type: "action", text: "Shop now", action: { type: "openUrlAction", url: "https://ex/shop" } },
        { type: "reply", text: "Notify me" },
      ],
    }),
    media: img(),
  },
  {
    name: "horizontal-thumbnail",
    card: {
      type: "standaloneRichCard",
      cardOrientation: "HORIZONTAL",
      cardContent: {
        title: "Order #4821 shipped",
        description: "Arriving Tuesday.",
        media: { height: "TALL", contentInfo: { fileUrl: "https://ex/p.png" } },
        suggestions: [{ type: "action", text: "Track", action: { type: "openUrlAction", url: "https://ex/track" } }],
      },
    },
    media: img({ mimeType: "image/png", width: 600, height: 600, aspectRatio: 1 }),
  },
  { name: "title-too-long", card: vcard({ title: "T".repeat(201), description: "x" }) },
  {
    name: "too-many-suggestions",
    card: vcard({
      title: "Pick one",
      suggestions: [
        { type: "reply", text: "a" },
        { type: "reply", text: "b" },
        { type: "reply", text: "c" },
        { type: "reply", text: "d" },
        { type: "reply", text: "e" },
      ],
    }),
  },
  {
    name: "unsupported-media",
    card: vcard({ title: "Promo", media: { height: "TALL", contentInfo: { fileUrl: "https://ex/a.bmp" } } }),
    media: img({ mimeType: "image/bmp", width: 100, height: 100, aspectRatio: 1 }),
  },
  {
    name: "oversized-thumbnail",
    card: vcard({ title: "Promo", media: { height: "MEDIUM", contentInfo: { fileUrl: "https://ex/a.png" } } }),
    media: img({ mimeType: "image/png", thumbnailSizeBytes: 150_000, width: 800, height: 450, aspectRatio: 16 / 9 }),
  },
  { name: "text-only-no-media", card: vcard({ title: "Just text", description: "No media here." }) },
];

describe("golden vectors (Naxai port parity contract)", () => {
  for (const v of vectors) {
    it(v.name, () => {
      expect({
        functional: validateFunctional(v.card, v.media),
        quality: scoreRcsContent(v.card, v.media),
      }).toMatchSnapshot();
    });
  }
});
