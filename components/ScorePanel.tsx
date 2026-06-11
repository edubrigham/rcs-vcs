"use client";

/**
 * Deterministic score readout: overall + per-platform scores, the four
 * weighted sub-scores, warnings (severity-sorted) and recommendations.
 */

import type { ScoreResult, Warning } from "@/types/rcs";
import {
  InlineCitation,
  InlineCitationCard,
  InlineCitationCardBody,
  InlineCitationCardTrigger,
  InlineCitationCarousel,
  InlineCitationCarouselContent,
  InlineCitationCarouselHeader,
  InlineCitationCarouselIndex,
  InlineCitationCarouselItem,
  InlineCitationCarouselNext,
  InlineCitationCarouselPrev,
  InlineCitationSource,
} from "@/components/ai-elements/inline-citation";
import { parseRecommendationCitations } from "@/lib/recommendationCitations";

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
            <p className="text-sm text-emerald-600 dark:text-emerald-400">
              No platform risks detected — this content should render consistently.
            </p>
          ) : (
            <div className="space-y-3">
              <div className="flex flex-wrap gap-1.5">
                <span className="rounded-full border border-rose-500/20 bg-white px-2 py-0.5 font-mono text-[10px] text-rose-700">
                  Critical {severityCounts.critical}
                </span>
                <span className="rounded-full border border-amber-400/30 bg-white px-2 py-0.5 font-mono text-[10px] text-amber-700">
                  Warning {severityCounts.warning}
                </span>
                <span className="rounded-full border border-sky-400/30 bg-white px-2 py-0.5 font-mono text-[10px] text-sky-700">
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
                    <span className="mt-0.5 text-emerald-600 dark:text-emerald-400">→</span>
                    <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                      <span>{parsed.text}</span>
                      {parsed.citations.length > 0 ? (
                        <InlineCitation>
                          <InlineCitationCard>
                            <InlineCitationCardTrigger
                              sources={parsed.citations.map((citation) => citation.url)}
                            />
                            <InlineCitationCardBody>
                              <InlineCitationCarousel>
                                <InlineCitationCarouselHeader>
                                  <InlineCitationCarouselPrev />
                                  <InlineCitationCarouselNext />
                                  <InlineCitationCarouselIndex />
                                </InlineCitationCarouselHeader>
                                <InlineCitationCarouselContent>
                                  {parsed.citations.map((citation) => (
                                    <InlineCitationCarouselItem key={`${citation.url}-${citation.label}`}>
                                      <InlineCitationSource
                                        title={citation.displayTitle}
                                        url={citation.url}
                                        description={citation.description}
                                      />
                                    </InlineCitationCarouselItem>
                                  ))}
                                </InlineCitationCarouselContent>
                              </InlineCitationCarousel>
                            </InlineCitationCardBody>
                          </InlineCitationCard>
                        </InlineCitation>
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
