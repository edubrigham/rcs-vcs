"use client";

import type { FunctionalResult } from "@/types/rcs";

/**
 * Functional-compliance strip: the binary "will the Naxai API accept this?" axis
 * (validateFunctional), shown above the quality score. Pure presentation.
 */
export default function FunctionalBanner({ result }: { result: FunctionalResult }) {
  if (result.passes) {
    return (
      <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-2.5 text-sm text-emerald-300">
        ✓ Functionally valid — the Naxai API would accept this card.
      </div>
    );
  }
  return (
    <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
      <p className="font-semibold">✕ The Naxai API would reject this card:</p>
      <ul className="mt-1.5 list-disc space-y-1 pl-5 text-[13px] text-rose-200/90">
        {result.violations.map((v, i) => (
          <li key={i}>
            {v.message} <span className="font-mono text-[11px] text-rose-300/70">[{v.citation}]</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
