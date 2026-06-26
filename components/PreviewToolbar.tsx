"use client";

/**
 * The preview toolbar shared by the Draft page and the Playbook Pass page:
 * 2-axis orientation/height control, iOS/Android visibility toggles, overlay
 * filter icons, and the rendering-approximation disclaimer.
 */

import type { ReactNode } from "react";
import type { CardOrientation, MediaHeight, OverlayToggles, Platform } from "@/types/rcs";
import type { PlatformVisibility } from "@/components/RcsInputPanel";

const DISCLAIMER =
  "This is an approximation based on the RCS UX playbooks. Actual rendering may vary by device, font size, app version, and orientation.";

/** Human-readable badge for the resolved render geometry. */
function renderBadge(orientation: CardOrientation, height: MediaHeight): string {
  if (orientation === "HORIZONTAL") return "1:1 thumbnail";
  if (height === "SHORT") return "7:2 vertical";
  if (height === "MEDIUM") return "3:2 vertical";
  return "4:3 vertical";
}

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
  orientation: CardOrientation;
  height: MediaHeight;
  onOrientationChange: (orientation: CardOrientation) => void;
  onHeightChange: (height: MediaHeight) => void;
  toggles: OverlayToggles;
  onTogglesChange: (toggles: OverlayToggles) => void;
  /**
   * Platform control. "none" (default) renders nothing. "single" renders an
   * iOS↔Android segmented toggle showing one platform at a time (Playbook Pass);
   * requires `platforms`/`onPlatformsChange`.
   */
  platformMode?: "none" | "single";
  platforms?: PlatformVisibility;
  onPlatformsChange?: (platforms: PlatformVisibility) => void;
}

export default function PreviewToolbar({
  orientation,
  height,
  onOrientationChange,
  onHeightChange,
  toggles,
  onTogglesChange,
  platformMode = "none",
  platforms,
  onPlatformsChange,
}: PreviewToolbarProps) {
  const activePlatform: Platform = platforms?.android && !platforms.ios ? "android" : "ios";

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line bg-panel px-4 py-2.5">
      {/* Orientation toggle */}
      <div className="flex items-center gap-2">
        <div className="flex overflow-hidden rounded-lg border border-line">
          {(["HORIZONTAL", "VERTICAL"] as const).map((o, i) => (
            <button
              key={o}
              type="button"
              onClick={() => onOrientationChange(o)}
              aria-pressed={orientation === o}
              className={`px-3 py-1.5 text-xs font-semibold transition ${
                i > 0 ? "border-l border-line" : ""
              } ${
                orientation === o
                  ? "bg-panel-strong text-[var(--color-primary)]"
                  : "text-muted hover:text-body"
              }`}
            >
              {o === "HORIZONTAL" ? "Horizontal" : "Vertical"}
            </button>
          ))}
        </div>

        {/* Height picker — only visible when VERTICAL */}
        {orientation === "VERTICAL" && (
          <div className="flex overflow-hidden rounded-lg border border-line">
            {(["SHORT", "MEDIUM", "TALL"] as const).map((h, i) => (
              <button
                key={h}
                type="button"
                onClick={() => onHeightChange(h)}
                aria-pressed={height === h}
                className={`px-3 py-1.5 text-xs font-semibold capitalize transition ${
                  i > 0 ? "border-l border-line" : ""
                } ${
                  height === h
                    ? "bg-panel-strong text-[var(--color-primary)]"
                    : "text-muted hover:text-body"
                }`}
              >
                {h.charAt(0) + h.slice(1).toLowerCase()}
              </button>
            ))}
          </div>
        )}

        {/* Badge showing the resolved render geometry */}
        <span className="rounded border border-line bg-panel px-2 py-0.5 font-mono text-[10px] text-muted">
          {renderBadge(orientation, height)}
        </span>
      </div>

      {platformMode === "single" && onPlatformsChange && (
        <div className="flex overflow-hidden rounded-lg border border-line">
          {(["ios", "android"] as const).map((p, i) => (
            <button
              key={p}
              type="button"
              aria-pressed={activePlatform === p}
              onClick={() => onPlatformsChange({ ios: p === "ios", android: p === "android" })}
              className={`px-4 py-1.5 text-xs font-semibold transition ${
                i > 0 ? "border-l border-line" : ""
              } ${
                activePlatform === p
                  ? "border-[var(--color-secondary)] bg-panel-strong text-[var(--color-secondary)]"
                  : "text-muted hover:text-body"
              }`}
            >
              {p === "ios" ? "iOS" : "Android"}
            </button>
          ))}
        </div>
      )}

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
