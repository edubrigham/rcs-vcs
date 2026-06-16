export interface RecommendationCitation {
  label: string;
  url: string;
  title: string;
  description: string;
  displayTitle: string;
}

type SourceDocKey = "xPlatform" | "Card Media";

const SOURCE_DOCS: Record<SourceDocKey, { title: string; url: string }> = {
  xPlatform: {
    title: "xPlatform Playbook (Apr 2026)",
    url: "https://www.gstatic.com/rbm-devsite/ux/xPlatformPlaybook_April2026.pdf",
  },
  "Card Media": {
    title: "Card Media Playbook (Mar 2026)",
    url: "https://www.gstatic.com/rbm-devsite/ux/CardMediaPlaybook_March2026.pdf",
  },
};

// One blurb per slide actually cited in the scoring/improver code. Each
// summarizes the rule THIS app leans on from that slide (a slide may say more).
// Every label emitted anywhere in lib/ must have an entry here, or its citation
// chip is silently dropped — guarded by recommendationCitations.test.ts.
const SECTION_BLURBS: Record<string, string> = {
  "xPlatform s9": "Use one https:// hyperlink as the last element, or a suggested OpenURL action; set og:image for a card-style preview.",
  "xPlatform s11": "Rich cards/carousels: keep title + description within ~3 lines, with one CTA action and up to 3 replies.",
  "xPlatform s12": "Vertical rich card: 3:2 media with a 5% safe zone; carousels: 16:9.",
  "xPlatform s13": "Prefer the Tall card format for stronger cross-platform consistency.",
  "xPlatform s15": "iOS renders the media at 60×60 DP; on Android, vertical cropping worsens as the text gets longer.",
  "xPlatform s16": "Keep critical media subject matter inside the centered 1:1 safe area.",
  "xPlatform s17": "Rich cards: max 4 suggestions (1 action + up to 3 replies), 25 chars each; don't combine rich-card and message suggestions in one turn.",
  "xPlatform s18": "Rich-card suggestions are persistent; message suggestions are transient on Android.",
  "xPlatform s21": "Place the action first — iOS always shows actions above replies.",
  "xPlatform s23": "Keep title + description within 6 lines, or iOS hides media and buttons behind a full-text page.",
  "xPlatform s25": "Keep descriptions short; Android caps card length at 576px, then shows a “More” page.",
  "xPlatform s28": "iOS preserves portrait media; Android center-crops all portrait media.",
  "xPlatform s29": "iOS preserves portrait media; Android center-crops all portrait media.",
  "xPlatform s42": "iOS collapses 3+ actions into an “Options” dropdown with replies listed below; Android shows card suggestions inline and later message suggestions as transient chips.",
  "Card Media p6": "Favor tight, subject-led composition over dead space.",
  "Card Media p8": "Vertical rich card best ratios: short 7:2, medium 21:9, tall 3:2.",
  "Card Media p12": "Keep key subject matter inside the visual safe area.",
  "Card Media p13": "Horizontal/compact cards use a fixed 128 DP media width and need shorter text.",
  "Card Media p28": "iOS preserves native aspect for non-extreme media; use 3:2 or 4:3 for vertical cards.",
  "Card Media p29": "iOS preserves native aspect for non-extreme media; use 3:2 or 4:3 for vertical cards.",
  "Card Media p39": "Keep critical content within the central 80–90% so cross-platform crops preserve it.",
};

function buildDisplayTitle(label: string): string {
  const xPlatformMatch = label.match(/^xPlatform\s+s(\d+)$/i);
  if (xPlatformMatch) {
    return `xPlatform Playbook - slide ${xPlatformMatch[1]}`;
  }

  const cardMediaMatch = label.match(/^Card Media\s+p(\d+)$/i);
  if (cardMediaMatch) {
    // The Card Media Playbook is page-based ("p" = PDF page), not slide-numbered.
    return `Card Media Playbook - page ${cardMediaMatch[1]}`;
  }

  return label;
}

function citationPage(label: string): string | null {
  const xPlatformMatch = label.match(/^xPlatform\s+s(\d+)$/i);
  if (xPlatformMatch) return xPlatformMatch[1];
  const cardMediaMatch = label.match(/^Card Media\s+p(\d+)$/i);
  if (cardMediaMatch) return cardMediaMatch[1];
  return null;
}

function expandRangeLabel(label: string): string[] {
  // Accept both "s15-16" and the form the code actually emits, "s15-s16".
  const xPlatformRange = label.match(/^xPlatform\s+s(\d+)-s?(\d+)$/i);
  if (xPlatformRange) {
    const start = Number(xPlatformRange[1]);
    const end = Number(xPlatformRange[2]);
    if (!Number.isNaN(start) && !Number.isNaN(end) && end >= start) {
      return Array.from({ length: end - start + 1 }, (_, i) => `xPlatform s${start + i}`);
    }
  }

  const cardMediaRange = label.match(/^Card Media\s+p(\d+)-p?(\d+)$/i);
  if (cardMediaRange) {
    const start = Number(cardMediaRange[1]);
    const end = Number(cardMediaRange[2]);
    if (!Number.isNaN(start) && !Number.isNaN(end) && end >= start) {
      return Array.from({ length: end - start + 1 }, (_, i) => `Card Media p${start + i}`);
    }
  }

  return [label];
}

export function citationsFromLabels(labels: string[]): RecommendationCitation[] {
  const expanded = labels.flatMap(expandRangeLabel);
  const deduped = Array.from(new Set(expanded));

  return deduped
    .filter((label) => label in SECTION_BLURBS)
    .map((label) => {
      const key: SourceDocKey = label.startsWith("Card Media") ? "Card Media" : "xPlatform";
      const source = SOURCE_DOCS[key];
      const page = citationPage(label);
      return {
        label,
        title: source.title,
        url: page ? `${source.url}#page=${page}` : source.url,
        description: SECTION_BLURBS[label],
        displayTitle: buildDisplayTitle(label),
      };
    });
}

export function parseRecommendationCitations(message: string): {
  text: string;
  citations: RecommendationCitation[];
} {
  const refMatch = message.match(/\(([^()]+)\)\.?$/);
  if (!refMatch) return { text: message, citations: [] };

  const text = message.slice(0, refMatch.index).trim();
  const refsRaw = refMatch[1].split(",").map((token) => token.trim().replace(/\.$/, ""));
  let currentDoc: SourceDocKey | null = null;

  const normalizedLabels = refsRaw.map((token) => {
    if (token.startsWith("xPlatform Playbook")) {
      currentDoc = "xPlatform";
      return token.replace("xPlatform Playbook", "xPlatform").trim();
    }
    if (token.startsWith("Card Media Playbook")) {
      currentDoc = "Card Media";
      return token.replace("Card Media Playbook", "Card Media").trim();
    }
    if (token.startsWith("xPlatform")) {
      currentDoc = "xPlatform";
      return token;
    }
    if (token.startsWith("Card Media")) {
      currentDoc = "Card Media";
      return token;
    }
    return currentDoc ? `${currentDoc} ${token}` : token;
  });

  const citations = citationsFromLabels(normalizedLabels);

  return { text, citations };
}
