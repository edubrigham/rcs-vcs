"use client";

/* eslint-disable @next/next/no-img-element -- previews simulate exact DP-sized
   native renderers; next/image optimization would fight the simulation. */

/**
 * The platform-divergent card renderer. This is intentionally NOT a generic
 * preview: each platform follows its own playbook-documented behavior.
 *
 *  iOS  [xPlatform s13/s15/s23/s42]: 60×60 DP thumbnail on compact cards,
 *       line-clamp truncation with ellipsis, “Options” dropdown for 3+ actions,
 *       tappable-card overflow past 6 total text lines.
 *  Android [CardMedia p8/p13, xPlatform s15/s25]: format-fixed media
 *       containers, center cropping, media space shrinking as text grows.
 */

import type { CSSProperties } from "react";
import {
  getVisibleWindow,
  subjectProminenceWindow,
  visibleAreaFraction,
  type VisibleWindow,
} from "@/lib/cropMath";
import { androidCropWindow, estimateTextLines, getPlatformRules, IOS_RULES } from "@/lib/rcsRules";
import type { CardView, ViewAction } from "@/components/cardView";
import type { FocalPoint, OverlayToggles, Platform } from "@/types/rcs";
import SafeZoneOverlay from "@/components/SafeZoneOverlay";
import InlineSlideCitation from "@/components/InlineSlideCitation";

interface RcsCardPreviewProps {
  content: CardView;
  platform: Platform;
  toggles: OverlayToggles;
  /** "improved" simulates a re-cropped asset zoomed onto the subject. */
  variant?: "original" | "improved";
  /**
   * Where the subject sits in the ORIGINAL bitmap. The improver may relocate
   * content.focalPoint to model a re-exported asset (subject centered), but
   * the simulated re-crop must zoom to the subject's real position.
   */
  subjectPoint?: FocalPoint;
  /** Actions moved out of the card by the improver (shown as a footnote). */
  secondaryActions?: ViewAction[];
}

function clampStyle(lines: number): CSSProperties {
  return {
    display: "-webkit-box",
    WebkitLineClamp: lines,
    WebkitBoxOrient: "vertical",
    overflow: "hidden",
  };
}

const ACTION_GLYPH: Record<ViewAction["type"], string> = {
  openUrl: "↗",
  dial: "✆",
  reply: "↩",
};

export default function RcsCardPreview({
  content,
  platform,
  toggles,
  variant = "original",
  subjectPoint,
  secondaryActions = [],
}: RcsCardPreviewProps) {
  const orientation = content.orientation;
  const mh = content.orientation === "HORIZONTAL" ? null : content.height;
  const lines = estimateTextLines(
    content.title,
    content.description,
    getPlatformRules(platform, orientation, mh, 0),
  );
  const rules = getPlatformRules(platform, orientation, mh, lines.totalLines);
  const aspect = content.imageMetadata?.aspectRatio;

  // iOS vertical cards keep the native aspect ratio up to a height cap
  // [CardMedia p28]; everything else uses the rules' fixed container.
  const mediaWidth = rules.mediaWidth;
  const mediaHeight =
    platform === "ios" && rules.mediaLayout === "vertical" && aspect
      ? Math.min(Math.round(rules.mediaWidth / aspect), rules.mediaHeight)
      : rules.mediaHeight;

  const containerAspect = mediaWidth / mediaHeight;
  // Original iOS shows the platform's plain center cover-crop. Android original
  // uses the shared monotone crop window (cover + text-driven vertical punch-in,
  // same as the scorer). Improved simulates a re-cropped asset centred on the
  // subject. Non-cover windows are rendered by mapping the window rect onto the
  // box explicitly (object-fit can pan but not zoom past cover).
  const focalForCrop = variant === "improved" ? (subjectPoint ?? content.focalPoint) : content.focalPoint;
  const isAndroid = platform === "android";
  const window: VisibleWindow | null = aspect
    ? variant === "improved"
      ? subjectProminenceWindow(aspect, containerAspect, focalForCrop)
      : isAndroid
        ? androidCropWindow(aspect, orientation, mh, lines.totalLines)
        : getVisibleWindow(aspect, containerAspect)
    : null;
  const useExplicitWindow = !!window && (variant === "improved" || isAndroid);

  const media = (
    <div
      className="relative shrink-0 overflow-hidden bg-zinc-200"
      style={{ width: mediaWidth, height: mediaHeight }}
    >
      {content.mediaType === "video" ? (
        <div className="flex h-full w-full items-center justify-center bg-zinc-800 text-[10px] font-medium text-zinc-300">
          ▶ video
        </div>
      ) : content.imageUrl ? (
        useExplicitWindow && window ? (
          <img
            src={content.imageUrl}
            alt=""
            className="absolute"
            style={{
              width: `${100 / (window.x1 - window.x0)}%`,
              height: `${100 / (window.y1 - window.y0)}%`,
              maxWidth: "none",
              left: `${(-window.x0 / (window.x1 - window.x0)) * 100}%`,
              top: `${(-window.y0 / (window.y1 - window.y0)) * 100}%`,
            }}
            draggable={false}
          />
        ) : (
          <img
            src={content.imageUrl}
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
            draggable={false}
          />
        )
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-zinc-200 to-zinc-300 text-[10px] text-zinc-500">
          no media
        </div>
      )}
      {window && (
        <SafeZoneOverlay
          window={window}
          imageAspect={aspect}
          showSafeZone={toggles.showSafeZone}
          showCriticalSquare={content.orientation === "HORIZONTAL"}
          focal={focalForCrop}
          minimal={mediaWidth < 100 || mediaHeight < 100}
        />
      )}
    </div>
  );

  const titleOverflow = Math.max(0, lines.titleLines - rules.maxTitleLines);
  const descOverflow = Math.max(0, lines.descriptionLines - rules.maxDescriptionLines);
  const iosTappableOverflow =
    platform === "ios" && lines.totalLines > IOS_RULES.tappableOverflowTotalLines;

  const truncationBadge =
    toggles.showTextLineLimits && titleOverflow + descOverflow > 0 ? (
      <span className="mt-1 inline-block rounded bg-amber-100 px-1.5 py-0.5 font-mono text-[9px] font-medium text-amber-800">
        ≈{titleOverflow + descOverflow} line{titleOverflow + descOverflow > 1 ? "s" : ""} hidden
      </span>
    ) : null;

  const cropFootnote =
    toggles.showCropArea && window && content.imageUrl && aspect ? (
      <CropFootnote
        imageUrl={content.imageUrl}
        aspect={aspect}
        window={window}
        platform={platform}
      />
    ) : null;

  // Moving CTAs out of the card is a TRADE-OFF, not a free win: follow-up
  // message suggestions are transient on Android [xPlatform s18].
  const movedActionsNote =
    secondaryActions.length > 0 ? (
      <p className="mt-1.5 px-1 font-mono text-[9px] leading-snug text-amber-600">
        ⚠ {secondaryActions.length} suggestion{secondaryActions.length > 1 ? "s" : ""} moved to a
        follow-up message{" "}
        <InlineSlideCitation labels={["xPlatform s17", "xPlatform s18"]} />
      </p>
    ) : null;

  // Actions vs replies render differently [xPlatform s42]: iOS keeps actions
  // inside the card (dropdown if >2) and lists replies below it; Android shows
  // all card suggestions as chips inside the card.
  const ctas = content.actions.filter((a) => a.type !== "reply");
  const replies = content.actions.filter((a) => a.type === "reply");

  // Primary CTA = the first non-reply action by position (T5 model; no .primary flag).
  const primaryCta = content.actions.find((a) => a.type !== "reply");
  const isPrimary = (a: ViewAction) => primaryCta?.id === a.id && content.actions[0]?.id === a.id;

  // ─────────────────────────── iOS ───────────────────────────
  if (platform === "ios") {
    const collapsed = ctas.length > rules.maxVisibleActions;

    return (
      <div style={{ width: 272 }}>
        <div className="overflow-hidden rounded-2xl bg-[#e9e9eb] text-black shadow-sm">
          {rules.mediaLayout === "thumbnail" ? (
            <div className="flex items-start gap-2.5 p-2.5">
              <div className="overflow-hidden rounded-lg">{media}</div>
              <div className="min-w-0 flex-1 pt-0.5">
                <p className="text-[15px] font-semibold leading-snug" style={clampStyle(rules.maxTitleLines)}>
                  {content.title || "Title"}
                </p>
                <p className="text-[13px] leading-snug text-neutral-500" style={clampStyle(rules.maxDescriptionLines)}>
                  {content.description || "Description"}
                </p>
                {truncationBadge}
              </div>
              {iosTappableOverflow && <span className="self-center pr-1 text-neutral-400">›</span>}
            </div>
          ) : (
            <>
              {media}
              <div className="px-3 pb-1 pt-2">
                <div className="flex items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-[15px] font-semibold leading-snug" style={clampStyle(rules.maxTitleLines)}>
                      {content.title || "Title"}
                    </p>
                    <p className="text-[13px] leading-snug text-neutral-500" style={clampStyle(rules.maxDescriptionLines)}>
                      {content.description || "Description"}
                    </p>
                    {truncationBadge}
                  </div>
                  {iosTappableOverflow && <span className="text-neutral-400">›</span>}
                </div>
              </div>
            </>
          )}

          {ctas.length > 0 && (
            <div className="border-t border-black/10">
              {collapsed ? (
                // [xPlatform s42] iOS collapses ALL actions (when >2) into an
                // "Options" dropdown inside the card.
                <button className="flex w-full items-center justify-center gap-1 py-2 text-[15px] font-medium text-[#007aff]">
                  Options
                  <span className="text-[11px]">▾</span>
                  <span className="ml-1 rounded-full bg-[#007aff]/10 px-1.5 font-mono text-[10px]">
                    {ctas.length}
                  </span>
                </button>
              ) : (
                ctas.map((action, i) => (
                  <button
                    key={action.id}
                    className={`flex w-full items-center justify-center gap-1.5 py-2 text-[15px] text-[#007aff] ${
                      i > 0 ? "border-t border-black/10" : ""
                    } ${isPrimary(action) ? "font-semibold" : "font-normal"}`}
                  >
                    <span className="text-[12px] opacity-70">{ACTION_GLYPH[action.type]}</span>
                    <span className="max-w-[200px] truncate">{action.label || "Action"}</span>
                  </button>
                ))
              )}
            </div>
          )}
        </div>

        {/* [xPlatform s42] iOS places suggested replies BELOW the card. */}
        {replies.length > 0 && (
          <div className="mt-1.5 overflow-hidden rounded-2xl bg-[#e9e9eb]">
            {replies.map((reply, i) => (
              <button
                key={reply.id}
                className={`flex w-full items-center justify-center gap-1.5 py-2 text-[15px] text-[#007aff] ${
                  i > 0 ? "border-t border-black/10" : ""
                }`}
              >
                <span className="text-[12px] opacity-70">{ACTION_GLYPH.reply}</span>
                <span className="max-w-[200px] truncate">{reply.label || "Reply"}</span>
              </button>
            ))}
          </div>
        )}

        {iosTappableOverflow && (
          <p className="mt-1.5 px-1 font-mono text-[9px] leading-snug text-rose-500">
            ⚠ &gt;6 text lines: card opens a separate full-text page without media or buttons
            <span className="ml-1">
              <InlineSlideCitation labels={["xPlatform s23"]} />
            </span>
          </p>
        )}
        {collapsed && (
          <p className="mt-1 px-1 font-mono text-[9px] text-muted">
            {ctas.length} actions collapse into the Options dropdown on iOS{" "}
            <InlineSlideCitation labels={["xPlatform s42"]} />
          </p>
        )}
        {movedActionsNote}
        {cropFootnote}
      </div>
    );
  }

  // ───────────────────────── Android ─────────────────────────
  // [xPlatform s42] Android keeps ALL card suggestions inside the card as
  // chips; CTA actions render first [s21].
  const orderedChips = [...ctas, ...replies];
  const visibleChips = orderedChips.slice(0, rules.maxVisibleActions);
  const overLimit = orderedChips.length - rules.maxVisibleActions;

  return (
    <div style={{ width: 280 }}>
      <div className="overflow-hidden rounded-2xl bg-white text-black shadow-[0_1px_3px_rgba(0,0,0,0.18)]">
        {rules.mediaLayout === "horizontal" ? (
          <div className="flex items-stretch">
            {media}
            <div className="min-w-0 flex-1 px-3 py-2.5">
              <p className="text-[15px] font-medium leading-snug" style={clampStyle(rules.maxTitleLines)}>
                {content.title || "Title"}
              </p>
              <p className="mt-0.5 text-[13px] leading-snug text-zinc-600" style={clampStyle(rules.maxDescriptionLines)}>
                {content.description || "Description"}
              </p>
              {truncationBadge}
            </div>
          </div>
        ) : (
          <>
            {media}
            <div className="px-3 py-2.5">
              <p className="text-[15px] font-medium leading-snug" style={clampStyle(rules.maxTitleLines)}>
                {content.title || "Title"}
              </p>
              <p className="mt-0.5 text-[13px] leading-snug text-zinc-600" style={clampStyle(rules.maxDescriptionLines)}>
                {content.description || "Description"}
              </p>
              {truncationBadge}
            </div>
          </>
        )}

        {content.actions.length > 0 && (
          <div className="mt-1.5 flex flex-wrap gap-1.5 px-3 pb-3">
            {visibleChips.map((action) => (
              <button
                key={action.id}
                className={`max-w-full truncate rounded-full border px-3 py-1 text-[12px] font-medium ${
                  isPrimary(action)
                    ? "border-[#0b57d0] bg-[#0b57d0] text-white"
                    : "border-[#c4c7c5] bg-white text-[#0b57d0]"
                }`}
              >
                {action.label || "Action"}
              </button>
            ))}
            {overLimit > 0 && (
              <span className="rounded-full border border-dashed border-rose-400 px-3 py-1 font-mono text-[11px] text-rose-500">
                +{overLimit} over limit
              </span>
            )}
          </div>
        )}
      </div>

      {rules.cropSeverity !== "low" && (
        <p className="mt-1.5 px-1 font-mono text-[9px] leading-snug text-amber-600">
          ⚠ {rules.cropSeverity} crop: long text shrinks the media area{" "}
          <InlineSlideCitation labels={["xPlatform s15"]} />
        </p>
      )}
      {movedActionsNote}
      {cropFootnote}
    </div>
  );
}

/**
 * "What survived the crop" footnote: the full source image with the visible
 * window outlined and the cropped remainder dimmed.
 */
function CropFootnote({
  imageUrl,
  aspect,
  window: win,
  platform,
}: {
  imageUrl: string;
  aspect: number;
  window: VisibleWindow;
  platform: Platform;
}) {
  const visiblePct = Math.round(visibleAreaFraction(win) * 100);
  // Keep the strip at the EXACT source aspect ratio so the window outline maps 1:1.
  const maxH = 110;
  const stripWidth = 92 / aspect > maxH ? Math.round(maxH * aspect) : 92;
  const stripHeight = Math.round(stripWidth / aspect);
  return (
    <div className="mt-2 flex items-center gap-2.5 rounded-lg border border-line bg-panel p-2">
      <div
        className="relative shrink-0 overflow-hidden rounded"
        style={{ width: stripWidth, height: stripHeight }}
      >
        <img src={imageUrl} alt="" className="h-full w-full object-cover" draggable={false} />
        <div
          className="absolute border border-sky-400"
          style={{
            left: `${win.x0 * 100}%`,
            top: `${win.y0 * 100}%`,
            width: `${(win.x1 - win.x0) * 100}%`,
            height: `${(win.y1 - win.y0) * 100}%`,
            boxShadow: "0 0 0 999px rgba(0,0,0,0.62)",
          }}
        />
      </div>
      <p className="font-mono text-[9px] leading-relaxed text-body">
        <span className="text-accent">{visiblePct}%</span> of the source image is visible on{" "}
        {platform === "ios" ? "iOS" : "Android"}; the dimmed region is cropped away.
      </p>
    </div>
  );
}
