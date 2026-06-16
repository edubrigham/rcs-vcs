"use client";

/**
 * Phase 2 — Playbook Pass: deterministic playbook fixes applied to the card
 * authored on the Draft page, shown as a before/after.
 *
 * Reuses the Draft page's chrome (PreviewToolbar) so the two pages feel
 * continuous: the size buttons, platform toggles and overlay filters all drive
 * the same shared state, and switching size here re-runs the pass for that size.
 *
 * Layout: left 2/3 = toolbar + full-size Before→After device grid; right 1/3 =
 * compliance score (after) on top, changes (by category) below.
 *
 * TODO: replace deterministic improveRcsContent with the Anthropic Agent SDK
 *       (the agent must load /skills/rcs-playbook-rules as its source of truth).
 */

import { useRouter } from "next/navigation";
import { useMemo } from "react";
import BeforeAfterComparison from "@/components/BeforeAfterComparison";
import ChangesPanel from "@/components/ChangesPanel";
import ImprovementScorePanel from "@/components/ImprovementScorePanel";
import PreviewToolbar from "@/components/PreviewToolbar";
import { useSimulator } from "@/components/SimulatorProvider";
import StepNav from "@/components/StepNav";
import { improveRcsContent } from "@/lib/improveRcsContent";
import { scoreRcsContent } from "@/lib/scoreRcsContent";

export default function ImprovePage() {
  const router = useRouter();
  const { content, patchContent, replaceContent, toggles, setToggles, platforms, setPlatforms } =
    useSimulator();

  const score = useMemo(() => scoreRcsContent(content), [content]);
  const improved = useMemo(() => improveRcsContent(content, score), [content, score]);
  const improvedScore = useMemo(() => scoreRcsContent(improved.improvedContent), [improved]);

  function adoptImprovements() {
    replaceContent(improved.improvedContent);
    router.push("/");
  }

  return (
    <main className="mx-auto w-full max-w-[1500px] px-5 pb-24 pt-8">
      {/* ── Header: title + step nav + adopt ── */}
      <header className="mb-8 border-b border-line pb-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-accent">
              Naxai · RCS Lab
            </p>
            <h1 className="font-display mt-1 text-3xl font-bold tracking-tight text-heading sm:text-4xl">
              RCS Visual Compatibility Simulator
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">
              Playbook Pass — the playbook recommendations applied deterministically. Switch size
              or platform with the toolbar; the pass re-runs for what you select.
            </p>
          </div>
          <button
            type="button"
            onClick={adoptImprovements}
            className="rounded-xl bg-[var(--color-accent)] px-5 py-2.5 text-sm font-semibold text-white shadow-[0_8px_24px_-8px_rgba(14,165,233,0.7)] transition hover:opacity-90 active:scale-[0.98]"
          >
            Adopt improved content in the editor
          </button>
        </div>
        <StepNav />
      </header>

      {/* ── Left 2/3 preview · Right 1/3 sidebar ── */}
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(320px,360px)]">
        <div className="overflow-hidden rounded-2xl border border-line bg-[radial-gradient(ellipse_at_top,rgba(56,130,246,0.08),transparent_60%)]">
          <PreviewToolbar
            cardFormat={content.cardFormat}
            onFormatChange={(cardFormat) => patchContent({ cardFormat })}
            platforms={platforms}
            onPlatformsChange={setPlatforms}
            toggles={toggles}
            onTogglesChange={setToggles}
          />
          <div className="px-4 py-8 sm:px-6">
            <BeforeAfterComparison
              original={content}
              originalScore={score}
              improved={improved}
              improvedScore={improvedScore}
              toggles={toggles}
              platforms={platforms}
            />
          </div>
        </div>

        <aside className="flex h-fit flex-col gap-4 lg:sticky lg:top-6">
          <ImprovementScorePanel before={score} after={improvedScore} />
          <ChangesPanel changes={improved.changes} />
        </aside>
      </div>

      <footer className="mt-16 border-t border-line pt-5 font-mono text-[10px] leading-relaxed text-faint">
        Rendering rules sourced from Google&apos;s RCS for Business playbooks: Card Media Playbook
        (March 2026) &amp; X-Platform Playbook (April 2026). Local MVP — no data leaves the browser.
      </footer>
    </main>
  );
}
