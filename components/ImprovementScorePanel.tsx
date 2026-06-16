"use client";

/**
 * Compliance score card for the Playbook Pass sidebar: the deterministic score
 * AFTER the pass, with each metric showing its before→after jump (faint bar =
 * before, accent bar = after).
 */

import { scoreTone } from "@/components/ScorePanel";
import type { ScoreResult } from "@/types/rcs";

const SUBS: { label: string; weight: string; key: keyof ScoreResult }[] = [
  { label: "Image safe zone", weight: "35%", key: "imageSafeZoneScore" },
  { label: "Text fit", weight: "30%", key: "textFitScore" },
  { label: "Suggested actions", weight: "20%", key: "actionScore" },
  { label: "Layout / platform risk", weight: "15%", key: "layoutScore" },
];

export default function ImprovementScorePanel({
  before,
  after,
}: {
  before: ScoreResult;
  after: ScoreResult;
}) {
  return (
    <div className="rounded-xl border border-line bg-panel p-4">
      <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted">
        Compliance score · after
      </p>
      <p className="font-display text-5xl font-bold tabular-nums">
        <span className="text-2xl font-medium text-faint">{before.overallScore} → </span>
        <span className={scoreTone(after.overallScore)}>{after.overallScore}</span>
        <span className="text-lg font-medium text-faint">/100</span>
      </p>
      <div className="mt-2 flex gap-4 font-mono text-[11px] text-muted">
        <span>
          iOS{" "}
          <strong className={scoreTone(after.iosScore)}>
            {before.iosScore}→{after.iosScore}
          </strong>
        </span>
        <span>
          Android{" "}
          <strong className={scoreTone(after.androidScore)}>
            {before.androidScore}→{after.androidScore}
          </strong>
        </span>
      </div>

      <div className="mt-4 flex flex-col gap-2.5">
        {SUBS.map((s) => {
          const was = before[s.key] as number;
          const now = after[s.key] as number;
          return (
            <div key={s.key}>
              <div className="flex items-baseline justify-between text-[11px]">
                <span className="text-body">{s.label}</span>
                <span className="font-mono text-muted">
                  {was} → {now} · w {s.weight}
                </span>
              </div>
              <div className="relative mt-1 h-1.5 overflow-hidden rounded-full bg-panel-strong">
                <div
                  className="absolute h-full rounded-full bg-line-strong opacity-50"
                  style={{ width: `${was}%` }}
                />
                <div
                  className="absolute h-full rounded-full bg-[var(--color-secondary)] transition-all duration-500"
                  style={{ width: `${now}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
