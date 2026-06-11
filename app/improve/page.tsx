"use client";

/**
 * Phase 2 — the improvement studio: deterministic playbook fixes applied to
 * the card authored on the main page, shown as a before/after comparison.
 *
 * The improvement is recomputed from the shared simulator state, so this page
 * is always in sync with the editor — no stale snapshots.
 *
 * TODO: replace deterministic improveRcsContent with the Anthropic Agent SDK
 *       (the agent must load /skills/rcs-playbook-rules as its source of truth).
 */

import { useMemo } from "react";
import BeforeAfterComparison from "@/components/BeforeAfterComparison";
import { scoreTone } from "@/components/ScorePanel";
import { useSimulator } from "@/components/SimulatorProvider";
import StepNav from "@/components/StepNav";
import { improveRcsContent } from "@/lib/improveRcsContent";
import { scoreRcsContent } from "@/lib/scoreRcsContent";

export default function ImprovePage() {
  const { content, toggles } = useSimulator();

  const score = useMemo(() => scoreRcsContent(content), [content]);
  const improved = useMemo(() => improveRcsContent(content, score), [content, score]);
  const improvedScore = useMemo(
    () => scoreRcsContent(improved.improvedContent),
    [improved],
  );

  return (
    <main className="mx-auto w-full max-w-[1500px] px-5 pb-24 pt-8">
      {/* ── Header: title row + centered step navigation ── */}
      <header className="mb-8 border-b border-line pb-6">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-accent">
            Naxai · RCS Lab
          </p>
          <h1 className="font-display mt-1 text-3xl font-bold tracking-tight text-heading sm:text-4xl">
            Improvement Studio
          </h1>
        </div>
        <StepNav />
      </header>

      <section className="mb-6 rounded-xl border border-line bg-panel px-4 py-3">
        <p className="text-sm leading-relaxed text-muted">
          Deterministic playbook pass: shorter copy, tighter action structure, and safer subject
          framing for cross-platform consistency. Deterministic compliance score{" "}
          <strong className={scoreTone(score.overallScore)}>{score.overallScore}</strong>
          {" → "}
          <strong className={scoreTone(improvedScore.overallScore)}>{improvedScore.overallScore}</strong>.
        </p>
      </section>

      {/* ── Before / after ── */}
      <BeforeAfterComparison
        original={content}
        originalScore={score}
        improved={improved}
        improvedScore={improvedScore}
        toggles={toggles}
      />

      
    </main>
  );
}
