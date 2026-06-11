"use client";

/* eslint-disable @next/next/no-img-element -- editor needs the raw bitmap */

/**
 * Left-hand authoring panel: media upload, focal-point editor, texts, the
 * suggested-actions editor and platform visibility. Card format and overlay
 * toggles live in the preview toolbar (app/page.tsx).
 *
 * TODO: replace manual focal point with vision-based object/logo/text detection.
 */

import { useId, useRef, type ChangeEvent, type PointerEvent } from "react";
import { clamp } from "@/lib/cropMath";
import { SUGGESTION_RULES } from "@/lib/rcsRules";
import { DEFAULT_CONTENT } from "@/lib/sampleContent";
import type {
  OverlayToggles,
  RcsAction,
  RcsActionType,
  RcsContent,
} from "@/types/rcs";
import SafeZoneOverlay from "@/components/SafeZoneOverlay";

export interface PlatformVisibility {
  ios: boolean;
  android: boolean;
}

interface RcsInputPanelProps {
  content: RcsContent;
  onContentChange: (patch: Partial<RcsContent>) => void;
  /** Read-only here: drives the focal-point editor's safe-zone overlay. */
  toggles: OverlayToggles;
}

const ACTION_TYPES: { value: RcsActionType; label: string }[] = [
  { value: "openUrl", label: "Open URL" },
  { value: "dial", label: "Dial" },
  { value: "reply", label: "Reply" },
];

const VALUE_PLACEHOLDER: Record<RcsActionType, string> = {
  openUrl: "https://…",
  dial: "+32 2 555 01 23",
  reply: "Postback text",
};

let actionSeq = 0;

export default function RcsInputPanel({
  content,
  onContentChange,
  toggles,
}: RcsInputPanelProps) {
  const fileInputId = useId();
  const objectUrlRef = useRef<string | null>(null);
  const focalBoxRef = useRef<HTMLDivElement | null>(null);
  const draggingRef = useRef(false);

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

  function updateAction(id: string, patch: Partial<RcsAction>) {
    onContentChange({
      actions: content.actions.map((a) => (a.id === id ? { ...a, ...patch } : a)),
    });
  }

  function setPrimary(id: string) {
    onContentChange({
      actions: content.actions.map((a) => ({ ...a, primary: a.id === id })),
    });
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
                imageUrl: DEFAULT_CONTENT.imageUrl,
                imageMetadata: DEFAULT_CONTENT.imageMetadata,
                focalPoint: DEFAULT_CONTENT.focalPoint,
              })
            }
            className="rounded-lg px-2 py-1.5 text-xs text-muted transition hover:text-body"
          >
            Use sample
          </button>
          <button
            type="button"
            onClick={() => onContentChange({ ...DEFAULT_CONTENT })}
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
                showCriticalSquare={content.cardFormat === "compact"}
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
      </Section>

      {/* ── Text ── */}
      <Section title="2 · Text" hint="3 lines recommended (xPlatform s11)">
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
        hint={`Max ${SUGGESTION_RULES.maxSuggestionsPerCard} per card, ${SUGGESTION_RULES.maxSuggestionLabelChars} chars each (xPlatform s17)`}
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
                    updateAction(action.id, { type: e.target.value as RcsActionType })
                  }
                  className="rounded-md border border-line bg-field px-1.5 py-1 text-[11px] text-body outline-none"
                >
                  {ACTION_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
                <label className="ml-auto flex cursor-pointer items-center gap-1 font-mono text-[10px] text-muted">
                  <input
                    type="radio"
                    name="primary-action"
                    checked={!!action.primary}
                    onChange={() => setPrimary(action.id)}
                    className="accent-sky-500"
                  />
                  primary
                </label>
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
  hint?: string;
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
  return (
    <span
      className={`font-mono text-[10px] ${value > soft ? "text-amber-400" : "text-faint"}`}
    >
      {value} chars{value > soft ? ` · >${soft} risks truncation` : ""}
    </span>
  );
}
