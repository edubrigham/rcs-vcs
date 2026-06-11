"use client";

/**
 * Deterministic score readout: overall + per-platform scores, the four
 * weighted sub-scores, warnings (severity-sorted) and recommendations.
 */

import type { ScoreResult, Warning } from "@/types/rcs";
import InlineSlideCitation from "@/components/InlineSlideCitation";
import { parseRecommendationCitations } from "@/lib/recommendationCitations";

export function scoreTone(score: number): string {
  if (score >= 80) return "text-[var(--color-secondary)]";
  if (score >= 60) return "text-[var(--color-accent)]";
  return "text-[var(--color-destructive)]";
}

function barTone(score: number): string {
  if (score >= 80) return "bg-[var(--color-secondary)]";
  if (score >= 60) return "bg-[var(--color-accent)]";
  return "bg-[var(--color-destructive)]";
}

const SEVERITY_STYLE: Record<Warning["severity"], { dot: string; label: string }> = {
  critical: { dot: "bg-[var(--color-destructive)]", label: "text-[var(--color-destructive)]" },
  warning: { dot: "bg-[var(--color-accent)]", label: "text-[var(--color-accent)]" },
  info: { dot: "bg-[var(--color-primary)]", label: "text-[var(--color-primary)]" },
};

export default function ScorePanel({ score }: { score: ScoreResult }) {
  const subScores = [
    { label: "Image safe zone", weight: "35%", value: score.imageSafeZoneScore },
    { label: "Text fit", weight: "30%", value: score.textFitScore },
    { label: "Suggested actions", weight: "20%", value: score.actionScore },
    { label: "Layout / platform risk", weight: "15%", value: score.layoutScore },
  ];
  const severityCounts = {
    critical: score.warnings.filter((warning) => warning.severity === "critical").length,
    warning: score.warnings.filter((warning) => warning.severity === "warning").length,
    info: score.warnings.filter((warning) => warning.severity === "info").length,
  };
  const warningGroups: Array<{
    key: Warning["platform"];
    title: string;
    warnings: Warning[];
  }> = [
    {
      key: "ios",
      title: "iOS",
      warnings: score.warnings.filter((warning) => warning.platform === "ios"),
    },
    {
      key: "android",
      title: "Android",
      warnings: score.warnings.filter((warning) => warning.platform === "android"),
    },
    {
      key: "both",
      title: "Cross-platform",
      warnings: score.warnings.filter((warning) => warning.platform === "both"),
    },
  ];

  return (
    <div className="grid gap-4 lg:grid-cols-[230px_1fr]">
      {/* totals + sub-scores */}
      <div className="rounded-xl border border-line bg-panel p-4">
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted">
          Deterministic playbook compliance score
        </p>
        <p className={`font-display text-5xl font-bold tabular-nums ${scoreTone(score.overallScore)}`}>
          {score.overallScore}
          <span className="text-lg font-medium text-faint">/100</span>
        </p>
        <p className="mt-1 text-[11px] leading-relaxed text-muted">
          Weighted heuristic model: image safe zone (35%), text fit (30%), suggestions/actions
          (20%), layout risk (15%).
        </p>
        <p className="mt-1 text-[11px] leading-relaxed text-muted">
          This score reflects deterministic rule compliance in this simulator, not real campaign
          delivery or conversion performance.
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
        <div className="rounded-xl border border-line bg-white p-4">
          <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.2em] text-muted">
            Warnings · {score.warnings.length}
          </p>
          {score.warnings.length === 0 ? (
            <p className="text-sm text-[var(--color-secondary)]">
              No platform risks detected — this content should render consistently.
            </p>
          ) : (
            <div className="space-y-3">
              <div className="flex flex-wrap gap-1.5">
                <span className="rounded-full border border-[var(--color-destructive)]/25 bg-white px-2 py-0.5 font-mono text-[10px] text-[var(--color-destructive)]">
                  Critical {severityCounts.critical}
                </span>
                <span className="rounded-full border border-[var(--color-accent)]/35 bg-white px-2 py-0.5 font-mono text-[10px] text-[var(--color-accent)]">
                  Warning {severityCounts.warning}
                </span>
                <span className="rounded-full border border-[var(--color-primary)]/35 bg-white px-2 py-0.5 font-mono text-[10px] text-[var(--color-primary)]">
                  Info {severityCounts.info}
                </span>
              </div>

              <div className="grid gap-2 md:grid-cols-3">
                {warningGroups.map((group) => (
                  <div key={group.key} className="rounded-xl border border-line bg-white p-3 shadow-[0_6px_20px_-18px_rgba(15,23,42,0.4)]">
                    <p className="mb-2 flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.14em] text-muted">
                      <span>{group.title}</span>
                      <span className="rounded border border-line px-1.5 py-px text-[9px]">{group.warnings.length}</span>
                    </p>
                    {group.warnings.length === 0 ? (
                      <p className="text-[12px] text-muted">No warnings.</p>
                    ) : (
                      <ul className="flex flex-col gap-2">
                        {group.warnings.map((w, i) => (
                          <li key={`${group.key}-${i}`} className="flex items-start gap-2 text-[12px] leading-snug">
                            <span
                              className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${SEVERITY_STYLE[w.severity].dot}`}
                            />
                            <span className="text-body">{w.message}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {score.recommendations.length > 0 && (
          <div className="rounded-xl border border-line bg-panel p-4">
            <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.2em] text-muted">
              Recommendations
            </p>
            <ul className="flex flex-col gap-2">
              {score.recommendations.map((r, i) => {
                const parsed = parseRecommendationCitations(r.message);
                return (
                  <li key={i} className="flex items-start gap-2 text-[13px] leading-snug text-body">
                    <span className="mt-0.5 text-[var(--color-secondary)]">→</span>
                    <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                      <span>{parsed.text}</span>
                      {parsed.citations.length > 0 ? (
                        <InlineSlideCitation labels={parsed.citations.map((citation) => citation.label)} />
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
