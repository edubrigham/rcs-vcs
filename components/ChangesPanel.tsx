"use client";

/**
 * The "Changes applied" card for the Playbook Pass sidebar — grouped by the
 * part of the card each change touches (Text / Image / Actions / Format), so it
 * reads as logical content edits rather than a platform-mixed flat list.
 */

import InlineSlideCitation from "@/components/InlineSlideCitation";
import { parseRecommendationCitations } from "@/lib/recommendationCitations";
import type { ImprovementCategory, ImprovementChange } from "@/types/rcs";

const ORDER: ImprovementCategory[] = ["text", "image", "actions", "format", "general"];

const META: Record<ImprovementCategory, { label: string; icon: string }> = {
  text: { label: "Text", icon: "T" },
  image: { label: "Image", icon: "▦" },
  actions: { label: "Actions", icon: "⌖" },
  format: { label: "Format", icon: "▭" },
  general: { label: "General", icon: "•" },
};

export default function ChangesPanel({ changes }: { changes: ImprovementChange[] }) {
  const groups = ORDER.map((category) => ({
    category,
    items: changes.filter((c) => c.category === category),
  })).filter((g) => g.items.length > 0);

  return (
    <div className="rounded-xl border border-line bg-panel p-4">
      <p className="mb-3 font-mono text-[10px] uppercase tracking-[0.2em] text-muted">
        Changes applied
      </p>

      <div className="flex flex-col gap-3.5">
        {groups.map(({ category, items }) => (
          <div key={category}>
            <div className="mb-1.5 flex items-center gap-2">
              <span className="flex h-5 w-5 items-center justify-center rounded-md bg-panel-strong font-mono text-[11px] text-[var(--color-accent)]">
                {META[category].icon}
              </span>
              <span className="font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-heading">
                {META[category].label}
              </span>
            </div>
            <ul className="flex flex-col gap-1.5 pl-0.5">
              {items.map((c, i) => {
                const parsed = parseRecommendationCitations(c.message);
                return (
                  <li key={i} className="flex items-start gap-2 text-[13px] leading-snug text-body">
                    <span className="mt-0.5 shrink-0 text-[var(--color-secondary)]">✓</span>
                    <span className="flex min-w-0 flex-wrap items-center gap-1.5">
                      <span>{parsed.text}</span>
                      {parsed.citations.length > 0 && (
                        <InlineSlideCitation labels={parsed.citations.map((cit) => cit.label)} />
                      )}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>

      <p className="mt-4 border-t border-line pt-3 font-mono text-[10px] leading-relaxed text-muted">
        Deterministic simulation — no AI yet. The agent layer (Anthropic Agent SDK + playbook
        skills) plugs in behind the same interface. See lib/improveRcsContent.ts.
      </p>
    </div>
  );
}
