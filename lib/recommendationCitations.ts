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

const SECTION_BLURBS: Record<string, string> = {
  "xPlatform s11": "Use concise copy with one primary action and up to three suggestions/replies.",
  "xPlatform s13": "Prefer the Tall card format for stronger cross-platform consistency.",
  "xPlatform s15": "Long text increases Android crop pressure and layout risk.",
  "xPlatform s16": "Keep critical media subject matter inside the central safe area.",
  "xPlatform s17": "Keep suggestion count and labels constrained for reliable display.",
  "xPlatform s18": "Suggestion sets can be transient on Android between turns.",
  "xPlatform s21": "Action/reply ordering varies by platform; preserve CTA intent explicitly.",
  "xPlatform s23": "Prevent text overflow that hides CTA actions.",
  "xPlatform s25": "Keep descriptions short to reduce truncation and preview drift.",
  "xPlatform s42": "Sequence suggestion sets carefully in multi-step interactions.",
  "Card Media p6": "Favor tight, subject-led composition over dead space.",
  "Card Media p12": "Keep key subject matter inside the visual safe area.",
  "Card Media p13": "Horizontal/compact cards require shorter supporting text.",
  "Card Media p39": "Center critical subject matter so cross-platform crops preserve it.",
};

function buildDisplayTitle(label: string): string {
  const xPlatformMatch = label.match(/^xPlatform\s+s(\d+)$/i);
  if (xPlatformMatch) {
    return `xPlatform Playbook - slide ${xPlatformMatch[1]}`;
  }

  const cardMediaMatch = label.match(/^Card Media\s+p(\d+)$/i);
  if (cardMediaMatch) {
    return `Card Media Playbook - slide ${cardMediaMatch[1]}`;
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
  const xPlatformRange = label.match(/^xPlatform\s+s(\d+)-(\d+)$/i);
  if (xPlatformRange) {
    const start = Number(xPlatformRange[1]);
    const end = Number(xPlatformRange[2]);
    if (!Number.isNaN(start) && !Number.isNaN(end) && end >= start) {
      return Array.from({ length: end - start + 1 }, (_, i) => `xPlatform s${start + i}`);
    }
  }

  const cardMediaRange = label.match(/^Card Media\s+p(\d+)-(\d+)$/i);
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
