"use client";

/**
 * Visual overlay: central safe zone, the compact card's centered 1:1 critical
 * content area [xPlatform s16], and the focal-point marker.
 *
 * Everything is expressed in normalized image coordinates and mapped through
 * the container's VisibleWindow, so the same component works on the upload
 * editor (window = whole image) and on cropped previews.
 */

import type { CSSProperties } from "react";
import { criticalSquareWindow, focalInContainer, type VisibleWindow } from "@/lib/cropMath";
import { SAFE_ZONE_RULES } from "@/lib/rcsRules";
import type { FocalPoint } from "@/types/rcs";

const SAFE_LO = (1 - SAFE_ZONE_RULES.centralFraction) / 2;
const SAFE_HI = 1 - SAFE_LO;

interface SafeZoneOverlayProps {
  /** Part of the source image visible in this container. */
  window: VisibleWindow;
  imageAspect?: number;
  showSafeZone: boolean;
  /** Render the centered 1:1 critical area (compact / horizontal cards). */
  showCriticalSquare?: boolean;
  focal?: FocalPoint | null;
  /** Hide text labels in very small containers (e.g. the iOS 60×60 thumb). */
  minimal?: boolean;
}

/** Maps an image-space rect into container-space CSS percentages. */
function rectStyle(rect: VisibleWindow, win: VisibleWindow): CSSProperties {
  const w = win.x1 - win.x0 || 1;
  const h = win.y1 - win.y0 || 1;
  return {
    left: `${((rect.x0 - win.x0) / w) * 100}%`,
    top: `${((rect.y0 - win.y0) / h) * 100}%`,
    width: `${((rect.x1 - rect.x0) / w) * 100}%`,
    height: `${((rect.y1 - rect.y0) / h) * 100}%`,
  };
}

export default function SafeZoneOverlay({
  window: win,
  imageAspect,
  showSafeZone,
  showCriticalSquare = false,
  focal,
  minimal = false,
}: SafeZoneOverlayProps) {
  const safeRect: VisibleWindow = { x0: SAFE_LO, y0: SAFE_LO, x1: SAFE_HI, y1: SAFE_HI };
  const focalPos = focal ? focalInContainer(focal, win) : null;

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      {showSafeZone && (
        <div
          className="absolute border border-dashed border-emerald-400/90 bg-emerald-400/5"
          style={rectStyle(safeRect, win)}
        >
          {!minimal && (
            <span className="absolute left-1 top-1 rounded-sm bg-emerald-500/90 px-1 font-mono text-[8px] font-semibold uppercase tracking-wider text-emerald-950">
              safe zone
            </span>
          )}
        </div>
      )}

      {showSafeZone && showCriticalSquare && imageAspect != null && (
        <div
          className="absolute border border-dashed border-amber-400/90"
          style={rectStyle(criticalSquareWindow(imageAspect), win)}
        >
          {!minimal && (
            <span className="absolute bottom-1 right-1 rounded-sm bg-amber-400/90 px-1 font-mono text-[8px] font-semibold uppercase tracking-wider text-amber-950">
              1:1 critical
            </span>
          )}
        </div>
      )}

      {focalPos && (
        <div
          className="absolute -translate-x-1/2 -translate-y-1/2"
          style={{
            left: `${Math.min(100, Math.max(0, focalPos.u * 100))}%`,
            top: `${Math.min(100, Math.max(0, focalPos.v * 100))}%`,
          }}
        >
          {focalPos.visible ? (
            <span className="block h-3 w-3 rounded-full border-2 border-white bg-sky-500 shadow-[0_0_0_3px_rgba(14,165,233,0.35)]" />
          ) : (
            <span
              className="flex h-4 w-4 items-center justify-center rounded-full border-2 border-white bg-rose-500 font-mono text-[9px] font-bold leading-none text-white shadow-[0_0_0_3px_rgba(244,63,94,0.4)]"
              title="Focal point is outside the visible crop"
            >
              ✕
            </span>
          )}
        </div>
      )}
    </div>
  );
}
