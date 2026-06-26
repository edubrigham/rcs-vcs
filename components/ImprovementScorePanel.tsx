"use client";

/**
 * Compliance score card for the Playbook Pass sidebar: the deterministic score
 * AFTER the pass, with each metric showing its before→after jump (faint bar =
 * before, accent bar = after).
 */

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
  const overallDelta = after.overallScore - before.overallScore;

  const overallDeltaText = overallDelta > 0 ? `+${overallDelta}` : `${overallDelta}`;
  const overallDeltaClass =
    overallDelta > 0
      ? "text-[var(--color-secondary)]"
      : overallDelta < 0
        ? "text-[var(--color-destructive)]"
        : "text-muted";

  return (
    <div className="rounded-xl border border-line bg-panel p-4">
      <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted">
        Compliance score · after
      </p>
      <p className="font-display text-5xl font-bold tabular-nums">
        <span className="text-2xl font-medium text-faint">
          {before.overallScore} {"-->"}{" "}
        </span>
        <span className={overallDeltaClass}>{overallDeltaText}</span>
        <span className="text-lg font-medium text-faint"> ({after.overallScore})</span>
      </p>
      <div className="mt-2 flex gap-4 font-mono text-[11px] text-muted">
        <span>
          iOS{" "}
          <strong
            className="font-mono text-muted"
          >
            {before.iosScore} {"-->"}{" "}
            <span
              className={
                after.iosScore - before.iosScore > 0
                  ? "text-[var(--color-secondary)]"
                  : after.iosScore - before.iosScore < 0
                    ? "text-[var(--color-destructive)]"
                    : "text-muted"
              }
            >
              {after.iosScore - before.iosScore > 0
                ? `+${after.iosScore - before.iosScore}`
                : `${after.iosScore - before.iosScore}`}
            </span>{" "}
            <span className="text-faint">({after.iosScore})</span>
          </strong>
        </span>
        <span>
          Android{" "}
          <strong
            className="font-mono text-muted"
          >
            {before.androidScore} {"-->"}{" "}
            <span
              className={
                after.androidScore - before.androidScore > 0
                  ? "text-[var(--color-secondary)]"
                  : after.androidScore - before.androidScore < 0
                    ? "text-[var(--color-destructive)]"
                    : "text-muted"
              }
            >
              {after.androidScore - before.androidScore > 0
                ? `+${after.androidScore - before.androidScore}`
                : `${after.androidScore - before.androidScore}`}
            </span>{" "}
            <span className="text-faint">({after.androidScore})</span>
          </strong>
        </span>
      </div>

      <div className="mt-4 flex flex-col gap-2.5">
        {SUBS.map((s) => {
          const was = before[s.key] as number;
          const now = after[s.key] as number;
          const delta = now - was;
          const deltaText = delta > 0 ? `+${delta}` : `${delta}`;
          const deltaClass =
            delta > 0
              ? "text-[var(--color-secondary)]"
              : delta < 0
                ? "text-[var(--color-destructive)]"
                : "text-muted";

          return (
            <div key={s.key}>
              <div className="flex items-baseline justify-between text-[11px]">
                <span className="text-body">
                  {s.label} (w{s.weight})
                </span>
                <span className="font-mono text-muted">
                  {was} {"-->"} <span className={deltaClass}>{deltaText}</span> ({now})
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
