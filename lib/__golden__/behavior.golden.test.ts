import { describe, it, expect } from "vitest";
import { scoreRcsContent } from "@/lib/scoreRcsContent";
import { improveRcsContent } from "@/lib/improveRcsContent";
import { DEFAULT_CARD, DEFAULT_MEDIA, DEFAULT_FOCAL } from "@/lib/sampleContent";
import type { FocalPoint, MediaIntrospection, StandaloneRichCard } from "@/types/rcs";

type Case = { card: StandaloneRichCard; media?: MediaIntrospection; focal?: FocalPoint };

const cases: Record<string, Case> = {
  default: { card: DEFAULT_CARD, media: DEFAULT_MEDIA, focal: DEFAULT_FOCAL },
  compactNoImage: {
    card: { ...DEFAULT_CARD, cardContent: { ...DEFAULT_CARD.cardContent, media: undefined } },
    media: undefined,
    focal: DEFAULT_FOCAL,
  },
  longText: {
    card: {
      ...DEFAULT_CARD,
      cardContent: {
        ...DEFAULT_CARD.cardContent,
        title: "A very long title ".repeat(6),
        description: "Long ".repeat(80),
      },
    },
    media: DEFAULT_MEDIA,
    focal: DEFAULT_FOCAL,
  },
};

describe("behavior golden", () => {
  for (const [name, c] of Object.entries(cases)) {
    it(`score:${name}`, () => {
      expect(scoreRcsContent(c.card, c.media, c.focal)).toMatchSnapshot();
    });
    it(`improve:${name}`, () => {
      const score = scoreRcsContent(c.card, c.media, c.focal);
      expect(improveRcsContent(c.card, c.media, c.focal, score)).toMatchSnapshot();
    });
  }
});
