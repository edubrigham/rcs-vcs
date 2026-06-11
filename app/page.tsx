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

import Link from "next/link";
import { useMemo } from "react";
import PlatformPreview from "@/components/PlatformPreview";
import RcsCardPreview from "@/components/RcsCardPreview";
import RcsInputPanel from "@/components/RcsInputPanel";
import ScorePanel from "@/components/ScorePanel";
import { useSimulator } from "@/components/SimulatorProvider";
import StepNav from "@/components/StepNav";
import { improveRcsContent } from "@/lib/improveRcsContent";
import { scoreRcsContent } from "@/lib/scoreRcsContent";
import type { CardFormat, OverlayToggles } from "@/types/rcs";

const DISCLAIMER =
  "This is an approximation based on the RCS UX playbooks. Actual rendering may vary by device, font size, app version, and orientation.";

const CARD_FORMATS: CardFormat[] = ["compact", "medium", "tall"];

/** Overlay toggles rendered as filter icons in the preview toolbar. */
const OVERLAY_FILTERS: { key: keyof OverlayToggles; label: string; icon: React.ReactNode }[] = [
  {
    key: "showSafeZone",
    label: "Safe zone + 1:1 critical area",
    icon: (
      <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.6}>
        <rect x="1.5" y="1.5" width="13" height="13" rx="2" />
        <rect x="5" y="5" width="6" height="6" strokeDasharray="2 1.6" />
      </svg>
    ),
  },
  {
    key: "showCropArea",
    label: "Crop area (what survives)",
    icon: (
      <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.6}>
        <path d="M4 1v11h11M1 4h11v11" />
      </svg>
    ),
  },
  {
    key: "showTextLineLimits",
    label: "Text line limits",
    icon: (
      <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.6}>
        <path d="M2 4h12M2 8h12M2 12h7" />
        <circle cx="11.2" cy="12" r="0.6" fill="currentColor" stroke="none" />
        <circle cx="13" cy="12" r="0.6" fill="currentColor" stroke="none" />
      </svg>
    ),
  },
];

export default function Home() {
  const { content, patchContent, toggles, setToggles, platforms, setPlatforms } =
    useSimulator();

  const score = useMemo(() => scoreRcsContent(content), [content]);

  // Teaser for the /improve page: how many points the deterministic
  // improvements would gain on the current content.
  const potentialGain = useMemo(() => {
    const improved = improveRcsContent(content, score);
    return scoreRcsContent(improved.improvedContent).overallScore - score.overallScore;
  }, [content, score]);

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
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">
          The same rich card renders differently on Apple and Android. Author once, see both,
          and catch cropping, truncation and action-dropdown risks before sending.
        </p>
        <StepNav />
      </header>

      {/* ── Editor + previews ── */}
      <div className="grid gap-8 lg:grid-cols-[minmax(330px,390px)_1fr]">
        <RcsInputPanel content={content} onContentChange={patchContent} toggles={toggles} />

        <div className="flex flex-col gap-8">
          <div className="overflow-hidden rounded-2xl border border-line bg-[radial-gradient(ellipse_at_top,rgba(56,130,246,0.08),transparent_60%)]">
            {/* toolbar: card format (left) + overlay filters and disclaimer (right) */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line bg-panel px-4 py-2.5">
              <div className="flex overflow-hidden rounded-lg border border-line">
                {CARD_FORMATS.map((format, i) => (
                  <button
                    key={format}
                    type="button"
                    onClick={() => patchContent({ cardFormat: format })}
                    aria-pressed={content.cardFormat === format}
                    className={`px-4 py-1.5 text-xs font-semibold capitalize transition ${
                      i > 0 ? "border-l border-line" : ""
                    } ${
                      content.cardFormat === format
                        ? "bg-sky-500/15 text-sky-800"
                        : "text-muted hover:text-body"
                    }`}
                  >
                    {format}
                  </button>
                ))}
              </div>
              {/* platform visibility toggles (moved here from the left panel) */}
              <div className="flex items-center gap-1.5">
                {(["ios", "android"] as const).map((p) => (
                  <button
                    key={p}
                    type="button"
                    aria-pressed={platforms[p]}
                    onClick={() => setPlatforms({ ...platforms, [p]: !platforms[p] })}
                    className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
                      platforms[p]
                        ? "border-emerald-500/60 bg-emerald-500/10 text-emerald-700"
                        : "border-line bg-panel text-muted hover:border-line-strong"
                    }`}
                  >
                    {p === "ios" ? "iOS preview" : "Android preview"}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-1.5">
                {OVERLAY_FILTERS.map((filter) => (
                  <button
                    key={filter.key}
                    type="button"
                    title={filter.label}
                    aria-label={filter.label}
                    aria-pressed={toggles[filter.key]}
                    onClick={() =>
                      setToggles({ ...toggles, [filter.key]: !toggles[filter.key] })
                    }
                    className={`flex h-8 w-8 items-center justify-center rounded-lg border transition ${
                      toggles[filter.key]
                        ? "border-sky-500/60 bg-sky-500/10 text-sky-700"
                        : "border-line bg-panel text-muted hover:border-line-strong"
                    }`}
                  >
                    {filter.icon}
                  </button>
                ))}
                <span
                  title={DISCLAIMER}
                  className="ml-1 cursor-help font-mono text-xs text-faint"
                  aria-label={DISCLAIMER}
                >
                  ⓘ
                </span>
              </div>
            </div>

            <div className="flex flex-wrap items-start justify-center gap-8 p-6 pb-2">
              {platforms.ios && (
                <PlatformPreview platform="ios" caption="iOS">
                  <RcsCardPreview content={content} platform="ios" toggles={toggles} />
                </PlatformPreview>
              )}
              {platforms.android && (
                <PlatformPreview platform="android" caption="Android">
                  <RcsCardPreview content={content} platform="android" toggles={toggles} />
                </PlatformPreview>
              )}
              {!platforms.ios && !platforms.android && (
                <p className="py-20 text-sm text-muted">
                  Enable at least one platform preview in the panel on the left.
                </p>
              )}
            </div>
          </div>

          <ScorePanel score={score} />

          {/* ── Phase 2 entry point ── */}
          <div className="flex flex-wrap items-center gap-4 rounded-2xl border border-line bg-panel p-5">
            <div className="min-w-52 flex-1">
              <h2 className="font-display text-lg font-semibold text-heading">
                Phase 2 · Improvement studio
              </h2>
              <p className="mt-1 text-[13px] leading-relaxed text-muted">
                See the playbook recommendations applied to this card and compare original vs
                improved per platform — on its own page.
              </p>
            </div>
            <Link
              href="/improve"
              className="rounded-xl bg-sky-500 px-5 py-2.5 text-sm font-semibold text-white shadow-[0_8px_24px_-8px_rgba(14,165,233,0.7)] transition hover:bg-sky-400 active:scale-[0.98]"
            >
              Open improvement studio
              {potentialGain > 0 ? (
                <span className="ml-2 rounded-md bg-white/20 px-1.5 py-0.5 font-mono text-xs">
                  +{potentialGain}
                </span>
              ) : null}
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
