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

  return (
    <div className="flex flex-col items-center gap-2">
      {(caption || scoreChip) && (
        <div className="flex items-center gap-2">
          {caption ? (
            <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted">
              {caption}
            </span>
          ) : null}
          {scoreChip}
        </div>
      )}

      <div className="w-[320px] shrink-0 rounded-[2.4rem] border border-line bg-zinc-900 p-[7px] shadow-[0_24px_60px_-24px_rgba(0,0,0,0.8)]">
        <div
          className={`relative overflow-hidden rounded-[2rem] ${
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

          {/* conversation area: fixed height so every device frame is the same
              size — content differences show INSIDE the screen, like a real
              phone. Long cards scroll, as they would in a real conversation. */}
          <div className="h-[560px] overflow-y-auto px-3.5 pb-5 pt-4">
            <p className="mb-2.5 text-center font-mono text-[9px] uppercase tracking-wider text-zinc-400">
              Today
            </p>
            {children}
          </div>
        </div>
      </div>

      <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted">
        {isIos ? "iOS · Messages" : "Android · Google Messages"}
      </span>
    </div>
  );
}
