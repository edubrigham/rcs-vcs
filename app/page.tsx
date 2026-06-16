"use client";

/**
 * Phase 1 — the visual simulator: author a card, see iOS/Android side by
 * side, get the deterministic compatibility score.
 *
 * Phase 2 (improvement simulation + before/after) lives on /improve.
 *
 * TODO: replace deterministic improveRcsContent with the Anthropic Agent SDK
 *       (the agent must load /skills/rcs-playbook-rules as its source of truth).
 */

import { useMemo } from "react";
import PlatformPreview from "@/components/PlatformPreview";
import PreviewToolbar from "@/components/PreviewToolbar";
import RcsCardPreview from "@/components/RcsCardPreview";
import RcsInputPanel from "@/components/RcsInputPanel";
import ScorePanel from "@/components/ScorePanel";
import { useSimulator } from "@/components/SimulatorProvider";
import StepNav from "@/components/StepNav";
import { scoreRcsContent } from "@/lib/scoreRcsContent";

export default function Home() {
  const { content, patchContent, toggles, setToggles } = useSimulator();

  const score = useMemo(() => scoreRcsContent(content), [content]);

  return (
    <main className="mx-auto w-full max-w-[1500px] px-5 pb-24 pt-8">
      {/* ── Header: title row + centered step navigation ── */}
      <header className="mb-8 border-b border-line pb-6">
        <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-accent">
          Naxai · RCS Lab
        </p>
        <h1 className="font-display mt-1 text-3xl font-bold tracking-tight text-heading sm:text-4xl">
          RCS Visual Compatibility Simulator
        </h1>
        
        <StepNav />
      </header>

      {/* ── Editor + previews ── */}
      <div className="grid gap-8 lg:grid-cols-[minmax(330px,390px)_1fr]">
        <RcsInputPanel content={content} onContentChange={patchContent} toggles={toggles} />

        <div className="flex flex-col gap-8">
          <div className="overflow-hidden rounded-2xl border border-line bg-[radial-gradient(ellipse_at_top,rgba(56,130,246,0.08),transparent_60%)]">
            <PreviewToolbar
              cardFormat={content.cardFormat}
              onFormatChange={(cardFormat) => patchContent({ cardFormat })}
              toggles={toggles}
              onTogglesChange={setToggles}
            />

            {/* Draft always shows BOTH platforms side by side — the tool's
                signature comparison; no device filter here. */}
            <div className="flex flex-wrap items-start justify-center gap-8 p-6 pb-2">
              <PlatformPreview platform="ios" caption="iOS">
                <RcsCardPreview content={content} platform="ios" toggles={toggles} />
              </PlatformPreview>
              <PlatformPreview platform="android" caption="Android">
                <RcsCardPreview content={content} platform="android" toggles={toggles} />
              </PlatformPreview>
            </div>
          </div>

          <ScorePanel score={score} />

        </div>
      </div>
    </main>
  );
}
