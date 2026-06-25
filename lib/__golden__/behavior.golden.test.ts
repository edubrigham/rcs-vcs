import { describe, it, expect } from "vitest";
import { scoreRcsContent } from "@/lib/scoreRcsContent";
import { improveRcsContent } from "@/lib/improveRcsContent";
import { DEFAULT_CONTENT } from "@/lib/sampleContent";
import type { RcsContent } from "@/types/rcs";

const cases: Record<string, RcsContent> = {
  default: DEFAULT_CONTENT,
  compactNoImage: { ...DEFAULT_CONTENT, cardFormat: "compact", imageUrl: null, imageMetadata: undefined },
  longText: { ...DEFAULT_CONTENT, title: "A very long title ".repeat(6), description: "Long ".repeat(80) },
};

describe("behavior golden", () => {
  for (const [name, content] of Object.entries(cases)) {
    it(`score:${name}`, () => {
      expect(scoreRcsContent(content)).toMatchSnapshot();
    });
    it(`improve:${name}`, () => {
      expect(improveRcsContent(content, scoreRcsContent(content))).toMatchSnapshot();
    });
  }
});
