"use client";

import { useEffect, useMemo, useState } from "react";
import { cardToView, viewToParts, type CardView } from "@/components/cardView";
import {
  analyzeCard,
  improveCard,
  introspectUrl,
  type AnalyzeResponse,
  type TrafficEntry,
} from "@/components/apiClient";
import ApiConsole from "@/components/ApiConsole";
import FunctionalBanner from "@/components/FunctionalBanner";
import PlatformPreview from "@/components/PlatformPreview";
import PreviewToolbar from "@/components/PreviewToolbar";
import RcsCardPreview from "@/components/RcsCardPreview";
import RcsInputPanel from "@/components/RcsInputPanel";
import ScorePanel from "@/components/ScorePanel";
import { DEFAULT_CARD, DEFAULT_FOCAL, DEFAULT_MEDIA } from "@/lib/sampleContent";
import type { FocalPoint, MediaIntrospection, OverlayToggles, StandaloneRichCard } from "@/types/rcs";

export default function ApiPlayground() {
  const [card, setCard] = useState<StandaloneRichCard>(DEFAULT_CARD);
  const [media, setMedia] = useState<MediaIntrospection | undefined>(DEFAULT_MEDIA);
  const [focal, setFocal] = useState<FocalPoint>(DEFAULT_FOCAL);
  const [toggles, setToggles] = useState<OverlayToggles>({
    showSafeZone: true,
    showCropArea: false,
    showTextLineLimits: true,
  });
  const [entries, setEntries] = useState<TrafficEntry[]>([]);
  const [result, setResult] = useState<AnalyzeResponse | null>(null);
  const [scoring, setScoring] = useState(true);
  const [improving, setImproving] = useState(false);

  const emit = (e: TrafficEntry) => setEntries((prev) => [e, ...prev]);

  const view = useMemo(() => cardToView(card, media, focal), [card, media, focal]);

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

  // Live analyze: POST /api/analyze ~500ms after the card settles.
  useEffect(() => {
    setScoring(true);
    const t = setTimeout(async () => {
      const res = await analyzeCard({ card, media, focal }, emit);
      setResult(res);
      setScoring(false);
    }, 500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [card, media, focal]);

  async function runImprover() {
    setImproving(true);
    await improveCard({ card, media, focal }, emit);
    setImproving(false);
  }

  return (
    <main className="mx-auto w-full max-w-[1500px] px-5 pb-24 pt-8">
      <header className="mb-8 border-b border-line pb-6">
        <div className="flex items-center justify-between">
          <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-accent">Naxai · RCS Lab</p>
          <div className="flex items-center gap-4">
            <a href="/" className="font-mono text-[11px] text-muted transition hover:text-body">
              ← Draft
            </a>
            <a href="/api-docs" className="font-mono text-[11px] text-accent hover:underline">
              API docs ↗
            </a>
          </div>
        </div>
        <h1 className="font-display mt-1 text-3xl font-bold tracking-tight text-heading sm:text-4xl">
          RCS API Playground
        </h1>
        <p className="mt-1 text-sm text-muted">
          Every score comes over HTTP from the scoring API — watch the requests in the console below.
        </p>
      </header>

      <div className="grid gap-8 lg:grid-cols-[minmax(330px,390px)_1fr]">
        <RcsInputPanel
          content={view}
          onContentChange={onContentChange}
          onMediaUrlFetched={onMediaUrlFetched}
          fetchMedia={(url) => introspectUrl(url, emit)}
          toggles={toggles}
        />

        <div className="flex flex-col gap-8">
          <div className="overflow-hidden rounded-2xl border border-line bg-[radial-gradient(ellipse_at_top,rgba(56,130,246,0.08),transparent_60%)]">
            <PreviewToolbar
              orientation={view.orientation}
              height={view.height}
              onOrientationChange={(orientation) => onContentChange({ orientation })}
              onHeightChange={(height) => onContentChange({ height })}
              toggles={toggles}
              onTogglesChange={setToggles}
            />
            <div className="flex flex-wrap items-start justify-center gap-8 p-6 pb-2">
              <PlatformPreview platform="ios" caption="iOS">
                <RcsCardPreview content={view} platform="ios" toggles={toggles} />
              </PlatformPreview>
              <PlatformPreview platform="android" caption="Android">
                <RcsCardPreview content={view} platform="android" toggles={toggles} />
              </PlatformPreview>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            {result ? (
              <>
                <FunctionalBanner result={result.functional} />
                <ScorePanel score={result.quality} />
              </>
            ) : (
              <div className="rounded-xl border border-line bg-panel px-4 py-3 text-sm text-muted">
                {scoring ? "Scoring via POST /api/analyze…" : "API error — see the console below."}
              </div>
            )}
            <button
              type="button"
              onClick={runImprover}
              disabled={improving}
              className="self-start rounded-lg border border-line bg-panel px-3 py-1.5 text-xs font-medium text-body transition hover:border-line-strong disabled:opacity-50"
            >
              {improving ? "Improving…" : "Run improver (POST /api/improve)"}
            </button>
          </div>
        </div>
      </div>

      <div className="mt-8">
        <ApiConsole entries={entries} onClear={() => setEntries([])} />
      </div>
    </main>
  );
}
