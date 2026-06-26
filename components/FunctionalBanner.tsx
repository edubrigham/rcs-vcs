"use client";

import type { FunctionalResult } from "@/types/rcs";

/**
 * Functional-compliance strip: the binary "will the Naxai API accept this?" axis
 * (validateFunctional), shown above the quality score. Pure presentation. Uses
 * the app's theme tokens (var(--color-secondary)/destructive, text-body) so it
 * stays readable on the light theme, matching ScorePanel.
 */
export default function FunctionalBanner({ result }: { result: FunctionalResult }) {
  if (result.passes) {
    return (
      <div className="rounded-xl border border-[var(--color-secondary)]/40 bg-[var(--color-secondary)]/10 px-4 py-2.5 text-sm font-medium text-[var(--color-secondary)]">
        ✓ Functionally valid — the Naxai API would accept this card.
      </div>
    );
  }
  return (
    <div className="rounded-xl border border-[var(--color-destructive)]/40 bg-[var(--color-destructive)]/10 px-4 py-3 text-sm">
      <p className="font-semibold text-[var(--color-destructive)]">✕ The Naxai API would reject this card:</p>
      <ul className="mt-1.5 list-disc space-y-1 pl-5 text-[13px] text-body">
        {result.violations.map((v, i) => (
          <li key={i}>
            {v.message} <span className="font-mono text-[11px] text-muted">[{v.citation}]</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
