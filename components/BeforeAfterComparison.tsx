"use client";

/**
 * Phase 2 readout: original vs improved, per platform.
 * Top row: iOS original → iOS improved.
 * Bottom row: Android original → Android improved.
 */

import { scoreTone } from "@/components/ScorePanel";
import PlatformPreview from "@/components/PlatformPreview";
import RcsCardPreview from "@/components/RcsCardPreview";
import type {
  ImprovedRcsContent,
  OverlayToggles,
  Platform,
  RcsContent,
  ScoreResult,
} from "@/types/rcs";

interface BeforeAfterComparisonProps {
  original: RcsContent;
  originalScore: ScoreResult;
  improved: ImprovedRcsContent;
  improvedScore: ScoreResult;
  toggles: OverlayToggles;
}

function ScoreChip({ value, delta }: { value: number; delta?: number }) {
  return (
    <span className="flex items-center gap-1.5 rounded-full border border-line bg-field px-2 py-0.5 font-mono text-[11px]">
      <span className={`font-semibold ${scoreTone(value)}`}>{value}</span>
      {delta !== undefined && delta !== 0 && (
        <span className={delta > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}>
          {delta > 0 ? `▲ +${delta}` : `▼ ${delta}`}
        </span>
      )}
    </span>
  );
}

export default function BeforeAfterComparison({
  original,
  originalScore,
  improved,
  improvedScore,
  toggles,
}: BeforeAfterComparisonProps) {
  const platformScore = (score: ScoreResult, platform: Platform) =>
    platform === "ios" ? score.iosScore : score.androidScore;

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_300px]">
      <div className="flex flex-col gap-8">
        {(["ios", "android"] as const).map((platform) => (
          <div key={platform} className="flex flex-wrap items-start justify-center gap-6">
            <PlatformPreview
              platform={platform}
              caption="Original"
              scoreChip={<ScoreChip value={platformScore(originalScore, platform)} />}
            >
              <RcsCardPreview
                content={original}
                platform={platform}
                toggles={toggles}
                variant="original"
              />
            </PlatformPreview>

            <div className="hidden self-center text-2xl text-faint sm:block">→</div>

            <PlatformPreview
              platform={platform}
              caption="Improved"
              scoreChip={
                <ScoreChip
                  value={platformScore(improvedScore, platform)}
                  delta={
                    platformScore(improvedScore, platform) -
                    platformScore(originalScore, platform)
                  }
                />
              }
            >
              <RcsCardPreview
                content={improved.improvedContent}
                platform={platform}
                toggles={toggles}
                variant="improved"
                subjectPoint={original.focalPoint}
                secondaryActions={improved.secondaryActions}
              />
            </PlatformPreview>
          </div>
        ))}
      </div>

      {/* applied changes */}
      <aside className="h-fit rounded-xl border border-emerald-500/20 bg-emerald-500/[0.04] p-4 xl:sticky xl:top-6">
        <p className="mb-1 font-mono text-[10px] uppercase tracking-[0.2em] text-emerald-600 dark:text-emerald-400">
          Changes applied
        </p>
        <p className="mb-3 font-mono text-[11px] text-muted">
          Overall {originalScore.overallScore} →{" "}
          <span className={scoreTone(improvedScore.overallScore)}>
            {improvedScore.overallScore}
          </span>
        </p>
        <ul className="flex flex-col gap-2">
          {improved.changes.map((change, i) => (
            <li key={i} className="flex items-start gap-2 text-[13px] leading-snug text-body">
              <span className="mt-0.5 shrink-0 text-emerald-600 dark:text-emerald-400">✓</span>
              {change}
            </li>
          ))}
        </ul>
        <p className="mt-4 border-t border-line pt-3 font-mono text-[10px] leading-relaxed text-muted">
          Deterministic simulation — no AI involved yet. The agent layer
          (Anthropic Agent SDK + playbook skills) plugs in behind the same
          interface. See lib/improveRcsContent.ts.
        </p>
      </aside>
    </div>
  );
}
