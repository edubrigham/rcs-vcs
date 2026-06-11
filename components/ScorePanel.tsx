"use client";

/**
 * Deterministic score readout: overall + per-platform scores, the four
 * weighted sub-scores, warnings (severity-sorted) and recommendations.
 */

import type { ScoreResult, Warning } from "@/types/rcs";

export function scoreTone(score: number): string {
  if (score >= 80) return "text-emerald-600 dark:text-emerald-400";
  if (score >= 60) return "text-amber-600 dark:text-amber-400";
  return "text-rose-600 dark:text-rose-400";
}

function barTone(score: number): string {
  if (score >= 80) return "bg-emerald-400";
  if (score >= 60) return "bg-amber-400";
  return "bg-rose-400";
}

const SEVERITY_STYLE: Record<Warning["severity"], { dot: string; label: string }> = {
  critical: { dot: "bg-rose-500", label: "text-rose-600 dark:text-rose-400" },
  warning: { dot: "bg-amber-400", label: "text-amber-600 dark:text-amber-400" },
  info: { dot: "bg-sky-400", label: "text-sky-600 dark:text-sky-400" },
};

const PLATFORM_LABEL: Record<Warning["platform"], string> = {
  ios: "iOS",
  android: "Android",
  both: "Both",
};

export default function ScorePanel({ score }: { score: ScoreResult }) {
  const subScores = [
    { label: "Image safe zone", weight: "35%", value: score.imageSafeZoneScore },
    { label: "Text fit", weight: "30%", value: score.textFitScore },
    { label: "Suggested actions", weight: "20%", value: score.actionScore },
    { label: "Layout / platform risk", weight: "15%", value: score.layoutScore },
  ];

  return (
    <div className="grid gap-4 lg:grid-cols-[230px_1fr]">
      {/* totals + sub-scores */}
      <div className="rounded-xl border border-line bg-panel p-4">
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted">
          Compatibility score
        </p>
        <p className={`font-display text-5xl font-bold tabular-nums ${scoreTone(score.overallScore)}`}>
          {score.overallScore}
          <span className="text-lg font-medium text-faint">/100</span>
        </p>
        <div className="mt-2 flex gap-4 font-mono text-[11px] text-muted">
          <span>
            iOS <strong className={scoreTone(score.iosScore)}>{score.iosScore}</strong>
          </span>
          <span>
            Android{" "}
            <strong className={scoreTone(score.androidScore)}>{score.androidScore}</strong>
          </span>
        </div>

        <div className="mt-4 flex flex-col gap-2.5">
          {subScores.map((s) => (
            <div key={s.label}>
              <div className="flex items-baseline justify-between text-[11px]">
                <span className="text-body">{s.label}</span>
                <span className="font-mono text-muted">
                  {s.value} · w {s.weight}
                </span>
              </div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-panel-strong">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${barTone(s.value)}`}
                  style={{ width: `${s.value}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* warnings + recommendations */}
      <div className="flex flex-col gap-4">
        <div className="rounded-xl border border-line bg-panel p-4">
          <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.2em] text-muted">
            Warnings · {score.warnings.length}
          </p>
          {score.warnings.length === 0 ? (
            <p className="text-sm text-emerald-600 dark:text-emerald-400">
              No platform risks detected — this content should render consistently.
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {score.warnings.map((w, i) => (
                <li key={i} className="flex items-start gap-2.5 text-[13px] leading-snug">
                  <span
                    className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${SEVERITY_STYLE[w.severity].dot}`}
                  />
                  <span className="text-body">
                    <span
                      className={`mr-1.5 font-mono text-[9px] uppercase tracking-wider ${SEVERITY_STYLE[w.severity].label}`}
                    >
                      {w.severity}
                    </span>
                    <span className="mr-1.5 rounded bg-panel-strong px-1 py-px font-mono text-[9px] uppercase text-muted">
                      {PLATFORM_LABEL[w.platform]}
                    </span>
                    <span className="mr-1.5 rounded bg-panel px-1 py-px font-mono text-[9px] uppercase text-muted">
                      {w.category}
                    </span>
                    {w.message}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {score.recommendations.length > 0 && (
          <div className="rounded-xl border border-line bg-panel p-4">
            <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.2em] text-muted">
              Recommendations
            </p>
            <ul className="flex flex-col gap-1.5">
              {score.recommendations.map((r, i) => (
                <li key={i} className="flex items-start gap-2 text-[13px] leading-snug text-body">
                  <span className="mt-0.5 text-emerald-600 dark:text-emerald-400">→</span>
                  {r.message}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
