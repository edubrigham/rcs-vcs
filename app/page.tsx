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
import RcsCardPreview from "@/components/RcsCardPreview";
import RcsInputPanel from "@/components/RcsInputPanel";
import ScorePanel from "@/components/ScorePanel";
import { useSimulator } from "@/components/SimulatorProvider";
import StepNav from "@/components/StepNav";
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
                        ? "border-[var(--color-primary)] bg-panel-strong text-[var(--color-primary)]"
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
                        ? "border-[var(--color-secondary)] bg-panel-strong text-[var(--color-secondary)]"
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
                        ? "border-[var(--color-accent)] bg-panel-strong text-[var(--color-accent)]"
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

        </div>
      </div>
    </main>
  );
}
