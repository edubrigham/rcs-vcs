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

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo } from "react";
import BeforeAfterComparison from "@/components/BeforeAfterComparison";
import { scoreTone } from "@/components/ScorePanel";
import { useSimulator } from "@/components/SimulatorProvider";
import StepNav from "@/components/StepNav";
import { improveRcsContent } from "@/lib/improveRcsContent";
import { scoreRcsContent } from "@/lib/scoreRcsContent";

export default function ImprovePage() {
  const router = useRouter();
  const { content, replaceContent, toggles } = useSimulator();

  const score = useMemo(() => scoreRcsContent(content), [content]);
  const improved = useMemo(() => improveRcsContent(content, score), [content, score]);
  const improvedScore = useMemo(
    () => scoreRcsContent(improved.improvedContent),
    [improved],
  );

  function adoptImprovements() {
    replaceContent(improved.improvedContent);
    router.push("/");
  }

  return (
    <main className="mx-auto w-full max-w-[1500px] px-5 pb-24 pt-8">
      {/* ── Header: title row + centered step navigation ── */}
      <header className="mb-8 border-b border-line pb-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <Link
              href="/"
              className="font-mono text-[11px] uppercase tracking-[0.3em] text-accent transition hover:opacity-80"
            >
              ← Back to simulator
            </Link>
            <h1 className="font-display mt-1 text-3xl font-bold tracking-tight text-heading sm:text-4xl">
              Improvement Studio
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">
              Playbook recommendations applied deterministically: shorter text, one CTA with
              compliant replies, a safer focal point. Overall score{" "}
              <strong className={scoreTone(score.overallScore)}>{score.overallScore}</strong>
              {" → "}
              <strong className={scoreTone(improvedScore.overallScore)}>
                {improvedScore.overallScore}
              </strong>
              .
            </p>
          </div>
          <button
            type="button"
            onClick={adoptImprovements}
            className="rounded-xl bg-sky-500 px-5 py-2.5 text-sm font-semibold text-white shadow-[0_8px_24px_-8px_rgba(14,165,233,0.7)] transition hover:bg-sky-400 active:scale-[0.98]"
          >
            Adopt improved content in the editor
          </button>
        </div>
        <StepNav />
      </header>

      {/* ── Before / after ── */}
      <BeforeAfterComparison
        original={content}
        originalScore={score}
        improved={improved}
        improvedScore={improvedScore}
        toggles={toggles}
      />

      <footer className="mt-16 border-t border-line pt-5 font-mono text-[10px] leading-relaxed text-faint">
        Deterministic simulation — no AI involved yet; the Anthropic Agent SDK layer plugs in
        behind the same interface. This is an approximation based on the RCS UX playbooks:
        actual rendering may vary by device, font size, app version, and orientation.
      </footer>
    </main>
  );
}
