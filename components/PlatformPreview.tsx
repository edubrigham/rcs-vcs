"use client";

/**
 * Phone-frame chrome around a card preview: iOS Messages vs Google Messages.
 * Deliberately light-mode (both apps default light) so platform differences
 * in the card itself stay the visual focus.
 */

import type { ReactNode } from "react";
import type { Platform } from "@/types/rcs";

interface PlatformPreviewProps {
  platform: Platform;
  children: ReactNode;
  /** Small caption above the frame, e.g. "Original" / "Improved". */
  caption?: string;
  /** Score chip rendered next to the caption. */
  scoreChip?: ReactNode;
}

export default function PlatformPreview({
  platform,
  children,
  caption,
  scoreChip,
}: PlatformPreviewProps) {
  const isIos = platform === "ios";
  const [platformLabel, detailLabel] = (caption ?? "").split("·").map((part) => part.trim());
  const overlayLabel = platformLabel || (isIos ? "iOS" : "Android");

  return (
    <div className="flex flex-col items-center gap-2">
      {(detailLabel || scoreChip) && (
        <div className="flex items-center gap-2">
          {detailLabel ? (
            <span className="font-mono text-[12px] font-semibold tracking-[0.15em] text-muted">
              {detailLabel}
            </span>
          ) : null}
          {scoreChip}
        </div>
      )}

      <div className="w-[324px] shrink-0">
        <div className="relative mt-5 rounded-[2.4rem] border border-line bg-zinc-900 p-[7px] shadow-[0_24px_60px_-24px_rgba(0,0,0,0.8)]">
          <span className="absolute left-1/2 top-0 z-20 -translate-x-1/2 -translate-y-1/2 whitespace-nowrap rounded-full border border-white/70 bg-white px-7 py-1 text-base font-medium text-zinc-900 shadow-[0_8px_24px_-12px_rgba(15,23,42,0.45)]">
            {overlayLabel}
          </span>
        {/* The SCREEN is the fixed-height box, so platform-specific header
            heights don't change the device size. */}
          <div
            className={`relative flex h-[600px] flex-col overflow-hidden rounded-[2rem] ${
              isIos ? "bg-white" : "bg-[#f7f9fc]"
            }`}
          >
            {/* status bar */}
            <div className="flex items-center justify-between px-6 pb-1 pt-2.5 text-[10px] font-semibold text-zinc-800">
              <span>09:41</span>
              <span className="flex items-center gap-1 tracking-tighter text-zinc-500">
                <span>▴▴</span>
                <span>▮</span>
              </span>
            </div>

            {/* app header */}
            {isIos ? (
              <div className="flex flex-col items-center gap-0.5 border-b border-black/5 pb-2 pt-1">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-b from-zinc-400 to-zinc-500 text-sm font-semibold text-white">
                  N
                </span>
                <span className="flex items-center gap-0.5 text-[11px] text-zinc-700">
                  Naxai <span className="text-zinc-400">›</span>
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-2.5 border-b border-black/5 px-4 pb-2.5 pt-1">
                <span className="text-zinc-500">←</span>
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#0b57d0] text-sm font-medium text-white">
                  N
                </span>
                <span className="flex items-center gap-1 text-[13px] font-medium text-zinc-800">
                  Naxai
                  <span className="text-[11px] text-[#0b57d0]" title="Verified business">
                    ✓
                  </span>
                </span>
                <span className="ml-auto tracking-widest text-zinc-400">⋮</span>
              </div>
            )}

            {/* conversation area fills the remaining screen; long cards scroll
                vertically with hidden scrollbars, like a real phone. */}
            <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-3 pb-5 pt-4">
              <p className="mb-2.5 text-center font-mono text-[9px] uppercase tracking-wider text-zinc-400">
                Today
              </p>
              {children}
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}
