"use client";

/**
 * The preview toolbar shared by the Draft page and the Playbook Pass page:
 * card-format segmented control, iOS/Android visibility toggles, overlay filter
 * icons, and the rendering-approximation disclaimer. Keeping it in one place is
 * what makes the two pages feel continuous.
 */

import type { ReactNode } from "react";
import type { CardFormat, OverlayToggles } from "@/types/rcs";
import type { PlatformVisibility } from "@/components/RcsInputPanel";

const DISCLAIMER =
  "This is an approximation based on the RCS UX playbooks. Actual rendering may vary by device, font size, app version, and orientation.";

const CARD_FORMATS: CardFormat[] = ["compact", "medium", "tall"];

const OVERLAY_FILTERS: { key: keyof OverlayToggles; label: string; icon: ReactNode }[] = [
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

interface PreviewToolbarProps {
  cardFormat: CardFormat;
  onFormatChange: (format: CardFormat) => void;
  platforms: PlatformVisibility;
  onPlatformsChange: (platforms: PlatformVisibility) => void;
  toggles: OverlayToggles;
  onTogglesChange: (toggles: OverlayToggles) => void;
}

export default function PreviewToolbar({
  cardFormat,
  onFormatChange,
  platforms,
  onPlatformsChange,
  toggles,
  onTogglesChange,
}: PreviewToolbarProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line bg-panel px-4 py-2.5">
      <div className="flex overflow-hidden rounded-lg border border-line">
        {CARD_FORMATS.map((format, i) => (
          <button
            key={format}
            type="button"
            onClick={() => onFormatChange(format)}
            aria-pressed={cardFormat === format}
            className={`px-4 py-1.5 text-xs font-semibold capitalize transition ${
              i > 0 ? "border-l border-line" : ""
            } ${
              cardFormat === format
                ? "border-[var(--color-primary)] bg-panel-strong text-[var(--color-primary)]"
                : "text-muted hover:text-body"
            }`}
          >
            {format}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-1.5">
        {(["ios", "android"] as const).map((p) => (
          <button
            key={p}
            type="button"
            aria-pressed={platforms[p]}
            onClick={() => onPlatformsChange({ ...platforms, [p]: !platforms[p] })}
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
            onClick={() => onTogglesChange({ ...toggles, [filter.key]: !toggles[filter.key] })}
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
  );
}
