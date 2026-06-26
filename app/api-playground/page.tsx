"use client";

import { useEffect, useMemo, useState } from "react";
import { cardToView, viewToParts, type CardView } from "@/components/cardView";
import { analyzeCard, improveCard, introspectUrl, type TrafficEntry } from "@/components/apiClient";
import ApiConsole from "@/components/ApiConsole";
import RcsInputPanel from "@/components/RcsInputPanel";
import { DEFAULT_CARD, DEFAULT_FOCAL } from "@/lib/sampleContent";
import type { FocalPoint, MediaIntrospection, OverlayToggles, StandaloneRichCard } from "@/types/rcs";

const ORIENTATIONS = ["HORIZONTAL", "VERTICAL"] as const;
const HEIGHTS = ["SHORT", "MEDIUM", "TALL"] as const;
const ANALYZE_ID = 0; // stable id so the live /analyze row keeps its open state across updates

// Sample text/actions but NO media — the API fires once a valid URL is fetched.
const INITIAL_CARD: StandaloneRichCard = {
  ...DEFAULT_CARD,
  cardContent: { ...DEFAULT_CARD.cardContent, media: undefined },
};

export default function ApiPlayground() {
  const [card, setCard] = useState<StandaloneRichCard>(INITIAL_CARD);
  const [media, setMedia] = useState<MediaIntrospection | undefined>(undefined);
  const [focal, setFocal] = useState<FocalPoint>(DEFAULT_FOCAL);
  const [toggles] = useState<OverlayToggles>({ showSafeZone: true, showCropArea: false, showTextLineLimits: true });
  const [actionEntries, setActionEntries] = useState<TrafficEntry[]>([]); // media-info + improve
  const [analyzeEntry, setAnalyzeEntry] = useState<TrafficEntry | null>(null); // live, in place (pinned)
  const [scoring, setScoring] = useState(false);
  const [improving, setImproving] = useState(false);

  const logEmit = (e: TrafficEntry) => setActionEntries((prev) => [e, ...prev]);

  const view = useMemo(() => cardToView(card, media, focal), [card, media, focal]);
  const hasMedia = media !== undefined;
  const entries = useMemo(
    () => (analyzeEntry ? [analyzeEntry, ...actionEntries] : actionEntries),
    [analyzeEntry, actionEntries],
  );

  const onContentChange = (patch: Partial<CardView>) => {
    const parts = viewToParts({ ...view, ...patch }, media);
    setCard(parts.card);
    setMedia(parts.media);
    setFocal(parts.focal);
  };

  const onMediaUrlFetched = (url: string, fetched: MediaIntrospection) => {
    setCard({
      ...card,
      cardContent: {
        ...card.cardContent,
        media: { height: card.cardContent.media?.height ?? "TALL", contentInfo: { fileUrl: url } },
      },
    });
    setMedia(fetched);
    setFocal({ x: 0.5, y: 0.5 });
  };

  // Live analyze — only after a valid media URL has been fetched. Replaces in place.
  useEffect(() => {
    if (!media) {
      setAnalyzeEntry(null);
      setScoring(false);
      return;
    }
    setScoring(true);
    const t = setTimeout(async () => {
      await analyzeCard(card, (e) => setAnalyzeEntry({ ...e, id: ANALYZE_ID }));
      setScoring(false);
    }, 500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [card, media, focal]);

  async function runImprover() {
    setImproving(true);
    await improveCard(card, logEmit);
    setImproving(false);
  }

  return (
    <main className="mx-auto w-full max-w-[1500px] px-5 pb-24 pt-8">
      <header className="mb-8 border-b border-line pb-6">
        <h1 className="font-display text-3xl font-bold tracking-tight text-heading sm:text-4xl">RCS API Playground</h1>
        <p className="mt-1 text-sm text-muted">
          Paste a media URL on the left to call the scoring API; the raw{" "}
          <span className="text-body">request + response</span> appear on the right. Only{" "}
          <code className="font-mono text-xs">card</code> is the Naxai payload — <code className="font-mono text-xs">media</code> and{" "}
          <code className="font-mono text-xs">focal</code> are scoring inputs.
        </p>
      </header>

      <div className="grid items-start gap-8 lg:grid-cols-[minmax(360px,420px)_1fr]">
        {/* ── Request authoring ── */}
        <div className="flex min-w-0 flex-col gap-4">
          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-line bg-panel px-3.5 py-3">
            <span className="font-mono text-[10px] uppercase tracking-wider text-muted">Card</span>
            <Segmented
              options={ORIENTATIONS.map((o) => ({ value: o, label: cap(o) }))}
              value={view.orientation}
              onChange={(orientation) => onContentChange({ orientation })}
            />
            {view.orientation === "VERTICAL" && (
              <Segmented
                options={HEIGHTS.map((h) => ({ value: h, label: cap(h) }))}
                value={view.height}
                onChange={(height) => onContentChange({ height })}
              />
            )}
          </div>

          <RcsInputPanel
            content={view}
            onContentChange={onContentChange}
            onMediaUrlFetched={onMediaUrlFetched}
            fetchMedia={(url) => introspectUrl(url, logEmit)}
            hideUpload
            toggles={toggles}
          />
        </div>

        {/* ── API responses (the focus) ── */}
        <ApiConsole
          entries={entries}
          scoring={scoring}
          onClear={() => setActionEntries([])}
          onImprove={runImprover}
          improving={improving}
          canImprove={hasMedia}
        />
      </div>
    </main>
  );
}

function cap(s: string): string {
  return s.charAt(0) + s.slice(1).toLowerCase();
}

/** Small segmented control for enum-ish card inputs (orientation, height). */
function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div className="flex overflow-hidden rounded-lg border border-line">
      {options.map((o, i) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          aria-pressed={value === o.value}
          className={`px-3 py-1.5 text-xs font-semibold transition ${i > 0 ? "border-l border-line" : ""} ${
            value === o.value ? "bg-panel-strong text-[var(--color-primary)]" : "text-muted hover:text-body"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
