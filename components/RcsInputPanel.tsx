"use client";

/* eslint-disable @next/next/no-img-element -- editor needs the raw bitmap */

/**
 * Left-hand authoring panel: media upload, focal-point editor, texts, the
 * suggested-actions editor and platform visibility. Card format and overlay
 * toggles live in the preview toolbar (app/page.tsx).
 *
 * TODO: replace manual focal point with vision-based object/logo/text detection.
 */

import { useId, useRef, useState, type ChangeEvent, type PointerEvent } from "react";
import { clamp } from "@/lib/cropMath";
import { SUGGESTION_RULES } from "@/lib/rcsRules";
import { DEFAULT_VIEW, type CardView, type ViewAction, type ViewActionType } from "@/components/cardView";
import { fetchMediaInfo } from "@/components/mediaClient";
import InlineSlideCitation from "@/components/InlineSlideCitation";
import type { MediaIntrospection, OverlayToggles } from "@/types/rcs";
import SafeZoneOverlay from "@/components/SafeZoneOverlay";

export interface PlatformVisibility {
  ios: boolean;
  android: boolean;
}

interface RcsInputPanelProps {
  content: CardView;
  onContentChange: (patch: Partial<CardView>) => void;
  onMediaUrlFetched: (url: string, media: MediaIntrospection) => void;
  /** Read-only here: drives the focal-point editor's safe-zone overlay. */
  toggles: OverlayToggles;
}

const ACTION_TYPES: { value: ViewActionType; label: string }[] = [
  { value: "openUrl", label: "Open URL" },
  { value: "dial", label: "Dial" },
  { value: "reply", label: "Reply" },
];

const VALUE_PLACEHOLDER: Record<ViewActionType, string> = {
  openUrl: "https://…",
  dial: "+32 2 555 01 23",
  reply: "Postback text",
};

let actionSeq = 0;

export default function RcsInputPanel({
  content,
  onContentChange,
  onMediaUrlFetched,
  toggles,
}: RcsInputPanelProps) {
  const fileInputId = useId();
  const objectUrlRef = useRef<string | null>(null);
  const focalBoxRef = useRef<HTMLDivElement | null>(null);
  const draggingRef = useRef(false);
  const [urlInput, setUrlInput] = useState("");
  const [fetching, setFetching] = useState(false);
  const [urlError, setUrlError] = useState<string | null>(null);

  async function handleFetchUrl() {
    setFetching(true);
    setUrlError(null);
    try {
      const media = await fetchMediaInfo(urlInput.trim());
      onMediaUrlFetched(urlInput.trim(), media);
    } catch (e) {
      setUrlError((e as Error).message);
    } finally {
      setFetching(false);
    }
  }

  function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    const url = URL.createObjectURL(file);
    objectUrlRef.current = url;
    const probe = new Image();
    probe.onload = () => {
      onContentChange({
        imageUrl: url,
        imageMetadata: {
          width: probe.naturalWidth,
          height: probe.naturalHeight,
          aspectRatio: probe.naturalWidth / Math.max(1, probe.naturalHeight),
        },
        focalPoint: { x: 0.5, y: 0.5 },
      });
    };
    probe.onerror = () => {
      // Unreadable/corrupt file: drop the object URL instead of leaking it.
      URL.revokeObjectURL(url);
      if (objectUrlRef.current === url) objectUrlRef.current = null;
    };
    probe.src = url;
    event.target.value = "";
  }

  function moveFocal(event: PointerEvent<HTMLDivElement>) {
    const box = focalBoxRef.current;
    if (!box) return;
    const rect = box.getBoundingClientRect();
    onContentChange({
      focalPoint: {
        x: clamp((event.clientX - rect.left) / rect.width, 0, 1),
        y: clamp((event.clientY - rect.top) / rect.height, 0, 1),
      },
    });
  }

  function updateAction(id: string, patch: Partial<ViewAction>) {
    onContentChange({
      actions: content.actions.map((a) => (a.id === id ? { ...a, ...patch } : a)),
    });
  }

  /** Move the action with `id` to index 0. Prominence is positional, not flagged. */
  function makePrimary(id: string) {
    const a = content.actions.find((x) => x.id === id);
    if (!a) return;
    const rest = content.actions.filter((x) => x.id !== id);
    onContentChange({ actions: [a, ...rest] });
  }

  return (
    <div className="flex flex-col gap-5">
      {/* ── Media ── */}
      <Section title="1 · Media">
        <div className="flex items-center gap-2">
          <label
            htmlFor={fileInputId}
            className="cursor-pointer rounded-lg border border-line bg-panel px-3 py-1.5 text-xs font-medium text-body transition hover:border-line-strong hover:bg-panel-strong"
          >
            Upload image…
          </label>
          <input
            id={fileInputId}
            type="file"
            accept="image/*"
            className="sr-only"
            onChange={handleFile}
          />
          <button
            type="button"
            onClick={() =>
              onContentChange({
                imageUrl: DEFAULT_VIEW.imageUrl,
                imageMetadata: DEFAULT_VIEW.imageMetadata,
                focalPoint: DEFAULT_VIEW.focalPoint,
              })
            }
            className="rounded-lg px-2 py-1.5 text-xs text-muted transition hover:text-body"
          >
            Use sample
          </button>
          <button
            type="button"
            onClick={() => onContentChange({ ...DEFAULT_VIEW })}
            title="Reset the canvas to the sample demo"
            aria-label="Reset the canvas to the sample demo"
            className="ml-auto flex h-8 w-8 items-center justify-center rounded-lg border border-line bg-panel text-muted transition hover:border-line-strong hover:text-body"
          >
            <svg
              viewBox="0 0 16 16"
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.6}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M2.5 8a5.5 5.5 0 1 0 1.61-3.89" />
              <path d="M2.5 1.5v3h3" />
            </svg>
          </button>
        </div>

        <div className="mt-2 flex items-center gap-2">
          <input
            type="url"
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            placeholder="…or paste a public image/video URL"
            className="min-w-0 flex-1 rounded-lg border border-line bg-field px-3 py-1.5 text-xs text-heading outline-none placeholder:text-faint focus:border-sky-500/60"
          />
          <button
            type="button"
            disabled={!urlInput.trim() || fetching}
            onClick={handleFetchUrl}
            className="shrink-0 rounded-lg border border-line bg-panel px-3 py-1.5 text-xs font-medium text-body transition hover:border-line-strong disabled:opacity-50"
          >
            {fetching ? "Fetching…" : "Fetch"}
          </button>
        </div>
        {urlError ? <p className="mt-1 text-[11px] text-rose-400">{urlError}</p> : null}
        <p className="mt-1 font-mono text-[10px] text-faint">
          Public URLs only — introspected server-side (size/dimensions, incl. video).
        </p>

        {content.imageUrl && content.imageMetadata ? (
          <div className="mt-3">
            <div
              ref={focalBoxRef}
              className="relative w-full cursor-crosshair touch-none select-none overflow-hidden rounded-lg border border-line"
              onPointerDown={(e) => {
                draggingRef.current = true;
                e.currentTarget.setPointerCapture(e.pointerId);
                moveFocal(e);
              }}
              onPointerMove={(e) => {
                if (draggingRef.current) moveFocal(e);
              }}
              onPointerUp={() => {
                draggingRef.current = false;
              }}
            >
              <img
                src={content.imageUrl}
                alt="Uploaded card media with focal point editor"
                className="block w-full"
                draggable={false}
              />
              <SafeZoneOverlay
                window={{ x0: 0, y0: 0, x1: 1, y1: 1 }}
                imageAspect={content.imageMetadata.aspectRatio}
                showSafeZone={toggles.showSafeZone}
                showCriticalSquare={content.orientation === "HORIZONTAL"}
                focal={content.focalPoint}
              />
            </div>
            <p className="mt-1.5 font-mono text-[10px] leading-relaxed text-muted">
              Drag to mark the focal point (product, face, logo) ·{" "}
              {content.imageMetadata.width}×{content.imageMetadata.height} · ratio{" "}
              {content.imageMetadata.aspectRatio.toFixed(2)}
            </p>
          </div>
        ) : null}

        {content.imageUrl && content.mediaType === "video" ? (
          <div className="mt-3 rounded-lg border border-line bg-field p-4 text-center">
            <p className="text-2xl">🎬</p>
            <p className="mt-1 text-xs text-body">Video media</p>
            <p className="mt-0.5 font-mono text-[10px] text-muted">
              Preview not rendered — introspection captures type &amp; size only.
            </p>
          </div>
        ) : null}
      </Section>

      {/* ── Text ── */}
      <Section
        title="2 · Text"
        hint={
          <>
            3 lines recommended <InlineSlideCitation labels={["xPlatform s11"]} />
          </>
        }
      >
        <label className="block">
          <span className="flex items-baseline justify-between">
            <span className="text-xs font-medium text-body">Title</span>
            <CharCount value={content.title.length} soft={30} />
          </span>
          <input
            type="text"
            value={content.title}
            onChange={(e) => onContentChange({ title: e.target.value })}
            placeholder="Card title"
            className="mt-1 w-full rounded-lg border border-line bg-field px-3 py-2 text-sm text-heading outline-none transition placeholder:text-faint focus:border-sky-500/60"
          />
        </label>
        <label className="mt-3 block">
          <span className="flex items-baseline justify-between">
            <span className="text-xs font-medium text-body">Description</span>
            <CharCount value={content.description.length} soft={76} />
          </span>
          <textarea
            value={content.description}
            onChange={(e) => onContentChange({ description: e.target.value })}
            placeholder="Card description"
            rows={3}
            className="mt-1 w-full resize-y rounded-lg border border-line bg-field px-3 py-2 text-sm leading-relaxed text-heading outline-none transition placeholder:text-faint focus:border-sky-500/60"
          />
        </label>
      </Section>

      {/* ── Actions ── */}
      <Section
        title="3 · Suggested actions"
        hint={
          <>
            Max {SUGGESTION_RULES.maxSuggestionsPerCard} per card,{" "}
            {SUGGESTION_RULES.maxSuggestionLabelChars} chars each <InlineSlideCitation labels={["xPlatform s17"]} />
          </>
        }
      >
        <div className="flex flex-col gap-2">
          {content.actions.map((action) => (
            <div
              key={action.id}
              className="rounded-lg border border-line bg-field p-2"
            >
              <div className="flex items-center gap-2">
                <select
                  value={action.type}
                  onChange={(e) =>
                    updateAction(action.id, { type: e.target.value as ViewActionType })
                  }
                  className="rounded-md border border-line bg-field px-1.5 py-1 text-[11px] text-body outline-none"
                >
                  {ACTION_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
                {/* Primary is determined by position (index 0). */}
                {content.actions[0]?.id === action.id ? (
                  <span className="ml-auto font-mono text-[10px] text-sky-500">primary</span>
                ) : (
                  <button
                    type="button"
                    onClick={() => makePrimary(action.id)}
                    className="ml-auto font-mono text-[10px] text-muted transition hover:text-sky-400"
                  >
                    Make primary
                  </button>
                )}
                <button
                  type="button"
                  aria-label={`Remove action ${action.label}`}
                  onClick={() =>
                    onContentChange({
                      actions: content.actions.filter((a) => a.id !== action.id),
                    })
                  }
                  className="rounded px-1 text-muted transition hover:text-rose-400"
                >
                  ✕
                </button>
              </div>
              <div className="mt-1.5 flex gap-2">
                <div className="flex-1">
                  <input
                    type="text"
                    value={action.label}
                    onChange={(e) => updateAction(action.id, { label: e.target.value })}
                    placeholder="Label"
                    className="w-full rounded-md border border-line bg-field px-2 py-1 text-xs text-heading outline-none placeholder:text-faint focus:border-sky-500/60"
                  />
                  <span
                    className={`font-mono text-[9px] ${
                      action.label.length > SUGGESTION_RULES.maxSuggestionLabelChars
                        ? "text-rose-400"
                        : "text-faint"
                    }`}
                  >
                    {action.label.length}/{SUGGESTION_RULES.maxSuggestionLabelChars}
                  </span>
                </div>
                <input
                  type="text"
                  value={action.value}
                  onChange={(e) => updateAction(action.id, { value: e.target.value })}
                  placeholder={VALUE_PLACEHOLDER[action.type]}
                  className="h-fit flex-1 rounded-md border border-line bg-field px-2 py-1 text-xs text-heading outline-none placeholder:text-faint focus:border-sky-500/60"
                />
              </div>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={() =>
            onContentChange({
              actions: [
                ...content.actions,
                {
                  id: `new-${++actionSeq}`,
                  type: "openUrl",
                  label: "",
                  value: "",
                },
              ],
            })
          }
          className="mt-2 w-full rounded-lg border border-dashed border-line py-1.5 text-xs text-muted transition hover:border-line-strong hover:text-body"
        >
          + Add action
        </button>
      </Section>
    </div>
  );
}

function Section({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-line bg-panel p-3.5">
      <header className="mb-2.5 flex items-baseline justify-between gap-2">
        <h3 className="font-display text-sm font-semibold tracking-tight text-heading">
          {title}
        </h3>
        {hint ? (
          <span className="text-right font-mono text-[9px] leading-tight text-muted">
            {hint}
          </span>
        ) : null}
      </header>
      {children}
    </section>
  );
}

function CharCount({ value, soft }: { value: number; soft: number }) {
  const isOverflow = value > soft;
  return (
    <span
      className={`font-mono text-[10px] ${
        isOverflow
          ? "rounded border border-[var(--color-destructive)]/35 bg-[var(--color-destructive)]/10 px-1.5 py-0.5 font-semibold text-[var(--color-destructive)]"
          : "text-faint"
      }`}
    >
      {value} chars{isOverflow ? ` · ⚠ >${soft} truncation risk` : ""}
    </span>
  );
}
